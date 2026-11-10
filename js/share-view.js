import { mountLabelPrinting } from './labels.js?v=1.5.2';
import { validatePublicShelf, validShareId } from './sharing.js';
import { family } from './core.js';
import { publicShareId } from './public-config.js?v=1.4.0';
const $ = selector => document.querySelector(selector);
const nf = new Intl.NumberFormat('de-AT',{maximumFractionDigits:2});
const names = {new:'Neu',opened:'Angebrochen',empty:'Leer'};
let shelf = null, selected = 'all';
mountLabelPrinting(() => shelf?.rolls || []);
function el(tag, className, text) { const n = document.createElement(tag); if (className) n.className = className; if (text !== undefined) n.textContent = text; return n; }
function clear(message) { shelf = null; $('#reader-grid').replaceChildren(); $('#reader-content').hidden = true; $('#reader-status').textContent = message; }
function render() {
  if (!shelf) return;
  $('#reader-content').hidden = false;
  $('#reader-count').textContent = shelf.rolls.length;
  $('#reader-weight').textContent = `${nf.format(shelf.rolls.reduce((sum,r)=>sum+r.remainingWeight,0)/1000)} kg`;
  const query = $('#reader-search').value.trim().toLocaleLowerCase('de');
  const rolls = shelf.rolls.filter(r => (selected === 'all' || family(r.material) === selected) && `${r.material} ${r.colorName} ${r.colorCode}`.toLocaleLowerCase('de').includes(query));
  $('#reader-empty').hidden = !!rolls.length;
  $('#reader-grid').replaceChildren(...rolls.map(r => {
    const card = el('article','card'), stage = el('div','color-stage');
    const rgb = r.colors[0].slice(1,7).match(/../g).map(v=>parseInt(v,16));
    stage.style.setProperty('--stage',`rgb(${rgb.map(c=>Math.round(c*.12+255*.88)).join(',')})`);
    const spool = el('div','spool'); spool.setAttribute('aria-hidden','true');
    spool.style.setProperty('--filament',r.colors.length === 1 ? r.colors[0] : `linear-gradient(125deg,${r.colors.join(',')})`);
    stage.append(el('span','type-badge',r.kind === 'refill' ? 'REFILL' : 'SPULE'),spool);
    const body = el('div','card-body'), meta = el('div','card-meta'); meta.append(el('span','material-label',r.material),el('span','',r.colorCode));
    const row = el('div','weight-row'); row.append(el('span','weight',`${nf.format(r.remainingWeight)} g`),el('span',`status ${r.status}`,names[r.status]));
    body.append(meta,el('h3','',r.colorName),row); card.append(stage,body); return card;
  }));
}
$('#reader-skip').addEventListener('click',event => { event.preventDefault(); $('#main').focus(); $('#main').scrollIntoView(); });
$('#reader-search').addEventListener('input',render);
$('#reader-filters').addEventListener('click',event => {
  const b = event.target.closest('[data-family]'); if (!b) return;
  selected = b.dataset.family;
  document.querySelectorAll('[data-family]').forEach(n=>{n.classList.toggle('active',n===b);n.setAttribute('aria-pressed',String(n===b));}); render();
});
// Explicit reader links never fall back to the default shelf: an invalid or
// revoked link must not unexpectedly display a different inventory.
const shareId = document.body.dataset.defaultShelf === 'true' ? publicShareId : location.hash.slice(1);
if (!validShareId(shareId)) clear('Dieser Leselink ist ungültig oder unvollständig. Bitte den vollständigen Link vom Besitzer anfordern.');
else {
  try {
    const { createShareReader } = await import('./firebase-client.js');
    await createShareReader(shareId,data => {
      if (data === null) { clear('Diese Freigabe ist nicht mehr aktiv oder existiert nicht.'); return; }
      try {
        shelf = validatePublicShelf(data);
        $('#reader-status').textContent = `Geteilter Bestand · aktualisiert am ${new Date(shelf.updatedAt).toLocaleString('de-AT')}`;
        render();
      } catch { clear('Der geteilte Bestand konnte nicht sicher gelesen werden.'); }
    },() => clear('Der geteilte Bestand ist gerade nicht erreichbar. Bitte die Seite neu laden oder den Besitzer um Prüfung der Freigabe bitten.'));
  } catch { clear('Verbindung zum geteilten Bestand fehlgeschlagen. Bitte Internetverbindung prüfen und neu laden.'); }
}
window.addEventListener('hashchange',() => location.reload());
