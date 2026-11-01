import { validateState, parseImport, now } from './core.js';

// One atomic snapshot is sufficient for a personal shelf. Keep comfortably below
// Firestore's 1 MiB document limit, including field names and metadata.
export const MAX_CLOUD_BYTES = 900000;
export function encodeCloud(state) {
  const clean = validateState(state);
  const payload = JSON.stringify(clean);
  if (new TextEncoder().encode(payload).length > MAX_CLOUD_BYTES) {
    throw new Error('Dieser Bestand ist für die Cloud zu groß (max. 900 KB). Bitte zuerst ein JSON-Backup exportieren.');
  }
  return { format: 1, revision: clean.revision, payload };
}
export function decodeCloud(document) {
  if (!document || document.format !== 1 || typeof document.payload !== 'string') throw new Error('Ungültiger Cloud-Bestand. Es wird nichts überschrieben.');
  const clean = parseImport(document.payload);
  encodeCloud(clean);
  if (clean.revision !== document.revision) throw new Error('Ungültige Cloud-Datenversion.');
  return clean;
}
export const CONFLICT_MESSAGE = 'Der Cloud-Bestand wurde auf einem anderen Gerät geändert. Bitte den aktuellen Stand laden und die Änderung erneut eingeben.';

// The transport contains only read(), transact(callback), and watch(callback,error).
// Firebase and authentication stay outside the inventory logic and its tests.
export class CloudRepository {
  constructor(transport, storage, uid) {
    this.transport = transport; this.storage = storage;
    this.key = `filament-shelf:cloud:${uid}`;
    this.raw = undefined; this.cacheWarning = false;
  }
  adopt(state) {
    const clean = validateState(state);
    this.raw = JSON.stringify(clean);
    try { this.storage.setItem(this.key, this.raw); this.cacheWarning = false; }
    catch { this.cacheWarning = true; } // The server remains authoritative.
    return clean;
  }
  async load() {
    const data = await this.transport.read(); // server only; never seeds or trusts cache
    if (data === null) { this.raw = null; return null; }
    return this.adopt(decodeCloud(data));
  }
  async initialize(localState) {
    const clean = validateState({ ...localState, revision: 0, updatedAt: now() });
    const document = encodeCloud(clean);
    await this.transport.transact(current => {
      if (current !== null) throw new Error('Ein Cloud-Bestand ist bereits vorhanden. Bitte neu laden.');
      return document;
    });
    return this.adopt(clean);
  }
  async save(state, { backup = false } = {}) {
    const expected = this.raw;
    if (typeof expected !== 'string') throw new Error('Bitte zuerst den Cloud-Bestand laden.');
    const before = parseImport(expected);
    if (state.revision !== before.revision) throw new Error(CONFLICT_MESSAGE);
    const clean = validateState({ ...state, revision: before.revision + 1, updatedAt: now() });
    const document = encodeCloud(clean);
    if (backup) this.storage.setItem(`${this.key}:before-import`, expected);
    await this.transport.transact(current => {
      if (current === null || JSON.stringify(decodeCloud(current)) !== expected) throw new Error(CONFLICT_MESSAGE);
      return document;
    });
    return this.adopt(clean);
  }
  subscribe(callback, error) {
    return this.transport.watch(data => {
      try {
        if (data === null) throw new Error('Der Cloud-Bestand fehlt. Bitte prüfen; der Startbestand wird nicht automatisch erneut importiert.');
        callback(decodeCloud(data));
      } catch (cause) { error(cause); }
    }, error);
  }
  recovery() { const raw = this.storage.getItem(`${this.key}:before-import`); return raw === null ? null : parseImport(raw); }
  rawExport() { return this.raw; }
}
