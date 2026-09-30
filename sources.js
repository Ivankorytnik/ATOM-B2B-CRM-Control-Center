(()=>{
'use strict';

const CLOUD_BUCKET='plan-source-files';
const PREFIX='registry__';
const activeProject='crm';
const projectMeta={title:'B2B CRM Control Center',defaultSource:'ELMA'};

const $=id=>document.getElementById(id);
const userEmail=$('authUserEmail');
const logoutBtn=$('authLogout');
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

let sb=window.ATOMSupabase||null;
let currentUser=window.ATOMAuthUser||null;
let busy=false;

const setCloud=(text,type='')=>{cloudStatus.textContent=text;cloudStatus.className='cloud-status'+(type?' '+type:'')};
const setMessage=(text,type='')=>{uploadMessage.textContent=text;uploadMessage.className='message'+(type?' '+type:'')};

function formatRuDate(iso){
  const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m?m[3]+'.'+m[2]+'.'+m[1]:'';
}
function normalizeSource(value){
  return String(value||'').trim().replace(/\s+/g,'_').replace(/_+/g,'_').toUpperCase();
}
function updatePreview(){
  const code=normalizeSource(sourceName.value)||'ИСТОЧНИК';
  const date=formatRuDate(actualDate.value)||'ДД.ММ.ГГГГ';
  sourcePreview.textContent=code+'_'+date;
  uploadBtn.disabled=busy||!sourceFile.files?.[0]||!sourceName.value.trim()||!actualDate.value;
}
function safeName(name){
  return String(name||'file').replace(/[\\/]+/g,'_').replace(/[\u0000-\u001f\u007f]/g,'_').slice(0,160);
}
function encodeText(text){
  const bytes=new TextEncoder().encode(String(text||''));
  let bin='';
  bytes.forEach(b=>bin+=String.fromCharCode(b));
  return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function decodeText(text){
  try{
    let s=String(text||'').replace(/-/g,'+').replace(/_/g,'/');
    while(s.length%4)s+='=';
    const bin=atob(s);
    const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }catch{return 'ИСТОЧНИК'}
}
function parseItem(item){
  const name=String(item?.name||'');
  const modern=name.match(/^registry__(sop09|crm)__(\d+)__(.+?)__(\d{4}-\d{2}-\d{2})__(.+)$/);
  if(modern){
    return {
      path:currentUser.id+'/'+name,
      storageName:name,
      project:modern[1],
      createdAt:Number(modern[2])||0,
      source:decodeText(modern[3]),
      actualDate:modern[4],
      originalName:modern[5],
      updatedAt:item.updated_at||item.created_at||''
    };
  }
  const legacy=name.match(/^registry__(\d+)__(.+?)__(\d{4}-\d{2}-\d{2})__(.+)$/);
  if(!legacy)return null;
  return {
    path:currentUser.id+'/'+name,
    storageName:name,
    project:'sop09',
    createdAt:Number(legacy[1])||0,
    source:decodeText(legacy[2]),
    actualDate:legacy[3],
    originalName:legacy[4],
    updatedAt:item.updated_at||item.created_at||''
  };
}
function formatDateTime(value,stamp){
  const d=value?new Date(value):new Date(stamp||Date.now());
  if(Number.isNaN(d.getTime()))return '';
  return d.toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).replace(',','');
}
function logicalName(entry){
  return normalizeSource(entry.source)+'_'+formatRuDate(entry.actualDate);
}
async function cloudList(){
  const {data,error}=await sb.storage.from(CLOUD_BUCKET).list(currentUser.id,{limit:100,sortBy:{column:'updated_at',order:'desc'}});
  if(error)throw error;
  return (data||[]).map(parseItem).filter(entry=>entry&&entry.project===activeProject).sort((a,b)=>b.createdAt-a.createdAt);
}
async function refreshRegistry(){
  if(!sb||!currentUser)return;
  setCloud('Синхронизация...');
  try{
    const items=await cloudList();
    renderRegistry(items);
    setCloud('Облако подключено · '+projectMeta.title,'ok');
  }catch(e){
    console.error(e);
    setCloud('Ошибка синхронизации','bad');
    setMessage('Не удалось получить список источников: '+(e.message||String(e)),'bad');
  }
}
function renderRegistry(items){
  sourcesBody.replaceChildren();
  sourceCount.textContent=String(items.length);
  emptyState.classList.toggle('hidden',items.length>0);
  tableWrap.classList.toggle('hidden',items.length===0);

  items.forEach(entry=>{
    const tr=document.createElement('tr');

    const tdSource=document.createElement('td');
    const code=document.createElement('div');
    code.className='source-code';
    code.textContent=logicalName(entry);
    tdSource.appendChild(code);

    const tdDate=document.createElement('td');
    tdDate.textContent=formatRuDate(entry.actualDate);

    const tdFile=document.createElement('td');
    tdFile.className='source-file';
    tdFile.title=entry.originalName;
    tdFile.textContent=entry.originalName;

    const tdAdded=document.createElement('td');
    tdAdded.textContent=formatDateTime(entry.updatedAt,entry.createdAt);

    const tdActions=document.createElement('td');
    const actions=document.createElement('div');
    actions.className='row-actions';

    const download=document.createElement('button');
    download.className='row-btn';
    download.type='button';
    download.textContent='Скачать';
    download.addEventListener('click',()=>downloadEntry(entry,download));

    const remove=document.createElement('button');
    remove.className='row-btn danger';
    remove.type='button';
    remove.textContent='Удалить';
    remove.addEventListener('click',()=>deleteEntry(entry,remove));

    actions.append(download,remove);
    tdActions.appendChild(actions);
    tr.append(tdSource,tdDate,tdFile,tdAdded,tdActions);
    sourcesBody.appendChild(tr);
  });
}
async function uploadSource(){
  const file=sourceFile.files?.[0];
  const name=sourceName.value.trim();
  const date=actualDate.value;
  if(!file||!name||!date||!sb||!currentUser)return;

  busy=true;
  updatePreview();
  setMessage('Загружаю '+logicalName({source:name,actualDate:date})+'...');
  try{
    const stamp=Date.now();
    const objectName=PREFIX+activeProject+'__'+stamp+'__'+encodeText(name)+'__'+date+'__'+safeName(file.name);
    const path=currentUser.id+'/'+objectName;
    const {error}=await sb.storage.from(CLOUD_BUCKET).upload(path,file,{
      cacheControl:'3600',
      upsert:false,
      contentType:file.type||'application/octet-stream'
    });
    if(error)throw error;
    setMessage('Источник '+normalizeSource(name)+'_'+formatRuDate(date)+' сохранён.','ok');
    sourceFile.value='';
    filePickText.textContent='Выбрать файл';
    selectedFileName.textContent='Файл не выбран';
    await refreshRegistry();
  }catch(e){
    console.error(e);
    setMessage('Не удалось сохранить файл: '+(e.message||String(e)),'bad');
  }finally{
    busy=false;
    updatePreview();
  }
}
async function downloadEntry(entry,button){
  button.disabled=true;
  try{
    const {data,error}=await sb.storage.from(CLOUD_BUCKET).download(entry.path);
    if(error)throw error;
    const url=URL.createObjectURL(data);
    const a=document.createElement('a');
    a.href=url;
    a.download=entry.originalName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){
    setMessage('Не удалось скачать файл: '+(e.message||String(e)),'bad');
  }finally{
    button.disabled=false;
  }
}
async function deleteEntry(entry,button){
  if(!confirm('Удалить источник '+logicalName(entry)+'?'))return;
  button.disabled=true;
  try{
    const {error}=await sb.storage.from(CLOUD_BUCKET).remove([entry.path]);
    if(error)throw error;
    setMessage('Источник удалён.','ok');
    await refreshRegistry();
  }catch(e){
    setMessage('Не удалось удалить источник: '+(e.message||String(e)),'bad');
    button.disabled=false;
  }
}

function connectAuth(auth){
  if(auth?.client)sb=auth.client;
  if(auth?.user)currentUser=auth.user;
  if(userEmail&&currentUser?.email)userEmail.textContent=currentUser.email;
  if(sb&&currentUser)refreshRegistry();
}
document.addEventListener('atom-auth-ready',e=>connectAuth(e.detail));
if(window.ATOMSupabase&&window.ATOMAuthUser)connectAuth({client:window.ATOMSupabase,user:window.ATOMAuthUser});

const today=new Date();
actualDate.value=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
sourceName.addEventListener('input',updatePreview);
actualDate.addEventListener('input',updatePreview);
sourceFile.addEventListener('change',()=>{
  const file=sourceFile.files?.[0];
  filePickText.textContent=file?'Файл выбран':'Выбрать файл';
  selectedFileName.textContent=file?.name||'Файл не выбран';
  updatePreview();
});
uploadBtn.addEventListener('click',uploadSource);

function applyProjectUi(){
  document.title='АТОМ · Источники · '+projectMeta.title;
  if(projectTitle)projectTitle.textContent=projectMeta.title;
  if(uploadProjectTitle)uploadProjectTitle.textContent=projectMeta.title;
  if(registryProjectTitle)registryProjectTitle.textContent=projectMeta.title;
  if(sourcesHomeLink)sourcesHomeLink.href='./sources.html';
    emptyState.textContent='Источники проекта '+projectMeta.title+' пока не загружены.';
  sourceName.value=projectMeta.defaultSource;
  sourceName.placeholder='Например, ELMA';
}
applyProjectUi();
updatePreview();
})();
