const BASE = window.ORBAT_DATA || {};
const KEY = 'c21-orbat-local-v6-rh-presence';
function freshDB(){
  const base = structuredClone(BASE);
  base.personnel ||= [];
  base.secondaires ||= [];
  base.sheets ||= {};
  base.stocks ||= {};
  (base.personnel||[]).forEach(p=>{p.presence ||= p.statut || 'Actif'});
  return base;
}
function loadDB(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return freshDB();
    const parsed = JSON.parse(raw);
    if(!parsed || !Array.isArray(parsed.personnel) || parsed.personnel.length === 0) return freshDB();
    parsed.secondaires ||= []; parsed.sheets ||= BASE.sheets || {}; parsed.stocks ||= BASE.stocks || {};
    (parsed.personnel||[]).forEach(p=>{p.presence ||= p.statut || 'Actif'});
    return parsed;
  }catch(e){ return freshDB(); }
}
let db = loadDB();
let selected=null;
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const RANK_ORDER=['Recruit','Private','Private First Class','Lance Corporal','Specialist','Corporal','Sergeant','Staff Sergeant','Gunnery Sergeant','First Sergeant','Master Sergeant','Master Gunnery Sergeant','Sergeant Major','Second Lieutenant','First Lieutenant','Captain','Major','Lieutenant Colonel','Colonel','Brigadier General','Major General','Lieutenant General','General'];
const PRESENCES=['Actif','Fantôme','Cryo'];
const PRESENCE_CLASS={'Actif':'active','Fantôme':'ghost','Cryo':'cryo'};
const RANK_ABBR={PVT:'Private',PFC:'Private First Class',LCPL:'Lance Corporal',SPEC:'Specialist',CPL:'Corporal',SGT:'Sergeant',SSGT:'Staff Sergeant',GYSGT:'Gunnery Sergeant',MSGT:'Master Sergeant','1SGT':'First Sergeant',MGYSGT:'Master Gunnery Sergeant',SGTMAJ:'Sergeant Major','2LT':'Second Lieutenant','1LT':'First Lieutenant',LT:'Lieutenant',CPT:'Captain',MAJ:'Major',LTCOL:'Lieutenant Colonel',COL:'Colonel',ENS:'Ensign',PO3:'Petty Officer 3rd Class',PO2:'Petty Officer 2nd Class',PO1:'Petty Officer 1st Class',CPO:'Chief Petty Officer'};
const esc=x=>String(x??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const clean=x=>String(x??'').replace(/\s+/g,' ').trim();
const uniq=a=>[...new Set(a.filter(Boolean).map(clean))];
function save(){localStorage.setItem(KEY,JSON.stringify(db));$('#saveState').textContent='Sauvegardé localement'}
function rankScore(g){let i=RANK_ORDER.findIndex(r=>clean(g).toLowerCase()===r.toLowerCase());return i<0?999-i:i}
function getFormations(){let first=db.sheets?.Formations?.[0]||[];return uniq(first.slice(1));}
function getSpecialisations(){let bad=/conditions|spécialisations|perso principal|fonctions|recrutement|place unique|hospital corps|private|sergeant|corporal|lieutenant|captain|la$/i;let cells=(db.sheets?.['Spécialisations']||[]).flat().map(clean);let specs=cells.filter(c=>c.length>2&&!bad.test(c)&&!/^\d+\s*op/i.test(c)&&!/^fsu|fps|fou/i.test(c));return uniq(specs).sort((a,b)=>a.localeCompare(b,'fr'));}
function getMedals(){let fromPeople=db.personnel.flatMap(p=>p.medailles||[]).filter(m=>m&&m!=='-');let rows=db.sheets?.['Décorations']||[];let fromSheet=[];rows.forEach(r=>r.forEach(c=>{c=clean(c).split('\n')[0];if(c&&!/^\d+$/.test(c)&&!/(points|ruban|nom|conditions|campagnes|distinctions)/i.test(c))fromSheet.push(c)}));return uniq([...fromPeople,...fromSheet]).sort((a,b)=>a.localeCompare(b,'fr'));}
function init(){
  $$('.tab').forEach(b=>b.onclick=()=>{$$('.tab').forEach(x=>x.classList.remove('active'));$$('.view').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('#'+b.dataset.view).classList.add('active')});
  fillFilters(); renderAll();
  $('#search').oninput=renderPeople; $('#gradeFilter').onchange=renderPeople; $('#formationFilter').onchange=renderPeople; $('#presenceFilter').onchange=renderPeople;
  $('#newBtn').onclick=()=>edit({id:'new-'+Date.now(),nom:'Nouvelle recrue',grade:'Private',op:'',formations:[],medailles:[],role:'',specialisation:'',presence:'Actif',notes:'',statut:'Actif'});
  $('#editor').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);let p={id:f.get('id')||('p-'+Date.now()),nom:f.get('nom'),grade:f.get('grade'),op:f.get('op'),role:f.get('role'),specialisation:f.get('specialisation'),formations:$$('#formationChecks input:checked').map(x=>x.value),medailles:$$('#medalChecks input:checked').map(x=>x.value),notes:f.get('notes'),presence:f.get('presence')||'Actif',statut:f.get('presence')||'Actif'};let i=db.personnel.findIndex(x=>x.id===p.id); if(i>=0)db.personnel[i]=p;else db.personnel.push(p); selected=p.id; save(); fillFilters(); renderAll();};
  $('#deleteBtn').onclick=()=>{if(!selected)return; db.personnel=db.personnel.filter(p=>p.id!==selected);selected=null;save();renderAll()};
  $('#exportBtn').onclick=()=>{let blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'});let a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='c21-orbat-export.json';a.click()};
  $('#resetBtn').onclick=()=>{if(confirm('Revenir aux données extraites depuis Excel ?')){localStorage.removeItem(KEY);db=freshDB();selected=null;fillFilters();renderAll()}};
}
function fillFilters(){let grades=uniq(db.personnel.map(p=>p.grade)).sort((a,b)=>rankScore(a)-rankScore(b));let forms=getFormations();let specs=getSpecialisations();let medals=getMedals();$('#gradeFilter').innerHTML='<option value="">Tous les grades</option>'+grades.map(g=>`<option>${esc(g)}</option>`).join('');$('#formationFilter').innerHTML='<option value="">Toutes formations</option>'+forms.map(g=>`<option>${esc(g)}</option>`).join('');$('#presenceFilter').innerHTML='<option value="">Toute présence</option>'+PRESENCES.map(x=>`<option>${esc(x)}</option>`).join('');$('select[name=grade]').innerHTML=grades.concat(RANK_ORDER).filter((v,i,a)=>v&&a.indexOf(v)==i).map(g=>`<option>${esc(g)}</option>`).join('');$('select[name=specialisation]').innerHTML='<option value="">Aucune</option>'+specs.map(s=>`<option>${esc(s)}</option>`).join('');$('#formationChecks').innerHTML=forms.map(f=>`<label class="check"><input type="checkbox" value="${esc(f)}"> ${esc(f)}</label>`).join('');$('#medalChecks').innerHTML=medals.map(m=>`<label class="check"><input type="checkbox" value="${esc(m)}"> ${esc(m)}</label>`).join('')}
function renderAll(){renderKpis();renderPeople();renderStocks();renderHierarchy();}
function renderKpis(){ db.personnel ||= []; db.secondaires ||= []; $('#kpiPersonnel').textContent=db.personnel.length; $('#kpiGrades').textContent=new Set(db.personnel.map(p=>p.grade).filter(Boolean)).size; $('#kpiFormations').textContent=new Set(db.personnel.flatMap(p=>p.formations||[])).size; $('#kpiSecondaires').textContent=db.secondaires.length; renderBars('#gradeBars',countBy(db.personnel,p=>p.grade||'Sans grade'),true); renderBars('#formationBars',countBy(db.personnel.flatMap(p=>p.formations||['Sans formation']),x=>x||'Sans formation'),false);}
function countBy(list,fn){let c={};list.forEach(x=>{let k=fn(x);c[k]=(c[k]||0)+1});return c}
function renderBars(sel,counts,ranked){let entries=Object.entries(counts);entries.sort(ranked?(a,b)=>rankScore(a[0])-rankScore(b[0]):(a,b)=>b[1]-a[1]);let max=Math.max(...entries.map(x=>x[1]),1);$(sel).innerHTML=entries.map(([g,n])=>`<div class="bar"><span>${esc(g)}</span><i style="width:${n/max*100}%"></i><b>${n}</b></div>`).join('')}
function renderPeople(){let q=($('#search').value||'').toLowerCase(),gf=$('#gradeFilter').value,ff=$('#formationFilter').value,pf=$('#presenceFilter').value;let list=db.personnel.filter(p=>(p.presence ||= p.statut || 'Actif')&&(!gf||p.grade===gf)&&(!ff||(p.formations||[]).includes(ff))&&(!pf||p.presence===pf)&&JSON.stringify(p).toLowerCase().includes(q));list.sort((a,b)=>rankScore(a.grade)-rankScore(b.grade)||a.nom.localeCompare(b.nom,'fr'));$('#personList').innerHTML=list.map(p=>`<article class="person presence-${PRESENCE_CLASS[p.presence]||'active'} ${p.id===selected?'selected':''}" data-id="${p.id}"><div class="presenceBadge">${esc(p.presence)}</div><h3>${esc(p.nom)}</h3><p>${esc(p.grade||'Sans grade')} · OP ${esc(p.op||'-')}</p><div class="tags">${(p.formations||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}${p.specialisation?`<span class="tag spec">${esc(p.specialisation)}</span>`:''}</div></article>`).join('')||'<p class="muted">Aucun résultat.</p>';$$('.person').forEach(x=>x.onclick=()=>edit(db.personnel.find(p=>p.id===x.dataset.id)))}
function edit(p){selected=p.id;let f=$('#editor');f.elements['id'].value=p.id;f.elements['nom'].value=p.nom||'';f.elements['grade'].value=p.grade||'';f.elements['op'].value=p.op||'';f.elements['role'].value=p.role||'';f.elements['specialisation'].value=p.specialisation||'';f.elements['presence'].value=p.presence||p.statut||'Actif';$$('#formationChecks input').forEach(x=>x.checked=(p.formations||[]).includes(x.value));$$('#medalChecks input').forEach(x=>x.checked=(p.medailles||[]).includes(x.value));f.elements['notes'].value=p.notes||'';renderPeople();}
function renderStocks(){let groups=db.stocks;$('#stockGrid').innerHTML=Object.entries(groups||{}).map(([name,items])=>`<div class="panel stockcard"><h3>${esc(name.replaceAll('_',' '))}</h3><table><thead><tr><th>Nom</th><th>Dispo</th><th>Perdu/Place</th></tr></thead><tbody>${items.slice(0,60).map(it=>`<tr><td>${esc(it.nom)}</td><td>${esc(it.disponible)}</td><td>${esc(it.perdu||it.place||it.detruit||'')}</td></tr>`).join('')}</tbody></table></div>`).join('')}
function parseAssignment(cell){cell=clean(cell);let m=cell.match(/\b(PVT|PFC|LCPL|SPEC|CPL|SGT|SSGT|GYSGT|MSGT|1SGT|MGYSGT|SGTMAJ|2LT|1LT|CPT|MAJ|LTCOL|COL|ENS|PO3|PO2|PO1|CPO|LT)\b\s+(.+)/);if(!m)return null;return {grade:RANK_ABBR[m[1]]||m[1],name:m[2],abbr:m[1]}}
function renderHierarchy(){let rows=db.sheets?.ORBAT2||[];let units=[];let current=null;let unitRe=/(Company|Squad|Team|Platoon|Section|Squadron|Battle Group|Battlegroup|MEU|Aquila|Scorpius|Pegasus|Andromeda|Pleiades)/i;rows.forEach(r=>{for(let i=0;i<r.length;i++){let c=clean(r[i]);if(!c)continue;if(unitRe.test(c)&&!parseAssignment(c)&&c.length<80){current={unit:c,people:[]};units.push(current)}let p=parseAssignment(c);if(p){let role=clean(r[i-1]||'');(current||(current={unit:'État-major / non classé',people:[]},units.push(current))).people.push({...p,role})}}});units=units.filter(u=>u.people.length||/Company|Platoon|Squad|Team|Section|Squadron|Battlegroup|MEU/i.test(u.unit));$('#hierarchyTree').innerHTML=units.map(u=>`<div class="branch"><div class="unit">${esc(u.unit)}</div><div class="nodes">${u.people.sort((a,b)=>rankScore(b.grade)-rankScore(a.grade)).map(p=>`<div class="node"><strong>${esc(p.grade)}</strong><span>${esc(p.name)}</span>${p.role?`<em>${esc(p.role)}</em>`:''}</div>`).join('')||'<div class="node empty">Postes non assignés / IA</div>'}</div></div>`).join('')||'<p class="muted">Aucune donnée hiérarchique exploitable.</p>'}
init();
