import type { Plan } from './features';

/**
 * Where the PRO purchase lives (RNF08): the App Store / Play Store, through an in-app purchase
 * library. The app is offline-first, so `load` must answer from the store's local cache (StoreKit
 * and Play Billing keep purchases on the device) and never wait for the network.
 */
export interface EntitlementSource {
  /** False when no store is reachable (Expo Go, web): the PRO screen explains it. */
  readonly storeAvailable: boolean;
  load(): Promise<Plan>;
  /**
   * Starts the purchase flow; resolves with the plan after it (unchanged when cancelled). Rejects
   * with `PurchasePendingError` when the store accepted the order but the payment is not done yet.
   */
  purchase(): Promise<Plan>;
  /** Restores a purchase made on another device or before a reinstall. */
  restore(): Promise<Plan>;
  /**
   * Plan changes the store reports on its own: a pending payment that completes, a purchase
   * replayed at launch, or a `load` that answered late. Returns the unsubscribe function.
   */
  subscribe?(listener: (plan: Plan) => void): () => void;
}

/** The store took the order but the payment is pending (Ask to Buy, cash, slow card). */
export class PurchasePendingError extends Error {
  constructor() {
    super('The purchase is pending: PRO unlocks once the store confirms the payment.');
    this.name = 'PurchasePendingError';
  }
}

/** No store in this runtime (Expo Go, web): everyone is on the free plan. */
export const noStoreSource: EntitlementSource = {
  storeAvailable: false,
  load: () => Promise.resolve('free'),
  purchase: () => Promise.resolve('free'),
  restore: () => Promise.resolve('free'),
};
