(()=>{
const $=s=>document.querySelector(s), fmt=n=>(Number(n)||0).toLocaleString('ru-RU');
const strip=v=>String(v||'').replace(/\s*\[[^\]]+\]\s*$/,'').trim();
const key=h=>{const m=String(h||'').match(/\[([^\]]+)\]\s*$/);return m?m[1]:String(h||'').trim()};
const num=v=>{const n=Number(String(v??'').replace(/\s/g,'').replace(',','.').replace(/[^0-9.\-]/g,''));return Number.isFinite(n)?n:null};
const date=v=>{if(!v)return null;const s=String(v),m=s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);if(m)return new Date(+m[3],+m[2]-1,+m[1]);const d=new Date(s);return isNaN(d)?null:d};
const vcat=v=>{const s=strip(v).toLowerCase();if(!s)return'Не указана';if(s.includes('corp')||s.includes('корп'))return'Корпоративные';if(s.includes('taxi')||s.includes('такс'))return'Такси';if(s.includes('delivery')||s.includes('достав'))return'Доставка';if(s==='gr'||s.includes('b2g'))return'GR / B2G';if(s.includes('carsharing')||s.includes('каршер'))return'Каршеринг';return strip(v)};
const SNAPSHOT_KEY='atom_b2b_crm_snapshot_v2';
const ELMA_FROM=new Date(2026,8,1);
const ALFA_SNAPSHOT_KEY='atom_b2b_alfa_funnel_snapshot_v1';
const REQUESTS_SNAPSHOT_KEY='atom_b2b_elma_requests_snapshot_v1';
const ALFA_FUNNEL_ORDER=['Подтвержден потенциал','Состоялось знакомство с ЛПР','Выявлена потребность','Направлено КП','КП принято','Подписан ДКП','Получена оплата','Передано в доставку','Выданы все автомобили','Отказ'];
const normalizeStageName=v=>String(v||'').toLowerCase().replace(/ё/g,'е').replace(/^\s*\d+\s*[.):-]?\s*/,'').replace(/[^a-zа-я0-9]+/gi,' ').trim().replace(/\s+/g,' ');
const versionEl=document.getElementById('crmVersion');
if(versionEl){const loadedAt=new Date().toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).replace(',','');versionEl.textContent='CRM MVP v1.5 · загрузка '+loadedAt;}
let data=[], current=[];
function parse(matrix){const hs=(matrix[0]||[]).map(key),today=new Date();today.setHours(0,0,0,0);return matrix.slice(1).filter(r=>r.some(x=>String(x||'').trim())).map((r,i)=>{const o={};hs.forEach((h,j)=>o[h]=r[j]??'');const status=strip(o.__status)||'Не указана',active=status!=='Не указана'&&!/(неактив|дисквалиф)/i.test(status);const source=strip(o._lead_source)||'Заливка';const ds=[o._lastActivity,o.lastActivity,o.__statusChangedAt,o.__createdAt].map(date).filter(Boolean);const touch=ds.length?new Date(Math.max(...ds.map(x=>x.getTime()))):null,age=touch?Math.max(0,Math.floor((today-touch)/86400000)):null;const created=date(o.__createdAt||o.createdAt||o._createdAt),statusChanged=date(o.__statusChangedAt);return{id:o.__id||i+1,company:strip(o.lead_company_name||o._company)||strip(o.__name)||'Без названия',owner:strip(o._owner).replace(/\s+/g,' ')||'Не назначен',status,vertical:vcat(o.vertical),source,createdAt:created?created.toISOString():'',statusChangedAt:statusChanged?statusChanged.toISOString():'',touch:touch?touch.toISOString():'',age,active,task:String(o.__tasks_earliest_duedate||''),fleet:num(o.fleet_size_number||o.fleet_size||o.lead_cars_amount),atom:num(o.lead_atom_amount||o.lead_electrocars_amount),phone:String(o.lead_phone||''),email:String(o.lead_email||''),inn:String(o.lead_inn||'')}}).filter(inElmaPeriod)}

