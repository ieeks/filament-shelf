import { createRoll, findByCode } from './core.js';
// User-confirmed stock is authoritative, including names/materials if upstream changes.
export const seedRows = [
 ['PLA Basic','Purple','10700','refill','#5E43B7'],
 ['PLA Basic','Cyan','10603','spool','#0086D6'],
 ['PLA Basic','Pumpkin Orange','10301','spool','#FF9016'],
 ['PLA Basic','Red','10200','spool','#C12E1F'],
 ['PLA Basic','Black','10101','spool','#000000'],
 ['PLA Basic','Sunflower Yellow','10402','spool','#FEC600'],
 ['PLA Basic','Jade White','10100','spool','#FFFFFF'],
 ['PLA Matte','Marine Blue','11600','spool','#0078BF'],
 ['PLA Matte','Ivory White','11100','spool','#FFFFFF'],
 ['PLA Wood','White Oak','13106','spool','#D6CCA3'],
 ['PLA Wood','Classic Birch','13505','spool','#918669'],
 ['PLA Pure','Milky Pink','17200','spool','#F7CED7'],
 ['PETG Basic','Black','30105','spool','#000000'],
 ['PETG Basic','Misty Blue','30108','spool','#688197'],
 ['PETG Basic','Navy Blue','30604','spool','#0086D6'],
 ['PETG Matte','White','35100','spool','#FFFFFF']
];
export function seedCatalog(catalog) {
  return seedRows.filter(([material,,code]) => !findByCode(catalog,code).some(c => c.material === material)).map(([material,colorName,colorCode,,hex]) => ({ manufacturer:'Bambu Lab', material, colorName, colorCode, colors:[hex], source:'seed' }));
}
export function createSeed(catalog) {
  const seededAt = new Date().toISOString();
  return seedRows.map(([material,colorName,colorCode,kind,hex], i) => createRoll({ material, colorName, colorCode, kind, createdAt: seededAt, updatedAt: seededAt, colors: findByCode(catalog,colorCode).find(c => c.material === material)?.colors || [hex], notes: colorCode === '30604' ? 'Geschenk' : '', purchasePrice: colorCode === '30604' ? 0 : null }, `seed-${String(i+1).padStart(2,'0')}-${colorCode}`));
}
