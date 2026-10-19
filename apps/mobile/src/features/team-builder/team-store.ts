import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { deleteTeam, getTeam, saveTeam, type AnySQLiteDatabase, type Team } from '@thedex/db';
import { useAppDatabase } from '../../shared/db/DatabaseProvider';

/**
 * In-memory copy of the teams being edited, shared by the team, slot and list screens so they
 * never show stale data. Every change is written through to thedex-user.db at once (the team is
 * the unit of sync: one `updated_at` per change).
 */
class TeamStore {
  private readonly teams = new Map<string, Team | null>();
  private readonly listeners = new Set<() => void>();
  /** Bumped on every save/delete: lists reload when it changes. */
  version = 0;

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private emit() {
    this.version++;
    for (const listener of this.listeners) listener();
  }

  /** Undefined until loaded; null when the team does not exist (or was deleted). */
  get(id: string): Team | null | undefined {
    return this.teams.get(id);
  }

  async load(db: AnySQLiteDatabase, id: string): Promise<void> {
    if (this.teams.has(id)) return;
    const team = await getTeam(db, id);
    this.teams.set(id, team);
    this.emit();
  }

  async save(db: AnySQLiteDatabase, team: Team): Promise<void> {
    const updatedAt = Date.now();
    this.teams.set(team.id, { ...team, updatedAt });
    this.emit();
    await saveTeam(db, team, updatedAt);
  }

  async remove(db: AnySQLiteDatabase, id: string): Promise<void> {
    this.teams.set(id, null);
    this.emit();
    await deleteTeam(db, id, Date.now());
  }
}

export const teamStore = new TeamStore();

/** Changes whenever a team is saved or deleted (for list screens). */
export function useTeamsVersion(): number {
  return useSyncExternalStore(teamStore.subscribe, () => teamStore.version);
}

/** One team, kept in sync across screens; `update` saves the new version. */
export function useTeam(id: string) {
  const { db } = useAppDatabase();
  const team = useSyncExternalStore(teamStore.subscribe, () => teamStore.get(id));
  useEffect(() => {
    void teamStore.load(db, id);
  }, [db, id]);
  const update = useCallback(
    (change: (team: Team) => Team) => {
      const current = teamStore.get(id);
      if (current) void teamStore.save(db, change(current));
    },
    [db, id],
  );
  const remove = useCallback(() => teamStore.remove(db, id), [db, id]);
  return { team, update, remove };
}
