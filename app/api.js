/* api.js — all server communication. URL comes from config.js. Contract: see API.md */
const API={
  on:!!window.MG_API, base:(window.MG_API||'').replace(/\/$/,''),
  get token(){try{return localStorage.getItem('mg_token')}catch(e){return null}},
  set token(v){try{v?localStorage.setItem('mg_token',v):localStorage.removeItem('mg_token')}catch(e){}},
  get queue(){try{return JSON.parse(localStorage.getItem('mg_queue')||'[]')}catch(e){return[]}},
  set queue(v){try{localStorage.setItem('mg_queue',JSON.stringify(v))}catch(e){}},
  enqueue(j){const q=this.queue;q.push(j);this.queue=q},
  async req(path,o={}){
    const fd=o.body instanceof FormData,h={};
    if(o.body&&!fd)h['Content-Type']='application/json';
    if(this.token)h.Authorization='Bearer '+this.token;
    let r;
    try{r=await fetch(this.base+path,{method:o.method||'GET',headers:h,body:o.body?(fd?o.body:JSON.stringify(o.body)):undefined})}
    catch(e){throw Object.assign(new Error('No connection'),{offline:true})}
    if(r.status===401&&path!=='/auth/login'){this.token=null;S.role=null;go('login');throw new Error('Session expired — sign in again')}
    if(!r.ok){let m;try{m=(await r.json()).error}catch(e){}throw new Error(m||'Server error '+r.status)}
    return r.status===204?null:r.json()},
  upload(file){const fd=new FormData();fd.append('file',file);return this.req('/uploads',{method:'POST',body:fd})},
  async flush(){let q=this.queue,n=0;while(q.length){try{await this.req(q[0].path,{method:q[0].method,body:q[0].body});n++}catch(e){if(e.offline)break}q.shift();this.queue=q}return n}
};

/* ---- API rows (same names as database/schema.sql) -> the shapes the screens use ---- */
const fmtD=iso=>{const d=new Date(iso),n=new Date(),t=d.toLocaleTimeString('en-PH',{hour:'numeric',minute:'2-digit'}),
  k=Math.round((new Date(n.getFullYear(),n.getMonth(),n.getDate())-new Date(d.getFullYear(),d.getMonth(),d.getDate()))/864e5);
  return k==0?'Today, '+t:k==1?'Yesterday':d.toLocaleDateString('en-US',{month:'short',day:'numeric'})};
const fromExp=r=>({id:r.id,t:r.vendor,a:+r.gross,d:fmtD(r.submitted_at),sub:new Date(r.submitted_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}),s:r.status,by:r.user_name,br:r.branch,tx:r.txn_id,ty:r.nature,note:r.supervisor_note,rp:r.receipt_url});
const fromSale=r=>({c:r.customer,a:+r.gross,d:fmtD(r.submitted_at),s:r.status,k:Math.floor((Date.now()-new Date(r.submitted_at))/864e5)});

