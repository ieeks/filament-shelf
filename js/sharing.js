import { validateState, normalizeHex } from './core.js';

export function validShareId(value) { return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value); }
export function newShareId() {
  return [...crypto.getRandomValues(new Uint8Array(32))].map(n => n.toString(16).padStart(2, '0')).join('');
}
// Explicit allowlist: never send private IDs, account details, notes, prices,
// purchase dates, usage history, archived stock or the wishlist to a reader.
export function publicShelf(state) {
  const clean = validateState(state);
  return {
    format: 1, revision: clean.revision, updatedAt: clean.updatedAt,
    rolls: clean.rolls.filter(r => !r.archived).map(r => ({
      material: r.material, colorName: r.colorName, colorCode: r.colorCode,
      colors: r.colors, initialWeight: r.initialWeight,
      remainingWeight: r.remainingWeight, kind: r.kind, status: r.status
    }))
  };
}
export function validatePublicShelf(data) {
  if (!data || data.format !== 1 || !Number.isSafeInteger(data.revision) || data.revision < 0 || typeof data.updatedAt !== 'string' || !Number.isFinite(Date.parse(data.updatedAt)) || !Array.isArray(data.rolls) || data.rolls.length > 5000) throw new Error('Die geteilten Daten sind ungültig.');
  const text = value => {
    if (typeof value !== 'string' || !value.trim() || value.length > 120) throw new Error('Ungültige Farbangabe.');
    return value;
  };
  const rolls = data.rolls.map(r => {
    if (!r || !Array.isArray(r.colors) || r.colors.length < 1 || r.colors.length > 16 || typeof r.colorCode !== 'string' || !/^\d{5}$/.test(r.colorCode) || !['spool','refill'].includes(r.kind) || !['new','opened','empty'].includes(r.status) || !Number.isFinite(r.initialWeight) || r.initialWeight <= 0 || r.initialWeight > 100000 || !Number.isFinite(r.remainingWeight) || r.remainingWeight < 0 || r.remainingWeight > r.initialWeight) throw new Error('Ungültige geteilte Rolle.');
    return { material:text(r.material), colorName:text(r.colorName), colorCode:r.colorCode, colors:r.colors.map(normalizeHex), initialWeight:r.initialWeight, remainingWeight:r.remainingWeight, kind:r.kind, status:r.status };
  });
  return { format:1, revision:data.revision, updatedAt:data.updatedAt, rolls };
}
