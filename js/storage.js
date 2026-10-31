import { createState, validateState, parseImport, now } from './core.js';
export const STORAGE_KEY = 'filament-shelf:v1';
export const RECOVERY_KEY = 'filament-shelf:before-import:v1';
export class LocalStorageRepository {
  constructor(storage, locks = null) { this.storage = storage; this.locks = locks; this.raw = undefined; }
  async locked(fn) { return this.locks ? this.locks.request(STORAGE_KEY, fn) : fn(); }
  async load(seedFactory) {
    return this.locked(() => {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (raw !== null) {
        const state = parseImport(raw); this.raw = raw; return state;
      }
      const state = validateState(createState(seedFactory()));
      const serialized = JSON.stringify(state);
      this.storage.setItem(STORAGE_KEY, serialized);
      this.raw = serialized;
      return state;
    });
  }
  async save(state, { backup = false } = {}) {
    return this.locked(() => {
      const current = this.storage.getItem(STORAGE_KEY);
      if (current !== this.raw) throw new Error('Der Bestand wurde in einem anderen Tab geändert. Bitte neu laden, bevor du speicherst.');
      const clean = validateState({ ...state, revision: state.revision + 1, updatedAt: now() });
      const serialized = JSON.stringify(clean);
      // Keep successful writes readable by the same 5 MB import validator.
      parseImport(serialized);
      if (backup && current !== null) this.storage.setItem(RECOVERY_KEY, current);
      // setItem is atomic. UI only adopts clean after this succeeds.
      this.storage.setItem(STORAGE_KEY, serialized);
      this.raw = serialized;
      return clean;
    });
  }
  async recover(incoming, expectedRaw) {
    return this.locked(() => {
      const current = this.storage.getItem(STORAGE_KEY);
      if (current !== expectedRaw) throw new Error('Die Daten haben sich geändert. Bitte neu laden.');
      if (current !== null) {
        let valid = false;
        try { parseImport(current); valid = true; } catch { /* Explicit repair only. */ }
        if (valid) throw new Error('Ein gültiger Bestand ist vorhanden. Bitte neu laden.');
      }
      const clean = validateState({ ...incoming, revision: incoming.revision + 1, updatedAt: now() });
      const serialized = JSON.stringify(clean);
      parseImport(serialized);
      if (current !== null) this.storage.setItem('filament-shelf:damaged-original:v1', current);
      this.storage.setItem(STORAGE_KEY, serialized);
      this.raw = serialized;
      return clean;
    });
  }
  recovery() { const raw = this.storage.getItem(RECOVERY_KEY); return raw === null ? null : parseImport(raw); }
  rawExport() { return this.storage.getItem(STORAGE_KEY); }
}
