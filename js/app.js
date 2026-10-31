import { catalogData } from './catalog-data.js';
import { normalizeCatalog, findByCode, normalizeHex, createRoll, validateRoll, createState, consume, stats, family, colorFamily, parseImport, planImport, now, round, MAX_IMPORT_BYTES, createWish, validateWish, purchaseWish } from './core.js';
import { createSeed, seedCatalog } from './seed.js';
import { LocalStorageRepository, STORAGE_KEY } from './storage.js';
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const official = normalizeCatalog(catalogData);
const catalog = [...official, ...seedCatalog(official)];
const nf = new Intl.NumberFormat('de-AT', { maximumFractionDigits: 2 });
const kg = grams => nf.format(grams / 1000);
const g = grams => `${nf.format(grams)} g`;
const names = { new:'Neu', opened:'Angebrochen', empty:'Leer' };
let state = null, repository, selectedFamily = 'all', editId = null, consumeId = null, pendingImport = null, toastTimer, busy = false;
let importedAtRaw = null, damagedRaw = null;
let activeView = 'inventory', formMode = 'stock', purchaseId = null;
function el(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
function button(label, className, action) { const node = el('button', className, label); node.type = 'button'; node.addEventListener('click', action); return node; }
function background(colors) { return colors.length === 1 ? colors[0] : `linear-gradient(125deg, ${colors.join(',')})`; }
function toast(message, error = false) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').className = `toast${error ? ' error' : ''}`; $('#toast').hidden = false; toastTimer = setTimeout(() => { $('#toast').hidden = true; }, error ? 8000 : 3500); }
function message(error) { if (error?.name === 'QuotaExceededError') return 'Der Browserspeicher ist voll. Die Änderung wurde nicht gespeichert. Bitte zuerst ein Backup exportieren.'; if (error?.name === 'SecurityError') return 'Dieser Browser erlaubt hier keine lokale Speicherung. Bitte einen normalen Browser-Tab verwenden.'; return error.message || String(error); }
function fatal(error) {
  $('#fatal').hidden = false; $('#fatal-message').textContent = message(error);
  $('#add-open').disabled = true; $('#quick-form button').disabled = true; $('#wish-add').disabled = true;
  $('#save-state').textContent = 'Speichern nicht verfügbar';
}
async function commit(rolls, options = {}, wishlist = state?.wishlist) {
  if (!state || busy) return false;
  busy = true;
  try { const next = await repository.save({ ...state, rolls, wishlist }, options); state = next; render(); return true; }
  catch (error) { throw new Error(message(error)); }
  finally { busy = false; }
}
function ask(title, text, actionLabel = 'Bestätigen', danger = false) {
  const dialog = $('#confirm-dialog');
  $('#confirm-title').textContent = title; $('#confirm-message').textContent = text;
  $('#confirm-yes').textContent = actionLabel; $('#confirm-yes').className = `button ${danger ? 'danger' : 'primary'}`;
  return new Promise(resolve => {
    let result = false;
    $('#confirm-yes').onclick = () => { result = true; dialog.close(); };
    $('#confirm-no').onclick = () => dialog.close();
    dialog.addEventListener('close', () => resolve(result), { once:true });
    dialog.showModal();
  });
}
$$('.close-dialog').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
function options(selector, values, firstLabel) {
  const select = $(selector), previous = select.value;
  select.replaceChildren(new Option(firstLabel,'all'), ...values.map(v => new Option(v,v)));
  if ([...select.options].some(o => o.value === previous)) select.value = previous;
}
function metric(label, value, unit, detail, icon) {
  const node = el('article','metric'), top = el('div','metric-top',label); top.append(el('span','metric-icon',icon));
  const val = el('div','metric-value',value); val.append(el('span','metric-unit',unit));
  node.append(top,val,el('p','metric-detail',detail)); return node;
}
function render() {
  if (!state) return;
  const s = stats(state.rolls);
  $('#metrics').replaceChildren(metric('Gesamtbestand',kg(s.remaining),'kg',`${s.count} Rollen · inkl. ${s.archived} im Archiv`,'◉'),metric('Farben im Bestand',s.colorCount,'',`${s.byMaterial.size} Materialuntertypen`,'◐'),metric('Angebrochene Rollen',s.opened,'',`Bereit für den nächsten Druck`,'◴'),metric('Leere Rollen',s.empty,'',`${kg(s.consumed)} kg verbraucht¹`,'○'));
  $('#inventory-count').textContent = state.rolls.filter(r => !r.archived).length;
  options('#subtype',[...new Set(state.rolls.filter(r => selectedFamily === 'all' || family(r.material) === selectedFamily).map(r => r.material))].sort(),'Alle Untertypen');
  options('#color-filter',[...new Set(state.rolls.flatMap(r => r.colors.map(colorFamily)))].sort(),'Alle Farben');
  $('#save-state').replaceChildren(el('span','dot'), document.createTextNode('Lokal gespeichert'));
  renderGrid(); renderStats(s); renderWishlist();
}
function filteredRolls() {
  const query = $('#search').value.trim().toLocaleLowerCase('de');
  const type = $('#subtype').value, color = $('#color-filter').value, status = $('#status-filter').value;
  const result = state.rolls.filter(r => {
    const translated = catalog.find(c => c.colorCode === r.colorCode && c.material === r.material)?.colorNameDE || '';
    return (selectedFamily === 'all' || family(r.material) === selectedFamily) && (type === 'all' || r.material === type) && (color === 'all' || r.colors.some(c => colorFamily(c) === color)) && (!query || `${r.colorName} ${translated} ${r.colorCode} ${r.material}`.toLocaleLowerCase('de').includes(query)) && (status === 'archive' ? r.archived : !r.archived && (status === 'all' || status === 'active' && r.status !== 'empty' || status === r.status));
  });
  switch ($('#sort').value) {
    case 'color': result.sort((a,b) => a.colorName.localeCompare(b.colorName)); break;
    case 'material': result.sort((a,b) => a.material.localeCompare(b.material) || a.colorName.localeCompare(b.colorName)); break;
    case 'remaining': result.sort((a,b) => a.remainingWeight-b.remainingWeight); break;
    default: result.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  }
  return result;
}
function renderGrid() {
  if (!state) return;
  const rolls = filteredRolls();
  $('#result-count').textContent = `${rolls.length} ${rolls.length === 1 ? 'Rolle' : 'Rollen'}`;
  $('#empty-state').hidden = rolls.length > 0;
  const fragment = document.createDocumentFragment();
  rolls.forEach(r => fragment.append(rollCard(r)));
  $('#grid').replaceChildren(fragment);
}
function filamentStage(r,onEdit) {
  const stage = el('div','color-stage');
  const rgb = r.colors[0].slice(1,7).match(/../g).map(v => parseInt(v,16));
  stage.style.setProperty('--stage',`rgb(${rgb.map(c => Math.round(c*.12+255*.88)).join(',')})`);
  const badge = el('span','type-badge',r.kind === 'refill' ? 'REFILL' : 'SPULE');
  const edit = button('⋯','edit-button',onEdit); edit.setAttribute('aria-label',`${r.colorName} ${r.colorCode} bearbeiten`);
  const spool = el('div','spool'); spool.setAttribute('aria-hidden','true'); spool.style.setProperty('--filament',background(r.colors)); spool.append(el('span','spool-label','BAMBU LAB'));
  stage.append(badge,edit,spool);
  return stage;
}
function rollCard(r) {
  const card = el('article',`card${r.kind === 'refill' ? ' refill' : ''}`); card.dataset.id = r.id;
  const stage = filamentStage(r,() => openRoll(r));
  const body = el('div','card-body'), meta = el('div','card-meta'); meta.append(el('span','material-label',r.material),el('span','',r.colorCode));
  const title = el('h3','',r.colorName), weightRow = el('div','weight-row'), weight = el('span','weight',g(r.remainingWeight)); weight.append(el('small','',`/ ${g(r.initialWeight)}`));
  const status = el('span',`status ${r.status}`,r.archived ? 'Archiv' : names[r.status]);
  weightRow.append(weight,status);
  const progress = el('div','progress'); progress.setAttribute('role','meter'); progress.setAttribute('aria-label',`Restgewicht ${r.colorName}`); progress.setAttribute('aria-valuemin','0'); progress.setAttribute('aria-valuemax',r.initialWeight); progress.setAttribute('aria-valuenow',r.remainingWeight); progress.setAttribute('aria-valuetext',g(r.remainingWeight));
  const bar = el('span'); bar.style.width = `${r.remainingWeight/r.initialWeight*100}%`; progress.append(bar);
  body.append(meta,title,weightRow,progress);
  const footer = el('div','card-footer'), note = el('span','card-note',r.notes || r.manufacturer); note.title = r.notes || r.manufacturer;
  const actions = el('div','card-actions');
  if (r.archived) actions.append(button('Zurück ins Regal','text-button',() => archive(r,false)));
  else if (r.remainingWeight > 0) actions.append(button('− Verbrauch','text-button',() => openConsume(r)));
  else actions.append(button('Archivieren ↗','text-button',() => archive(r,true)));
  footer.append(note,actions); card.append(stage,body,footer); return card;
}
function renderWishlist() {
  if (!state) return;
  const total = state.wishlist.reduce((n,w) => n + w.quantity,0);
  $('#wishlist-count').textContent = state.wishlist.length;
  $('#wishlist-summary').textContent = `${state.wishlist.length} ${state.wishlist.length === 1 ? 'Wunsch' : 'Wünsche'} · ${total} ${total === 1 ? 'gewünschte Rolle' : 'gewünschte Rollen'}. Noch nicht im Bestand enthalten.`;
  const query = $('#wish-search').value.trim().toLocaleLowerCase('de');
  const wishes = state.wishlist.filter(w => `${w.colorName} ${w.material} ${w.colorCode}`.toLocaleLowerCase('de').includes(query)).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  $('#wishlist-empty').hidden = wishes.length > 0;
  $('#wishlist-empty h2').textContent = query ? 'Kein passender Wunsch gefunden.' : 'Platz für deine nächste Idee.';
  $('#wishlist-grid').replaceChildren(...wishes.map(w => {
    const card = el('article',`card wish-card${w.kind === 'refill' ? ' refill' : ''}`); card.dataset.id = w.id;
    const body = el('div','card-body'), meta = el('div','card-meta');
    meta.append(el('span','material-label',w.material),el('span','',w.colorCode));
    body.append(meta,el('h3','',w.colorName),el('p','wish-quantity',`${w.quantity} × ${g(w.initialWeight)} · ${w.kind === 'refill' ? 'Refill' : 'Spule'}`));
    if(w.notes) body.append(el('p','wish-note',w.notes));
    const footer = el('div','card-footer'); footer.append(button('1 Rolle ins Regal ↗','text-button',() => openRoll(null,'','stock',w)));
    card.append(filamentStage(w,() => openRoll(w,'','wish')),body,footer); return card;
  }));
}
async function removeWish(wish) {
  if (!await ask('Wunsch entfernen?',`${wish.colorName} von der Wunschliste entfernen? Dein Inventar bleibt unverändert.`,'Entfernen',true)) return;
  try { if (await commit(state.rolls,{},state.wishlist.filter(w => w.id !== wish.id))) { $('#roll-dialog').close(); toast('Wunsch entfernt.'); } }
  catch(error) { $('#roll-error').textContent = message(error); }
}
function statRow(label,value) { const node = el('div','stat-row'); node.append(el('span','',label),el('strong','',value)); return node; }
function renderStats(s) {
  const materials = $('#material-stats'); materials.replaceChildren();
  for (const [name,grams] of s.byFamily) materials.append(statRow(name,`${kg(grams)} kg`));
  materials.append(el('hr'));
  for (const [name,grams] of [...s.byMaterial].sort()) {
    materials.append(statRow(name,`${kg(grams)} kg`)); const bar = el('div','stat-bar'), fill = el('span'); fill.style.width = `${s.remaining ? grams/s.remaining*100 : 0}%`; bar.append(fill); materials.append(bar);
  }
  $('#usage-stats').replaceChildren(statRow('Rollen gesamt',nf.format(s.count)),statRow('Neu',nf.format(s.count-s.opened-s.empty)),statRow('Angebrochen',nf.format(s.opened)),statRow('Leer',nf.format(s.empty)),statRow('Davon archiviert',nf.format(s.archived)),statRow('Verbraucht¹',`${kg(s.consumed)} kg`),el('p','hint','¹ Startgewicht minus Restgewicht aller erfassten Rollen. Gewichtskorrekturen verändern diesen Wert; gelöschte Rollen entfallen.'));
  const colorNodes = [...s.byColor.values()].sort((a,b) => b.grams-a.grams).map(c => {
    const item = el('div','color-stat'), dot = el('span','color-dot'); dot.style.background = background(c.colors);
    const info = el('div','color-info'); info.append(el('strong','',c.name),el('small','',`${c.material} · ${c.code}`));
    const amount = el('div','color-amount',g(c.grams)); amount.append(el('small','',`${c.count} ${c.count === 1 ? 'Rolle' : 'Rollen'}`)); item.append(dot,info,amount); return item;
  });
  $('#color-stats').replaceChildren(...colorNodes);
  const usage = state.rolls.flatMap(r => r.usage.map(u => ({ ...u, colorName:r.colorName, code:r.colorCode }))).sort((a,b) => b.date.localeCompare(a.date)).slice(0,30);
  $('#history').replaceChildren(...usage.map(u => { const row = el('div','history-item'), details = el('div','',`${u.colorName} · ${u.code}`); details.append(el('span','',`${new Date(u.date).toLocaleDateString('de-AT')} · ${u.note || 'Verbrauch erfasst'}`)); row.append(details,el('strong','',`− ${g(u.grams)}`)); return row; }));
  if (!usage.length) $('#history').append(el('p','hint','Noch kein Verbrauch erfasst. Dein nächstes Projekt macht den Anfang.'));
}
function resetFilters() { selectedFamily = 'all'; $('#search').value = ''; ['#subtype','#color-filter'].forEach(s => $(s).value = 'all'); $('#status-filter').value = 'active'; $('#sort').value = 'added'; renderFamily(); render(); }
function renderFamily() { $$('#family-filter button').forEach(b => { b.classList.toggle('active',b.dataset.family === selectedFamily); b.setAttribute('aria-pressed',String(b.dataset.family === selectedFamily)); }); }
$('#family-filter').addEventListener('click',event => { const b = event.target.closest('[data-family]'); if (!b) return; selectedFamily = b.dataset.family; $('#subtype').value = 'all'; renderFamily(); render(); });
['#search','#subtype','#color-filter','#status-filter','#sort'].forEach(s => $(s).addEventListener(s === '#search' ? 'input' : 'change',renderGrid));
$('#clear-filters').addEventListener('click',resetFilters);
function view(name) { activeView = name; $('#add-open').textContent = name === 'wishlist' ? '＋ Wunsch hinzufügen' : '＋ Filament hinzufügen'; $('#quick-title').textContent = name === 'wishlist' ? 'Neue Farbe auf der Wunschliste?' : 'Neue Farbe im Regal?'; ['inventory','wishlist','stats'].forEach(key => { $(`#${key}-panel`).hidden = key !== name; $(`#${key}-tab`).classList.toggle('active',key === name); $(`#${key}-tab`).setAttribute('aria-pressed',String(key === name)); }); }
$('#inventory-tab').addEventListener('click',() => view('inventory'));
$('#wishlist-tab').addEventListener('click',() => view('wishlist'));
$('#wish-add').addEventListener('click',() => openRoll(null,'','wish'));
$('#wish-search').addEventListener('input',renderWishlist);
$('#stats-tab').addEventListener('click',() => view('stats'));
function preview() {
  $('#preview-name').textContent = $('#color-name').value || 'Deine nächste Farbe'; $('#preview-material').textContent = `${$('#manufacturer').value} · ${$('#material').value}`;
  try { $('#preview-swatch').style.background = background($('#colors').value.split(',').map(v => normalizeHex(v.trim()))); } catch { $('#preview-swatch').style.background = '#dfe6d9'; }
}
function populate(item) { $('#manufacturer').value = item.manufacturer; $('#material').value = item.material; $('#color-name').value = item.colorName; $('#colors').value = item.colors.map(c => c.endsWith('FF') && c.length === 9 ? c.slice(0,7) : c).join(', '); preview(); }
function lookup() {
  $('#matches').replaceChildren();
  try {
    const matches = findByCode(catalog,$('#roll-code').value);
    const custom = [...(state?.rolls || []), ...(state?.wishlist || [])].filter(r => r.colorCode === $('#roll-code').value.trim() && !matches.some(c => c.material === r.material && c.colorName === r.colorName && c.colors.map(x => x.slice(0,7)).join() === r.colors.map(x => x.slice(0,7)).join()));
    for (const r of custom) if (!matches.some(c => c.material === r.material && c.colorName === r.colorName)) matches.push({...r,source:'inventory'});
    if (!matches.length) { $('#lookup-message').textContent = 'Unbekannter Farbcode. Bitte Material, Farbname und HEX-Farbe selbst ergänzen.'; $('#material').value = ''; $('#color-name').value = ''; $('#colors').value = ''; preview(); $('#material').focus(); }
    else if (matches.length === 1) { populate(matches[0]); $('#lookup-message').textContent = matches[0].source === 'official' ? 'Erkannt im offiziellen Bambu-Studio-Katalog ✓' : 'Erkannt aus deinem Ausgangsbestand / Inventar ✓'; }
    else {
      $('#material').value = ''; $('#color-name').value = ''; $('#colors').value = ''; preview();
      $('#lookup-message').textContent = `${matches.length} Treffer. Bitte die passende Variante auswählen:`;
      matches.forEach(m => { const b = button(`${m.material} · ${m.colorName}`,'match',() => { populate(m); $('#lookup-message').textContent = `Ausgewählt: ${m.material} · ${m.colorName}`; $('#matches').replaceChildren(); }); const dot = el('span','color-dot'); dot.style.background = background(m.colors); b.prepend(dot); $('#matches').append(b); });
    }
  } catch(error) { $('#lookup-message').textContent = message(error); }
}
function openRoll(roll = null, code = '', mode = 'stock', fromWish = null) {
  if (!state) return;
  formMode = mode; purchaseId = fromWish?.id || null;
  editId = roll?.id || null; $('#roll-form').reset();
  $$('.stock-only').forEach(node => { node.hidden = mode === 'wish'; node.querySelectorAll('input,select').forEach(input => input.disabled = mode === 'wish'); });
  $('#wish-quantity-label').hidden = mode !== 'wish'; $('#wish-quantity').disabled = mode !== 'wish';
 $('#roll-error').textContent = ''; $('#matches').replaceChildren();
  $('#roll-title').textContent = mode === 'wish' ? (roll ? 'Wunsch bearbeiten' : 'Wunsch hinzufügen') : fromWish ? 'Gekaufte Rolle übernehmen' : roll ? 'Rolle bearbeiten' : 'Filament hinzufügen';
  $('#roll-submit').textContent = mode === 'wish' ? 'Wunsch speichern' : fromWish ? '1 Rolle ins Regal' : roll ? 'Änderungen speichern' : 'Rolle hinzufügen';
  $('#lookup-message').textContent = 'Fünf Ziffern vom Etikett – der Katalog ist lokal verfügbar.';
  $('#roll-code').value = roll?.colorCode || code;
  if (roll) {
    populate(roll); $('#kind').value = roll.kind; $('#roll-status').value = roll.status || 'new'; $('#initial').value = roll.initialWeight; $('#remaining').value = roll.remainingWeight ?? roll.initialWeight; $('#purchase-date').value = roll.purchaseDate || ''; $('#wish-quantity').value = roll.quantity || 1; $('#purchase-price').value = roll.purchasePrice ?? ''; $('#notes').value = roll.notes;
  } else { $('#colors').value = ''; preview(); }
  if (fromWish) { populate(fromWish); $('#roll-code').value = fromWish.colorCode; $('#kind').value = fromWish.kind; $('#initial').value = fromWish.initialWeight; $('#remaining').value = fromWish.initialWeight; $('#notes').value = fromWish.notes; $('#lookup-message').textContent = 'Übernimmt genau eine Rolle. Die gewünschte Menge wird beim Speichern um 1 reduziert.'; }
  $('#edit-actions')?.remove();
  if (roll) {
    const actions = el('div','backup-actions'); actions.id = 'edit-actions';
    if (mode === 'wish') actions.append(button('Wunsch entfernen','button secondary',() => removeWish(roll)));
    else actions.append(button(roll.archived ? 'Zurück ins Regal' : 'Archivieren','button secondary',() => archive(roll,!roll.archived)),button('Rolle löschen','button secondary',() => removeRoll(roll)));
    $('#roll-error').before(actions);
  }
  $('#roll-dialog').showModal();
  if (code) lookup();
}
$('#add-open').addEventListener('click',() => openRoll(null,'',activeView === 'wishlist' ? 'wish' : 'stock'));
$('#quick-form').addEventListener('submit',event => { event.preventDefault(); openRoll(null,$('#quick-code').value,activeView === 'wishlist' ? 'wish' : 'stock'); });
$('#lookup').addEventListener('click',lookup);
$('#roll-code').addEventListener('input',() => { $('#lookup-message').textContent = 'Code geändert. Bitte erneut „Erkennen“ wählen oder die Angaben manuell ergänzen.'; $('#material').value = ''; $('#color-name').value = ''; $('#colors').value = ''; $('#matches').replaceChildren(); preview(); });
$('#roll-code').addEventListener('keydown',event => { if (event.key === 'Enter') { event.preventDefault(); lookup(); } });
['#colors','#color-name','#material','#manufacturer'].forEach(s => $(s).addEventListener('input',preview));
function weightStatus() { const remaining = Number($('#remaining').value), initial = Number($('#initial').value); $('#roll-status').value = remaining === 0 ? 'empty' : remaining < initial ? 'opened' : $('#roll-status').value === 'opened' ? 'opened' : 'new'; }
$('#remaining').addEventListener('input',weightStatus);
$('#initial').addEventListener('input',() => { if (!editId && $('#roll-status').value === 'new') $('#remaining').value = $('#initial').value; weightStatus(); });
$('#roll-status').addEventListener('change',() => { if ($('#roll-status').value === 'empty') $('#remaining').value = '0'; if ($('#roll-status').value === 'new') $('#remaining').value = $('#initial').value; if ($('#roll-status').value === 'opened' && Number($('#remaining').value) === 0) $('#remaining').value = $('#initial').value; });
$('#roll-form').addEventListener('submit',async event => {
  event.preventDefault(); if (busy) return; $('#roll-error').textContent = ''; const submit = $('#roll-submit'); submit.disabled = true;
  try {
    const existing = editId ? (formMode === 'wish' ? state.wishlist : state.rolls).find(r => r.id === editId) : null;
    if (editId && !existing) throw new Error('Diese Rolle existiert nicht mehr. Bitte den Dialog schließen.');
    const fields = { manufacturer:$('#manufacturer').value.trim(), material:$('#material').value.trim(), colorName:$('#color-name').value.trim(), colorCode:$('#roll-code').value, colors:$('#colors').value.split(',').map(c => normalizeHex(c.trim())), initialWeight:Number($('#initial').value), remainingWeight:Number($('#remaining').value), kind:$('#kind').value, status:$('#roll-status').value, purchaseDate:$('#purchase-date').value, purchasePrice:$('#purchase-price').value === '' ? null : Number($('#purchase-price').value), notes:$('#notes').value.trim(), updatedAt:now() };
    if (formMode === 'wish') {
      const wishFields = { ...fields, quantity: Number($('#wish-quantity').value) };
      const wish = existing ? validateWish({ ...existing, ...wishFields }) : createWish(wishFields);
      const wishlist = existing ? state.wishlist.map(w => w.id === editId ? wish : w) : [...state.wishlist, wish];
      if (await commit(state.rolls, {}, wishlist)) { $('#roll-dialog').close(); $('#quick-code').value = ''; view('wishlist'); toast('Wunschliste gespeichert.'); }
      return;
    }
    if (purchaseId) {
      const next = purchaseWish(state, purchaseId, fields);
      if (await commit(next.rolls, {}, next.wishlist)) { $('#roll-dialog').close(); toast('1 Rolle ins Regal übernommen. Wunschmenge aktualisiert.'); }
      return;
    }
    const roll = existing ? validateRoll({...existing,...fields}) : createRoll(fields);
    const rolls = existing ? state.rolls.map(r => r.id === editId ? roll : r) : [...state.rolls,roll];
    if (await commit(rolls)) { $('#roll-dialog').close(); $('#quick-code').value = ''; toast(existing ? 'Rolle aktualisiert.' : `${roll.colorName} steht jetzt im Regal.`); }
  } catch(error) { $('#roll-error').textContent = message(error); }
  finally { submit.disabled = false; }
});
async function archive(roll,value) {
  try { if (await commit(state.rolls.map(r => r.id === roll.id ? {...r,archived:value,updatedAt:now()} : r))) { $('#roll-dialog').close(); toast(value ? 'Rolle archiviert.' : 'Rolle zurück im Regal.'); } } catch(error) { toast(message(error),true); }
}
async function removeRoll(roll) {
  if (!await ask('Rolle löschen?',`${roll.colorName} (${roll.colorCode}) und die zugehörigen Verbrauchseinträge werden gelöscht. Für eine spätere Wiederverwendung kannst du die Rolle stattdessen archivieren.`,'Löschen',true)) return;
  try { if (await commit(state.rolls.filter(r => r.id !== roll.id))) { $('#roll-dialog').close(); toast('Rolle gelöscht.'); } } catch(error) { $('#roll-error').textContent = message(error); }
}
function openConsume(roll) { consumeId = roll.id; $('#consume-form').reset(); $('#consume-error').textContent = ''; $('#consume-name').textContent = `${roll.colorName} · ${roll.material} · ${roll.colorCode}`; $('#consume-grams').max = roll.remainingWeight; $('#consume-preview').textContent = `Aktuell verfügbar: ${g(roll.remainingWeight)}`; $('#consume-dialog').showModal(); $('#consume-grams').focus(); }
function consumePreview() { const roll = state.rolls.find(r => r.id === consumeId), amount = Number($('#consume-grams').value); if (roll) $('#consume-preview').textContent = amount > 0 && amount <= roll.remainingWeight ? `Danach bleiben ${g(round(roll.remainingWeight-amount))}.` : `Verfügbar: ${g(roll.remainingWeight)}`; }
$('#consume-grams').addEventListener('input',consumePreview);
$('#consume-presets').addEventListener('click',event => { const b = event.target.closest('[data-grams]'); if (!b) return; const roll = state.rolls.find(r => r.id === consumeId); $('#consume-grams').value = b.dataset.grams === 'all' ? roll.remainingWeight : b.dataset.grams; consumePreview(); });
$('#consume-form').addEventListener('submit',async event => {
  event.preventDefault(); if (busy) return; const submit = $('#consume-form button[type="submit"]'); submit.disabled = true; $('#consume-error').textContent = '';
  try { const roll = state.rolls.find(r => r.id === consumeId); if (!roll) throw new Error('Rolle nicht gefunden.'); const updated = consume(roll,Number($('#consume-grams').value),$('#consume-note').value.trim()); if (await commit(state.rolls.map(r => r.id === consumeId ? updated : r))) { $('#consume-dialog').close(); toast(`${g(updated.remainingWeight)} verbleiben auf der Rolle.`); } }
  catch(error) { $('#consume-error').textContent = message(error); }
  finally { submit.disabled = false; }
});
function download(data,filename) {
  const url = URL.createObjectURL(new Blob([data],{type:'application/json'})), link = el('a'); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url),10000);
}
function exportState() { if (!state) return exportRaw(); download(JSON.stringify({...state,exportedAt:now()},null,2),`filament-shelf-${new Date().toISOString().slice(0,10)}.json`); toast('Backup zum Download bereit.'); }
function exportRaw() { try { const raw = repository?.rawExport(); if (raw === null || raw === undefined) throw new Error('Keine gespeicherten Rohdaten gefunden.'); download(raw,'filament-shelf-rohdaten.json'); } catch(error) { toast(message(error),true); } }
$('#export').addEventListener('click',exportState); $('#raw-export').addEventListener('click',exportRaw); $('#reload').addEventListener('click',() => location.reload());
$('#backup-open').addEventListener('click',() => { $('#backup-error').textContent = ''; $('#backup-dialog').showModal(); });
$('#import-choose').addEventListener('click',() => $('#import-file').click());
function prepareImport(text) {
  pendingImport = null; $('#import-preview').hidden = true; $('#backup-error').textContent = '';
  try { pendingImport = parseImport(text); importedAtRaw = repository.raw; $('#import-mode').value = state ? 'merge' : 'replace'; $('#import-mode').disabled = !state; updateImportSummary(); $('#import-preview').hidden = false; }
  catch(error) { $('#backup-error').textContent = message(error); }
}
function updateImportSummary() {
  if (!pendingImport) return;
  try { const mode = $('#import-mode').value, plan = planImport(state || createState([]),pendingImport,mode); $('#import-summary').textContent = mode === 'merge' ? `${pendingImport.rolls.length} Rollen im Backup: ${plan.added} werden ergänzt, ${plan.duplicates} vorhandene IDs übersprungen. Danach: ${plan.total} Rollen.` : `Der gesamte aktuelle Bestand (${state?.rolls.length ?? 'beschädigte Daten'} Rollen) wird durch ${plan.total} Rollen aus diesem Backup ersetzt. Änderungen seit dem Backup gehen dabei verloren.`; $('#import-summary').textContent += mode === 'merge' ? ` Wunschliste: ${plan.wishAdded} neue Einträge, ${plan.wishDuplicates} vorhandene IDs übersprungen.` : ` Wunschliste wird durch ${plan.wishlist.length} Einträge ersetzt.`; $('#import-confirm').disabled = false; }
  catch(error) { $('#backup-error').textContent = message(error); $('#import-confirm').disabled = true; }
}
$('#import-mode').addEventListener('change',updateImportSummary);
$('#import-file').addEventListener('change',async () => { const file = $('#import-file').files[0]; if (!file) return; pendingImport = null; $('#import-preview').hidden = true; try { if (file.size > MAX_IMPORT_BYTES) throw new Error('Datei ist zu groß (max. 5 MB).'); prepareImport(await file.text()); } catch(error) { $('#backup-error').textContent = message(error); } finally { $('#import-file').value = ''; } });
$('#validate-paste').addEventListener('click',() => prepareImport($('#import-text').value));
$('#import-confirm').addEventListener('click',async () => {
  if (!pendingImport || busy) return; $('#backup-error').textContent = ''; const mode = $('#import-mode').value;
  if (mode === 'replace' && !await ask('Bestand ersetzen?','Bestand und Wunschliste werden durch das geprüfte Backup ersetzt. Ein altes Backup ohne Wunschliste leert diese. Der vorherige Stand wird zusätzlich lokal gesichert.','Bestand ersetzen')) return;
  $('#import-confirm').disabled = true;
  try {
    if (repository.raw !== importedAtRaw) throw new Error('Der Bestand hat sich seit der Vorschau geändert. Bitte das Backup erneut prüfen.');
    const plan = planImport(state || createState([]),pendingImport,mode);
    if (state) { if (!await commit(plan.rolls,{backup:true},plan.wishlist)) return; }
    else { state = await repository.recover(pendingImport,damagedRaw); $('#fatal').hidden = true; $('#add-open').disabled = false; $('#quick-form button').disabled = false; $('#wish-add').disabled = false; render(); }
    pendingImport = null; $('#import-preview').hidden = true; $('#import-text').value = ''; $('#backup-dialog').close(); toast(`Import abgeschlossen: ${plan.total} Rollen.`);
  } catch(error) { $('#backup-error').textContent = message(error); }
  finally { $('#import-confirm').disabled = false; }
});
$('#restore').addEventListener('click',async () => {
  $('#backup-error').textContent = '';
  try { const recovery = repository.recovery(); if (!recovery) throw new Error('Noch kein Stand vor einem Import vorhanden.'); prepareImport(JSON.stringify(recovery)); $('#import-mode').value = 'replace'; updateImportSummary(); }
  catch(error) { $('#backup-error').textContent = message(error); }
});
window.addEventListener('storage',event => { if (event.key === STORAGE_KEY || event.key === null) { $('#save-state').textContent = 'Anderer Tab geändert · neu laden'; toast('Bestand in einem anderen Tab geändert. Bitte neu laden; offene Eingaben bleiben bis dahin erhalten.',true); } });
$('#catalog-count').textContent = catalog.length;
$('#material-options').replaceChildren(...[...new Set(catalog.map(c => c.material))].sort().map(m => new Option(m,m)));
try { repository = new LocalStorageRepository(window.localStorage,navigator.locks); state = await repository.load(() => createSeed(catalog)); render(); }
catch(error) { try { damagedRaw = repository?.rawExport(); } catch { /* Blocked storage remains untouched. */ } fatal(error); }
