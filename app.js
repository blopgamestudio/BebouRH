const BASE = window.ORBAT_DATA || {};
const KEY = 'c21-orbat-local-v12-rh-clean-medals';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const PRESENCES = ['Actif', 'Fantôme', 'Cryo'];
const PRESENCE_CLASS = { 'Actif': 'active', 'Fantôme': 'ghost', 'Cryo': 'cryo' };
const COMMANDS = ['UNICOM', 'NAVCOM'];

const RANK_ORDER = [
  'Recruit','Private','Private First Class','Lance Corporal','Specialist','Corporal',
  'Sergeant','Staff Sergeant','Gunnery Sergeant','First Sergeant','Master Sergeant',
  'Master Gunnery Sergeant','Sergeant Major','Warrant Officer','Chief Warrant Officer',
  'Ensign','Petty Officer 3rd Class','Petty Officer 2nd Class','Petty Officer 1st Class',
  'Chief Petty Officer','Senior Chief Petty Officer','Master Chief Petty Officer',
  'Second Lieutenant','First Lieutenant','Lieutenant','Lieutenant Junior Grade',
  'Lieutenant Commander','Commander','Captain','Major','Lieutenant Colonel','Colonel',
  'Commodore','Rear Admiral','Vice Admiral','Admiral','Brigadier General','Major General',
  'Lieutenant General','General'
];
const RANK_ABBR = {PVT:'Private',PFC:'Private First Class',LCPL:'Lance Corporal',SPEC:'Specialist',CPL:'Corporal',SGT:'Sergeant',SSGT:'Staff Sergeant',GYSGT:'Gunnery Sergeant',MSGT:'Master Sergeant','1SGT':'First Sergeant',MGYSGT:'Master Gunnery Sergeant',SGTMAJ:'Sergeant Major','2LT':'Second Lieutenant','1LT':'First Lieutenant',LT:'Lieutenant',CPT:'Captain',MAJ:'Major',LTCOL:'Lieutenant Colonel',COL:'Colonel',ENS:'Ensign',PO3:'Petty Officer 3rd Class',PO2:'Petty Officer 2nd Class',PO1:'Petty Officer 1st Class',CPO:'Chief Petty Officer',CMDR:'Commander'};

