/* OPEXA FSM • Field Visit Notifications
 * Renders an authenticated activity feed derived from shared Field Logs.
 * Does not write to Firebase Chat or create duplicate notice records.
 * Read/unread state is per FSM user and device, stored only in localStorage.
 */
(()=>{
  'use strict';
  const list=document.getElementById('fsm-notif-list');
  const popover=document.getElementById('fsm-notif-popover');
  const bells=[document.getElementById('fsm-notif-bell-desktop'),document.getElementById('fsm-notif-bell-mobile')].filter(Boolean);
  if(!list||!popover||!bells.length)return;
  const filterButtons=[...document.querySelectorAll('[data-fsm-notif-filter]')];
  const markAll=document.getElementById('fsm-notif-mark-all');
  const dateFormat=new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'});
  const timeFormat=new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'});
  let activeKey='', initialized=false,filter='all',read=new Set(),records=[],polling=false,firstLoad=true;
  let toastLast='';
  function isOpen(){return !popover.hidden;}
  function closePopover({restoreFocus=false}={}){
    if(!isOpen())return;
    popover.hidden=true;
    bells.forEach(b=>b.setAttribute('aria-expanded','false'));
    if(restoreFocus){
      const trigger=bells.find(b=>b.offsetParent!==null)||bells[0];
      trigger?.focus({preventScroll:true});
    }
  }
  function openPopover(trigger){
    if(!user())return;
    const active=trigger||bells.find(b=>b.offsetParent!==null)||bells[0];
    const bounds=active.getBoundingClientRect();
    popover.style.setProperty('--fsm-notif-top',Math.max(8,Math.min(bounds.bottom+9,window.innerHeight-220))+'px');
    popover.style.setProperty('--fsm-notif-right',Math.max(12,window.innerWidth-bounds.right)+'px');
    popover.hidden=false;
    bells.forEach(b=>b.setAttribute('aria-expanded','true'));
    render();
    // On demand refresh without requiring users to leave their current page.
    void poll();
  }
  bells.forEach(bell=>bell.addEventListener('click',event=>{
    event.stopPropagation();
    if(isOpen())closePopover({restoreFocus:true});
    else openPopover(bell);
  }));
  document.addEventListener('pointerdown',event=>{
    if(isOpen()&&!popover.contains(event.target)&&!bells.some(b=>b.contains(event.target)))closePopover();
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&isOpen()){
      event.preventDefault();closePopover({restoreFocus:true});
    }
  });
  window.fsmNotificationsOpen=()=>openPopover();
  window.fsmNotificationsClose=()=>closePopover();
  window.fsmNotificationsToggle=()=>isOpen()?closePopover():openPopover();
  function user(){
    try{return typeof currentUser==='object'&&currentUser&&['fse','management'].includes(currentUser.role)?currentUser:null;}
    catch{return null;}
  }
  function key(){
    const u=user();return u?'fsm-notif-read-v1:'+String(u.username||u.name||u.fse||'').toLowerCase().trim():'';
  }
  function safeDate(entry){
    const raw=entry.createdAt||entry.date||'';
    const ms=Date.parse(raw);
    if(Number.isFinite(ms))return ms;
    const fallback=Date.parse((entry.date||'')+'T00:00:00');
    return Number.isFinite(fallback)?fallback:0;
  }
  function normalize(rows){
    if(!Array.isArray(rows))return [];
    const seen=new Set();
    return rows.filter(row=>row&&row.id&&row.status!=='Voided').map(row=>({
      id:String(row.id).slice(0,128),
      site:String(row.site||'Site not specified').slice(0,130),
      tech:String(row.tech||'FSE').slice(0,85),
      type:String(row.visitType||'Field Visit').slice(0,80),
      category:String(row.issueType||row.category||'').slice(0,90),
      status:String(row.status||'Unspecified').slice(0,32),
      priority:String(row.priority||'').slice(0,30),
      date:String(row.date||''),
      timestamp:safeDate(row),
      original:row
    })).filter(r=>{
      if(seen.has(r.id))return false;
      seen.add(r.id);return true;
    }).sort((a,b)=>b.timestamp-a.timestamp||b.id.localeCompare(a.id)).slice(0,100);
  }
  function loadForAccount(){
    const next=key();
    if(!next)return false;
    if(next===activeKey)return true;
    activeKey=next;initialized=false;read=new Set();records=[];firstLoad=true;
    try{
      const stored=JSON.parse(localStorage.getItem(activeKey)||'null');
      if(stored&&Array.isArray(stored.read)){
        read=new Set(stored.read.map(String));
        initialized=true;
      }
    }catch{}
    return true;
  }
  function persist(){
    if(!activeKey)return;
    const known=records.map(r=>r.id);
    const retained=[...read].filter(id=>known.includes(id)).slice(-120);
    read=new Set(retained);
    try{localStorage.setItem(activeKey,JSON.stringify({read:retained,updatedAt:Date.now()}));}
    catch(err){console.warn('Notifications read state unavailable:',err.message);}
  }
  function unreadCount(){return records.reduce((sum,r)=>sum+(!read.has(r.id)?1:0),0);}
  function updateBadges(){
    const count=unreadCount();
    for(const id of ['fsm-notif-desktop-badge','fsm-notif-mobile-badge','fsm-notif-filter-count']){
      const item=document.getElementById(id);
      if(item){item.hidden=count===0;item.textContent=count>99?'99+':String(count);}
    }
    if(markAll)markAll.disabled=count===0;
  }
  function el(tag,cls,text){
    const n=document.createElement(tag);if(cls)n.className=cls;
    if(text!==undefined)n.textContent=text;return n;
  }
  function renderTime(ms,date){
    if(!ms)return date||'';
    const d=new Date(ms),now=new Date();
    if(now.toDateString()===d.toDateString())return timeFormat.format(d);
    return dateFormat.format(d);
  }
  function openFieldLog(id){
    const open=window.fsmOpenFieldLogFromChat;
    if(typeof open==='function'){
      const ok=open(id);
      if(!ok&&typeof showToast==='function')showToast('Unable to open visit','This record may have been removed or is not accessible.','bad');
    }
  }
  function markRead(ids){
    for(const id of ids)read.add(id);
    persist();updateBadges();
  }
  function render(){
    if(!loadForAccount()){
      list.replaceChildren(el('p','fsm-notif-empty','Sign in to FSM to view team notifications.'));
      updateBadges();return;
    }
    const shown=filter==='unread'?records.filter(r=>!read.has(r.id)):records;
    list.replaceChildren();
    if(!shown.length){
      const empty=el('div','fsm-notif-blank');
      empty.append(el('div','fsm-notif-blank-symbol','✓'),
        el('strong','',filter==='unread'?'All caught up':'No field visits yet'),
        el('p','',filter==='unread'?'No unread visit notifications.':'New team visits will appear here when they are saved.'));
      list.append(empty);updateBadges();return;
    }
    for(const r of shown){
      const unread=!read.has(r.id);
      const card=el('button','fsm-notif-item'+(unread?' is-unread':''));card.type='button';
      card.dataset.visitId=r.id;
      card.setAttribute('role','listitem');
      card.title='Open Field Log';
      const icon=el('span','fsm-notif-icon',/incident|breakdown/i.test(r.type)?'!':'✓');
      icon.setAttribute('aria-hidden','true');
      const content=el('span','fsm-notif-info');
      const top=el('span','fsm-notif-row');
      const heading=el('strong','fsm-notif-title',r.tech+' logged a field visit');
      const timestamp=el('time','fsm-notif-time',renderTime(r.timestamp,r.date));
      if(r.timestamp)timestamp.dateTime=new Date(r.timestamp).toISOString();
      top.append(heading,timestamp);
      const sub=el('span','fsm-notif-site',r.site);
      const desc=el('span','fsm-notif-description',r.type+(r.category&&r.category!==r.type?' · '+r.category:''));
      const foot=el('span','fsm-notif-meta');
      if(r.priority&&/incident|breakdown/i.test(r.type))foot.append(el('span','fsm-notif-priority',r.priority));
      foot.append(el('span','fsm-notif-status',r.status));
      if(unread)foot.append(el('span','fsm-notif-new','New'));
      content.append(top,sub,desc,foot);
      const arrow=el('span','fsm-notif-arrow','›');arrow.setAttribute('aria-hidden','true');
      card.append(icon,content,arrow);
      card.addEventListener('click',()=>{markRead([r.id]);render();closePopover();openFieldLog(r.id);});
      list.append(card);
    }
    updateBadges();
  }
  function sync(rows,quiet=false){
    if(!loadForAccount())return;
    const previous=new Set(records.map(r=>r.id));
    records=normalize(rows);
    if(!initialized){
      // First open does not turn old history into a flood of unread notices.
      records.forEach(r=>read.add(r.id));
      initialized=true;persist();
    }else{
      const fresh=records.filter(r=>!previous.has(r.id)&&!read.has(r.id));
      if(!quiet&&!firstLoad&&fresh.length&&user()){
        const newest=fresh[0];
        if(toastLast!==newest.id&&typeof showToast==='function'&&document.visibilityState==='visible'){
          toastLast=newest.id;
          showToast('New Field Visit',newest.tech+' · '+newest.site,'ok');
        }
      }
    }
    firstLoad=false;
    render();
  }
  window.fsmNotificationsSync=rows=>sync(rows);
  window.fsmNotificationsRender=render;
  markAll?.addEventListener('click',()=>{markRead(records.map(r=>r.id));render();});
  filterButtons.forEach(btn=>btn.addEventListener('click',()=>{
    filter=btn.dataset.fsmNotifFilter;
    filterButtons.forEach(b=>{
      const selected=b===btn;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));
    });render();
  }));
  window.addEventListener('visit-committed',event=>{
    if(event.detail?.isEdit||!event.detail?.entry)return;
    // The authoritative Apps Script save was confirmed before this event.
    const entry=event.detail.entry;
    sync([entry,...records.map(r=>r.original)],true);
  });
  // Read changes in all FSE accounts without requiring a manual page refresh.
  // Keep Google Sheets traffic low and do not poll while the tab is hidden.
  async function poll(){
    if(polling||!user()||document.visibilityState!=='visible')return;
    if(typeof window.fsmNotificationsFetch!=='function')return;
    polling=true;
    try{const rows=await window.fsmNotificationsFetch();sync(rows);}
    catch(err){console.warn('Notification refresh unavailable:',err.message);}
    finally{polling=false;}
  }
  window.setInterval(poll,120000);
  window.addEventListener('focus',()=>{if(user())void poll();});
  window.addEventListener('resize',()=>{if(isOpen())closePopover();});
  // In case an existing authenticated session was restored before this script loaded.
  if(user()&&typeof entries!=='undefined')sync(entries,true);
})();
