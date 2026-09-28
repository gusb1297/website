/**
 * System control — the operator switches of the /hackeradmin console.
 * ---------------------------------------------------------------------------
 * The console can, at runtime and without a redeploy:
 *
 *   • switch the database OFF / ON      (databaseEnabled)
 *       off → the MongoDB connection is dropped, the public site keeps serving
 *             the in-memory snapshot, and every write is refused with a clear
 *             message instead of being silently lost. Nothing is deleted.
 *   • freeze the public site            (maintenanceMode)
 *       on  → anonymous writes (job applications, CV uploads) and edits from the
 *             ordinary /admin panel are refused; the hackeradmin console keeps
 *             full access. The public pages themselves stay up.
 *
 * The switches live in the `systemcontrol` singleton document so they survive a
 * restart, and are mirrored in module state so they apply instantly — even while
 * MongoDB itself is switched off.
 */
import { contentCollection, type ContentDoc } from '../config/contentDb';
import {
  databaseDisabledAt,
  disableDatabase,
  enableDatabase,
  isDatabaseOperatorDisabled,
  isDatabaseReady,
  isMongoConfigured,
} from '../config/mongo';

export const SYSTEM_CONTROL_COLLECTION = 'systemcontrol';
const SINGLETON_ID = 'system';

export interface SystemControlState {
  /** Operator master switch for MongoDB. */
  databaseEnabled: boolean;
  /** Freeze anonymous/public writes (the console keeps working). */
  maintenanceMode: boolean;
  /** Free-text note the operator can attach to the current state. */
  note: string;
  updatedAt: string | null;
  updatedBy: string | null;
  /** Where the current values come from. */
  source: 'mongodb' | 'default' | 'memory';
  /** False while the change could not be stored in MongoDB. */
  persisted: boolean;
  /** ISO timestamp of the moment the database was switched off. */
  databaseDisabledAt: string | null;
}

const state: SystemControlState = {
  databaseEnabled: true,
  maintenanceMode: false,
  note: '',
  updatedAt: null,
  updatedBy: null,
  source: 'default',
  persisted: true,
  databaseDisabledAt: null,
};

function snapshot(): SystemControlState {
  return { ...state, databaseDisabledAt: databaseDisabledAt() };
}

export function getSystemControlState(): SystemControlState {
  return snapshot();
}

/** True when the operator switched MongoDB off. */
export function isDatabaseEnabledByOperator(): boolean {
  return !isDatabaseOperatorDisabled();
}

/** True when public writes are frozen. */
export function isMaintenanceMode(): boolean {
  return state.maintenanceMode;
}

function applyDatabaseSwitch(enabled: boolean): void {
  state.databaseEnabled = enabled;
  state.databaseDisabledAt = enabled ? null : databaseDisabledAt();
}

async function persist(): Promise<boolean> {
  if (!isDatabaseReady()) {
    state.persisted = false;
    return false;
  }
  try {
    const doc: ContentDoc = {
      id: SINGLETON_ID,
      databaseEnabled: state.databaseEnabled,
      maintenanceMode: state.maintenanceMode,
      note: state.note,
      updatedAt: state.updatedAt,
      updatedBy: state.updatedBy,
    };
    await contentCollection(SYSTEM_CONTROL_COLLECTION).updateOne({ id: SINGLETON_ID }, { $set: doc }, { upsert: true });
    state.persisted = true;
    state.source = 'mongodb';
    return true;
  } catch (err) {
    console.warn('[system] Could not persist the control state:', (err as Error).message);
    state.persisted = false;
    return false;
  }
}

/**
 * Read the stored switches at boot and apply them.
 *
 * Called after the first successful MongoDB connection. When the stored value
 * says "database off", the connection this read just used is dropped again —
 * that is the point of the switch.
 */
export async function loadSystemControl(): Promise<SystemControlState> {
  if (!isMongoConfigured()) {
    state.source = 'default';
    return snapshot();
  }
  try {
    const docs = await contentCollection(SYSTEM_CONTROL_COLLECTION).find({ id: SINGLETON_ID }, { limit: 1 });
    const stored = docs[0] as Partial<SystemControlState> | undefined;
    if (stored) {
      state.maintenanceMode = Boolean(stored.maintenanceMode);
      state.note = typeof stored.note === 'string' ? stored.note : '';
      state.updatedAt = typeof stored.updatedAt === 'string' ? stored.updatedAt : null;
      state.updatedBy = typeof stored.updatedBy === 'string' ? stored.updatedBy : null;
      state.source = 'mongodb';
      state.persisted = true;
      const enabled = stored.databaseEnabled !== false;
      applyDatabaseSwitch(enabled);
      if (!enabled) {
        // The operator left the database switched off: honour it.
        await disableDatabase();
      } else {
        state.databaseEnabled = true;
      }
      console.log(
        `[system] Control state loaded — database ${state.databaseEnabled ? 'ON' : 'OFF'}, maintenance ${
          state.maintenanceMode ? 'ON' : 'OFF'
        }.`
      );
    }
  } catch (err) {
    console.warn('[system] Could not read the control state:', (err as Error).message);
  }
  return snapshot();
}

/** Switch MongoDB on/off and remember the choice. */
export async function setDatabaseEnabled(enabled: boolean, actor: string): Promise<SystemControlState> {
  state.updatedAt = new Date().toISOString();
  state.updatedBy = actor;

  if (enabled) {
    // Write the decision first (while the flag is still off the write would be
    // skipped), then reconnect.
    const ok = await enableDatabase(); // clears the switch + reconnects
    applyDatabaseSwitch(true);
    state.persisted = await persist();
    if (!ok) {
      console.warn('[system] Database switched ON, but it is not reachable yet — retrying in the background.');
    }
  } else {
    applyDatabaseSwitch(false);
    await disableDatabase();
    state.persisted = false; // nothing can be written while it is off
  }

  state.note = enabled ? '' : state.note;
  return snapshot();
}

/** Freeze / unfreeze public writes. */
export async function setMaintenanceMode(enabled: boolean, actor: string, note = ''): Promise<SystemControlState> {
  state.maintenanceMode = enabled;
  state.note = note || '';
  state.updatedAt = new Date().toISOString();
  state.updatedBy = actor;
  await persist();
  return snapshot();
}

/**
 * Push the in-memory decisions back into MongoDB. Called after the database is
 * switched back on so a change made while it was off is not forgotten.
 */
export async function syncSystemControl(): Promise<boolean> {
  if (!state.updatedAt) return true;
  return persist();
}
