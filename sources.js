(()=>{
'use strict';

const DB_NAME='atom-b2b-crm-local';
const STORE='sources';
const activeProject='crm';
const projectMeta={title:'B2B CRM Control Center',defaultSource:'ELMA'};
const $=id=>document.getElementById(id);
const cloudStatus=$('cloudStatus');
const sourceName=$('sourceName');
const actualDate=$('actualDate');
const sourceFile=$('sourceFile');
const filePickText=$('filePickText');
const selectedFileName=$('selectedFileName');
const sourcePreview=$('sourcePreview');
const uploadBtn=$('uploadBtn');
const uploadMessage=$('uploadMessage');
const sourceCount=$('sourceCount');
const emptyState=$('emptyState');
const tableWrap=$('tableWrap');
const sourcesBody=$('sourcesBody');
const projectTitle=$('projectTitle');
const uploadProjectTitle=$('uploadProjectTitle');
const registryProjectTitle=$('registryProjectTitle');
const sourcesHomeLink=$('sourcesHomeLink');
let busy=false;

const setCloud=(text,type='')=>{cloudStatus.textContent=text;cloudStatus.className='cloud-status'+(type?' '+type:'')};
const setMessage=(text,type='')=>{uploadMessage.textContent=text;uploadMessage.className='message'+(type?' '+type:'')};
const formatRuDate=iso=>{const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?m[3]+'.'+m[2]+'.'+m[1]:''};
const normalizeSource=value=>String(value||'').trim().replace(/\s+/g,'_').replace(/_+/g,'_').toUpperCase();
const logicalName=e=>normalizeSource(e.source)+'_'+formatRuDate(e.actualDate);

function openDb(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'id'})};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
async function tx(mode,fn){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const t=db.transaction(STORE,mode),s=t.objectStore(STORE);
    let result;
    try{result=fn(s)}catch(e){reject(e);return}
    t.oncomplete=()=>resolve(result);
    t.onerror=()=>reject(t.error);
  });
}
async function listItems(){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const t=db.transaction(STORE,'readonly'),s=t.objectStore(STORE),r=s.getAll();
    r.onsuccess=()=>resolve((r.result||[]).filter(x=>x.project===activeProject).sort((a,b)=>b.createdAt-a.createdAt));
    r.onerror=()=>reject(r.error);
  });
}
function updatePreview(){
  const code=normalizeSource(sourceName.value)||'ИСТОЧНИК';
  const date=formatRuDate(actualDate.value)||'ДД.ММ.ГГГГ';
  sourcePreview.textContent=code+'_'+date;
  uploadBtn.disabled=busy||!sourceFile.files?.[0]||!sourceName.value.trim()||!actualDate.value;
}
async function refreshRegistry(){
  try{renderRegistry(await listItems());setCloud('Локальное хранилище','ok')}
  catch(e){console.error(e);setCloud('Ошибка локального хранилища','bad');setMessage('Не удалось открыть локальное хранилище: '+(e.message||String(e)),'bad')}
}
function renderRegistry(items){
  sourcesBody.replaceChildren();
  sourceCount.textContent=String(items.length);
  emptyState.classList.toggle('hidden',items.length>0);
  tableWrap.classList.toggle('hidden',items.length===0);
  items.forEach(entry=>{
    const tr=document.createElement('tr');
    const tdSource=document.createElement('td');const code=document.createElement('div');code.className='source-code';code.textContent=logicalName(entry);tdSource.appendChild(code);
    const tdDate=document.createElement('td');tdDate.textContent=formatRuDate(entry.actualDate);
    const tdFile=document.createElement('td');tdFile.className='source-file';tdFile.title=entry.originalName;tdFile.textContent=entry.originalName;
    const tdAdded=document.createElement('td');tdAdded.textContent=new Date(entry.createdAt).toLocaleString('ru-RU').replace(',','');
    const tdActions=document.createElement('td');const actions=document.createElement('div');actions.className='row-actions';
    const download=document.createElement('button');download.className='row-btn';download.type='button';download.textContent='Скачать';download.onclick=()=>downloadEntry(entry,download);
    const remove=document.createElement('button');remove.className='row-btn danger';remove.type='button';remove.textContent='Удалить';remove.onclick=()=>deleteEntry(entry,remove);
    actions.append(download,remove);tdActions.appendChild(actions);tr.append(tdSource,tdDate,tdFile,tdAdded,tdActions);sourcesBody.appendChild(tr);
  });
}
async function uploadSource(){
  const file=sourceFile.files?.[0],name=sourceName.value.trim(),date=actualDate.value;
  if(!file||!name||!date)return;
  busy=true;updatePreview();setMessage('Сохраняю '+logicalName({source:name,actualDate:date})+'...');
  try{
    const entry={id:'crm_'+Date.now()+'_'+Math.random().toString(36).slice(2),project:activeProject,source:name,actualDate:date,originalName:file.name,createdAt:Date.now(),blob:file};
    await tx('readwrite',s=>s.put(entry));
    setMessage('Источник '+logicalName(entry)+' сохранён в этом браузере.','ok');
    sourceFile.value='';filePickText.textContent='Выбрать файл';selectedFileName.textContent='Файл не выбран';await refreshRegistry();
  }catch(e){console.error(e);setMessage('Не удалось сохранить файл: '+(e.message||String(e)),'bad')}
  finally{busy=false;updatePreview()}
}
async function downloadEntry(entry,button){
  button.disabled=true;
  try{
    const db=await openDb();
    const saved=await new Promise((resolve,reject)=>{const t=db.transaction(STORE,'readonly'),r=t.objectStore(STORE).get(entry.id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
    if(!saved?.blob)throw new Error('Файл не найден');
    const url=URL.createObjectURL(saved.blob),a=document.createElement('a');a.href=url;a.download=saved.originalName||'source';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){setMessage('Не удалось скачать файл: '+(e.message||String(e)),'bad')}
  finally{button.disabled=false}
}
async function deleteEntry(entry,button){
  if(!confirm('Удалить источник '+logicalName(entry)+'?'))return;
  button.disabled=true;
  try{await tx('readwrite',s=>s.delete(entry.id));setMessage('Источник удалён.','ok');await refreshRegistry()}
  catch(e){setMessage('Не удалось удалить источник: '+(e.message||String(e)),'bad');button.disabled=false}
}
const today=new Date();
actualDate.value=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
sourceName.addEventListener('input',updatePreview);
actualDate.addEventListener('input',updatePreview);
sourceFile.addEventListener('change',()=>{const file=sourceFile.files?.[0];filePickText.textContent=file?'Файл выбран':'Выбрать файл';selectedFileName.textContent=file?.name||'Файл не выбран';updatePreview()});
uploadBtn.addEventListener('click',uploadSource);
document.title='АТОМ · Источники · '+projectMeta.title;
if(projectTitle)projectTitle.textContent=projectMeta.title;
if(uploadProjectTitle)uploadProjectTitle.textContent=projectMeta.title;
if(registryProjectTitle)registryProjectTitle.textContent=projectMeta.title;
if(sourcesHomeLink)sourcesHomeLink.href='./sources.html';
emptyState.textContent='Источники проекта '+projectMeta.title+' пока не загружены.';
sourceName.value=projectMeta.defaultSource;
updatePreview();
refreshRegistry();
})();