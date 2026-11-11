/* A deliberately dependency-free frontend: fully usable without a build step. */
const app = document.querySelector('#app');
const toastNode = document.querySelector('#toast');
const state = {user: localStorage.getItem('docspace-user') || 'alex', users: [], tab: 'owned', docs: {owned: [], shared: []}, doc: null, dirty: false, timer: null, saving: null, search: '', loadToken: 0};
if (!['alex','sam','jordan'].includes(state.user)) state.user = 'alex';
const icons = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 10 12 3l9 7v10H3z"/><path d="M9 20v-7h6v7"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="14" height="16" rx="2"/><path d="M9 8h12M9 13h12"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 16V3m-5 5 5-5 5 5M5 16v4h14v-4"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m14 5-7 7 7 7"/></svg>'
};
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const currentUser = () => state.users.find(u => u.id === state.user) || {name:'Alex Morgan'};
const avatar = name => esc(name.split(' ').map(s=>s[0]).join('').slice(0,2));
const when = value => new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
let toastTimer;
function toast(message) {toastNode.textContent=message;toastNode.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toastNode.classList.remove('show'),3200);}
async function api(path, options={}) {
 const {method='GET',body,...rest}=options;
 let response;
 try {response=await fetch('/api'+path,{method,headers:{'X-Demo-User':state.user,...(body!==undefined?{'Content-Type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{}),...rest});}
 catch(e){throw new Error('Cannot connect to the server. Check it is running.');}
 const data=await response.json().catch(()=>({}));
 if(!response.ok) throw new Error(typeof data.detail==='string'?data.detail:`Request failed (${response.status})`);
 return data;
}
const docIdFromUrl = () => /^\/documents\/([a-f0-9-]{36})$/.exec(location.pathname)?.[1] || null;
function shell(content) {
 const me=currentUser();
 app.innerHTML=`<div class="app-shell"><aside class="sidebar">
 <a class="brand" href="/" data-action="home"><span class="brand-mark">✦</span><span>docspace<span style="color:#606be2">.</span></span></a>
 <div><div class="side-label">Workspace</div><div class="side-links">
 <button class="nav ${state.tab==='owned'?'active':''}" data-action="tab" data-tab="owned">${icons.home} My documents</button>
 <button class="nav ${state.tab==='shared'?'active':''}" data-action="tab" data-tab="shared">${icons.share} Shared with me</button>
 </div></div>
 <div class="sidebar-bottom"><small>DEMO WORKSPACE</small><strong>Switch account to test sharing</strong>
 <select id="user-select" aria-label="Active demo account">${state.users.map(u=>`<option value="${esc(u.id)}" ${u.id===state.user?'selected':''}>${esc(u.name)}</option>`).join('')}</select></div>
 </aside><main class="main"><div class="topbar"><div class="crumb">Workspace &nbsp; / &nbsp; ${docIdFromUrl()?'Document':'Overview'}</div>
 <div class="topbar-right"><span>Demo mode</span><div class="avatar">${avatar(me.name)}</div></div></div>${content}</main></div>`;
}
function errorView(message){shell(`<div class="panel empty"><div class="empty-symbol">⚠️</div><h3>Something went wrong</h3><p>${esc(message)}</p><button class="btn" data-action="home">Back to workspace</button></div>`);}
async function loadDashboard(){
 const token=++state.loadToken;state.doc=null; shell('<div class="loading">Loading your documents...</div>');
 try {const docs=await api('/documents');if(token!==state.loadToken)return;state.docs=docs;renderDashboard();} catch(e){if(token===state.loadToken)errorView(e.message);}
}
function renderDashboard(){
 const tab=state.tab, list=state.docs[tab].filter(d=>d.title.toLowerCase().includes(state.search.toLowerCase()));
 shell(`<section class="hero"><div><div class="eyebrow">YOUR SPACE TO CREATE</div><h1>Good ideas start here<span style="color:#6b70e4">.</span></h1>
 <p class="muted">Create, organize, and share your team's best work.</p></div><div class="actions">
 <button class="btn" data-action="import">${icons.upload} Import .txt</button><button class="btn btn-primary" data-action="create">${icons.plus} New document</button>
 </div></section><section class="panel"><div class="panel-head"><div class="panel-title">${tab==='owned'?'My documents':'Shared with me'} <span class="count">${state.docs[tab].length}</span></div>
 <input class="search" id="search-docs" aria-label="Search documents" placeholder="Search documents..." value="${esc(state.search)}"></div>
 ${list.length?`<div class="doc-grid">${list.map(d=>`<button class="doc-card" data-action="open" data-id="${esc(d.id)}"><span class="file-icon">📄</span><div class="doc-title">${esc(d.title)}</div><div class="doc-meta">${tab==='shared'?'From '+esc(d.owner_name)+' · ':''}Updated ${when(d.updated_at)}</div><div class="doc-foot"><span class="pill ${tab==='shared'?'shared':''}">${tab==='shared'?'View only':'Owner'}</span><span style="color:#9ba8bd">↗</span></div></button>`).join('')}</div>`:
 `<div class="empty"><div class="empty-symbol">${state.search?'🔎':tab==='owned'?'📝':'🤝'}</div><h3>${state.search?'No matching documents':tab==='owned'?'Your next big idea awaits':'Nothing shared with you yet'}</h3><p>${state.search?'Try another search.':tab==='owned'?'Create a document or import a .txt file to get started.':'Switch to another demo account and share a document with this user.'}</p></div>`}
 </section><p class="small-hint">Made for fast ideas. Saved locally on the server with SQLite.</p>`);
}
function setStatus(text,kind=''){const node=document.querySelector('#save-status');if(node){node.textContent=text;node.className='status '+kind;}}
async function loadDocument(id){
 const token=++state.loadToken;state.doc=null;shell('<div class="loading">Opening document...</div>');
 try {const doc=await api('/documents/'+id);if(token!==state.loadToken)return;state.doc=doc;state.dirty=false;renderEditor();}
 catch(e){if(token===state.loadToken)errorView(e.message);}
}
function renderEditor(){
 const d=state.doc;if(!d)return;
 const tools=[['bold','B','Bold'],['italic','I','Italic'],['underline','U̲','Underline'],['formatBlock','H1','Heading 1','h1'],['formatBlock','H2','Heading 2','h2'],['insertUnorderedList','• ≡','Bulleted list'],['insertOrderedList','1. ≡','Numbered list']];
 shell(`<div class="editor-layout"><div class="editor-top"><button class="back" data-action="home">${icons.arrow} Back to workspace</button>
 <div class="actions">${d.can_edit?`<button class="btn" data-action="delete">Delete</button><button class="btn" data-action="share">↗ Share</button><button class="btn btn-primary" data-action="save">Save now</button>`:`<span class="pill shared">Read-only access</span>`}</div></div>
 <div class="editor-meta"><input id="document-title" class="title-input" aria-label="Document title" maxlength="100" value="${esc(d.title)}" ${d.can_edit?'':'disabled'}>
 <span id="save-status" class="status ${d.can_edit?'saved':''}">${d.can_edit?'● Saved':'Shared by '+esc(d.owner_name)}</span></div>
 ${d.can_edit?'':'<div class="readonly-notice">🔒 You can view this document, but only its owner can edit it.</div>'}
 <div class="editor-card"><div class="toolbar" role="toolbar" aria-label="Text formatting">${tools.map(([cmd,label,title,value],idx)=>`<button type="button" class="tool ${idx===3||idx===5?'divided':''}" data-action="format" data-cmd="${cmd}" ${value?`data-value="${value}"`:''} title="${title}" aria-label="${title}" ${d.can_edit?'':'disabled'}>${label}</button>`).join('')}</div>
 <div id="editable" class="editable" contenteditable="${d.can_edit}" role="textbox" aria-label="Document content" aria-multiline="true" spellcheck="true">${d.content}</div></div>
 <p class="small-hint">${d.can_edit?'Changes are saved automatically. Use Ctrl/Cmd+B, I, or U to format.':'This document was shared with you as a viewer.'}</p></div>`);
}
function markDirty(){if(!state.doc?.can_edit)return;state.dirty=true;setStatus('● Unsaved changes');clearTimeout(state.timer);state.timer=setTimeout(()=>{saveNow().catch(e=>toast(e.message));},700);}
async function saveNow(){
 clearTimeout(state.timer);
 if(!state.doc?.can_edit)return;
 if(state.saving){await state.saving;if(!state.dirty)return;}
 if(!state.dirty){setStatus('● Saved','saved');return;}
 const d=state.doc, id=d.id, title=document.querySelector('#document-title')?.value.trim()||'',content=document.querySelector('#editable')?.innerHTML??'';
 if(!title || title.length>100){setStatus('● Invalid title','error');throw new Error('Title must be 1–100 characters');}
 state.dirty=false;setStatus('● Saving...');
 const promise=api('/documents/'+id,{method:'PATCH',body:{title,content}});
 state.saving=promise;
 try {const result=await promise;if(state.doc?.id===id){state.doc.title=title;state.doc.content=content;setStatus(state.dirty?'● Unsaved changes':'● Saved',state.dirty?'':'saved');}return result;}
 catch(e){state.dirty=true;setStatus('● Save failed — retry','error');throw e;}
 finally {if(state.saving===promise)state.saving=null;}
}
async function navigate(path){
 try {if(state.doc && state.dirty)await saveNow();}catch(e){toast('Save failed: '+e.message);return;}
 history.pushState({},'',path);state.search='';if(docIdFromUrl())await loadDocument(docIdFromUrl());else await loadDashboard();
}
async function createDocument(){try{const d=await api('/documents',{method:'POST',body:{title:'Untitled document',content:'<p></p>'}});await navigate('/documents/'+d.id);toast('Document created');}catch(e){toast(e.message);}}
async function importFile(){
 const input=document.createElement('input');input.type='file';input.accept='.txt,text/plain';input.onchange=async()=>{
  const file=input.files?.[0];if(!file)return;
  if(!file.name.toLowerCase().endsWith('.txt')){toast('Only .txt files are supported');return;}
  if(file.size>1024*1024){toast('Maximum file size is 1 MB');return;}
  try{const content=await file.text();const doc=await api('/documents/import',{method:'POST',body:{filename:file.name,content}});await navigate('/documents/'+doc.id);toast('Text file imported successfully');}
  catch(e){toast(e.message);}
 };input.click();
}
function closeModal(){document.querySelector('.modal-backdrop')?.remove();}
function showShareModal(){
 const d=state.doc;if(!d?.can_edit)return;
 const available=state.users.filter(u=>u.id!==state.user && !(d.shares||[]).some(s=>s.user_id===u.id));
 const node=document.createElement('div');node.className='modal-backdrop';node.innerHTML=`<div class="modal" role="dialog" aria-modal="true" aria-label="Share document">
 <h2>Share “${esc(d.title)}”</h2><p>Invite a demo teammate to view this document. Recipients cannot edit.</p>
 <div class="modal-row"><select id="share-target" aria-label="Select teammate">${available.map(u=>`<option value="${esc(u.id)}">${esc(u.name)}</option>`).join('')}</select><button class="btn btn-primary" data-action="grant-share" ${available.length?'':'disabled'}>Share</button></div>
 <div class="panel-title" style="margin-bottom:12px">People with access</div>
 <div class="share-row"><div><b>${esc(currentUser().name)}</b><small>Owner</small></div><span class="pill">Owner</span></div>
 ${(d.shares||[]).map(s=>`<div class="share-row"><div><b>${esc(s.name)}</b><small>${esc(s.email)} · Viewer</small></div><button class="btn btn-danger" data-action="revoke-share" data-user="${esc(s.user_id)}">Remove</button></div>`).join('')}
 <div class="modal-footer"><button class="btn" data-action="close-modal">Done</button></div></div>`;
 node.addEventListener('click',e=>{if(e.target===node)closeModal();});document.body.append(node);
}
async function refreshShares(){state.doc=await api('/documents/'+state.doc.id);closeModal();showShareModal();}
async function action(name,btn){
 try{
 switch(name){
 case 'home':await navigate('/');break;
 case 'tab':{const tab=btn.dataset.tab;if(state.doc && state.dirty)await saveNow();state.tab=tab;await navigate('/');break;}
 case 'create':await createDocument();break;
 case 'import':await importFile();break;
 case 'open':await navigate('/documents/'+btn.dataset.id);break;
 case 'save':await saveNow();toast('All changes saved');break;
 case 'share':await saveNow();showShareModal();break;
 case 'close-modal':closeModal();break;
 case 'grant-share':{const target=document.querySelector('#share-target')?.value;if(!target)return;await api('/documents/'+state.doc.id+'/shares',{method:'POST',body:{user_id:target}});await refreshShares();toast('Document shared');break;}
 case 'revoke-share':await api('/documents/'+state.doc.id+'/shares/'+btn.dataset.user,{method:'DELETE'});await refreshShares();toast('Access removed');break;
 case 'delete':if(confirm('Delete this document permanently?')){await api('/documents/'+state.doc.id,{method:'DELETE'});state.dirty=false;await navigate('/');toast('Document deleted');}break;
 case 'format':{if(!state.doc?.can_edit)return;const editor=document.querySelector('#editable');editor.focus();document.execCommand(btn.dataset.cmd,false,btn.dataset.value||null);markDirty();break;}
 }
 }catch(e){toast(e.message);}
}
app.addEventListener('click',e=>{const btn=e.target.closest('[data-action]');if(!btn)return;e.preventDefault();action(btn.dataset.action,btn);});
document.addEventListener('click',e=>{const btn=e.target.closest('.modal [data-action]');if(btn){e.preventDefault();action(btn.dataset.action,btn);}});
app.addEventListener('input',e=>{if(e.target.id==='editable'||e.target.id==='document-title')markDirty();if(e.target.id==='search-docs'){const pos=e.target.selectionStart;state.search=e.target.value;renderDashboard();const el=document.querySelector('#search-docs');el.focus();el.setSelectionRange(pos,pos);}});
app.addEventListener('change',async e=>{if(e.target.id!=='user-select')return;try{if(state.doc?.can_edit && state.dirty)await saveNow();}catch(err){toast('Save your work before switching accounts');e.target.value=state.user;return;}
 state.user=e.target.value;localStorage.setItem('docspace-user',state.user);state.tab='owned';state.doc=null;await navigate('/');toast('Switched to '+currentUser().name);});
app.addEventListener('mousedown',e=>{if(e.target.closest('[data-action="format"]'))e.preventDefault();});
window.addEventListener('popstate',()=>{clearTimeout(state.timer);state.dirty=false;if(docIdFromUrl())loadDocument(docIdFromUrl());else loadDashboard();});
window.addEventListener('beforeunload',e=>{if(state.dirty){e.preventDefault();e.returnValue='';}});
(async()=>{try{state.users=await api('/users');if(docIdFromUrl())await loadDocument(docIdFromUrl());else await loadDashboard();}catch(e){errorView(e.message);}})();
