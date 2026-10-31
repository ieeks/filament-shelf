export const APP = 'filament-shelf';
export const VERSION = 1;
export const MAX_ROLLS = 5000;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const now = () => new Date().toISOString();
export const uid = () => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // crypto.randomUUID requires HTTPS; getRandomValues also works on HTTP previews.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  return Array.from(bytes, (n,i) => ([4,6,8,10].includes(i) ? '-' : '') + n.toString(16).padStart(2,'0')).join('');
};
export const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
const fail = message => { throw new Error(message); };
const object = x => x && typeof x === 'object' && !Array.isArray(x);
function string(x, label, max = 120, optional = false) {
  if (typeof x !== 'string' || x.length > max || (!optional && !x.trim())) fail(`${label} ist ungültig.`);
  return x.trim();
}
function number(x, label, min, max) {
  if (typeof x !== 'number' || !Number.isFinite(x) || x < min || x > max) fail(`${label} muss zwischen ${min} und ${max} liegen.`);
  return round(x);
}
function timestamp(x) {
  if (typeof x !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(x) || !Number.isFinite(Date.parse(x))) fail('Ungültiger Zeitstempel.');
  return new Date(x).toISOString();
}
export function normalizeCode(value) {
  const code = String(value ?? '').trim();
  if (!/^\d{5}$/.test(code)) fail('Bitte einen fünfstelligen Farbcode eingeben.');
  return code;
}
export function normalizeHex(value) {
  if (typeof value !== 'string' || !/^#[\da-f]{6}([\da-f]{2})?$/i.test(value)) fail('Farbwert muss #RRGGBB oder #RRGGBBAA sein.');
  return value.toUpperCase();
}
export function normalizeCatalog(raw) {
  const unique = new Map();
  for (const entry of raw.data || []) {
    try {
      const item = { manufacturer: 'Bambu Lab', colorCode: normalizeCode(entry.fila_color_code), material: string(entry.fila_type, 'Material'), colorName: string(entry.fila_color_name?.en || entry.fila_color_name?.de, 'Farbname'), colorNameDE: entry.fila_color_name?.de || '', colors: entry.fila_color.map(normalizeHex), source: 'official' };
      if (!item.colors.length) continue;
      unique.set(JSON.stringify([item.colorCode, item.material, item.colorName, item.colors]), item);
    } catch { /* Incomplete upstream records must not break the inventory. */ }
  }
  return [...unique.values()];
}
export function findByCode(catalog, value) {
  const code = normalizeCode(value);
  return catalog.filter(item => item.colorCode === code);
}
export const family = material => /^PLA(?:\b|-)/i.test(material) ? 'PLA' : /^PETG(?:\b|-)/i.test(material) ? 'PETG' : 'Andere';
export function colorFamily(hex) {
  const [r,g,b] = hex.slice(1,7).match(/../g).map(v => parseInt(v,16)/255);
  const max = Math.max(r,g,b), min = Math.min(r,g,b), delta = max-min;
  if (max < .22) return 'Schwarz';
  if (min > .86) return 'Weiß';
  if (delta < .1) return 'Grau';
  let hue = delta === 0 ? 0 : max === r ? ((g-b)/delta)%6 : max === g ? (b-r)/delta+2 : (r-g)/delta+4;
  hue = (hue*60+360)%360;
  if ((hue < 18 || hue >= 295) && r > .8 && g > .5 && b > .5) return 'Rosa';
  if (hue < 18 || hue >= 345) return 'Rot';
  if (hue < 70 && min > .45 && delta < .3) return 'Orange / Beige';
  if (hue < 45) return max < .68 ? 'Braun' : 'Orange / Beige';
  if (hue < 70) return 'Gelb';
  if (hue < 165) return 'Grün';
  if (hue < 195) return 'Türkis';
  if (hue < 250) return 'Blau';
  if (hue < 295) return 'Violett';
  return 'Rosa';
}
export function validateRoll(input) {
  if (!object(input)) fail('Ungültiger Rolleneintrag.');
  const initialWeight = number(input.initialWeight, 'Startgewicht', .01, 100000);
  const remainingWeight = number(input.remainingWeight, 'Restgewicht', 0, initialWeight);
  if (!['new','opened','empty'].includes(input.status)) fail('Ungültiger Status.');
  if ((remainingWeight === 0 && input.status !== 'empty') || (remainingWeight > 0 && input.status === 'empty') || (remainingWeight < initialWeight && remainingWeight > 0 && input.status !== 'opened')) fail('Status und Restgewicht passen nicht zusammen.');
  if (!['spool','refill'].includes(input.kind)) fail('Typ muss Spule oder Refill sein.');
  if (typeof input.archived !== 'boolean') fail('Ungültiger Archivstatus.');
  if (!Array.isArray(input.colors) || !input.colors.length || input.colors.length > 16) fail('Ungültige Farben.');
  const purchaseDate = string(input.purchaseDate, 'Kaufdatum', 10, true);
  if (purchaseDate && (!/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate) || !Number.isFinite(Date.parse(purchaseDate)) || new Date(purchaseDate).toISOString().slice(0,10) !== purchaseDate)) fail('Kaufdatum ist ungültig.');
  if (!Array.isArray(input.usage) || input.usage.length > 10000) fail('Ungültiges Verbrauchsprotokoll.');
  const usageIds = new Set();
  const usage = input.usage.map(entry => {
    if (!object(entry)) fail('Ungültiger Verbrauch.');
    const id = string(entry.id, 'Verbrauchs-ID', 100);
    if (usageIds.has(id)) fail('Doppelte Verbrauchs-ID.');
    usageIds.add(id);
    return { id, grams: number(entry.grams, 'Verbrauch', .01, 100000), date: timestamp(entry.date), note: string(entry.note, 'Verbrauchsnotiz', 500, true) };
  });
  return { id: string(input.id, 'Rollen-ID', 100), manufacturer: string(input.manufacturer, 'Hersteller'), material: string(input.material, 'Material'), colorName: string(input.colorName, 'Farbname'), colorCode: normalizeCode(input.colorCode), colors: input.colors.map(normalizeHex), initialWeight, remainingWeight, kind: input.kind, status: input.status, archived: input.archived, purchaseDate, purchasePrice: input.purchasePrice === null ? null : number(input.purchasePrice, 'Kaufpreis', 0, 100000), notes: string(input.notes, 'Notizen', 2000, true), createdAt: timestamp(input.createdAt), updatedAt: timestamp(input.updatedAt), usage };
}
export function createRoll(fields, id = uid()) {
  const date = now();
  return validateRoll({ id, manufacturer: 'Bambu Lab', material: '', colorName: '', colorCode: '', colors: ['#CCCCCC'], initialWeight: 1000, remainingWeight: 1000, kind: 'spool', status: 'new', archived: false, purchaseDate: '', purchasePrice: null, notes: '', createdAt: date, updatedAt: date, usage: [], ...fields, id });
}
export function consume(roll, grams, note = '') {
  number(grams, 'Verbrauch', .01, roll.remainingWeight);
  if (roll.archived) fail('Bitte die Rolle zuerst aus dem Archiv holen.');
  const remainingWeight = round(roll.remainingWeight - grams);
  return validateRoll({ ...roll, remainingWeight, status: remainingWeight === 0 ? 'empty' : 'opened', updatedAt: now(), usage: [...roll.usage, { id: uid(), grams: round(grams), date: now(), note }] });
}
export function createState(rolls) { return { app: APP, version: VERSION, revision: 0, updatedAt: now(), rolls }; }
export function validateState(input) {
  if (!object(input) || input.app !== APP || input.version !== VERSION) fail('Kein unterstütztes Filament-Shelf-Backup (Version 1).');
  if (!Number.isSafeInteger(input.revision) || input.revision < 0) fail('Ungültige Datenversion.');
  if (!Array.isArray(input.rolls) || input.rolls.length > MAX_ROLLS) fail('Ungültige Rollenliste (max. 5.000).');
  const ids = new Set();
  const rolls = input.rolls.map(raw => { const roll = validateRoll(raw); if (ids.has(roll.id)) fail('Doppelte Rollen-ID im Backup. Import abgebrochen.'); ids.add(roll.id); return roll; });
  return { app: APP, version: VERSION, revision: input.revision, updatedAt: timestamp(input.updatedAt), rolls };
}
export function parseImport(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) fail('Datei ist zu groß (max. 5 MB).');
  let data;
  try { data = JSON.parse(text); } catch { fail('Die Datei enthält kein gültiges JSON.'); }
  return validateState(data);
}
export function planImport(current, incoming, mode) {
  const validated = validateState(incoming);
  if (!['merge','replace'].includes(mode)) fail('Ungültiger Importmodus.');
  const ids = new Set(current.rolls.map(r => r.id));
  const duplicates = validated.rolls.filter(r => ids.has(r.id)).length;
  const rolls = mode === 'merge' ? [...current.rolls, ...validated.rolls.filter(r => !ids.has(r.id))] : validated.rolls;
  if (rolls.length > MAX_ROLLS) fail('Der Import würde 5.000 Rollen überschreiten.');
  return { rolls, duplicates, added: validated.rolls.length - duplicates, total: rolls.length };
}
export function stats(rolls) {
  const byMaterial = new Map(), byFamily = new Map(), byColor = new Map();
  let remaining = 0, consumed = 0, opened = 0, empty = 0, archived = 0;
  for (const r of rolls) {
    remaining += r.remainingWeight; consumed += r.initialWeight-r.remainingWeight;
    opened += Number(r.status === 'opened'); empty += Number(r.status === 'empty'); archived += Number(r.archived);
    byMaterial.set(r.material, round((byMaterial.get(r.material) || 0) + r.remainingWeight));
    byFamily.set(family(r.material), round((byFamily.get(family(r.material)) || 0) + r.remainingWeight));
    const key = JSON.stringify([r.manufacturer, r.material, r.colorCode, r.colors.map(c => c.length === 9 && c.endsWith('FF') ? c.slice(0,7) : c)]);
    const c = byColor.get(key) || { name: r.colorName, material: r.material, code: r.colorCode, colors: r.colors, grams: 0, count: 0 };
    c.grams = round(c.grams + r.remainingWeight); c.count++; byColor.set(key,c);
  }
  return { count: rolls.length, remaining: round(remaining), consumed: round(consumed), opened, empty, archived, byMaterial, byFamily, byColor, colorCount: [...byColor.values()].filter(c => c.grams > 0).length };
}