function inElmaPeriod(row){if(!row?.createdAt)return false;const d=new Date(row.createdAt);return !Number.isNaN(d.getTime())&&d>=ELMA_FROM}
function recalcAge(row){if(!row.touch)return row;const d=new Date(row.touch);if(Number.isNaN(d.getTime()))return row;const today=new Date();today.setHours(0,0,0,0);row.age=Math.max(0,Math.floor((today-d)/86400000));return row}
function persistSnapshot(fileName){const payload={version:1,fileName:String(fileName||'Выгрузка ELMA'),savedAt:new Date().toISOString(),data};localStorage.setItem(SNAPSHOT_KEY,JSON.stringify(payload));return payload}
function showLoadedState(fileName,restored=false,savedAt=''){const source=String(fileName||'Выгрузка ELMA');if(location.hash!=='#funnel'&&location.hash!=='#dynamics'){$('#dashboard').classList.remove('hidden');$('#globalFilters').classList.remove('hidden')}$('#emptyState').classList.add('hidden');$('#exportBtn').disabled=false;$('#clearBtn').disabled=false;const when=savedAt?new Date(savedAt):null;const suffix=when&&!Number.isNaN(when.getTime())?' · сохранено '+when.toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).replace(',',''):'';$('#fileStatus').textContent=(restored?'Восстановлен последний сохранённый срез'+suffix+'.':'Готово. Данные сохранены в браузере и останутся после обновления страницы.')+' ELMA учитывается с 01.09.2026.';$('#fileStatus').className='statusline ok';summary()}
function restoreSnapshot(){try{const raw=localStorage.getItem(SNAPSHOT_KEY);if(!raw)return false;const saved=JSON.parse(raw);if(!saved||!Array.isArray(saved.data)||!saved.data.length)return false;data=saved.data.map(r=>recalcAge({...r,source:strip(r.source)||'Заливка'})).filter(inElmaPeriod);showLoadedState(saved.fileName,true,saved.savedAt);return true}catch(err){console.warn('CRM snapshot restore failed',err);return false}}
function isoDate(d){return d.toISOString().slice(0,10)}
function startOfWeek(d){const x=new Date(d);x.setHours(0,0,0,0);const day=(x.getDay()+6)%7;x.setDate(x.getDate()-day);return x}
function bucketDate(d,grain){const x=new Date(d);x.setHours(0,0,0,0);if(grain==='day')return x;if(grain==='week')return startOfWeek(x);if(grain==='month')return new Date(x.getFullYear(),x.getMonth(),1);if(grain==='quarter')return new Date(x.getFullYear(),Math.floor(x.getMonth()/3)*3,1);return new Date(x.getFullYear(),0,1)}
function isoWeekNumber(d){const x=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=x.getUTCDay()||7;x.setUTCDate(x.getUTCDate()+4-day);const yearStart=new Date(Date.UTC(x.getUTCFullYear(),0,1));return Math.ceil((((x-yearStart)/86400000)+1)/7)}
function getDynamicsControls(){const fromVal=$('#dynFrom').value,toVal=$('#dynTo').value,grain=$('#dynGrain').value;return{fromVal,toVal,grain,from:fromVal?new Date(fromVal+'T00:00:00'):null,to:toVal?new Date(toVal+'T23:59:59'):null}}
function renderAllDynamics(){renderDynamics(current);renderStatusTransitions(current)}
function alfaSnapshot(){try{const raw=localStorage.getItem(ALFA_SNAPSHOT_KEY);if(!raw)return null;const s=JSON.parse(raw);return s&&Array.isArray(s.stages)?s:null}catch{return null}}
function alfaSummarySnapshot(){return alfaSnapshot()}
function fillSimpleSelect(el,values,placeholder){
  if(!el)return;
  const current=el.value;
  el.innerHTML='<option value="">'+placeholder+'</option>'+values.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join('');
  if(values.includes(current))el.value=current;
}
function renderAlfaSummary(){
  const a=alfaSummarySnapshot();
  const meta=$('#alfaSummaryMeta');
  const rows=Array.isArray(a?.rows)?a.rows:[];
  const companies=[...new Set(rows.map(r=>r.company).filter(Boolean))];
  const owners=[...new Set(rows.map(r=>r.owner).filter(Boolean))];
  const stages=[...new Set(rows.map(r=>r.stage).filter(Boolean))];
  if(meta)meta.textContent=a?'Файл: '+(a.fileName||'Альфа РЛ')+(a.actualDate?' · актуально на '+a.actualDate:''):'Загрузите «Альфа · рабочий лист».';
  $('#aKCompanies').textContent=fmt(companies.length||Math.max(0,...(a?.stages||[]).map(x=>Number(x.count)||0)));
  $('#aKRows').textContent=fmt(rows.length);
  $('#aKStages').textContent=fmt(stages.length||(a?.stages||[]).length);
  $('#aKOwners').textContent=fmt(owners.length);
  const stageCounts={};
  if(rows.length){
    rows.forEach(r=>{if(!r.stage)return;stageCounts[r.stage]=(stageCounts[r.stage]||0)+1});
  }else{
    (a?.stages||[]).forEach(x=>stageCounts[x.name]=Number(x.count)||0);
  }
  bars('#alfaStageBars',stageCounts);

  const ownerBody=$('#alfaOwnersBody'),ownerEmpty=$('#alfaOwnersEmpty');
  if(rows.length&&owners.length){
    ownerEmpty.classList.add('hidden');
    ownerBody.innerHTML=owners.map(o=>{
      const rs=rows.filter(r=>r.owner===o);
      const cs=new Set(rs.map(r=>r.companyKey||r.company).filter(Boolean));
      return '<tr><td>'+esc(o)+'</td><td class="num"><b>'+fmt(cs.size)+'</b></td><td class="num">'+fmt(rs.length)+'</td></tr>';
    }).sort().join('');
  }else{
    ownerBody.innerHTML='';
    ownerEmpty.classList.remove('hidden');
  }

  fillSimpleSelect($('#alfaStageFilter'),stages.sort(),'Все этапы');
  fillSimpleSelect($('#alfaOwnerFilter'),owners.sort(),'Все авторы');
  const q=String($('#alfaSearch')?.value||'').toLowerCase();
  const sf=$('#alfaStageFilter')?.value||'';
  const of=$('#alfaOwnerFilter')?.value||'';
  const filtered=rows.filter(r=>(!q||String(r.company||'').toLowerCase().includes(q))&&(!sf||r.stage===sf)&&(!of||r.owner===of));
  $('#alfaResultCount').textContent=rows.length?'Показано '+fmt(filtered.length)+' из '+fmt(rows.length):'Нет детальных данных';
  const body=$('#alfaSummaryBody'),empty=$('#alfaSummaryEmpty');
  if(rows.length){
    empty.classList.add('hidden');
    body.innerHTML=filtered.map(r=>'<tr><td class="company">'+esc(r.company)+'</td><td>'+esc(r.stage)+'</td><td>'+esc(r.owner||'')+'</td></tr>').join('');
  }else{
    body.innerHTML='';
    empty.classList.remove('hidden');
  }
}
function requestsSnapshot(){try{const raw=localStorage.getItem(REQUESTS_SNAPSHOT_KEY);if(!raw)return null;const s=JSON.parse(raw);return s&&Array.isArray(s.rows)?s:null}catch{return null}}
function normalizeRequestHeader(v){
  return String(v||'').replace(/\s+/g,' ').trim();
}
function requestHeaderKey(v){
  const s=normalizeRequestHeader(v);
  const m=s.match(/\[([^\]]+)\]\s*$/);
  return m?m[1].toLowerCase():s.toLowerCase();
}
function requestHeaderLabel(v){
  return normalizeRequestHeader(v).replace(/\s*\[[^\]]+\]\s*$/,'').trim();
}
function cleanRequestText(v){
  return String(v??'')
    .replace(/\s*\[[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\]\s*/gi,' ')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,' ')
    .replace(/\s{2,}/g,' ')
    .replace(/\s+([,;:.])/g,'$1')
    .replace(/([,;])\s*([,;])+/g,'$1')
    .replace(/^[,;\s]+|[,;\s]+$/g,'')
    .trim();
}
function requestHeaderScore(row){
  let filled=0,hints=0,keys=0,dataLike=0,longText=0;
  (row||[]).forEach(v=>{
    const s=normalizeRequestHeader(v);
    if(!s)return;
    filled++;
    if(/\[[^\]]+\]\s*$/.test(s))keys++;
    if(/статус|дата|создан|обращ|ответствен|исполнител|менеджер|канал|источник|тема|тип|категор|клиент|компан|телефон|почт|email|номер|id|автор|владел/i.test(s))hints++;
    if(/^\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}/.test(s)||/^\+?\d[\d\s()+-]{6,}$/.test(s))dataLike++;
    if(s.length>90)longText++;
  });
  return hints*20+keys*12+filled*2-dataLike*14-longText*4;
}
function detectRequestHeaderRow(matrix){
  let bestRow=0,bestScore=-Infinity;
  const limit=Math.min(matrix.length,50);
  for(let r=0;r<limit;r++){
    const score=requestHeaderScore(matrix[r]||[]);
    if(score>bestScore){bestScore=score;bestRow=r}
  }
  return bestRow;
}
function requestField(headers,patterns,keyPatterns=[]){
  let best=-1,score=-Infinity;
  headers.forEach((h,i)=>{
    const raw=normalizeRequestHeader(h),label=requestHeaderLabel(raw).toLowerCase().replace(/ё/g,'е'),key=requestHeaderKey(raw);
    patterns.forEach((p,rank)=>{if(p.test(label)){const v=200-rank*10-Math.min(label.length,100)/100;if(v>score){score=v;best=i}}});
    keyPatterns.forEach((p,rank)=>{if(p.test(key)){const v=300-rank*10;if(v>score){score=v;best=i}}});
  });
  return best;
}
function requestFieldName(headers,patterns,keyPatterns=[]){const i=requestField(headers,patterns,keyPatterns);return i>=0?headers[i]:''}
function parseRequests(matrix,fileName){
  const headerRow=detectRequestHeaderRow(matrix);
  const rawRow=matrix[headerRow]||[];
  let lastCol=-1;
  for(let i=0;i<rawRow.length;i++){
    const hasHeader=normalizeRequestHeader(rawRow[i]);
    const hasData=matrix.slice(headerRow+1,Math.min(matrix.length,headerRow+80)).some(r=>normalizeRequestHeader((r||[])[i]));
    if(hasHeader||hasData)lastCol=i;
  }
  if(lastCol<0)throw new Error('Не удалось определить колонки файла');
  const sourceHeaders=rawRow.slice(0,lastCol+1).map((v,i)=>normalizeRequestHeader(v)||('Колонка '+(i+1)));
  const seen={};
  const headers=sourceHeaders.map(h=>{seen[h]=(seen[h]||0)+1;return seen[h]>1?h+' '+seen[h]:h});
  const rows=[];
  for(let ri=headerRow+1;ri<matrix.length;ri++){
    const r=(matrix[ri]||[]).slice(0,lastCol+1);
    const values=r.map(v=>String(v??'').trim());
    if(!values.some(Boolean))continue;
    const looksHeaderAgain=values.filter((v,i)=>v&&requestHeaderLabel(v)===requestHeaderLabel(sourceHeaders[i])).length;
    if(looksHeaderAgain>=Math.max(2,Math.floor(headers.length*.35)))continue;
    const o={};headers.forEach((h,i)=>o[h]=r[i]??'');rows.push(o);
  }
  const fields={
    id:requestFieldName(headers,[/^номер$/i,/номер.*обращ/i,/идентификатор/i,/код.*обращ/i,/^id$/i],[/(^|_)(id|number|num)$/i,/request.*id|appeal.*id/i]),
    title:requestFieldName(headers,[/^тема$/i,/тема.*обращ/i,/название.*обращ/i,/наименование.*обращ/i,/^название$/i,/subject/i],[/subject|title|theme|topic/i]),
    status:requestFieldName(headers,[/^статус$/i,/^статус.*обращ/i,/^состояни/i,/^этап$/i],[/^_*status$/i,/^(request|appeal)[_-]?status$/i]),
    owner:headers.find(h=>requestHeaderKey(h)==='responsibility')||requestFieldName(headers,[/^ответственный$/i],[/^responsibility$/i]),
    source:requestFieldName(headers,[/^источник$/i,/источник.*обращ/i,/^канал$/i,/канал.*обращ/i,/откуда/i,/source/i],[/source|channel|origin/i]),
    type:requestFieldName(headers,[/^тип$/i,/тип.*обращ/i,/категор/i,/классификац/i,/вид.*обращ/i,/направлен/i],[/type|category|kind|class/i]),
    created:requestFieldName(headers,[/^дата создания$/i,/дата.*создан/i,/создан.*дата/i,/дата.*обращ/i,/created/i],[/createdat|created_at|creationdate|created/i]),
    closed:requestFieldName(headers,[/дата.*закрыт/i,/закрыт.*дата/i,/дата.*заверш/i,/completed/i,/closed/i],[/closedat|completedat|resolvedat|closed|completed/i]),
    client:requestFieldName(headers,[/^клиент$/i,/компан/i,/контрагент/i,/организац/i,/фио.*клиент/i,/заявител/i],[/client|company|customer|applicant/i]),
    phone:requestFieldName(headers,[/телефон/i,/phone/i],[/phone|mobile|tel/i]),
    email:requestFieldName(headers,[/e-?mail/i,/электрон.*почт/i,/почта/i],[/email|mail/i])
  };
  return{version:3,fileName,savedAt:new Date().toISOString(),headerRow,headers,rows,fields};
}
function requestDate(v){if(!v)return null;const s=String(v).trim(),m=s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);if(m){let y=+m[3];if(y<100)y+=2000;const d=new Date(y,+m[2]-1,+m[1]);return Number.isNaN(d.getTime())?null:d}const d=new Date(s);return Number.isNaN(d.getTime())?null:d}
function requestColumnProfile(rows,header){
  const vals=rows.map(r=>String(r[header]??'').trim()).filter(Boolean).slice(0,500);
  const unique=[...new Set(vals)];
  const n=vals.length||1;
  const dateRate=vals.filter(v=>!!requestDate(v)).length/n;
  const uuidRate=vals.filter(v=>/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(v)).length/n;
  const multiPersonRate=vals.filter(v=>{
    const s=v.replace(/[\[\]{}]/g,' ').replace(/\s+/g,' ').trim();
    const separators=(s.match(/[;,|]/g)||[]).length;
    const surnamePairs=(s.match(/[А-ЯA-Z][а-яa-zёЁ-]+\s+[А-ЯA-Z][а-яa-zёЁ-]+/g)||[]).length;
    return separators>0||surnamePairs>1||s.length>90;
  }).length/n;
  const singleNameRate=vals.filter(v=>{
    if(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(v))return false;
    if(/[;,|]/.test(v)||v.length>80)return false;
    const s=v.replace(/[.,()]/g,' ').replace(/\s+/g,' ').trim();
    const parts=s.split(' ').filter(Boolean);
    return parts.length>=2&&parts.length<=4&&parts.every(p=>/^[А-ЯA-Z][А-Яа-яA-Za-zёЁ-]+$/.test(p));
  }).length/n;
  const sourceRate=vals.filter(v=>/(сайт|форма|телефон|звон|email|e-mail|почт|чат|telegram|whatsapp|веб|web|реклама|партнер|партнёр|мероприят|дилер|входящ)/i.test(v)).length/n;
  const statusRate=vals.filter(v=>/(нов|открыт|закрыт|в работе|обработ|решен|решён|выполн|заверш|ожидан|отказ|неактив|квалиф|создан|принят|назначен)/i.test(v)).length/n;
  const avgLen=vals.reduce((a,v)=>a+v.length,0)/n;
  return{count:vals.length,unique:unique.length,dateRate,nameRate:singleNameRate,singleNameRate,uuidRate,multiPersonRate,sourceRate,statusRate,avgLen};
}
function inferRequestField(headers,rows,kind,used=new Set()){
  let best='',bestScore=-Infinity;
  headers.forEach(h=>{
    if(used.has(h))return;
    const label=requestHeaderLabel(h).toLowerCase().replace(/ё/g,'е'),key=requestHeaderKey(h),p=requestColumnProfile(rows,h);
    if(!p.count)return;
    let score=0;
    if(kind==='created'){
      score=p.dateRate*180+(p.unique>10?15:0);
      if(/дата.*создан|создан.*дата|created|creation/i.test(label+' '+key))score+=220;
      if(/измен|закры|обнов|status/i.test(label+' '+key))score-=80;
    }else if(kind==='status'){
      score=p.statusRate*130+(p.unique>=2&&p.unique<=40?45:0)+(p.avgLen<60?10:0);
      if(/^статус$/i.test(label)||/^_*status$/i.test(key)||/^(request|appeal)[_-]?status$/i.test(key))score+=360;
      else if(/статус.*обращ|состояни|^этап$|status/i.test(label+' '+key))score+=180;
      if(/дата|переход|измен|смен|время|date|changed|change|transition|timestamp/i.test(label+' '+key))score-=420;
      if(p.dateRate>.25)score-=420;
    }else if(kind==='owner'){
      score=p.singleNameRate*220+(p.unique>=2&&p.unique<=120?25:0);
      if(/^ответствен/i.test(label))score+=320;
      else if(/ответствен|исполнител|менеджер|куратор|владел|owner|assignee|executor/i.test(label+' '+key))score+=220;
      if(/список|участник|наблюдател|пользовател|согласующ|команда|members|users|participants/i.test(label+' '+key))score-=350;
      score-=p.uuidRate*420;
      score-=p.multiPersonRate*380;
      if(p.avgLen>80)score-=180;
      if(p.dateRate>.5)score-=200;
    }else if(kind==='source'){
      score=p.sourceRate*150+(p.unique>=2&&p.unique<=80?25:0)+(p.avgLen<80?10:0);
      if(/источник|канал|откуда|source|channel|origin/i.test(label+' '+key))score+=220;
      if(p.dateRate>.5)score-=200;
    }else if(kind==='type'){
      score=(p.unique>=2&&p.unique<=80?35:0)+(p.avgLen<100?15:0);
      if(/тип|категор|классификац|вид|направлен|type|category|kind|class/i.test(label+' '+key))score+=220;
      if(p.dateRate>.5||p.nameRate>.7)score-=120;
    }
    if(score>bestScore){bestScore=score;best=h}
  });
  const min={created:90,status:35,owner:45,source:35,type:30}[kind]||0;
  return bestScore>=min?best:'';
}
function resolveRequestFields(s){
  const rows=s?.rows||[],headers=s?.headers||[],saved=s?.fields||{},used=new Set();
  const out={...saved};

  // ELMA requests: responsible person must come only from "Ответственный [responsibility]".
  const responsibilityHeader=headers.find(h=>requestHeaderKey(h)==='responsibility')
    || headers.find(h=>/^ответственный$/i.test(requestHeaderLabel(h)));
  out.owner=responsibilityHeader||'';
  if(out.owner)used.add(out.owner);

  ['created','status','source','type'].forEach(kind=>{
    let field=out[kind];

    if(kind==='status'){
      const explicitStatus=headers.find(h=>{
        const label=requestHeaderLabel(h).toLowerCase().replace(/ё/g,'е');
        const key=requestHeaderKey(h);
        return /^статус$/.test(label)||/^_*status$/i.test(key)||/^(request|appeal)[_-]?status$/i.test(key);
      });
      if(explicitStatus)field=explicitStatus;
    }

    let valid=field&&headers.includes(field)&&requestValues(rows,field).length;
    if(valid&&kind==='status'){
      const label=requestHeaderLabel(field).toLowerCase().replace(/ё/g,'е');
      const key=requestHeaderKey(field);
      const p=requestColumnProfile(rows,field);
      const looksLikeStatusDate=/дата|переход|измен|смен|время|date|changed|change|transition|timestamp/i.test(label+' '+key);
      if(looksLikeStatusDate||p.dateRate>.25)valid=false;
    }

    if(!valid)field=inferRequestField(headers,rows,kind,used);
    out[kind]=field||'';
    if(field)used.add(field);
  });
  ['id','title','closed','client','phone','email'].forEach(k=>{if(out[k]&&!headers.includes(out[k]))out[k]=''});
  return out;
}