/* ---- glue: the screens call these; in demo mode they fall back to the *_demo functions ---- */
function applyUser(u){S.u=u.username;ME=u.full_name;S.role=u.role=='supervisor'?'sup':'emp';S.target=+u.sales_target||280000}
async function refresh(){
  if(!API.on)return;
  const sup=S.role=='sup',q=sup?'':'?mine=1';
  const [e,s,l]=await Promise.all([API.req('/expenses'+q),sup?[]:API.req('/sales?mine=1'),sup?API.req('/ledger'):[]]);
  X.length=0;X.push(...e.map(fromExp));Y.length=0;Y.push(...s.map(fromSale));
  const g={};l.forEach(r=>{(g[r.day]=g[r.day]||[]).push([r.label,+r.gross,r.branch,r.txn_id])});
  L.length=0;Object.keys(g).sort().reverse().forEach(d=>L.push({d:new Date(d+'T00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}),r:g[d]}))}
async function send(path,method,body,ok,local){  // online -> server; offline -> queue + optimistic local update
  if(method=='POST')body={client_ref:crypto.randomUUID(),...body}; // lets the server ignore duplicate retries
  try{await API.req(path,{method,body});await refresh();toast(ok);return true}
  catch(e){if(e.offline){local&&local();API.enqueue({path,method,body});S.qn=API.queue.length;toast('Offline — saved, will sync later');return true}toast(e.message);return null}}
async function login(){
  const u=$('#u').value.trim(),p=$('#pw').value;
  try{
    if(API.on){const r=await API.req('/auth/login',{method:'POST',body:{username:u,password:p}});API.token=r.token;applyUser(r.user)}
    else{S.u=u||'jdelacruz';S.role=/^(rmendoza|sup)/i.test(u)?'sup':'emp'}
    await refresh();go(S.role=='sup'?'queue':'home')
  }catch(e){toast(e.message)}}
function logout(){API.token=null;S.role=null;go('login')}
async function subE(){
  if(!API.on)return subE_demo();
  let ph;try{if(S.d.file)ph=(await API.upload(S.d.file)).url}catch(e){return toast(e.message)}
  if(await send('/expenses','POST',{gross:num(S.d.amt),account_code:S.d.coa.split(' · ')[0],vendor:S.d.v,doc_type:S.d.doc,nature:S.d.ty,receipt_url:ph},'Expense submitted',subE_demo)!==null){S.d.ph=0;S.d.file=null;go('home')}}
async function subS(){
  if(!API.on)return subS_demo();
  let ph;try{if(S.s.file)ph=(await API.upload(S.s.file)).url}catch(e){return toast(e.message)}
  if(await send('/sales','POST',{customer:S.s.c,item:S.s.i,invoice_no:S.s.n,payment:S.s.p,gross:num(S.s.a),invoice_url:ph},'Sale submitted',subS_demo)!==null){S.s.ph=0;S.s.file=null;go('mysales')}}
async function act(id,s){if(!API.on)return act_demo(id,s);await send('/expenses/'+id,'PATCH',{status:s},s,()=>act_demo(id,s));go('queue')}
async function edit(id){if(!API.on)return edit_demo(id);const g=num(S.ev)||X.find(x=>x.id==id).a;await send('/expenses/'+id,'PATCH',{gross:g},'Amount updated',()=>edit_demo(id));S.m='';S.ev='';go('detail')}
async function flag(id){if(!API.on)return flag_demo(id);await send('/expenses/'+id,'PATCH',{status:'Flagged',supervisor_note:S.fr||'Needs review'},'Flagged',()=>flag_demo(id));S.m='';S.fr='';go('queue')}
async function openD(id){S.sel=id;S.m='';if(API.on){try{X.find(x=>x.id==id).audit=await API.req('/expenses/'+id+'/audit')}catch(e){}}go('detail');if(API.on){const e=X.find(x=>x.id==id);if(e&&e.rp)showReceipt(e.rp)}}
async function showReceipt(u){ // receipts are private: fetch with the login token, show as image
  try{const r=await fetch(API.base.replace(/\/api$/,'')+u,{headers:{Authorization:'Bearer '+API.token}});if(!r.ok)return;
    const o=URL.createObjectURL(await r.blob()),h=$('#rp');if(h){h.innerHTML='<img src="'+o+'" alt="Receipt" style="max-width:100%;max-height:260px;border-radius:6px">';h.onclick=()=>window.open(o)}}catch(e){}}
function auditHTML(e){
  if(e.audit)return e.audit.map(a=>`<div class="cd"><b>${E(a.action)} by ${E(a.actor)}</b><small>${fmtD(a.at)}${a.note?' · "'+E(a.note)+'"':''}</small></div>`).join('');
  return `<div class="cd"><b>Submitted by ${E(e.by)}</b><small>${e.sub||e.d} · ${e.tx}</small>${e.s=='Flagged'?`<b>Flagged by R. Mendoza</b><small>${e.fd||'Today'} · "${E(e.note||'')}"</small>`:''}</div>`}
function pick(o,scr){ // camera / gallery picker
  if(!API.on){o.ph=!o.ph;return go(scr)}
  const i=document.createElement('input');i.type='file';i.accept='image/*';i.capture='environment';
  i.onchange=()=>{o.file=i.files[0]||null;o.ph=!!o.file;go(scr)};i.click()}
function resub(id){
  if(!API.on)return toast('Camera opened — retake the photo');
  const i=document.createElement('input');i.type='file';i.accept='image/*';i.capture='environment';
  i.onchange=async()=>{try{const u=await API.upload(i.files[0]);await API.req('/expenses/'+id,{method:'PATCH',body:{receipt_url:u.url,status:'Pending'}});await refresh();toast('Photo resubmitted');go('myexp')}catch(e){toast(e.message)}};i.click()}
async function syncNow(){
  if(API.on){try{const n=await API.flush();await refresh();S.qn=API.queue.length;toast(n?n+' synced':'Up to date')}catch(e){toast(e.offline?'Still offline':e.message)}}
  else{S.qn=0;toast('Synced')}
  S.sync=now();go('settings')}
async function init(){
  if(API.on&&API.token){try{const r=await API.req('/auth/me');applyUser(r.user);await refresh();return go(S.role=='sup'?'queue':'home')}catch(e){}}
  render()}
addEventListener('online',()=>{if(API.on&&S.role&&S.auto)syncNow()});