const esc = x => String(x ?? '').replace(/[&<>\"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[m]));
const clean = x => String(x ?? '').replace(/\s+/g, ' ').trim();
const uniq = a => [...new Set(a.filter(Boolean).map(clean))];

function normalizePresence(v){
  v = clean(v || 'Actif').toLowerCase();
  if(v.includes('fant')) return 'Fantôme';
  if(v.includes('cryo')) return 'Cryo';
  return 'Actif';
}
function normalizeCommand(v){
  v = clean(v || 'UNICOM').toUpperCase();
  if(v.includes('NAV')) return 'NAVCOM';
  return 'UNICOM';
}
function normalizeOP(v){
  const n = parseInt(String(v ?? '').replace(/[^0-9-]/g, ''), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
function medalName(v){
  let x = clean(String(v ?? ''));
  if(!x || x === '-') return '';
  x = clean(x.split('\n')[0]);
  
  x = x.replace(/\s+(Pour|Finir|Participer|Participation|Service de|Les officier|Avoir|Obtention|Être|Etre)\b.*$/i, '').trim();
  return x;
}
function splitNames(nom){
  const raw = clean(nom);
  if(!raw) return ['Sans nom'];
  const out = [];
  raw.split('/').forEach(part => {
    const m = part.match(/^(.*?)\s*\((.*?)\)\s*$/);
    if(m){
      if(clean(m[1])) out.push(clean(m[1]));
      if(clean(m[2])) out.push(clean(m[2]));
    }else{
      out.push(clean(part));
    }
  });
  return uniq(out);
}
function splitPersonnel(list){
  const out = [];
  (list || []).forEach((p, idx) => {
    const names = splitNames(p.nom);
    names.forEach((name, i) => {
      const clone = {...p};
      clone.nom = name;
      clone.id = clean(p.id || name).toLowerCase().replace(/[^a-z0-9À-ÿ]+/gi,'-') + (names.length > 1 ? '-' + (i+1) : '');
      clone.medailles = uniq((clone.medailles || []).map(medalName));
      clone.presence = normalizePresence(clone.presence || clone.statut);
      clone.role = normalizeCommand(clone.role || clone.commandement || clone.affectation);
      clone.op = normalizeOP(clone.op);
      clone.formations ||= [];
      clone.specialisation ||= '';
      clone.notes ||= '';
      out.push(clone);
    });
  });
  return out.sort(personSort);
}
function freshDB(){
  const base = structuredClone(BASE);
  base.personnel ||= [];
  base.secondaires ||= [];
  base.sheets ||= {};
  base.meta ||= {};
  base.personnel = splitPersonnel(base.personnel);
  return base;
}
function loadDB(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return freshDB();
    const parsed = JSON.parse(raw);
    if(!parsed || !Array.isArray(parsed.personnel) || parsed.personnel.length === 0) return freshDB();
    parsed.secondaires ||= [];
    parsed.sheets ||= BASE.sheets || {};
    parsed.meta ||= {};
    parsed.personnel = splitPersonnel(parsed.personnel);
    return parsed;
  }catch(e){
    console.error(e);
    return freshDB();
  }
}

let db = loadDB();
let selected = null;

function rankScore(g){
  const v = clean(g).toLowerCase();
  const i = RANK_ORDER.findIndex(r => r.toLowerCase() === v);
  return i < 0 ? 0 : i;
}
function rankLabel(g){ return clean(g || 'Sans grade'); }
function commandScore(role){ return normalizeCommand(role) === 'UNICOM' ? 0 : 1; }
function personSort(a,b){
  return commandScore(a.role) - commandScore(b.role)
    || rankScore(b.grade) - rankScore(a.grade)
    || clean(a.nom).localeCompare(clean(b.nom), 'fr');
}
function formatDateTime(iso){
  if(!iso) return 'jamais';
  try{return new Date(iso).toLocaleString('fr-FR');}catch(e){return 'jamais';}
}
function updateSaveDisplay(){
  const el = $('#lastSave');
  if(el) el.textContent = 'Dernière sauvegarde : ' + formatDateTime(db.meta?.lastSave);
  const st = $('#saveState');
  if(st) st.textContent = 'BDD locale prête';
}
function save(){
  db.meta ||= {};
  db.meta.lastSave = new Date().toISOString();
  localStorage.setItem(KEY, JSON.stringify(db));
  updateSaveDisplay();
}

function getFormations(){
  let first = db.sheets?.Formations?.[0] || [];
  let fromSheet = first.slice(1);
  let fromPeople = db.personnel.flatMap(p => p.formations || []);
  return uniq([...fromSheet, ...fromPeople]).sort((a,b)=>a.localeCompare(b,'fr'));
}
function getSpecialisations(){
  let bad = /conditions|spécialisations|specialisations|perso principal|fonctions|recrutement|place unique|hospital corps|private|sergeant|corporal|lieutenant|captain|la$/i;
  let cells = (db.sheets?.['Spécialisations'] || []).flat().map(clean);
  let specs = cells.filter(c => c.length > 2 && !bad.test(c) && !/^\d+\s*op/i.test(c) && !/^fsu|fps|fou/i.test(c));
  return uniq(specs).sort((a,b)=>a.localeCompare(b,'fr'));
}
function getMedals(){
  const rows = db.sheets?.['Décorations'] || [];
  const fromSheet = [];
  
  rows.slice(2).forEach(r => [1,4,7].forEach(i => {
    const name = medalName(r[i]);
    if(name && !/nom|conditions|points|ruban|campagnes|distinctions/i.test(name)) fromSheet.push(name);
  }));
  const fromPeople = db.personnel.flatMap(p => p.medailles || []).map(medalName);
  return uniq([...fromSheet, ...fromPeople]).sort((a,b)=>a.localeCompare(b,'fr'));
}

function init(){
  $$('.tab').forEach(b => b.onclick = () => {
    $$('.tab').forEach(x => x.classList.remove('active'));
    $$('.view').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    $('#' + b.dataset.view).classList.add('active');
  });
  fillFilters();
  renderAll();
  updateSaveDisplay();

  $('#search').oninput = renderPeople;
  $('#gradeFilter').onchange = renderPeople;
  $('#formationFilter').onchange = renderPeople;
  $('#presenceFilter').onchange = renderPeople;
  $('#newBtn').onclick = () => edit({id:'new-'+Date.now(), nom:'Nouvelle recrue', grade:'Private', op:0, formations:[], medailles:[], role:'UNICOM', specialisation:'', presence:'Actif', notes:'', statut:'Actif'});
  $('#editor').onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const p = {
      id: f.get('id') || ('p-'+Date.now()),
      nom: clean(f.get('nom')) || 'Sans nom',
      grade: f.get('grade') || 'Private',
      op: normalizeOP(f.get('op')),
      role: normalizeCommand(f.get('role')),
      specialisation: f.get('specialisation') || '',
      formations: $$('#formationChecks input:checked').map(x => x.value),
      medailles: $$('#medalChecks input:checked').map(x => x.value),
      notes: f.get('notes') || '',
      presence: normalizePresence(f.get('presence')),
      statut: normalizePresence(f.get('presence'))
    };
    const i = db.personnel.findIndex(x => x.id === p.id);
    if(i >= 0) db.personnel[i] = p; else db.personnel.push(p);
    selected = p.id;
    save();
    fillFilters();
    renderAll();
  };
  $('#deleteBtn').onclick = () => {
    if(!selected) return;
    if(!confirm('Supprimer cette fiche personnel ?')) return;
    db.personnel = db.personnel.filter(p => p.id !== selected);
    selected = null;
    save();
    fillFilters();
    renderAll();
  };
  $('#exportBtn').onclick = exportJSON;
  $('#exportPdfBtn').onclick = exportPDF;
  $('#exportExcelBtn').onclick = exportExcel;
}

function fillFilters(){
  const grades = uniq(db.personnel.map(p => p.grade)).sort((a,b)=>rankScore(b)-rankScore(a));
  const gradeOptions = uniq([...grades, ...RANK_ORDER]).sort((a,b)=>rankScore(b)-rankScore(a));
  const forms = getFormations();
  const specs = getSpecialisations();
  const medals = getMedals();
  $('#gradeFilter').innerHTML = '<option value="">Tous les grades</option>' + grades.map(g => `<option>${esc(g)}</option>`).join('');
  $('#formationFilter').innerHTML = '<option value="">Toutes formations</option>' + forms.map(g => `<option>${esc(g)}</option>`).join('');
  $('#presenceFilter').innerHTML = '<option value="">Toute présence</option>' + PRESENCES.map(x => `<option>${esc(x)}</option>`).join('');
  $('select[name=grade]').innerHTML = gradeOptions.map(g => `<option>${esc(g)}</option>`).join('');
  $('select[name=role]').innerHTML = COMMANDS.map(c => `<option>${esc(c)}</option>`).join('');
  $('select[name=specialisation]').innerHTML = '<option value="">Aucune</option>' + specs.map(s => `<option>${esc(s)}</option>`).join('');
  $('#formationChecks').innerHTML = forms.map(f => `<label class="check"><input type="checkbox" value="${esc(f)}"> ${esc(f)}</label>`).join('');
  $('#medalChecks').innerHTML = medals.map(m => `<label class="check"><input type="checkbox" value="${esc(m)}"> ${esc(m)}</label>`).join('');
}
function renderAll(){ renderKpis(); renderPeople(); renderHierarchy(); }
function countBy(list, fn){ const c = {}; list.forEach(x => { const k = fn(x); c[k] = (c[k] || 0) + 1; }); return c; }
function renderKpis(){
  db.personnel ||= []; db.secondaires ||= [];
  $('#kpiPersonnel').textContent = db.personnel.length;
  $('#kpiGrades').textContent = new Set(db.personnel.map(p => p.grade).filter(Boolean)).size;
  $('#kpiFormations').textContent = new Set(db.personnel.flatMap(p => p.formations || [])).size;
  $('#kpiSecondaires').textContent = db.secondaires.length;
  renderBars('#formationBars', countBy(db.personnel.flatMap(p => p.formations?.length ? p.formations : ['Sans formation']), x => x || 'Sans formation'), false);
  renderBars('#gradeBars', countBy(db.personnel, p => rankLabel(p.grade)), true);
  renderBars('#presenceBars', countBy(db.personnel, p => normalizePresence(p.presence)), false, PRESENCES);
}
function renderBars(sel, counts, ranked, forcedOrder){
  let entries = forcedOrder ? forcedOrder.map(k => [k, counts[k] || 0]) : Object.entries(counts);
  entries.sort(forcedOrder ? (()=>0) : ranked ? ((a,b)=>rankScore(b[0])-rankScore(a[0])) : ((a,b)=>b[1]-a[1]));
  const max = Math.max(...entries.map(x => x[1]), 1);
  $(sel).innerHTML = entries.map(([g,n]) => `<div class="bar"><span>${esc(g)}</span><i style="width:${(n/max*100).toFixed(2)}%"></i><b>${n}</b></div>`).join('');
}
function renderPeople(){
  const q = ($('#search').value || '').toLowerCase();
  const gf = $('#gradeFilter').value;
  const ff = $('#formationFilter').value;
  const pf = $('#presenceFilter').value;
  const list = db.personnel.filter(p => {
    p.presence = normalizePresence(p.presence || p.statut);
    p.role = normalizeCommand(p.role);
    return (!gf || p.grade === gf)
      && (!ff || (p.formations || []).includes(ff))
      && (!pf || p.presence === pf)
      && JSON.stringify(p).toLowerCase().includes(q);
  }).sort(personSort);
  $('#personList').innerHTML = list.map(p => `
    <article class="person presence-${PRESENCE_CLASS[p.presence] || 'active'} ${p.id === selected ? 'selected' : ''}" data-id="${esc(p.id)}">
      <div class="presenceBadge">${esc(p.presence)}</div>
      <h3>${esc(p.nom)}</h3>
      <p>${esc(p.role || 'UNICOM')} · ${esc(p.grade || 'Sans grade')} · ${esc(p.op || 0)} OP</p>
      <div class="tags">${(p.formations || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}${p.specialisation ? `<span class="tag spec">${esc(p.specialisation)}</span>` : ''}</div>
    </article>`).join('') || '<p class="muted">Aucun résultat.</p>';
  $$('.person').forEach(x => x.onclick = () => edit(db.personnel.find(p => p.id === x.dataset.id)));
}
function edit(p){
  if(!p) return;
  selected = p.id;
  const f = $('#editor');
  f.elements['id'].value = p.id;
  f.elements['nom'].value = p.nom || '';
  f.elements['grade'].value = p.grade || '';
  f.elements['op'].value = normalizeOP(p.op);
  f.elements['role'].value = normalizeCommand(p.role);
  f.elements['specialisation'].value = p.specialisation || '';
  f.elements['presence'].value = normalizePresence(p.presence || p.statut);
  $$('#formationChecks input').forEach(x => x.checked = (p.formations || []).includes(x.value));
  $$('#medalChecks input').forEach(x => x.checked = (p.medailles || []).map(medalName).includes(x.value));
  f.elements['notes'].value = p.notes || '';
  renderPeople();
}
function renderStocks(){ }
function parseAssignment(cell){
  cell = clean(cell);
  const m = cell.match(/\b(PVT|PFC|LCPL|SPEC|CPL|SGT|SSGT|GYSGT|MSGT|1SGT|MGYSGT|SGTMAJ|2LT|1LT|CPT|MAJ|LTCOL|COL|ENS|PO3|PO2|PO1|CPO|LT|CMDR)\b\s+(.+)/);
  if(!m) return null;
  return {grade:RANK_ABBR[m[1]] || m[1], name:m[2], abbr:m[1]};
}
function renderHierarchy(){
  const rows = db.sheets?.ORBAT2 || [];
  let units = [];
  let current = null;
  const unitRe = /(Company|Squad|Team|Platoon|Section|Squadron|Battle Group|Battlegroup|MEU|Aquila|Scorpius|Pegasus|Andromeda|Pleiades|UNICOM|NAVCOM)/i;
  rows.forEach(r => {
    for(let i=0;i<r.length;i++){
      const c = clean(r[i]);
      if(!c) continue;
      if(unitRe.test(c) && !parseAssignment(c) && c.length < 90){ current = {unit:c, people:[]}; units.push(current); }
      const p = parseAssignment(c);
      if(p){ const role = clean(r[i-1] || ''); (current || (current={unit:'État-major / non classé', people:[]}, units.push(current))).people.push({...p,role}); }
    }
  });
  units = units.filter(u => u.people.length || unitRe.test(u.unit));
  $('#hierarchyTree').innerHTML = units.map(u => `<div class="branch"><div class="unit">${esc(u.unit)}</div><div class="nodes">${u.people.sort((a,b)=>rankScore(b.grade)-rankScore(a.grade)).map(p => `<div class="node"><strong>${esc(p.grade)}</strong><span>${esc(p.name)}</span>${p.role ? `<em>${esc(p.role)}</em>` : ''}</div>`).join('') || '<div class="node empty">Postes non assignés / IA</div>'}</div></div>`).join('') || '<p class="muted">Aucune donnée hiérarchique exploitable.</p>';
}


function rhOnlyDB(){
  const copy = structuredClone(db);
  delete copy.stocks;
  if(copy.sheets){
    delete copy.sheets.Materiel;
    delete copy.sheets['Matériel'];
    delete copy.sheets.Logistique;
    delete copy.sheets['Flotte (stockage en cours)'];
  }
  copy.meta ||= {};
  copy.meta.version = 'V11 RH allégée';
  copy.meta.note = 'Module Matériel & Logistique retiré : dédié à un autre service.';
  return copy;
}

function exportJSON(){
  const blob = new Blob([JSON.stringify(rhOnlyDB(),null,2)], {type:'application/json'});
  downloadBlob(blob, 'c21-orbat-export.json');
}
function exportExcel(){
  const rows = [['Nom','Commandement','Grade','Nombre OP','Présence','Spécialisation','Formations','Médailles','Notes']]
    .concat(db.personnel.slice().sort(personSort).map(p => [p.nom,p.role,p.grade,p.op,p.presence,p.specialisation,(p.formations||[]).join(', '),(p.medailles||[]).join(', '),p.notes]));
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><table>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table></body></html>`;
  downloadBlob(new Blob([html], {type:'application/vnd.ms-excel'}), 'c21-orbat-export.xls');
}
function exportPDF(){
  const w = window.open('', '_blank');
  const rows = db.personnel.slice().sort(personSort).map(p => `<tr><td>${esc(p.nom)}</td><td>${esc(p.role)}</td><td>${esc(p.grade)}</td><td>${esc(p.op)}</td><td>${esc(p.presence)}</td></tr>`).join('');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Export PDF ORBAT C21</title><style>body{font-family:Arial,sans-serif;color:#111}h1{font-size:22px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #999;padding:6px;font-size:12px}th{background:#ddd}</style></head><body><h1>ORBAT RH — 21st Company</h1><p>Export du ${new Date().toLocaleString('fr-FR')}</p><table><thead><tr><th>Nom</th><th>Commandement</th><th>Grade</th><th>OP</th><th>Présence</th></tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>{window.print();}</script></body></html>`);
  w.document.close();
}
function downloadBlob(blob, filename){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

init();