function requestIsClosed(status){return /(закрыт|заверш|выполн|решен|решён|отмен|отказ|архив|closed|done|completed|resolved)/i.test(String(status||''))}
function requestValues(rows,field){return field?[...new Set(rows.map(r=>cleanRequestText(r[field])).filter(Boolean))]:[]}
function requestCounts(rows,field,emptyLabel='Не указано'){const o={};if(!field)return o;rows.forEach(r=>{const v=cleanRequestText(r[field])||emptyLabel;o[v]=(o[v]||0)+1});return o}
function requestChart(rows,createdField,opts={}){
  const chartId=opts.chartId||'#requestsDynChart',noteId=opts.noteId||'#requestsDynNote',totalId=opts.totalId||'#requestsDynTotal';
  const grain=opts.grain||'week',from=opts.from||null,to=opts.to||null;
  const box=$(chartId),note=$(noteId),total=$(totalId);if(!box)return;
  if(!createdField){box.innerHTML='<div class="empty">Колонка даты создания не найдена.</div>';if(note)note.textContent='';if(total)total.textContent='';return}
  const grouped=new Map();let missing=0,outside=0;
  rows.forEach(r=>{
    const d=requestDate(r[createdField]);
    if(!d){missing++;return}
    if((from&&d<from)||(to&&d>to)){outside++;return}
    const b=bucketDate(d,grain),k=isoDate(b);
    if(!grouped.has(k))grouped.set(k,{date:b,count:0});
    grouped.get(k).count++;
  });
  const pts=[...grouped.values()].sort((a,b)=>a.date-b.date);
  const visibleCount=rows.length-missing-outside;
  if(total)total.textContent=fmt(visibleCount)+' обращений';
  if(note){
    const parts=[];
    if(missing)parts.push('Без даты создания: '+fmt(missing));
    if(outside)parts.push('Вне выбранного диапазона: '+fmt(outside));
    note.textContent=parts.join(' · ');
  }
  if(!pts.length){box.innerHTML='<div class="empty">Нет обращений в выбранном периоде.</div>';return}
  const w=Math.max(760,pts.length*72),h=330,pad={l:46,r:18,t:20,b:56},max=Math.max(...pts.map(p=>p.count),1),step=(w-pad.l-pad.r)/Math.max(pts.length-1,1),x=i=>pad.l+i*step,y=v=>pad.t+(h-pad.t-pad.b)*(1-v/max);
  let path='';pts.forEach((p,i)=>path+=(i?'L':'M')+x(i)+','+y(p.count));
  const ticks=[0,.25,.5,.75,1].map(f=>Math.round(max*f));
  const grid=ticks.map(v=>'<line x1="'+pad.l+'" x2="'+(w-pad.r)+'" y1="'+y(v)+'" y2="'+y(v)+'" class="dyn-grid"/><text x="'+(pad.l-8)+'" y="'+(y(v)+4)+'" class="dyn-y" text-anchor="end">'+v+'</text>').join('');
  const dots=pts.map((p,i)=>'<circle cx="'+x(i)+'" cy="'+y(p.count)+'" r="4" class="dyn-dot"><title>'+bucketLabel(p.date,grain)+': '+p.count+'</title></circle>').join('');
  const valueLabels=pts.map((p,i)=>'<text x="'+x(i)+'" y="'+Math.max(14,y(p.count)-10)+'" class="dyn-value-label" text-anchor="middle">'+p.count+'</text>').join('');
  const labels=pts.map((p,i)=>'<text x="'+x(i)+'" y="'+(h-20)+'" class="dyn-x" text-anchor="middle">'+bucketLabel(p.date,grain)+'</text>').join('');
  box.innerHTML='<div class="dyn-scroll"><svg viewBox="0 0 '+w+' '+h+'" width="'+w+'" height="'+h+'" role="img" aria-label="Динамика поступления обращений">'+grid+'<path d="'+path+'" class="dyn-line"/>'+dots+valueLabels+labels+'</svg></div>';
}
function renderRequestsDynamicsPage(){
  const s=requestsSnapshot(),rows=s?.rows||[],f=resolveRequestFields(s||{});
  const {from,to,grain}=getDynamicsControls();
  requestChart(rows,f.created,{chartId:'#requestsDynChartPage',noteId:'#requestsDynNotePage',totalId:'#requestsDynTotalPage',from,to,grain});
}
function renderRequestsSummary(){
  const s=requestsSnapshot(),rows=s?.rows||[],headers=s?.headers||[],f=resolveRequestFields(s||{});
  $('#requestsSummaryMeta').textContent=s?'Файл: '+s.fileName+' · строк данных: '+fmt(rows.length)+' · заголовок Excel: строка '+fmt((s.headerRow??0)+1):'Загрузите файл «Обращения Элма».';

  const statuses=requestValues(rows,f.status).sort((a,b)=>a.localeCompare(b,'ru'));
  const owners=requestValues(rows,f.owner).sort((a,b)=>a.localeCompare(b,'ru'));
  const sources=requestValues(rows,f.source).sort((a,b)=>a.localeCompare(b,'ru'));
  const types=requestValues(rows,f.type).sort((a,b)=>a.localeCompare(b,'ru'));
  fillSimpleSelect($('#requestsStatusFilter'),statuses,'Все статусы');
  fillSimpleSelect($('#requestsOwnerFilter'),owners,'Все ответственные');
  fillSimpleSelect($('#requestsSourceFilter'),sources,'Все каналы');
  fillSimpleSelect($('#requestsTypeFilter'),types,'Все типы');

  const q=String($('#requestsSearch')?.value||'').trim().toLowerCase();
  const sf=$('#requestsStatusFilter')?.value||'',of=$('#requestsOwnerFilter')?.value||'',src=$('#requestsSourceFilter')?.value||'',tf=$('#requestsTypeFilter')?.value||'';
  const fromV=$('#requestsFrom')?.value||'',toV=$('#requestsTo')?.value||'',from=fromV?new Date(fromV+'T00:00:00'):null,to=toV?new Date(toV+'T23:59:59'):null;

  const filtered=rows.filter(r=>{
    if(sf&&cleanRequestText(r[f.status])!==sf)return false;
    if(of&&cleanRequestText(r[f.owner])!==of)return false;
    if(src&&cleanRequestText(r[f.source])!==src)return false;
    if(tf&&cleanRequestText(r[f.type])!==tf)return false;
    if(from||to){
      const d=f.created?requestDate(r[f.created]):null;
      if(!d)return false;
      if(from&&d<from)return false;
      if(to&&d>to)return false;
    }
    if(q){
      const hay=headers.map(h=>cleanRequestText(r[h])).join(' | ').toLowerCase();
      if(!hay.includes(q))return false;
    }
    return true;
  });

  const open=f.status?filtered.filter(r=>!requestIsClosed(cleanRequestText(r[f.status]))).length:0;
  const closed=f.status?filtered.length-open:0;
  const unassigned=f.owner?filtered.filter(r=>!cleanRequestText(r[f.owner])).length:0;
  const cutoff=new Date();cutoff.setHours(0,0,0,0);cutoff.setDate(cutoff.getDate()-6);
  const d7=f.created?filtered.filter(r=>{const d=requestDate(r[f.created]);return d&&d>=cutoff}).length:0;

  $('#rKTotal').textContent=fmt(filtered.length);
  $('#rKOpen').textContent=f.status?fmt(open):'—';
  $('#rKClosed').textContent=f.status?fmt(closed):'—';
  $('#rKUnassigned').textContent=f.owner?fmt(unassigned):'—';
  $('#rK7d').textContent=f.created?fmt(d7):'—';
  $('#rKSources').textContent=f.source?fmt(requestValues(filtered,f.source).length):'—';

  bars('#requestsStatusBars',requestCounts(filtered,f.status));
  bars('#requestsSourceBars',requestCounts(filtered,f.source));
  bars('#requestsTypeBars',requestCounts(filtered,f.type));
  bars('#requestsOwnerBars',requestCounts(filtered,f.owner,'Без ответственного'));
  requestChart(filtered,f.created);

  $('#requestsResultCount').textContent=rows.length?'Показано '+fmt(filtered.length)+' из '+fmt(rows.length):'Нет данных';
  const map=[['Статус',f.status,statuses.length],['Дата',f.created,''],['Ответственный',f.owner?f.owner:'Ответственный [responsibility] не найден',owners.length],['Канал',f.source,sources.length],['Тип',f.type,types.length]].map(x=>x[0]+': '+(x[1]||'не найдено')+(x[2]!==''?' ('+x[2]+')':'')).join(' · ');
  $('#requestsFieldMap').textContent=map;

  const priority=[f.id,f.created,f.title,f.status,f.owner,f.type,f.source,f.client,f.phone,f.email].filter(Boolean);
  const visible=[...new Set([...priority,...headers])];
  $('#requestsSummaryHead').innerHTML=visible.length?'<tr>'+visible.map(h=>'<th>'+esc(requestHeaderLabel(h)||h)+'</th>').join('')+'</tr>':'';
  $('#requestsSummaryBody').innerHTML=filtered.slice(0,1500).map(r=>'<tr>'+visible.map(h=>'<td>'+esc(cleanRequestText(r[h]))+'</td>').join('')+'</tr>').join('');
  $('#requestsSummaryEmpty').classList.toggle('hidden',rows.length>0);
}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function funnelElmaStages(){
  const companiesByStatus=new Map();
  const companyKey=r=>{
    const inn=String(r.inn||'').replace(/\D/g,'');
    if(inn)return 'inn:'+inn;
    return 'name:'+String(r.company||'').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]+/gi,' ').trim().replace(/\s+/g,' ');
  };
  data.forEach(r=>{
    const status=String(r.status||'').trim();
    if(!status||status==='Не указана')return;
    const key=companyKey(r);
    if(!key||key==='name:'||key==='name:без названия')return;
    if(!companiesByStatus.has(status))companiesByStatus.set(status,new Set());
    companiesByStatus.get(status).add(key);
  });
  const rank=status=>{
    const s=String(status||'').toLowerCase();
    if(/нов/.test(s))return 10;
    if(/в работе/.test(s))return 20;
    if(/квалификац/.test(s)&&!/дисквалификац/.test(s))return 30;
    if(/предварител|оценк/.test(s))return 30;
    if(/встреч|знакомств/.test(s))return 40;
    if(/тз|пилот/.test(s))return 50;
    if(/коммерческ|\bкп\b/.test(s))return 60;
    if(/согласован/.test(s))return 70;
    if(/рабоч.*лист|альфа/.test(s))return 80;
    if(/договор|дкп/.test(s))return 90;
    if(/отгруз|выдач|достав/.test(s))return 100;
    if(/дисквалификац|неактив|отказ/.test(s))return 900;
    return 500;
  };
  return [...companiesByStatus.entries()]
    .map(([name,companies])=>({name,count:companies.size,source:'ELMA'}))
    .sort((a,b)=>rank(a.name)-rank(b.name)||a.name.localeCompare(b.name,'ru'));
}
function funnelRowsHtml(stages,counts,cumulative=false){
  const max=Math.max(1,...counts);
  return stages.map((s,i)=>{
    const value=Number(counts[i])||0;
    const width=value<=0?0:(value/max*100);
    const prev=i?Number(counts[i-1])||0:null;
    const conv=prev>0?Math.round(value/prev*100):null;
    const formula=cumulative?stages.slice(i).map(x=>fmt(Number(x.count)||0)).join(' + ')+' = '+fmt(value):'';
    return '<div class="funnel-row"><div class="funnel-step">'+(i+1)+'</div><div class="funnel-main"><div class="funnel-label"><span>'+esc(s.name)+'</span><small>'+s.source+'</small></div><div class="funnel-track"><div class="funnel-bar '+(s.source==='ELMA'?'elma':'alfa')+'" style="width:'+width+'%"><b'+(formula?' title="'+esc(formula)+'"':'')+'>'+fmt(value)+'</b></div></div></div><div class="funnel-conv">'+(conv==null?'':conv+'%')+'</div></div>';
  }).join('');
}
function renderFunnel(){
  const box=$('#funnelStages'),cumulativeBox=$('#funnelStagesCumulative'); if(!box)return;
  const e=funnelElmaStages(),a=alfaSnapshot();
  const stages=[
    ...e,
    ...ALFA_FUNNEL_ORDER.map(name=>{const hit=(a?.countType==='companies'?a.stages:[]).find(x=>normalizeStageName(x.name)===normalizeStageName(name));return{name,count:Number(hit?.count)||0,source:'Альфа'}})
  ];
  $('#funnelElmaMeta').textContent=data.length?'ELMA: воронка по уникальным компаниям':'ELMA: нет данных';
  $('#funnelAlfaMeta').textContent=a&&a.countType==='companies'?'Альфа: '+(a.fileName||'рабочий лист')+(a.actualDate?' · '+a.actualDate:'')+' · по компаниям':'Альфа: загрузите файл заново';
  $('#funnelNotice').textContent=!data.length&&!a?'Загрузите ELMA и «Альфа · рабочий лист», чтобы построить сквозную воронку.':(!a?'Показаны все этапы из ELMA. Для продолжения загрузите «Альфа · рабочий лист».':'');
  if(!stages.some(x=>x.count)){
    const empty='<div class="empty">Нет данных для построения воронки.</div>';
    box.innerHTML=empty;
    if(cumulativeBox)cumulativeBox.innerHTML=empty;
    return;
  }
  const FUNNEL_STAGE_COUNT=13;
  const funnelStages=stages.slice(0,FUNNEL_STAGE_COUNT);
  const counts=funnelStages.map(x=>Number(x.count)||0);
  const cumulativeCounts=counts.map((_,i)=>{
    let total=0;
    for(let j=i;j<FUNNEL_STAGE_COUNT;j++)total+=Number(counts[j])||0;
    return total;
  });
  box.innerHTML=funnelRowsHtml(funnelStages,counts,false);
  if(cumulativeBox)cumulativeBox.innerHTML=funnelRowsHtml(funnelStages,cumulativeCounts,true);
}
function bucketLabel(d,grain){if(grain==='day')return d.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit'});if(grain==='week')return 'Нед. '+isoWeekNumber(d)+' · с '+d.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit'});if(grain==='month')return d.toLocaleDateString('ru-RU',{month:'short',year:'numeric'});if(grain==='quarter')return 'Q'+(Math.floor(d.getMonth()/3)+1)+' '+d.getFullYear();return String(d.getFullYear())}
function renderDynamics(rows){const {from,to,grain}=getDynamicsControls();const dated=rows.map(r=>({r,d:r.createdAt?new Date(r.createdAt):null})).filter(x=>x.d&&!Number.isNaN(x.d.getTime())&&(!from||x.d>=from)&&(!to||x.d<=to));const grouped=new Map();dated.forEach(x=>{const b=bucketDate(x.d,grain),k=isoDate(b);if(!grouped.has(k))grouped.set(k,{date:b,count:0});grouped.get(k).count++});const pts=[...grouped.values()].sort((a,b)=>a.date-b.date);$('#dynTotal').textContent=fmt(dated.length)+' лидов';$('#dynNote').textContent=dated.length===rows.length?'':'Без даты создания: '+fmt(rows.length-dated.length);const box=$('#dynChart');if(!pts.length){const hasCreated=rows.some(r=>r.createdAt);box.innerHTML='<div class="empty">'+(hasCreated?'Нет созданных лидов в выбранном периоде.':'В сохранённом срезе нет даты создания. Один раз замените исходный Excel, после этого динамика будет сохраняться вместе с данными.')+'</div>';return}const w=Math.max(760,pts.length*72),h=340,pad={l:46,r:18,t:20,b:56},max=Math.max(...pts.map(p=>p.count),1),stepX=(w-pad.l-pad.r)/Math.max(pts.length-1,1),y=v=>pad.t+(h-pad.t-pad.b)*(1-v/max),x=i=>pad.l+i*stepX;let path='';pts.forEach((p,i)=>{path+=(i?'L':'M')+x(i)+','+y(p.count)});const yTicks=[0,.25,.5,.75,1].map(f=>Math.round(max*f));const grid=yTicks.map(v=>'<line x1="'+pad.l+'" x2="'+(w-pad.r)+'" y1="'+y(v)+'" y2="'+y(v)+'" class="dyn-grid"/><text x="'+(pad.l-8)+'" y="'+(y(v)+4)+'" class="dyn-y" text-anchor="end">'+v+'</text>').join('');const labels=pts.map((p,i)=>'<text x="'+x(i)+'" y="'+(h-20)+'" class="dyn-x" text-anchor="middle">'+bucketLabel(p.date,grain)+'</text>').join('');const dots=pts.map((p,i)=>'<circle cx="'+x(i)+'" cy="'+y(p.count)+'" r="4" class="dyn-dot"><title>'+bucketLabel(p.date,grain)+': '+p.count+'</title></circle>').join('');box.innerHTML='<div class="dyn-scroll"><svg viewBox="0 0 '+w+' '+h+'" width="'+w+'" height="'+h+'" role="img" aria-label="Динамика созданных лидов">'+grid+'<path d="'+path+'" class="dyn-line"/>'+dots+labels+'</svg></div>'}
function statusClassName(status){const s=String(status||'').toLowerCase();if(/дисквалиф|неактив/.test(s))return'status-inactive';if(/квалификац/.test(s))return'status-qualified';if(/в работе/.test(s))return'status-work';if(/нов/.test(s))return'status-new';return'status-other'}
function renderStatusTransitions(rows){const {from,to,grain}=getDynamicsControls();const hasStatusDate=rows.some(r=>r.statusChangedAt);if(rows.length&&!hasStatusDate){$('#statusTransitionTotal').textContent='—';$('#statusTransitionLegend').innerHTML='';$('#statusTransitionNote').textContent='В сохранённом срезе нет поля Дата перехода в статус [__statusChangedAt]. Один раз загрузите актуальный Excel, после этого поле будет сохраняться вместе с данными.';$('#statusTransitionChart').innerHTML='<div class="empty">Для построения графика загрузите актуальный _opportunities.xlsx один раз.</div>';return}const events=rows.map(r=>({status:r.status||'Не указана',d:r.statusChangedAt?new Date(r.statusChangedAt):null})).filter(x=>x.d&&!Number.isNaN(x.d.getTime())&&(!from||x.d>=from)&&(!to||x.d<=to));const statuses=[...new Set(events.map(x=>x.status))].sort();const grouped=new Map();events.forEach(x=>{const b=bucketDate(x.d,grain),k=isoDate(b);if(!grouped.has(k))grouped.set(k,{date:b,total:0,counts:{}});const g=grouped.get(k);g.counts[x.status]=(g.counts[x.status]||0)+1;g.total++});const pts=[...grouped.values()].sort((a,b)=>a.date-b.date);$('#statusTransitionTotal').textContent=fmt(events.length)+' переходов';$('#statusTransitionNote').textContent='Источник: Дата перехода в статус [__statusChangedAt]. Число над столбцом = всего переходов за период.';$('#statusTransitionLegend').innerHTML=statuses.map(st=>'<span><i class="status-swatch '+statusClassName(st)+'"></i>'+st+'</span>').join('');const box=$('#statusTransitionChart');if(!pts.length){box.innerHTML='<div class="empty">Нет переходов в статус в выбранном периоде.</div>';return}const w=Math.max(760,pts.length*76),h=370,pad={l:46,r:18,t:34,b:62},max=Math.max(...pts.map(p=>p.total),1),plotH=h-pad.t-pad.b,stepX=(w-pad.l-pad.r)/Math.max(pts.length,1),barW=Math.min(36,stepX*.58),y=v=>pad.t+plotH*(1-v/max),base=h-pad.b;const ticks=[0,.25,.5,.75,1].map(f=>Math.round(max*f));const grid=ticks.map(v=>'<line x1="'+pad.l+'" x2="'+(w-pad.r)+'" y1="'+y(v)+'" y2="'+y(v)+'" class="dyn-grid"/><text x="'+(pad.l-8)+'" y="'+(y(v)+4)+'" class="dyn-y" text-anchor="end">'+v+'</text>').join('');const bars=pts.map((p,i)=>{const cx=pad.l+stepX*(i+.5),label=bucketLabel(p.date,grain);let acc=0,rects='';statuses.forEach(st=>{const cnt=p.counts[st]||0;if(!cnt)return;const hh=plotH*(cnt/max),yy=base-acc-hh;rects+='<rect x="'+(cx-barW/2)+'" y="'+yy+'" width="'+barW+'" height="'+hh+'" rx="2" class="status-bar '+statusClassName(st)+'"><title>'+label+' · '+st+': '+cnt+'</title></rect>';acc+=hh});const top=base-plotH*(p.total/max);return '<g>'+rects+'<text x="'+cx+'" y="'+Math.max(14,top-7)+'" class="status-total-label" text-anchor="middle">'+p.total+'</text><text x="'+cx+'" y="'+(h-22)+'" class="dyn-x" text-anchor="middle">'+label+'</text></g>'}).join('');box.innerHTML='<div class="dyn-scroll"><svg viewBox="0 0 '+w+' '+h+'" width="'+w+'" height="'+h+'" role="img" aria-label="Переходы в статус">'+grid+bars+'</svg></div>'}
function setView(view){
  const analytics=view==='analytics',dynamics=view==='dynamics',funnel=view==='funnel',alfaSummary=view==='alfa-summary',requestsSummary=view==='requests-summary';
  $('#dashboard').classList.toggle('hidden',!analytics);
  $('#dynamicsView').classList.toggle('hidden',!dynamics);
  $('#funnelView').classList.toggle('hidden',!funnel);
  $('#alfaSummaryView').classList.toggle('hidden',!alfaSummary);
  $('#requestsSummaryView').classList.toggle('hidden',!requestsSummary);
  $('#globalFilters').classList.toggle('hidden',!analytics||!data.length);
  const leadActions=$('#leadHeaderActions'); if(leadActions)leadActions.classList.toggle('hidden',!analytics);
  $('#emptyState').classList.toggle('hidden',funnel||dynamics||alfaSummary||requestsSummary||data.length>0);
  $('#navAnalytics').classList.toggle('active',analytics);
  $('#navDynamics').classList.toggle('active',dynamics);
  $('#navFunnel').classList.toggle('active',funnel);
  $('#navAlfaSummary').classList.toggle('active',alfaSummary);
  $('#navRequestsSummary').classList.toggle('active',requestsSummary);
  if(dynamics){renderAllDynamics();renderRequestsDynamicsPage();}
  if(funnel)renderFunnel();
  if(alfaSummary)renderAlfaSummary();
  if(requestsSummary)renderRequestsSummary();
}
function count(arr,k){return arr.reduce((m,r)=>(m[r[k]||'Не указано']=(m[r[k]||'Не указано']||0)+1,m),{})}
function bars(id,obj){const e=$(id),a=Object.entries(obj).sort((x,y)=>y[1]-x[1]),mx=Math.max(1,...a.map(x=>x[1]));e.innerHTML=a.map(([k,v])=>`<div class="bar-row"><div>${k}</div><div class="bar-track"><div class="bar" style="width:${v/mx*100}%"></div></div><div class="bar-val">${fmt(v)}</div></div>`).join('')}
function renderOverview(rows){const active=rows.filter(x=>x.active),live=active.filter(x=>x.age!=null&&x.age<=30),stale=active.filter(x=>x.age!=null&&x.age>1);$('#kTotal').textContent=fmt(rows.length);$('#kActive').textContent=fmt(active.length);$('#kLive').textContent=fmt(live.length);$('#kStale').textContent=fmt(stale.length);bars('#statusBars',count(rows,'status'));const owners=count(rows,'owner');$('#owners').innerHTML=Object.entries(owners).sort((x,y)=>y[1]-x[1]).map(([o,n])=>`<tr><td>${o}</td><td class="num"><b>${fmt(n)}</b></td><td class="num">${fmt(rows.filter(x=>x.owner===o&&x.age!=null&&x.age<=30).length)}</td><td class="num">${fmt(rows.filter(x=>x.owner===o&&x.age!=null&&x.age>1).length)}</td><td class="num">${fmt(rows.filter(x=>x.owner===o&&x.task).length)}</td></tr>`).join('')}
function summary(){const activeStatuses=[...new Set(data.filter(x=>x.active).map(x=>x.status))].sort(),allStatuses=[...new Set(data.filter(x=>x.active).map(x=>x.status))].sort(),statusOptions=[...allStatuses,'Неактивные / дисквалифицированные'],verticalOptions=[...new Set(data.map(x=>x.vertical))].sort(),defaultVerticals=verticalOptions.filter(v=>['GR / B2G','Каршеринг','Корпоративные','Не указана'].includes(v));setupMulti('#fStatus',statusOptions,statusOptions);setupMulti('#fVertical',verticalOptions,defaultVerticals);setupMulti('#fSource',[...new Set(data.map(x=>x.source||'Заливка'))].sort(),[]);setupMulti('#fOwner',[...new Set(data.map(x=>x.owner))].sort(),[]);setupMulti('#fHealth',['≤30 дней','31-90 дней','>90 дней','Нет даты','Неактивный'],[]);apply()}
function setupMulti(id,items,selected=[]){const el=$(id);el._values=new Set(selected);el.innerHTML=`<button type="button" class="multi-trigger"><span class="multi-label"></span><span class="multi-chevron">⌄</span></button><div class="multi-menu"><div class="multi-actions"><button type="button" data-ms-all>Выбрать все</button><button type="button" data-ms-clear>Очистить</button></div><div class="multi-options"></div></div>`;const opts=el.querySelector('.multi-options');items.forEach(v=>{const row=document.createElement('label');row.className='multi-option';const cb=document.createElement('input');cb.type='checkbox';cb.value=v;cb.checked=el._values.has(v);const span=document.createElement('span');span.textContent=v;row.append(cb,span);opts.append(row);cb.addEventListener('change',()=>{cb.checked?el._values.add(v):el._values.delete(v);updateMultiLabel(el);apply()})});el.querySelector('.multi-trigger').addEventListener('click',e=>{e.stopPropagation();document.querySelectorAll('.multi-select.open').forEach(x=>{if(x!==el)x.classList.remove('open')});el.classList.toggle('open')});el.querySelector('[data-ms-all]').addEventListener('click',()=>{el._values=new Set(items);opts.querySelectorAll('input').forEach(x=>x.checked=true);updateMultiLabel(el);apply()});el.querySelector('[data-ms-clear]').addEventListener('click',()=>{el._values.clear();opts.querySelectorAll('input').forEach(x=>x.checked=false);updateMultiLabel(el);apply()});updateMultiLabel(el)}
function updateMultiLabel(el){const n=el._values?.size||0,total=el.querySelectorAll('.multi-option input').length,label=el.querySelector('.multi-label');if(!n||n===total)label.textContent='Все';else if(n===1)label.textContent=[...el._values][0];else label.textContent=n+' выбрано'}
function selected(id){return $(id)._values||new Set()}
document.addEventListener('click',e=>{if(!e.target.closest('.multi-select'))document.querySelectorAll('.multi-select.open').forEach(x=>x.classList.remove('open'))});
function fmtCreated(v){if(!v)return'';const d=new Date(v);return Number.isNaN(d.getTime())?'':d.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'})}
function health(r){if(!r.active)return'Неактивный';if(r.age==null)return'Нет даты';if(r.age<=30)return'≤30 дней';if(r.age<=90)return'31-90 дней';return'>90 дней'}
function apply(){const q=$('#fSearch').value.toLowerCase(),ss=selected('#fStatus'),vs=selected('#fVertical'),srcs=selected('#fSource'),os=selected('#fOwner'),hs=selected('#fHealth'),inactiveSelected=ss.has('Неактивные / дисквалифицированные');current=data.filter(r=>(!ss.size||ss.has(r.status)||(inactiveSelected&&!r.active))&&(!vs.size||vs.has(r.vertical))&&(!srcs.size||srcs.has(r.source||'Заливка'))&&(!os.size||os.has(r.owner))&&(!hs.size||hs.has(health(r)))&&(!q||[r.company,r.inn,r.owner,r.phone,r.email].some(x=>String(x||'').toLowerCase().includes(q))));renderOverview(current);renderAllDynamics();renderFunnel();$('#resultCount').textContent=`Показано ${fmt(current.length)} из ${fmt(data.length)}`;$('#tbody').innerHTML=current.slice(0,600).map(r=>`<tr><td class="company">${r.company}</td><td>${fmtCreated(r.createdAt)}</td><td>${r.status}</td><td>${r.vertical}</td><td>${r.owner}</td><td><span class="pill ${r.age!=null&&r.age<=30?'live':r.age>90?'stale':'mid'}">${health(r)}</span></td><td class="num">${r.age??''}</td><td>${r.task||'<span class="muted">нет</span>'}</td><td class="num">${r.fleet??''}</td><td class="num">${r.atom??''}</td><td>${r.phone||r.email?'✓':''}</td></tr>`).join('')}
function csv(){const c=[['Компания','company'],['Статус','status'],['Вертикаль','vertical'],['Ответственный','owner'],['Дней','age'],['Задача','task'],['Автопарк','fleet'],['ATOM','atom'],['Телефон','phone'],['Email','email'],['ИНН','inn']],q=v=>'"'+String(v??'').replaceAll('"','""')+'"';const lines=[c.map(x=>q(x[0])).join(';'),...current.map(r=>c.map(x=>q(r[x[1]])).join(';'))];const b=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='ATOM_B2B_CRM.csv';a.click()}
$('#crmFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const wb=XLSX.read(await f.arrayBuffer(),{type:'array'}),ws=wb.Sheets[wb.SheetNames[0]],m=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false});data=parse(m);const saved=persistSnapshot(f.name);showLoadedState(f.name,false,saved.savedAt)}catch(err){$('#fileStatus').textContent='Ошибка: '+err.message;$('#fileStatus').className='statusline bad'}};
$('#dynFrom').value='2026-09-01';$('#dynTo').value='2026-12-31';$('#navAnalytics').addEventListener('click',e=>{e.preventDefault();history.replaceState(null,'','#analytics');setView('analytics')});$('#navRequestsSummary').addEventListener('click',e=>{e.preventDefault();history.replaceState(null,'','#requests-summary');setView('requests-summary')});$('#navAlfaSummary').addEventListener('click',e=>{e.preventDefault();history.replaceState(null,'','#alfa-summary');setView('alfa-summary')});$('#navFunnel').addEventListener('click',e=>{e.preventDefault();history.replaceState(null,'','#funnel');setView('funnel')});$('#navDynamics').addEventListener('click',e=>{e.preventDefault();history.replaceState(null,'','#dynamics');setView('dynamics')});window.addEventListener('atom-alfa-updated',()=>{renderFunnel();renderAlfaSummary()});['#alfaSearch','#alfaStageFilter','#alfaOwnerFilter'].forEach(id=>{const el=$(id);if(el){el.addEventListener('input',renderAlfaSummary);el.addEventListener('change',renderAlfaSummary)}});['#dynFrom','#dynTo','#dynGrain'].forEach(id=>{const el=$(id);const rerenderDynamics=()=>{renderAllDynamics();renderRequestsDynamicsPage()};el.addEventListener('change',rerenderDynamics);if(el.type==='date')el.addEventListener('input',rerenderDynamics)});$('#fSearch').addEventListener('input',apply);$('#exportBtn').onclick=csv;$('#resetBtn').onclick=()=>{$('#fSearch').value='';const activeStatuses=[...new Set(data.filter(x=>x.active).map(x=>x.status))].sort(),statusOptions=[...activeStatuses,'Неактивные / дисквалифицированные'],verticalOptions=[...new Set(data.map(x=>x.vertical))].sort(),defaultVerticals=verticalOptions.filter(v=>['GR / B2G','Каршеринг','Корпоративные','Не указана'].includes(v));setupMulti('#fStatus',statusOptions,statusOptions);setupMulti('#fVertical',verticalOptions,defaultVerticals);setupMulti('#fSource',[...new Set(data.map(x=>x.source||'Заливка'))].sort(),[]);setupMulti('#fOwner',[...new Set(data.map(x=>x.owner))].sort(),[]);setupMulti('#fHealth',['≤30 дней','31-90 дней','>90 дней','Нет даты','Неактивный'],[]);apply()};const requestsFile=$('#requestsFile'),requestsStatus=$('#requestsFileStatus'),requestsClear=$('#requestsClearBtn');
function restoreRequests(){
  const s=requestsSnapshot();if(!s)return false;
  requestsClear.disabled=false;
  const f=resolveRequestFields(s);
  s.fields=f;
  try{localStorage.setItem(REQUESTS_SNAPSHOT_KEY,JSON.stringify(s))}catch{}
  requestsStatus.textContent='Восстановлен файл: '+s.fileName+' · '+fmt(s.rows.length)+' обращений';
  requestsStatus.className='statusline ok';
  return true
}
requestsFile.onchange=async e=>{const f=e.target.files[0];if(!f)return;requestsStatus.textContent='Читаю файл...';try{const wb=XLSX.read(await f.arrayBuffer(),{type:'array'}),ws=wb.Sheets[wb.SheetNames[0]],m=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false}),snap=parseRequests(m,f.name);snap.fields=resolveRequestFields(snap);localStorage.setItem(REQUESTS_SNAPSHOT_KEY,JSON.stringify(snap));requestsStatus.textContent='Готово: '+f.name+' · '+fmt(snap.rows.length)+' обращений. Данные сохранены в браузере.';requestsStatus.className='statusline ok';requestsClear.disabled=false;renderRequestsSummary();renderRequestsDynamicsPage();if(location.hash==='#requests-summary')setView('requests-summary')}catch(err){requestsStatus.textContent='Ошибка: '+err.message;requestsStatus.className='statusline bad'}finally{requestsFile.value=''}};
requestsClear.onclick=()=>{localStorage.removeItem(REQUESTS_SNAPSHOT_KEY);requestsStatus.textContent='Файл не загружен.';requestsStatus.className='statusline';requestsClear.disabled=true;renderRequestsSummary();renderRequestsDynamicsPage()};
['#requestsSearch','#requestsStatusFilter','#requestsOwnerFilter','#requestsSourceFilter','#requestsTypeFilter','#requestsFrom','#requestsTo'].forEach(id=>{const el=$(id);if(el){el.addEventListener('input',renderRequestsSummary);el.addEventListener('change',renderRequestsSummary)}});
const requestsSearchClear=$('#requestsSearchClear');if(requestsSearchClear)requestsSearchClear.addEventListener('click',()=>{$('#requestsSearch').value='';renderRequestsSummary();$('#requestsSearch').focus()});
restoreRequests();
$('#clearBtn').onclick=()=>{localStorage.removeItem(SNAPSHOT_KEY);location.reload()};restoreSnapshot();setView(location.hash==='#dynamics'?'dynamics':location.hash==='#funnel'?'funnel':location.hash==='#alfa-summary'?'alfa-summary':location.hash==='#requests-summary'?'requests-summary':'analytics');
})();

