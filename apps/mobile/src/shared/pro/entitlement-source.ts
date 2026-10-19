import type { Plan } from './features';

/**
 * Where the PRO purchase lives (RNF08): the App Store / Play Store, through an in-app purchase
 * library. The app is offline-first, so `load` must answer from the store's local cache (StoreKit
 * and Play Billing keep purchases on the device) and never wait for the network.
 */
export interface EntitlementSource {
  /** False until a store is integrated: the PRO screen then explains purchases are not open yet. */
  readonly storeAvailable: boolean;
  load(): Promise<Plan>;
  /** Starts the purchase flow; resolves with the plan after it (unchanged when cancelled). */
  purchase(): Promise<Plan>;
  /** Restores a purchase made on another device or before a reinstall. */
  restore(): Promise<Plan>;
}

/** No store yet: everyone is on the free plan. */
export const noStoreSource: EntitlementSource = {
  storeAvailable: false,
  load: () => Promise.resolve('free'),
  purchase: () => Promise.resolve('free'),
  restore: () => Promise.resolve('free'),
};
