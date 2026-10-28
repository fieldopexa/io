/* FSM Live Chat v1.1. Uses session-validated FSM SSO through Firebase custom authentication. */
(() => {
  'use strict';
  const cfg=window.FSM_CHAT_FIREBASE_CONFIG;
  const app=document.getElementById('app-shell');
  if(!app) return;
  const host=document.getElementById('fsm-live-chat');
  if(!host)return;
  host.hidden=true;
  host.innerHTML='<button type="button" id="fsm-chat-launcher" hidden aria-label="Open messages"></button>'
    +'<div id="fsm-chat-panel" aria-label="FSM communications">'
    +'<div class="fsm-chat-body" id="fsm-chat-content"><div class="fsm-chat-gate"><h3>Connecting</h3><p>Loading your messages…</p></div></div>'
    +'</div><div id="fsm-chat-toast" hidden role="status" aria-live="polite"></div>';

  const el=id=>document.getElementById(id);
  el('fsm-chat-panel').hidden=false; // Embedded in FSM Operations navigation.
  const launcher=el('fsm-chat-launcher'),panel=el('fsm-chat-panel'),content=el('fsm-chat-content');
  const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state={auth:null,db:null,lib:null,user:null,member:null,profiles:[],room:'engineering',unsubMessages:null,unsubMembers:null,unsubActivity:null,unsubPresence:null,unsubPreviews:new Map(),previewReady:{},preview:{},unread:{},lastSeen:{},presence:{},messages:[],filter:'',editingId:null,loading:false,booting:false,presenceTimer:null};
  const defaultTitle=document.title;
  const notifyMemory=new Map();
  // Directory entries are based on confirmed existing FSM usernames, not Firebase
  // email accounts. Add future users here if you need them to appear before
  // their first chat login. Users who have already used chat appear dynamically.
  const TEAM_DIRECTORY=[
    {username:'ian',name:'Ian'},
    {username:'kenneth',name:'Kenneth'},
    {username:'erwin',name:'Erwin'},
    {username:'popoy',name:'Popoy'}
  ];
  function uidForFsmUsername(username){
    const value=String(username||'').trim().toLowerCase();
    if(!/^[a-z0-9._-]{1,64}$/.test(value))return '';
    return 'fsm_'+btoa(value).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  // Keep read status separate for different FSM accounts using the same browser.
  const seenStorageKey=()=>state.user?'fsm-chat-seen-v2:'+state.user.uid:'';
  const isOpen=()=>!!document.getElementById('panel-chat')?.classList.contains('active');
  const roomId=(a,b)=>'dm~'+[a,b].sort().join('~');
  function openToggle(force){if(force===false&&isOpen())document.querySelector('.tab[data-tab="dashboard"]')?.click();}
  // Chat stays embedded in the FSM page. The normal sidebar navigates away.
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&isOpen())openToggle(false);});
  function gate(title,description,form=''){
    content.innerHTML=`<div class="fsm-chat-gate"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p>${form}<div id="fsm-chat-status" role="status"></div></div>`;
  }
  function setStatus(s){const n=el('fsm-chat-status');if(n)n.textContent=s;}
  function syncVisible(){
    const visible=app.style.display!=='none'&&!!document.getElementById('logged-user')?.textContent?.trim()&&document.getElementById('logged-user')?.textContent!=='—';
    host.hidden=!visible;
    if(visible&&!state.user&&!state.booting)setTimeout(()=>{if(!state.user&&!state.booting)launcher.click();},150);
  }
  new MutationObserver(syncVisible).observe(app,{attributes:true,attributeFilter:['style']});
  syncVisible();
  function persistSeen(){try{if(state.user)localStorage.setItem(seenStorageKey(),JSON.stringify(state.lastSeen));}catch{}}
  function chatPeople(){
    if(!state.user)return [];
    const profiles=new Map(state.profiles.map(p=>[p.uid,p]));
    const people=new Map();
    for(const entry of TEAM_DIRECTORY){
      const uid=uidForFsmUsername(entry.username);
      const profile=profiles.get(uid);
      if(!uid||uid===state.user.uid||profile?.active===false)continue;
      people.set(uid,{uid,name:entry.name,username:entry.username});
    }
    for(const profile of state.profiles){
      if(profile.uid===state.user.uid||profile.active!==true)continue;
      if(!people.has(profile.uid)){
        people.set(profile.uid,{uid:profile.uid,name:profile.name||profile.username||'Teammate',username:profile.username||''});
      }
    }
    return Array.from(people.values()).sort((a,b)=>a.name.localeCompare(b.name));
  }
  function conversations(){
    return [{id:'engineering',name:'Team Chat',type:'group',description:'Engineering group'},
      ...chatPeople().map(person=>({id:roomId(state.user.uid,person.uid),name:person.name,type:'direct',description:'Private message'}))];
  }
  function updateUnread(){
    const total=Object.values(state.unread).reduce((a,b)=>a+b,0);
    const badge=el('fsm-chat-badge');
    if(badge){badge.hidden=!total;badge.textContent=total>99?'99+':String(total);}
    for(const id of ['fsm-chat-nav-badge','fsm-chat-mobile-badge']){
      const n=el(id);if(n){n.hidden=!total;n.textContent=total>99?'99+':String(total);}
    }
    document.title=total?'('+total+') '+defaultTitle:defaultTitle;
    if(launcher)launcher.title=total?total+' unread conversations':'Team Chat';
  }
  function renderTextWithLinks(node,text){
    const raw=String(text||'');
    const regex=/https?:\/\/[^\s<>]+/gi;
    let last=0,match;
    while((match=regex.exec(raw))){
      if(match.index>last)node.append(document.createTextNode(raw.slice(last,match.index)));
      const safe=match[0];
      try{
        const url=new URL(safe);
        if(url.protocol!=='https:'&&url.protocol!=='http:')throw Error('protocol');
        const link=document.createElement('a');
        link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';
        link.textContent=safe;node.append(link);
      }catch{node.append(document.createTextNode(safe));}
      last=regex.lastIndex;
    }
    if(last<raw.length)node.append(document.createTextNode(raw.slice(last)));
  }
  function relativePreview(msg){
    if(!msg)return 'Start a conversation';
    if(msg.deleted)return 'Message unsent';
    return String(msg.text||'').replace(/\s+/g,' ').slice(0,58)||'New message';
  }
  function relativeTime(stamp){
    const ms=stamp?.toMillis?.()||0;
    if(!ms)return '';
    const d=new Date(ms);
    if(new Date().toDateString()===d.toDateString())return d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
    return d.toLocaleDateString([],{month:'short',day:'numeric'});
  }
  function notifyIncoming(room,msg){
    if(!state.user||isOpen()&&state.room===room||msg?.senderId===state.user.uid)return;
    const last=notifyMemory.get(room);
    if(last===msg?.id)return;
    notifyMemory.set(room,msg.id);
    const person=conversations().find(c=>c.id===room);
    const label=person?.name||'A teammate';
    const toast=el('fsm-chat-toast');
    if(toast&&document.visibilityState==='visible'){
      toast.hidden=false;
      toast.textContent='New message from '+label;
      toast.onclick=()=>{document.querySelector('.tab[data-tab="chat"]')?.click();selectRoom(room);toast.hidden=true;};
      clearTimeout(state.toastTimer);
      state.toastTimer=setTimeout(()=>toast.hidden=true,5200);
    }else if('Notification' in window&&Notification.permission==='granted'){
      try{
        const notice=new Notification('New message · '+label,{
          body:'Open FSM to read your message',tag:'fsm-chat-'+room,
          icon:'./icons/icon-192.png'
        });
        notice.onclick=()=>{window.focus();document.querySelector('.tab[data-tab="chat"]')?.click();selectRoom(room);notice.close();};
      }catch(e){console.warn('Browser notification unavailable:',e);}
    }
  }
  function syncRoomPreviews(){
    if(!state.user||!state.lib)return;
    const all=new Set(conversations().map(c=>c.id));
    for(const [id,off] of state.unsubPreviews){
      if(!all.has(id)){off();state.unsubPreviews.delete(id);delete state.preview[id];delete state.unread[id];delete state.previewReady[id];}
    }
    const {query,collection,orderBy,limit,onSnapshot}=state.lib;
    for(const id of all){
      if(state.unsubPreviews.has(id))continue;
      const stream=query(collection(state.db,'chatRooms',id,'messages'),orderBy('createdAt','desc'),limit(1));
      const off=onSnapshot(stream,snap=>{
        const latest=snap.docs.length?{id:snap.docs[0].id,...snap.docs[0].data()}:null;
        const previous=state.preview[id];
        const wasReady=!!state.previewReady[id];
        state.previewReady[id]=true;
        state.preview[id]=latest;
        const ms=latest?.createdAt?.toMillis?.()||0;
        const unread=!!latest&&latest.senderId!==state.user.uid&&ms>(state.lastSeen[id]||0);
        state.unread[id]=unread?1:0;
        if(wasReady&&latest&&latest.id!==previous?.id&&unread)notifyIncoming(id,latest);
        updateUnread();renderContacts();
      },err=>console.warn('Chat preview unavailable for '+id,err.code));
      state.unsubPreviews.set(id,off);
    }
    updateUnread();renderContacts();
  }
  async function syncPresence(){
    if(!state.user||!state.member?.active||document.visibilityState!=='visible')return;
    const {doc,setDoc,serverTimestamp}=state.lib;
    try{
      await setDoc(doc(state.db,'chatPresence',state.user.uid),{uid:state.user.uid,lastSeen:serverTimestamp()});
    }catch(err){console.warn('Chat presence sync failed:',err.code);}
  }
  function isRecentlyActive(uid){
    const seen=state.presence[uid]?.toMillis?.()||0;
    return !!seen&&Date.now()-seen<180000;
  }
  function roomName(){return conversations().find(c=>c.id===state.room)?.name||'Direct message';}
  function markRead(){if(!state.user)return;state.lastSeen[state.room]=Date.now();state.unread[state.room]=0;persistSeen();updateUnread();renderContacts();}
  async function loadSdk(){
    if(state.lib)return state.lib;
    if(!cfg||!cfg.apiKey||!cfg.projectId||!cfg.appId)throw new Error('Firebase is not configured yet. Follow docs/FSM-LIVE-CHAT-SETUP.md.');
    const [appMod,authMod,storeMod]=await Promise.all([
      import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js')]);
    const fb=appMod.initializeApp(cfg,'fsm-team-chat');
    state.auth=authMod.getAuth(fb);state.db=storeMod.getFirestore(fb);
    await authMod.setPersistence(state.auth,authMod.browserLocalPersistence);
    return state.lib={...authMod,...storeMod};
  }
  async function connectFromFSM(){
    // This must never trust display names or requested UIDs from the browser.
    // apiPost uses the existing FSM session token, which the Apps Script server validates.
    const fsmUser=(typeof currentUser!=='undefined')?currentUser:null;
    if(!fsmUser?.username)throw new Error('Sign in to FSM first.');
    const result=await apiPost('chatSSO',{});
    if(!result?.customToken)throw new Error('FSM server did not return a Team Chat identity. Update the Apps Script deployment.');
    await state.lib.signInWithCustomToken(state.auth,result.customToken);
    const firebaseUser=state.auth.currentUser;
    // Encode the normalized username into a regex-safe, collision-free Firebase UID.
    const expectedUid=uidForFsmUsername(fsmUser.username);
    if(!firebaseUser || firebaseUser.uid!==expectedUid)throw new Error('Chat identity mismatch. Contact the administrator.');
    await startChat(firebaseUser);
  }
  function stopListeners(){
    state.unsubMessages?.();state.unsubMembers?.();state.unsubPresence?.();
    state.unsubMessages=state.unsubMembers=state.unsubPresence=null;
    for(const off of state.unsubPreviews.values())off();
    state.unsubPreviews.clear();
    clearInterval(state.presenceTimer);state.presenceTimer=null;
  }
  function renderContacts(){
    const list=el('fsm-chat-contacts');if(!list||!state.user)return;
    const filter=state.filter.trim().toLowerCase();
    const all=conversations();
    const mk=x=>{
      const active=state.room===x.id,preview=state.preview[x.id];
      const avatar=x.type==='group'?'✦':String(x.name||'?').charAt(0).toUpperCase();
      const presence=x.type==='direct'&&chatPeople().find(p=>roomId(state.user.uid,p.uid)===x.id);
      const online=presence&&isRecentlyActive(presence.uid);
      const title=x.type==='group'?'Group conversation':'Private conversation';
      const label=relativePreview(preview);
      const unread=state.unread[x.id];
      return '<button type="button" class="fsm-chat-contact '+(active?'active':'')+'" data-chat-room="'+escapeHtml(x.id)+'" aria-current="'+(active?'page':'false')+'" title="'+escapeHtml(title)+'">'
        +'<span class="fsm-chat-avatar '+(x.type==='group'?'group':'')+'">'+escapeHtml(avatar)+(online?'<i class="fsm-chat-online" aria-label="Recently active"></i>':'')+'</span>'
        +'<span class="fsm-chat-contact-detail"><strong>'+escapeHtml(x.name)+'</strong><small>'+escapeHtml(label)+'</small></span>'
        +'<span class="fsm-chat-contact-aside"><span class="fsm-chat-contact-time">'+escapeHtml(relativeTime(preview?.createdAt))+'</span>'
        +(unread?'<span class="fsm-chat-count" aria-label="Unread message">1</span>':'')+'</span></button>';
    };
    const group=all.filter(c=>c.type==='group'&&c.name.toLowerCase().includes(filter));
    const direct=all.filter(c=>c.type==='direct'&&c.name.toLowerCase().includes(filter));
    list.innerHTML='<div class="fsm-chat-caption">Group</div>'+group.map(mk).join('')
      +'<div class="fsm-chat-caption fsm-chat-direct-label">People</div>'+direct.map(mk).join('')
      +(!group.length&&!direct.length?'<div class="fsm-chat-no-results">No conversations found</div>':'');
    list.querySelectorAll('[data-chat-room]').forEach(btn=>btn.addEventListener('click',()=>selectRoom(btn.dataset.chatRoom)));
  }
  function formatChatDay(ms){
    const d=new Date(ms),now=new Date();
    if(d.toDateString()===now.toDateString())return 'Today';
    const yesterday=new Date(now);yesterday.setDate(now.getDate()-1);
    return yesterday.toDateString()===d.toDateString()?'Yesterday':d.toLocaleDateString([],{month:'long',day:'numeric',year:'numeric'});
  }
  function renderMessages(){
    const node=el('fsm-chat-messages');if(!node)return;
    const atBottom=node.scrollHeight-node.scrollTop-node.clientHeight<100;
    node.replaceChildren();
    if(!state.messages.length){
      node.innerHTML='<div class="fsm-chat-empty"><span class="fsm-chat-empty-symbol">✉</span><strong>No messages yet</strong><span>Say hello or share an update with the team.</span></div>';
      return;
    }
    let lastDay='';
    for(const msg of state.messages){
      const mine=msg.senderId===state.user?.uid;
      const ms=msg.createdAt?.toMillis?.()||0;
      if(ms){
        const day=formatChatDay(ms);
        if(day!==lastDay){
          const tag=document.createElement('div');tag.className='fsm-chat-day';tag.textContent=day;node.append(tag);lastDay=day;
        }
      }
      const row=document.createElement('div');row.className='fsm-chat-message-row'+(mine?' mine':'');
      const item=document.createElement('div');item.className='fsm-chat-message'+(mine?' mine':'')+(msg.deleted?' deleted':'');
      const by=document.createElement('div');by.className='fsm-chat-byline';by.textContent=mine?'You':msg.senderName||'Teammate';
      const body=document.createElement('div');body.className='fsm-chat-text';
      if(msg.deleted)body.textContent=mine?'You unsent a message':'Message unsent';
      else renderTextWithLinks(body,msg.text);
      const stamp=document.createElement('div');stamp.className='fsm-chat-stamp';
      const dt=ms?new Date(ms):null;
      stamp.textContent=(dt?dt.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'Sending…')+(msg.editedAt&&!msg.deleted?' · edited':'');
      item.append(by,body,stamp);
      row.append(item);
      if(!msg.deleted){
        const actions=document.createElement('div');actions.className='fsm-chat-message-actions';
        const trigger=document.createElement('button');trigger.type='button';trigger.className='fsm-chat-message-more';
        trigger.title='Message actions';trigger.setAttribute('aria-label','Message actions');trigger.setAttribute('aria-expanded','false');
        trigger.textContent='⋯';
        const menu=document.createElement('div');menu.className='fsm-chat-message-menu';menu.hidden=true;
        const options=[['Copy','copy'],...(mine?[['Edit','edit'],['Unsend','unsend']]:[])];
        for(const [label,action] of options){
          const btn=document.createElement('button');btn.type='button';btn.textContent=label;
          btn.dataset.action=action;btn.addEventListener('click',event=>{event.stopPropagation();menu.hidden=true;handleMessageAction(action,msg);});
          menu.append(btn);
        }
        trigger.addEventListener('click',event=>{
          event.stopPropagation();
          document.querySelectorAll('.fsm-chat-message-menu').forEach(el=>{if(el!==menu)el.hidden=true;});
          menu.hidden=!menu.hidden;trigger.setAttribute('aria-expanded',String(!menu.hidden));
        });
        actions.append(trigger,menu);row.append(actions);
      }
      node.append(row);
    }
    if(atBottom)node.scrollTop=node.scrollHeight;
  }
  function stopEdit(){
    state.editingId=null;
    const form=el('fsm-chat-compose'),bar=el('fsm-chat-edit-bar');
    if(bar)bar.hidden=true;
    if(form){
      form.querySelector('textarea').value='';
      el('fsm-chat-send').textContent='Send';
    }
  }
  async function handleMessageAction(action,msg){
    if(!state.user||msg.deleted)return;
    const id=msg.id;
    if(action==='copy'){
      try{await navigator.clipboard.writeText(msg.text||'');}
      catch{window.prompt('Copy message text:',msg.text||'');}
      return;
    }
    if(msg.senderId!==state.user.uid)return;
    if(action==='edit'){
      state.editingId=id;
      const input=el('fsm-chat-input');
      input.value=msg.text||'';
      el('fsm-chat-edit-bar').hidden=false;
      el('fsm-chat-send').textContent='Save';
      input.focus();return;
    }
    if(action==='unsend'){
      if(!window.confirm('Unsend this message for everyone in the conversation?'))return;
      try{
        const {doc,updateDoc,serverTimestamp}=state.lib;
        await updateDoc(doc(state.db,'chatRooms',state.room,'messages',id),{
          text:'',deleted:true,deletedBy:state.user.uid,deletedAt:serverTimestamp()
        });
        if(state.editingId===id)stopEdit();
      }catch(err){
        el('fsm-chat-error').textContent='Could not unsend. The updated Firestore security rules may need publishing.';
      }
    }
  }
  function selectRoom(id){
    if(!state.user||!id||!conversations().some(c=>c.id===id))return;
    state.unsubMessages?.();state.room=id;state.messages=[];stopEdit();
    renderContacts();
    const current=conversations().find(c=>c.id===id);
    el('fsm-chat-thread-head').textContent=current.name;
    el('fsm-chat-thread-subtitle').textContent=current.type==='group'
      ?'Engineering group conversation':'Private conversation · '+(isRecentlyActive(chatPeople().find(p=>roomId(state.user.uid,p.uid)===id)?.uid)?'Recently active':'FSM teammate');
    const input=el('fsm-chat-input');
    if(input)input.placeholder=current.type==='group'?'Message the group…':'Message '+current.name+'…';
    renderMessages();
    const {collection,query,orderBy,limit,onSnapshot}=state.lib;
    state.unsubMessages=onSnapshot(query(collection(state.db,'chatRooms',id,'messages'),orderBy('createdAt','desc'),limit(100)),snap=>{
      if(state.room!==id)return;
      state.messages=snap.docs.map(d=>({id:d.id,...d.data()})).reverse();
      renderMessages();if(isOpen())markRead();
    },err=>{
      console.warn('Chat messages listener:',err.code);
      const n=el('fsm-chat-messages');
      if(n)n.innerHTML='<div class="fsm-chat-empty">Unable to load messages. Check Firestore permissions.</div>';
    });
  }
  async function sendMessage(event){
    event.preventDefault();
    if(state.loading||!state.user||!state.member?.active)return;
    const input=el('fsm-chat-input'),text=input.value.trim();
    if(!text||text.length>2000)return;
    const {collection,doc,writeBatch,serverTimestamp,updateDoc}=state.lib;
    state.loading=true;el('fsm-chat-send').disabled=true;
    try{
      if(state.editingId){
        await updateDoc(doc(state.db,'chatRooms',state.room,'messages',state.editingId),{text,editedAt:serverTimestamp()});
        stopEdit();
      }else{
        const ref=doc(collection(state.db,'chatRooms',state.room,'messages'));
        const batch=writeBatch(state.db);
        batch.set(ref,{text,senderId:state.user.uid,senderName:state.member.name||'Teammate',createdAt:serverTimestamp()});
        batch.set(doc(state.db,'chatActivity',state.room),{senderId:state.user.uid,updatedAt:serverTimestamp()});
        await batch.commit();
        input.value='';markRead();
      }
      el('fsm-chat-error').textContent='';
    }catch(err){
      el('fsm-chat-error').textContent='Could not save message. Check your connection and published rules.';
      console.warn('Chat send:',err.code);
    }finally{
      state.loading=false;el('fsm-chat-send').disabled=false;input.focus();
    }
  }
  async function startChat(user){
    const {doc,getDoc,setDoc,getIdTokenResult,collection,onSnapshot,query,limit,orderBy}=state.lib;
    const claims=(await getIdTokenResult(user)).claims;
    if(claims.fsm!==true)throw new Error('Team Chat requires a verified FSM login.');
    const profileRef=doc(state.db,'chatMembers',user.uid);
    let self=await getDoc(profileRef);
    if(!self.exists()){
      const name=String(claims.fsm_name||'').trim();
      const username=String(claims.fsm_username||'').trim();
      if(!name||!username)throw new Error('Your FSM identity is missing required fields.');
      await setDoc(profileRef,{name,username,active:true});
      self=await getDoc(profileRef);
    }
    if(!self.exists()||self.data().active!==true){
      gate('Access disabled','Your Team Chat access is disabled. Contact your FSM administrator.');
      el('fsm-chat-signout').hidden=false;
      return;
    }
    state.user=user;state.member=self.data();el('fsm-chat-signout').hidden=false;
    try{state.lastSeen=JSON.parse(localStorage.getItem(seenStorageKey())||'{}');}catch{state.lastSeen={};}
    state.unread={};updateUnread();
    content.innerHTML=`<aside class="fsm-chat-contacts" id="fsm-chat-contacts"></aside><div class="fsm-chat-thread"><div class="fsm-chat-thread-head" id="fsm-chat-thread-head"></div><div class="fsm-chat-messages" id="fsm-chat-messages" aria-live="polite"></div><form class="fsm-chat-compose" id="fsm-chat-compose"><input id="fsm-chat-input" maxlength="2000" placeholder="Write a message…" aria-label="Message" autocomplete="off" required><button id="fsm-chat-send" class="fsm-chat-send" type="submit">Send</button></form><div id="fsm-chat-error" role="status" style="padding:0 12px;color:#ffb3a4;font-size:11px"></div></div>`;
    el('fsm-chat-compose').addEventListener('submit',sendMessage);
    state.unsubMembers=onSnapshot(collection(state.db,'chatMembers'),snap=>{
      state.profiles=snap.docs.map(d=>({uid:d.id,...d.data()})).filter(p=>/^fsm_[A-Za-z0-9_-]+$/.test(p.uid));
      const me=state.profiles.find(p=>p.uid===user.uid);if(!me||me.active!==true){stopListeners();gate('Access disabled','Contact your FSM administrator.');return;}
      state.member=me;renderContacts();
    },()=>{});
    selectRoom(state.room);
    // Lightweight room activity badges while the app is open, even if chat is minimized.
    state.unsubActivity=onSnapshot(query(collection(state.db,'chatActivity'),orderBy('updatedAt','desc'),limit(100)),snap=>{
      for(const entry of snap.docs){const data=entry.data();const id=entry.id;
        if(!conversations().some(c=>c.id===id))continue;
        const millis=data.updatedAt?.toMillis?.()||0;
        state.unread[id]=(data.senderId!==user.uid&&millis>(state.lastSeen[id]||0))?1:0;
      }
      updateUnread();renderContacts();
    },()=>{});
  }
  window.fsmChatSignOut=async()=>{stopListeners();state.user=null;state.member=null;state.profiles=[];state.lastSeen={};state.unread={};if(state.auth&&state.lib)await state.lib.signOut(state.auth);};
  el('fsm-chat-signout').addEventListener('click',async()=>{await window.fsmChatSignOut();});
  document.querySelector('.tab[data-tab="chat"]')?.addEventListener('click',()=>{if(state.user)markRead();launcher.click();});
  launcher.addEventListener('click',async()=>{
    if(state.user||state.booting)return;
    state.booting=true;
    try{
      gate('Connecting to Team Chat','Verifying your existing FSM session…');
      await loadSdk();
      await connectFromFSM();
    }catch(err){
      const message=err?.message||'Check your connection, backend deployment, or chat permissions.';
      gate('Team Chat connection failed',message);
    }finally{
      state.booting=false;
    }
  });

})();