(()=>{
const BUCKET='plan-source-files',
      alfaFile=document.getElementById('alfaFile'),
      alfaDate=document.getElementById('alfaActualDate'),
      alfaStatus=document.getElementById('alfaFileStatus');
let sb=window.ATOMSupabase||null;
const enc=t=>{const b=new TextEncoder().encode(String(t||''));let s='';b.forEach(x=>s+=String.fromCharCode(x));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')};
const safe=n=>String(n||'file').replace(/[\\/]+/g,'_').replace(/[\u0000-\u001f\u007f]/g,'_').slice(0,160);
const setAlfa=(t,cl='')=>{if(!alfaStatus)return;alfaStatus.textContent=t;alfaStatus.className='statusline'+(cl?' '+cl:'')};
const connectAuth=auth=>{
  if(auth?.client)sb=auth.client;
  const user=document.getElementById('authUserEmail');
  if(user&&auth?.user?.email)user.textContent=auth.user.email;
};
document.addEventListener('atom-auth-ready',e=>connectAuth(e.detail));
if(window.ATOMSupabase&&window.ATOMAuthUser)connectAuth({client:window.ATOMSupabase,user:window.ATOMAuthUser});
if(alfaDate){const d=new Date();alfaDate.value=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}if(alfaFile)alfaFile.addEventListener('change',async()=>{
  const file=alfaFile.files?.[0];
  if(!file)return;
  const actual=alfaDate?.value;
  if(!actual){setAlfa('Укажите дату актуальности.','bad');alfaFile.value='';return}
  setAlfa('Сохраняю файл...');
  alfaFile.disabled=true;
  try{
    const{data,error}=await sb.auth.getUser();
    if(error||!data?.user)throw new Error('Нет активной авторизации');
    const stamp=Date.now(),source='АЛЬФА РАБОЧИЙ ЛИСТ',name='registry__crm__'+stamp+'__'+enc(source)+'__'+actual+'__'+safe(file.name),path=data.user.id+'/'+name;
    const res=await sb.storage.from(BUCKET).upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type||'application/octet-stream'});
    if(res.error)throw res.error;

    let parseWarning='';
    try{
      const ab=await file.arrayBuffer();
      const wb=XLSX.read(ab,{type:'array'}),ws=wb.Sheets[wb.SheetNames[0]],matrix=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false});
      let headerRow=0,statusCol=-1,companyCol=-1,best=-1,companyBest=-1;
      for(let r=0;r<Math.min(matrix.length,35);r++){
        const row=matrix[r]||[];
        row.forEach((v,i)=>{
          const s=String(v||'').trim();
          const statusScore=(/статус рабочего листа/i.test(s)?8:0)+(/статус сделки/i.test(s)?7:0)+(/^статус$/i.test(s)?6:0)+(/этап/i.test(s)?5:0)+(/^stage$/i.test(s)?5:0);
          if(statusScore>best){best=statusScore;headerRow=r;statusCol=i}
          const companyScore=(/^компания$/i.test(s)?10:0)+(/наименование.*компан/i.test(s)?9:0)+(/название.*компан/i.test(s)?9:0)+(/наименование.*клиент/i.test(s)?9:0)+(/название.*клиент/i.test(s)?9:0)+(/^клиент$/i.test(s)?8:0)+(/контрагент/i.test(s)?7:0)+(/организац/i.test(s)?6:0);
          if(companyScore>companyBest){companyBest=companyScore;companyCol=i}
        });
      }
      if(statusCol<0)throw new Error('не найдена колонка статуса/этапа');
      const header=matrix[headerRow]||[];
      if(companyCol<0||!String(header[companyCol]||'').trim())throw new Error('не найдена колонка компании/клиента');
      const order=[],companies=new Map();
      const normalizeCompany=v=>String(v||'').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]+/gi,' ').trim().replace(/\s+/g,' ');
      for(let r=headerRow+1;r<matrix.length;r++){
        const row=matrix[r]||[],stage=String(row[statusCol]||'').trim(),company=normalizeCompany(row[companyCol]);
        if(!stage||!company)continue;
        if(!companies.has(stage)){companies.set(stage,new Set());order.push(stage)}
        companies.get(stage).add(company);
      }
      const numbered=order.length>0&&order.every(x=>/^\s*\d+/.test(x));
      if(numbered)order.sort((a,b)=>(parseInt(a)||0)-(parseInt(b)||0));
      let ownerCol=-1,ownerHeaderRow=-1,ownerBest=-Infinity;
      const topRows=Math.min(matrix.length,35);
      const looksLikeName=v=>{
        const s=String(v||'').trim();
        if(!s||/^\d+(?:[.,]\d+)?$/.test(s))return false;
        if(!/[A-Za-zА-Яа-яЁё]/.test(s))return false;
        const parts=s.replace(/[.,()]/g,' ').split(/\s+/).filter(Boolean);
        return parts.length>=2 || /[А-ЯA-Z][а-яa-z]+\s+[А-ЯA-Z]\.?[А-ЯA-Z]?\.?/u.test(s);
      };
      for(let hr=0;hr<topRows;hr++){
        const hrow=matrix[hr]||[];
        hrow.forEach((v,i)=>{
          const s=String(v||'').trim();
          if(!/автор|author|фио.*автор|автор.*фио/i.test(s))return;
          if(/id|код|номер|uid|guid/i.test(s))return;
          const sample=matrix.slice(hr+1,Math.min(matrix.length,hr+41)).map(r=>String((r||[])[i]||'').trim()).filter(Boolean);
          const numeric=sample.filter(x=>/^\d+(?:[.,]\d+)?$/.test(x)).length;
          const names=sample.filter(looksLikeName).length;
          const base=(/^автор$/i.test(s)?120:0)+(/автор.*фио|фио.*автор/i.test(s)?150:0)+(/автор.*имя|имя.*автор/i.test(s)?130:0)+(/author/i.test(s)?60:0);
          const score=base+names*12-numeric*20;
          if(score>ownerBest){ownerBest=score;ownerCol=i;ownerHeaderRow=hr}
        });
      }
      if(ownerCol>=0){
        const sample=matrix.slice(ownerHeaderRow+1,Math.min(matrix.length,ownerHeaderRow+41)).map(r=>String((r||[])[ownerCol]||'').trim()).filter(Boolean);
        const names=sample.filter(looksLikeName).length;
        const numeric=sample.filter(x=>/^\d+(?:[.,]\d+)?$/.test(x)).length;
        if(!names||numeric>names){ownerCol=-1;ownerHeaderRow=-1}
      }
      const rows=[];
      const dataStart=Math.max(headerRow,ownerHeaderRow>=0?ownerHeaderRow:headerRow)+1;
      for(let r=dataStart;r<matrix.length;r++){
        const row=matrix[r]||[],stage=String(row[statusCol]||'').trim(),companyRaw=String(row[companyCol]||'').trim(),company=normalizeCompany(companyRaw);
        if(!stage||!company)continue;
        rows.push({stage,company:companyRaw,companyKey:company,owner:ownerCol>=0?String(row[ownerCol]||'').trim():''});
      }
      const ownerHeader=ownerCol>=0&&ownerHeaderRow>=0?String((matrix[ownerHeaderRow]||[])[ownerCol]||''):'';
      const snap={fileName:file.name,actualDate:actual,savedAt:new Date().toISOString(),countType:'companies',stageHeader:String(header[statusCol]||''),companyHeader:String(header[companyCol]||''),ownerHeader,stages:order.map(stage=>({name:stage,count:companies.get(stage).size})),rows};
      localStorage.setItem('atom_b2b_alfa_funnel_snapshot_v1',JSON.stringify(snap));
      window.dispatchEvent(new CustomEvent('atom-alfa-updated'));
    }catch(parseErr){
      parseWarning=parseErr?.message||String(parseErr);
    }

    setAlfa(parseWarning
      ?'Файл сохранён: '+file.name+' · '+actual+'. Воронка не обновлена: '+parseWarning+'.'
      :'Файл сохранён: '+file.name+' · '+actual+'. Воронка обновлена.','ok');
    alfaFile.value='';
  }catch(err){
    setAlfa('Ошибка сохранения: '+(err?.message||String(err)),'bad');
  }finally{
    alfaFile.disabled=false;
  }
});})();