import { getLocales } from 'expo-localization';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { readSettings, writeSetting } from '@thedex/db';
import { useAppDatabase } from '../db/DatabaseProvider';
import { decodeSettings, SETTING_KEY_OF, type AppSettings } from './settings';

interface SettingsValue {
  readonly settings: AppSettings;
  /** Device language tag (expo-localization), for `system` resolution. */
  readonly deviceLanguage: string | null;
  /** Persists the changed keys in thedex-user.db `settings` (optimistic). */
  readonly updateSettings: (patch: Partial<AppSettings>) => void;
}

const SettingsContext = createContext<SettingsValue | null>(null);

/** Loads settings from the user DB once; children render after the first load. */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const { db } = useAppDatabase();
  const deviceLanguage = getLocales()[0]?.languageTag ?? null;
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readSettings(db)
      .then((raw) => {
        if (!cancelled) setSettings(decodeSettings(raw, deviceLanguage));
      })
      .catch(() => {
        if (!cancelled) setSettings(decodeSettings({}, deviceLanguage));
      });
    return () => {
      cancelled = true;
    };
  }, [db, deviceLanguage]);

  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      setSettings((current) => (current ? { ...current, ...patch } : current));
      const now = Date.now();
      for (const [field, value] of Object.entries(patch) as [keyof AppSettings, unknown][]) {
        void writeSetting(db, SETTING_KEY_OF[field], value, now);
      }
    },
    [db],
  );

  const value = useMemo(
    () => (settings ? { settings, deviceLanguage, updateSettings } : null),
    [settings, deviceLanguage, updateSettings],
  );
  if (!value) return null;
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings must be used inside <SettingsProvider>');
  return value;
}
