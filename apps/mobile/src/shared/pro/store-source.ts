import { PurchasePendingError, type EntitlementSource } from './entitlement-source';
import type { Plan } from './features';

/** TheDex PRO in the stores: one non-consumable ("PRO forever"), same id on both. */
export const PRO_PRODUCT_ID = 'thedex_pro';

/**
 * How long `load` waits for the store's local cache before answering with the plan it knows.
 * StoreKit and Play Billing answer in milliseconds; this only covers a stuck billing service, and
 * the late answer still reaches `subscribe`.
 */
export const STORE_LOAD_TIMEOUT_MS = 3000;

/** The part of a store purchase the entitlement reads (expo-iap's `Purchase` has it). */
export interface StorePurchase {
  readonly productId: string;
  readonly purchaseState: 'pending' | 'purchased' | 'unknown';
  /** Android: false until acknowledged; Google refunds what stays unacknowledged for 3 days. */
  readonly isAcknowledgedAndroid?: boolean | null;
}

/** A failed purchase flow, with the OpenIAP error code (`user-cancelled`, `already-owned`…). */
export interface StoreError {
  readonly code: string;
  readonly message: string;
}

/** The store calls the entitlement needs. `expo-iap-store.ts` binds them to expo-iap. */
export interface StoreApi<P extends StorePurchase = StorePurchase> {
  /** Opens the billing connection (local: StoreKit, or the Play Store app's service). */
  connect(): Promise<void>;
  /** Purchases kept on the device (StoreKit current entitlements, Play Store cache). */
  getPurchases(): Promise<readonly P[]>;
  /** Whether the store sells the product (needs the network). */
  hasProduct(productId: string): Promise<boolean>;
  /** Opens the purchase sheet; the outcome arrives through `onPurchase` / `onError`. */
  requestPurchase(productId: string): Promise<void>;
  /** Finishes (iOS) or acknowledges (Android) a non-consumable purchase. */
  finish(purchase: P): Promise<void>;
  /** Syncs purchases from the store account (iOS `AppStore.sync`: network, may ask to sign in). */
  restore(): Promise<void>;
  onPurchase(listener: (purchase: P) => void): () => void;
  onError(listener: (error: StoreError) => void): () => void;
}

const CANCELLED = 'user-cancelled';
const ALREADY_OWNED = 'already-owned';
const PENDING = new Set(['pending', 'deferred-payment']);

export function isProPurchase(purchase: StorePurchase, productId = PRO_PRODUCT_ID): boolean {
  return purchase.productId === productId && purchase.purchaseState === 'purchased';
}

export function planFromPurchases(
  purchases: readonly StorePurchase[],
  productId = PRO_PRODUCT_ID,
): Plan {
  return purchases.some((purchase) => isProPurchase(purchase, productId)) ? 'pro' : 'free';
}

/** Reads the OpenIAP code of a rejected store call. */
export function toStoreError(error: unknown): StoreError {
  const { code, message } = (typeof error === 'object' && error !== null ? error : {}) as {
    code?: unknown;
    message?: unknown;
  };
  return {
    code: typeof code === 'string' ? code : 'unknown',
    message: typeof message === 'string' ? message : String(error),
  };
}

/** Settles like `promise`, or rejects after `ms` (the promise keeps running). */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`No answer from the store in ${ms} ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

interface PurchaseFlow {
  readonly resolve: (plan: Plan) => void;
  readonly reject: (error: unknown) => void;
}

/**
 * The PRO entitlement from a store (RNF08). Without a server, the store's on-device record is the
 * truth: StoreKit 2 only returns transactions it verified, and Play Billing reads the Play Store
 * app's cache. A refund removes the purchase from both, so `load` drops back to free.
 *
 * Meant as an app-wide singleton: the store listeners stay registered for the app's lifetime.
 */
export function createStoreSource<P extends StorePurchase>(
  api: StoreApi<P>,
  { productId = PRO_PRODUCT_ID, loadTimeoutMs = STORE_LOAD_TIMEOUT_MS } = {},
): EntitlementSource {
  let plan: Plan = 'free';
  const listeners = new Set<(plan: Plan) => void>();
  let listening = false;
  let connection: Promise<void> | null = null;
  let flow: PurchaseFlow | null = null;
  let purchasing: Promise<Plan> | null = null;

  const setPlan = (next: Plan) => {
    if (next === plan) return;
    plan = next;
    for (const listener of listeners) listener(next);
  };

  const endFlow = (end: (flow: PurchaseFlow) => void) => {
    const current = flow;
    flow = null;
    if (current) end(current);
  };

  // A failed finish is not fatal: StoreKit replays the transaction at the next launch and
  // `refresh` acknowledges it on Android.
  const finish = (purchase: P) => {
    api.finish(purchase).catch(() => undefined);
  };

  const onPurchase = (purchase: P) => {
    if (purchase.productId !== productId) return;
    if (purchase.purchaseState === 'purchased') {
      finish(purchase);
      setPlan('pro');
      endFlow((current) => current.resolve('pro'));
    } else if (purchase.purchaseState === 'pending') {
      endFlow((current) => current.reject(new PurchasePendingError()));
    }
  };

  const onError = (error: StoreError) => {
    if (error.code === CANCELLED) endFlow((current) => current.resolve(plan));
    else if (error.code === ALREADY_OWNED)
      endFlow((current) => void refresh().then(current.resolve, current.reject));
    else if (PENDING.has(error.code))
      endFlow((current) => current.reject(new PurchasePendingError()));
    else endFlow((current) => current.reject(new Error(error.message)));
  };

  const connect = (): Promise<void> => {
    if (!listening) {
      // Before connecting: StoreKit replays unfinished transactions as soon as it opens.
      listening = true;
      api.onPurchase(onPurchase);
      api.onError(onError);
    }
    connection ??= api.connect().catch((error: unknown) => {
      connection = null; // the next call tries again
      throw error;
    });
    return connection;
  };

  const refresh = async (): Promise<Plan> => {
    await connect();
    const purchases = await api.getPurchases();
    for (const purchase of purchases) {
      if (isProPurchase(purchase, productId) && purchase.isAcknowledgedAndroid === false) {
        finish(purchase);
      }
    }
    setPlan(planFromPurchases(purchases, productId));
    return plan;
  };

  const startPurchase = async (): Promise<Plan> => {
    await connect();
    if (!(await api.hasProduct(productId))) {
      throw new Error(`The store does not sell "${productId}" yet.`);
    }
    const outcome = new Promise<Plan>((resolve, reject) => {
      flow = { resolve, reject };
    });
    api.requestPurchase(productId).catch((error: unknown) => onError(toStoreError(error)));
    return outcome;
  };

  return {
    storeAvailable: true,
    // A store that fails or does not answer in time leaves the plan as it is (free at launch).
    load: () => withTimeout(refresh(), loadTimeoutMs).catch(() => plan),
    purchase: () => {
      purchasing ??= startPurchase().finally(() => {
        purchasing = null;
      });
      return purchasing;
    },
    restore: async () => {
      await connect();
      await api.restore();
      return refresh();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
