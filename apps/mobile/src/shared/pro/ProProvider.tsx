import { router } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { noStoreSource, type EntitlementSource } from './entitlement-source';
import { isFeatureEnabled, type FeatureKey, type Plan } from './features';

interface ProValue {
  /** The plan in effect (the simulated one in development). */
  readonly plan: Plan;
  readonly storeAvailable: boolean;
  readonly purchase: () => Promise<void>;
  readonly restore: () => Promise<void>;
  /** Development builds only: the simulated plan (null = the store's). */
  readonly simulated: Plan | null;
  readonly simulate: ((plan: Plan | null) => void) | null;
}

const ProContext = createContext<ProValue | null>(null);

/**
 * Loads the user's plan once (from the store's offline cache) and renders children after it, so
 * gated screens never flash the wrong state. A failing source means the free plan. Later changes
 * the store reports (a pending payment that completes, a purchase replayed at launch) arrive
 * through `source.subscribe`. The source must be stable: create it once, outside render.
 */
export function ProProvider({
  children,
  source = noStoreSource,
}: {
  children: ReactNode;
  source?: EntitlementSource;
}) {
  const [stored, setStored] = useState<Plan | null>(null);
  const [simulated, setSimulated] = useState<Plan | null>(null);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = source.subscribe?.((plan) => setStored(plan));
    source
      .load()
      .catch((): Plan => 'free')
      .then((plan) => {
        if (!cancelled) setStored(plan);
      });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [source]);

  const purchase = useCallback(async () => setStored(await source.purchase()), [source]);
  const restore = useCallback(async () => setStored(await source.restore()), [source]);

  const value = useMemo<ProValue | null>(
    () =>
      stored === null
        ? null
        : {
            plan: simulated ?? stored,
            storeAvailable: source.storeAvailable,
            purchase,
            restore,
            simulated,
            simulate: __DEV__ ? setSimulated : null,
          },
    [stored, simulated, source.storeAvailable, purchase, restore],
  );
  if (!value) return null;
  return <ProContext.Provider value={value}>{children}</ProContext.Provider>;
}

function usePlanContext(): ProValue {
  const value = useContext(ProContext);
  if (!value) throw new Error('PRO hooks must be used inside <ProProvider>');
  return value;
}

/** Whether a feature is unlocked for the user (RNF08). */
export function useFeature(feature: FeatureKey): boolean {
  return isFeatureEnabled(feature, usePlanContext().plan);
}

/** Opens the PRO screen (paywall). */
export function openPro(): void {
  router.push('/pro');
}

/**
 * Guards an action behind a feature: `requirePro('checklist.shiny', () => mark())` runs it when
 * unlocked and opens the PRO screen otherwise.
 */
export function useRequirePro(): (feature: FeatureKey, action: () => void) => void {
  const { plan } = usePlanContext();
  return useCallback(
    (feature, action) => {
      if (isFeatureEnabled(feature, plan)) action();
      else openPro();
    },
    [plan],
  );
}

/** Plan, purchase and restore — for the PRO screen only; everything else asks for features. */
export function usePro(): ProValue {
  return usePlanContext();
}
