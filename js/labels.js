// Printing reads a snapshot only; it never modifies stock or sharing data.
export function labelVariants(rolls = []) {
  const variants = new Map();
  for (const r of rolls) {
    if (r.archived || !(r.remainingWeight > 0)) continue;
    const key = JSON.stringify([r.manufacturer || '', r.material, r.colorCode, r.colorName, r.colors]);
    if (!variants.has(key)) variants.set(key, { key, material:r.material, colorName:r.colorName, colorCode:r.colorCode, manufacturer:r.manufacturer || '' });
  }
  return [...variants.values()].sort((a,b) => a.material.localeCompare(b.material,'de') || a.colorCode.localeCompare(b.colorCode));
}
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function printDocument(labels, mode = 'a4') {
  if (!['a4','single'].includes(mode) || !labels.length || labels.length > 1000) throw new Error('Bitte 1 bis 1.000 Etiketten auswählen.');
  const card = r => `<article class="label"><b>${escape(r.material)}</b><span>${escape(r.colorName)}</span><strong>${escape(r.colorCode)}</strong></article>`;
  const pages = [];
  if (mode === 'single') for (const r of labels) pages.push(`<section class="sheet">${card(r)}</section>`);
  else for (let i=0;i<labels.length;i+=112) pages.push(`<section class="sheet">${labels.slice(i,i+112).map(card).join('')}</section>`);
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Filament Shelf - Etiketten</title><style>
*{box-sizing:border-box}body{margin:0;background:#edf0e9;font-family:Arial,sans-serif;color:#111}
nav{padding:20px;max-width:800px;margin:auto;font-size:14px;line-height:1.6}button{padding:12px 18px;border:0;border-radius:8px;background:#285c40;color:white;font-size:16px;cursor:pointer}
.sheet{background:white;margin:16px auto;break-after:page;page-break-after:always}
.sheet:last-child{break-after:auto;page-break-after:auto}
.label{width:18mm;height:12mm;padding:1mm;border:.2mm solid #bbb;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;line-height:1.15;overflow:hidden;break-inside:avoid;font-size:6pt}
.label>*{display:block;max-width:100%;overflow-wrap:anywhere}.label span{margin:.5mm 0}.label strong{font-size:7pt}
${mode === 'a4' ? '.sheet{width:180mm;height:257mm;display:grid;grid-template-columns:repeat(8,18mm);grid-auto-rows:12mm;gap:4mm;align-content:start;padding-top:2mm}' : '.sheet{width:18mm;height:12mm}.label{border:0}'}
@page{size:${mode === 'a4' ? 'A4 portrait;margin:20mm 15mm' : '18mm 12mm;margin:0'}}
@media print{body{background:white}nav{display:none}.sheet{margin:0;box-shadow:none}}
@media screen{main{overflow-x:auto;padding:0 12px 20px}.sheet{box-shadow:0 2px 14px #0002}}
</style></head><body><nav><h1>Deine Farbmuster-Etiketten</h1><p>${labels.length} Etiketten · 18 × 12 mm</p><p>${mode === 'a4' ? 'A4 auf vollflächigem Klebepapier. An den grauen Linien ausschneiden.' : 'Eine Seite pro Etikett. Im Druckertreiber 18 × 12 mm einstellen. Kleine Papierformate werden nicht von jedem Drucker unterstützt; gegebenenfalls als PDF in die Drucker-App importieren.'} Bei 100 % / tatsächlicher Größe drucken, Kopf- und Fußzeilen ausschalten. Erst auf Normalpapier prüfen.</p><button id="print">Drucken / als PDF speichern</button><p>Am iPhone alternativ über Teilen → Drucken.</p></nav><main>${pages.join('')}</main><script>
document.querySelector('#print').onclick=()=>window.print();
// Fit long custom names into the actual label area before printing.
for(const label of document.querySelectorAll('.label')){
 let size=6;label.style.fontSize=size+'pt';
 while((label.scrollHeight>label.clientHeight||[...label.children].some(n=>n.scrollWidth>n.clientWidth))&&size>3){size-=.25;label.style.fontSize=size+'pt';}
}
</script></body></html>`;
}
export function mountLabelPrinting(getRolls) {
  const trigger = document.querySelector('#labels-open');
  if (!trigger) return;
  let variants = [], selection = new Set();
  const dialog = document.createElement('dialog');
  dialog.id = 'labels-dialog';
  dialog.setAttribute('aria-labelledby','labels-title');
  dialog.innerHTML = `<header class="dialog-header"><div><p class="eyebrow">DEINE FARBMUSTER</p><h2 id="labels-title">Etiketten drucken</h2></div><button class="icon-button" id="labels-close" aria-label="Schließen">×</button></header>
<div class="dialog-body"><p>Eine Auswahl pro Material und Farbe. Mehrere Rollen derselben Variante werden zusammengefasst. Leere und archivierte Rollen bleiben ausgeblendet.</p>
<label>Suchen<input id="labels-search" type="search" placeholder="Farbe, Material oder Code"></label>
<div class="labels-actions"><button class="button secondary" id="labels-all">Alle Treffer auswählen</button><button class="button secondary" id="labels-none">Auswahl leeren</button></div>
<div id="labels-list"></div><p id="labels-count" role="status"></p>
<div class="form-grid"><label>Ausgabe<select id="labels-mode"><option value="a4">A4-Bogen zum Ausschneiden</option><option value="single">Einzeletikett · 18 × 12 mm</option></select></label>
<label>Exemplare je Farbe<input id="labels-copies" type="number" inputmode="numeric" value="1" min="1" max="20" step="1"></label></div>
<p class="hint">Einzeletiketten: passender Drucker bzw. PDF-Import in dessen App erforderlich. Keine direkte Bluetooth-Verbindung.</p><p id="labels-error" class="form-error" role="alert"></p></div>
<div class="dialog-footer"><button id="labels-preview" class="button primary">Druckvorschau öffnen</button></div>`;
  document.body.append(dialog);
  const $ = id => dialog.querySelector(id);
  const visible = () => { const q=$('#labels-search').value.toLocaleLowerCase('de');return variants.filter(r=>`${r.material} ${r.colorName} ${r.colorCode} ${r.manufacturer}`.toLocaleLowerCase('de').includes(q)); };
  function render() {
    $('#labels-list').replaceChildren();
    for(const r of visible()){
      const row=document.createElement('label');row.className='label-choice';
      const input=document.createElement('input');input.type='checkbox';input.checked=selection.has(r.key);
      const text=document.createElement('span');text.textContent=`${r.material} · ${r.colorName} · ${r.colorCode}`;
      input.addEventListener('change',()=>{if(input.checked)selection.add(r.key);else selection.delete(r.key);update();});
      row.append(input,text);$('#labels-list').append(row);
    }
    if(!visible().length)$('#labels-list').textContent='Keine passenden Farben vorhanden.';
    update();
  }
  function update(){ $('#labels-count').textContent=`${selection.size} von ${variants.length} Farben ausgewählt`;$('#labels-preview').disabled=!selection.size; }
  trigger.addEventListener('click',()=>{
    variants=labelVariants(getRolls());selection=new Set();
    $('#labels-search').value='';$('#labels-error').textContent='';render();dialog.showModal();
  });
  $('#labels-close').onclick=()=>dialog.close();
  $('#labels-search').oninput=render;
  $('#labels-all').onclick=()=>{for(const r of visible())selection.add(r.key);render();};
  $('#labels-none').onclick=()=>{selection.clear();render();};
  $('#labels-preview').onclick=()=>{
    $('#labels-error').textContent='';
    const copies=Number($('#labels-copies').value);
    if(!Number.isInteger(copies)||copies<1||copies>20){$('#labels-error').textContent='Bitte 1 bis 20 Exemplare eingeben.';return;}
    const labels=variants.filter(r=>selection.has(r.key)).flatMap(r=>Array(copies).fill(r));
    try {
      const html=printDocument(labels,$('#labels-mode').value);
      const preview=window.open('','_blank');
      if(!preview)throw new Error('Bitte Pop-ups für die Druckvorschau erlauben.');
      preview.opener=null;preview.document.open();preview.document.write(html);preview.document.close();
    } catch(e){$('#labels-error').textContent=e.message;}
  };
}
