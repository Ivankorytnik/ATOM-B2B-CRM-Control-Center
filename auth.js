(()=>{
'use strict';

const SUPABASE_URL='https://enlyiedwkarajvfsilel.supabase.co';
const SUPABASE_KEY='sb_publishable_YK0GMEpWNTnEp3ImIvONKQ_3IPZdvq5';
const STORAGE_KEY='atom-b2b-crm-auth-v1';
const REDIRECT_URL='https://ivankorytnik.github.io/ATOM-B2B-CRM-Control-Center/';
const RETURN_KEY='atom-b2b-crm-auth-return-v1';
const OLD_KEYS=['atom_access_token','atom_refresh_token','atom-global-auth-v1','atom-sales-plan-auth'];

OLD_KEYS.forEach(key=>localStorage.removeItem(key));

const domainOk=email=>/^[^@\s]+@atom\.team$/i.test(String(email||'').trim());
const shell=document.getElementById('appShell');

const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
  auth:{
    persistSession:true,
    autoRefreshToken:true,
    detectSessionInUrl:true,
    flowType:'implicit',
    storageKey:STORAGE_KEY
  }
});

window.ATOMSupabase=client;

function cleanAuthUrl(){
  if(!location.hash && !/[?&](access_token|refresh_token|token_type|expires_in|expires_at|type|code)=/.test(location.search))return;
  const url=new URL(location.href);
  ['access_token','refresh_token','token_type','expires_in','expires_at','type','code','error','error_code','error_description'].forEach(k=>url.searchParams.delete(k));
  url.hash='';
  history.replaceState(null,'',url.pathname+(url.searchParams.toString()?'?'+url.searchParams.toString():''));
}

function setUserUi(user){
  const email=String(user?.email||'');
  const box=document.getElementById('authUserBox');
  if(box){
    box.replaceChildren();
    const mail=document.createElement('span');
    mail.className='auth-user-email';
    mail.textContent=email;
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='auth-logout';
    btn.textContent='Выйти';
    btn.addEventListener('click',()=>window.ATOMAuth.signOut());
    box.append(mail,btn);
  }
  const emailEl=document.getElementById('authUserEmail');
  if(emailEl)emailEl.textContent=email;
  const logout=document.getElementById('authLogout');
  if(logout)logout.onclick=()=>window.ATOMAuth.signOut();
}

function removeGate(){
  document.getElementById('atomAuthGate')?.remove();
}

function showGate(message='Введите рабочую почту @atom.team.'){
  shell?.classList.add('app-hidden');
  let gate=document.getElementById('atomAuthGate');
  if(!gate){
    gate=document.createElement('section');
    gate.id='atomAuthGate';
    gate.className='atom-auth-gate';
    gate.innerHTML=`
      <div class="atom-auth-card">
        <div class="atom-auth-brand">АТОМ · КОММЕРЧЕСКИЙ ШТАБ</div>
        <h1>Вход для сотрудников</h1>
        <p>Авторизация для B2B CRM Control Center.</p>
        <label class="atom-auth-field">Рабочая почта
          <input id="atomAuthEmail" type="email" autocomplete="email" placeholder="name@atom.team">
        </label>
        <button id="atomAuthSend" class="atom-auth-button" type="button">Получить ссылку на почту</button>
        <div id="atomAuthStatus" class="atom-auth-status"></div>
        <div class="atom-auth-note">После входа сессия сохраняется для B2B CRM Control Center.</div>
      </div>`;
    document.body.prepend(gate);
    const input=gate.querySelector('#atomAuthEmail');
    const send=gate.querySelector('#atomAuthSend');
    const status=gate.querySelector('#atomAuthStatus');
    const submit=async()=>{
      const email=input.value.trim().toLowerCase();
      if(!domainOk(email)){
        status.textContent='Доступ разрешён только для адресов @atom.team.';
        status.className='atom-auth-status bad';
        return;
      }
      send.disabled=true;
      status.textContent='Отправляю ссылку...';
      status.className='atom-auth-status';
      try{localStorage.setItem(RETURN_KEY,location.pathname+location.search+location.hash)}catch{}
      const {error}=await client.auth.signInWithOtp({
        email,
        options:{
          shouldCreateUser:true,
          emailRedirectTo:REDIRECT_URL
        }
      });
      if(error){
        status.textContent=error.message||'Не удалось отправить ссылку.';
        status.className='atom-auth-status bad';
      }else{
        status.textContent='Ссылка отправлена на '+email+'. Откройте последнее письмо.';
        status.className='atom-auth-status ok';
      }
      send.disabled=false;
    };
    send.addEventListener('click',submit);
    input.addEventListener('keydown',e=>{if(e.key==='Enter')submit()});
  }
  const status=gate.querySelector('#atomAuthStatus');
  if(status&&!status.textContent)status.textContent=message;
  gate.style.display='flex';
  document.documentElement.classList.remove('auth-loading');
}

async function validateSession(session){
  if(!session?.access_token)return null;
  let user=session.user||null;
  if(!user?.email){
    const {data,error}=await client.auth.getUser();
    if(error)return null;
    user=data.user||null;
  }
  if(!domainOk(user?.email)){
    await client.auth.signOut({scope:'local'}).catch(()=>{});
    return null;
  }
  return {client,session,user};
}

async function openApp(auth){
  if(!auth)return false;
  window.ATOMAuthUser=auth.user;
  window.ATOMAuthSession=auth.session;
  setUserUi(auth.user);
  removeGate();
  shell?.classList.remove('app-hidden');
  document.documentElement.classList.remove('auth-loading');
  cleanAuthUrl();
  document.dispatchEvent(new CustomEvent('atom-auth-ready',{detail:auth}));
  if(typeof window.startAtomBccApp==='function')window.startAtomBccApp();
  try{
    const saved=localStorage.getItem(RETURN_KEY)||'';
    localStorage.removeItem(RETURN_KEY);
    const current=location.pathname+location.search+location.hash;
    if(saved&&saved!==current&&saved.startsWith('/ATOM-B2B-CRM-Control-Center/')){
      location.replace(saved);
      return true;
    }
  }catch{}
  return true;
}

async function boot(){
  try{
    const hash=new URLSearchParams(location.hash.replace(/^#/,''));
    const access=hash.get('access_token');
    const refresh=hash.get('refresh_token');
    if(access&&refresh){
      const {data,error}=await client.auth.setSession({access_token:access,refresh_token:refresh});
      if(!error){
        const auth=await validateSession(data.session);
        if(auth)return openApp(auth);
      }
    }

    const {data,error}=await client.auth.getSession();
    if(!error&&data.session){
      const auth=await validateSession(data.session);
      if(auth)return openApp(auth);
    }
  }catch(e){
    console.error('ATOM auth boot failed',e);
  }
  showGate();
  return false;
}

window.ATOMAuth={
  client,
  async signOut(){
    await client.auth.signOut({scope:'local'}).catch(()=>{});
    window.ATOMAuthUser=null;
    window.ATOMAuthSession=null;
    location.href=REDIRECT_URL;
  },
  async getSession(){
    const {data}=await client.auth.getSession();
    return data.session||null;
  }
};

window.ATOM_AUTH_READY=boot();
})();