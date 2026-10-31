// Optional maintenance only. No build or runtime dependency.
import { writeFile } from 'node:fs/promises';
import { normalizeCatalog } from '../js/core.js';
const source = 'https://raw.githubusercontent.com/bambulab/BambuStudio/master/resources/profiles/BBL/filament/filaments_color_codes.json';
const response = await fetch(source);
if (!response.ok) throw new Error(`Catalog fetch failed: HTTP ${response.status}`);
const raw = await response.json();
if (!Array.isArray(raw.data) || raw.data.length < 100 || normalizeCatalog(raw).length < raw.data.length * .95) throw new Error('Unexpected catalog shape; no files changed.');
const snapshot = { source:'https://github.com/bambulab/BambuStudio/blob/master/resources/profiles/BBL/filament/filaments_color_codes.json', retrievedAt:new Date().toISOString().slice(0,10), data:raw.data.map(x => ({fila_color_code:x.fila_color_code,fila_type:x.fila_type,fila_color_name:{en:x.fila_color_name.en,de:x.fila_color_name.de},fila_color:x.fila_color})) };
await writeFile(new URL('../data/bambu-source.json',import.meta.url),JSON.stringify(raw,null,2)+'\n');
await writeFile(new URL('../js/catalog-data.js',import.meta.url),'// Local snapshot of the official Bambu Studio catalog. See NOTICE.md.\nexport const catalogData = '+JSON.stringify(snapshot)+';\n');
console.log(`${normalizeCatalog(snapshot).length} catalog entries saved. Review changes, update provenance in NOTICE.md, then run npm test.`);
