import { afterEach, describe, expect, it, vi } from 'vitest';
import { PurchasePendingError } from './entitlement-source';
import {
  createStoreSource,
  planFromPurchases,
  PRO_PRODUCT_ID,
  STORE_LOAD_TIMEOUT_MS,
  toStoreError,
  type StoreApi,
  type StoreError,
  type StorePurchase,
} from './store-source';

const pro = (overrides: Partial<StorePurchase> = {}): StorePurchase => ({
  productId: PRO_PRODUCT_ID,
  purchaseState: 'purchased',
  ...overrides,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/** A store whose events the test fires by hand. */
function fakeStore(purchases: StorePurchase[] = []) {
  let purchaseListener: ((purchase: StorePurchase) => void) | null = null;
  let errorListener: ((error: StoreError) => void) | null = null;
  const api = {
    connect: vi.fn(() => Promise.resolve()),
    getPurchases: vi.fn((): Promise<readonly StorePurchase[]> => Promise.resolve(purchases)),
    hasProduct: vi.fn((productId: string) => Promise.resolve(productId === PRO_PRODUCT_ID)),
    requestPurchase: vi.fn((_productId: string) => Promise.resolve()),
    finish: vi.fn((_purchase: StorePurchase) => Promise.resolve()),
    restore: vi.fn(() => Promise.resolve()),
    onPurchase: vi.fn((listener: (purchase: StorePurchase) => void) => {
      purchaseListener = listener;
      return () => undefined;
    }),
    onError: vi.fn((listener: (error: StoreError) => void) => {
      errorListener = listener;
      return () => undefined;
    }),
  } satisfies StoreApi;
  return {
    api,
    emitPurchase: (purchase: StorePurchase) => purchaseListener?.(purchase),
    emitError: (code: string, message = code) => errorListener?.({ code, message }),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('store entitlement (RNF08)', () => {
  it('grants PRO only for a completed purchase of the PRO product', () => {
    expect(planFromPurchases([])).toBe('free');
    expect(planFromPurchases([pro()])).toBe('pro');
    expect(planFromPurchases([pro({ purchaseState: 'pending' })])).toBe('free');
    expect(planFromPurchases([pro({ productId: 'other' })])).toBe('free');
  });

  it('reads the OpenIAP code of a rejected store call', () => {
    expect(toStoreError({ code: 'user-cancelled', message: 'Cancelled' })).toEqual({
      code: 'user-cancelled',
      message: 'Cancelled',
    });
    expect(toStoreError(new Error('boom'))).toEqual({ code: 'unknown', message: 'boom' });
    expect(toStoreError('boom')).toEqual({ code: 'unknown', message: 'boom' });
  });

  it('loads the plan from the purchases kept on the device', async () => {
    const { api } = fakeStore([pro()]);
    const source = createStoreSource(api);
    expect(source.storeAvailable).toBe(true);
    await expect(source.load()).resolves.toBe('pro');
    await expect(source.load()).resolves.toBe('pro');
    expect(api.connect).toHaveBeenCalledTimes(1);
    expect(api.onPurchase).toHaveBeenCalledTimes(1);
    expect(api.finish).not.toHaveBeenCalled();
  });

  it('acknowledges an Android purchase left unacknowledged', async () => {
    const purchase = pro({ isAcknowledgedAndroid: false });
    const { api } = fakeStore([purchase, pro({ isAcknowledgedAndroid: true })]);
    await expect(createStoreSource(api).load()).resolves.toBe('pro');
    expect(api.finish).toHaveBeenCalledTimes(1);
    expect(api.finish).toHaveBeenCalledWith(purchase);
  });

  it('falls back to free when the store fails, and connects again next time', async () => {
    const { api } = fakeStore([pro()]);
    api.connect.mockRejectedValueOnce(new Error('billing unavailable'));
    const source = createStoreSource(api);
    await expect(source.load()).resolves.toBe('free');
    await expect(source.load()).resolves.toBe('pro');
    expect(api.connect).toHaveBeenCalledTimes(2);
  });

  it('answers free when the store is slow and reports the late plan', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { api } = fakeStore();
    const late = deferred<readonly StorePurchase[]>();
    api.getPurchases.mockReturnValueOnce(late.promise);
    const source = createStoreSource(api);
    const listener = vi.fn();
    source.subscribe?.(listener);

    const loading = source.load();
    await vi.advanceTimersByTimeAsync(STORE_LOAD_TIMEOUT_MS);
    await expect(loading).resolves.toBe('free');

    late.resolve([pro()]);
    await vi.waitFor(() => expect(listener).toHaveBeenCalledWith('pro'));
  });

  it('buys PRO and finishes the transaction', async () => {
    const store = fakeStore();
    store.api.requestPurchase.mockImplementation(async () => {
      store.emitPurchase(pro());
    });
    const source = createStoreSource(store.api);
    const listener = vi.fn();
    source.subscribe?.(listener);
    await source.load();

    await expect(source.purchase()).resolves.toBe('pro');
    expect(store.api.requestPurchase).toHaveBeenCalledWith(PRO_PRODUCT_ID);
    expect(store.api.finish).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('pro');
  });

  it('keeps the plan when the purchase is cancelled', async () => {
    const store = fakeStore();
    store.api.requestPurchase.mockImplementation(async () => {
      store.emitError('user-cancelled');
    });
    await expect(createStoreSource(store.api).purchase()).resolves.toBe('free');
  });

  it('handles a cancellation reported as a rejected request', async () => {
    const store = fakeStore();
    store.api.requestPurchase.mockRejectedValue({ code: 'user-cancelled', message: 'Cancelled' });
    await expect(createStoreSource(store.api).purchase()).resolves.toBe('free');
  });

  it('reports a pending payment and unlocks PRO when it completes', async () => {
    const store = fakeStore();
    store.api.requestPurchase.mockImplementation(async () => {
      store.emitPurchase(pro({ purchaseState: 'pending' }));
    });
    const source = createStoreSource(store.api);
    const listener = vi.fn();
    source.subscribe?.(listener);

    await expect(source.purchase()).rejects.toBeInstanceOf(PurchasePendingError);
    expect(store.api.finish).not.toHaveBeenCalled();

    store.emitPurchase(pro());
    expect(listener).toHaveBeenCalledWith('pro');
    expect(store.api.finish).toHaveBeenCalledTimes(1);
  });

  it('treats a deferred payment (Ask to Buy) as pending', async () => {
    const store = fakeStore();
    store.api.requestPurchase.mockImplementation(async () => {
      store.emitError('deferred-payment');
    });
    await expect(createStoreSource(store.api).purchase()).rejects.toBeInstanceOf(
      PurchasePendingError,
    );
  });

  it('restores the plan when the store says PRO is already owned', async () => {
    const store = fakeStore();
    store.api.requestPurchase.mockImplementation(async () => {
      store.api.getPurchases.mockResolvedValue([pro()]);
      store.emitError('already-owned');
    });
    await expect(createStoreSource(store.api).purchase()).resolves.toBe('pro');
  });

  it('rejects with the store message on other errors', async () => {
    const store = fakeStore();
    store.api.requestPurchase.mockImplementation(async () => {
      store.emitError('network-error', 'No connection');
    });
    await expect(createStoreSource(store.api).purchase()).rejects.toThrow('No connection');
  });

  it('refuses to buy a product the store does not sell', async () => {
    const store = fakeStore();
    store.api.hasProduct.mockResolvedValue(false);
    const source = createStoreSource(store.api);
    await expect(source.purchase()).rejects.toThrow(PRO_PRODUCT_ID);
    expect(store.api.requestPurchase).not.toHaveBeenCalled();
  });

  it('runs one purchase flow at a time', async () => {
    const store = fakeStore();
    const source = createStoreSource(store.api);
    const first = source.purchase();
    const second = source.purchase();
    expect(second).toBe(first);
    await vi.waitFor(() => expect(store.api.requestPurchase).toHaveBeenCalledTimes(1));
    store.emitPurchase(pro());
    await expect(first).resolves.toBe('pro');
  });

  it('ignores other products and errors outside a purchase flow', async () => {
    const store = fakeStore();
    const source = createStoreSource(store.api);
    const listener = vi.fn();
    source.subscribe?.(listener);
    await source.load();
    store.emitPurchase(pro({ productId: 'other' }));
    store.emitError('network-error');
    expect(listener).not.toHaveBeenCalled();
    expect(store.api.finish).not.toHaveBeenCalled();
  });

  it('restores from the store account, then reads the device cache', async () => {
    const store = fakeStore();
    store.api.restore.mockImplementation(async () => {
      store.api.getPurchases.mockResolvedValue([pro()]);
    });
    const source = createStoreSource(store.api);
    await expect(source.load()).resolves.toBe('free');
    await expect(source.restore()).resolves.toBe('pro');
    expect(store.api.restore).toHaveBeenCalledTimes(1);
  });

  it('drops back to free when a refunded purchase disappears', async () => {
    const store = fakeStore([pro()]);
    const source = createStoreSource(store.api);
    const listener = vi.fn();
    source.subscribe?.(listener);
    await expect(source.load()).resolves.toBe('pro');
    store.api.getPurchases.mockResolvedValue([]);
    await expect(source.restore()).resolves.toBe('free');
    expect(listener.mock.calls).toEqual([['pro'], ['free']]);
  });
});
