import { requireOptionalNativeModule } from 'expo';
import {
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  restorePurchases,
  type Purchase,
} from 'expo-iap';
import { Platform } from 'react-native';
import { noStoreSource, type EntitlementSource } from './entitlement-source';
import { createStoreSource, toStoreError, type StoreApi } from './store-source';

/** expo-iap (OpenIAP: StoreKit 2 on iOS, Play Billing on Android) behind the `StoreApi`. */
const expoIapStore: StoreApi<Purchase> = {
  connect: async () => {
    if (!(await initConnection())) throw new Error('The store connection failed.');
  },
  getPurchases: () => getAvailablePurchases({ onlyIncludeActiveItemsIOS: true }),
  hasProduct: async (productId) => {
    const products = await fetchProducts({ skus: [productId], type: 'in-app' });
    return (products ?? []).some((product) => product.id === productId);
  },
  requestPurchase: async (productId) => {
    await requestPurchase({
      request: { apple: { sku: productId }, google: { skus: [productId] } },
      type: 'in-app',
    });
  },
  finish: async (purchase) => {
    await finishTransaction({ purchase, isConsumable: false });
  },
  restore: () => restorePurchases(),
  onPurchase: (listener) => {
    const subscription = purchaseUpdatedListener(listener);
    return () => subscription.remove();
  },
  onError: (listener) => {
    const subscription = purchaseErrorListener((error) => listener(toStoreError(error)));
    return () => subscription.remove();
  },
};

/**
 * The app's PRO source: the stores in a development or release build, `noStoreSource` where the
 * native module is missing (Expo Go, web). Create it once: it keeps the store listeners.
 */
export function createEntitlementSource(): EntitlementSource {
  const native =
    (Platform.OS === 'ios' || Platform.OS === 'android') &&
    requireOptionalNativeModule('ExpoIap') !== null;
  return native ? createStoreSource(expoIapStore) : noStoreSource;
}
