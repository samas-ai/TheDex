import { useSyncExternalStore } from 'react';

let version = 0;
const listeners = new Set<() => void>();

/**
 * Called after user data changed behind the screens' backs (a backup restore, later a sync):
 * settings, teams and checklist readers reload.
 */
export function notifyUserDataReplaced(): void {
  version++;
  for (const listener of listeners) listener();
}

export function subscribeUserData(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Changes after every restore: add it to the deps of loaders that read user data. */
export function useUserDataVersion(): number {
  return useSyncExternalStore(subscribeUserData, () => version);
}
