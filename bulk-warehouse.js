/* Management-only batch UI over the existing per-cabinet saveMovement API.
   No production writes occur until the user reviews and confirms a selection. */
(() => {
 const dialog=document.createElement('dialog');dialog.id='bulk-warehouse-dialog';dialog.setAttribute('aria-labelledby','bulk-warehouse-title');
 dialog.innerHTML='<header><div><h2 id="bulk-warehouse-title">Move cabinets to warehouse</h2><p>Select a site, review the cabinets, then confirm one batch.</p></div><button type="button" class="btn-secondary" id="bulk-warehouse-close">Close</button></header>'+
  '<div class="bulk-warehouse-fields"><label>From site<select id="bulk-warehouse-site"></select></label><label>Destination<input value="Carmona Cavite Warehouse" readonly></label><label>Movement date<input id="bulk-warehouse-date" type="date" required></label><label>Handled by<input id="bulk-warehouse-handler" maxlength="150"></label></div>'+
  '<label>Remarks <span class="muted">(optional)</span><textarea id="bulk-warehouse-remarks" rows="2"></textarea></label>'+
  '<div class="bulk-warehouse-selection"><label><input id="bulk-warehouse-all" type="checkbox"> Select all cabinets</label><span id="bulk-warehouse-count"></span></div><div id="bulk-warehouse-list"></div>'+
  '<p class="bulk-warehouse-explanation">Selected cabinets will move to Carmona Warehouse as Warehouse / Stock. Each keeps its permanent number and gets a separate movement record. The source site’s open/closed status will stay unchanged.</p>'+
  '<div id="bulk-warehouse-status" role="status" aria-live="polite"></div><div class="bulk-warehouse-actions"><button type="button" class="btn-secondary" id="bulk-warehouse-review">Review transfer</button><button type="button" class="btn-primary" id="bulk-warehouse-confirm" hidden>Confirm transfer</button><button type="button" class="btn-secondary" id="bulk-warehouse-back" hidden>Back</button></div>';
 document.body.append(dialog);
 const get=id=>document.getElementById('bulk-warehouse-'+id);
 const site=get('site'),list=get('list'),status=get('status'),all=get('all'),review=get('review'),confirm=get('confirm'),back=get('back'),close=get('close');
 let rows=[],selection=new Set(),busy=false,reviewed=false,batch=[],batchId='';
 const destination='Carmona Cavite Warehouse';
 const key=value=>normalizeSiteKey(canonicalSiteName(value||''));
 const location=(row,map)=>canonicalCabinetSite(row,map);
 const warehouse=row=>key(location(row,cabinetCanonicalSiteMap()))===key(destination);
 function setBusy(value){busy=value;dialog.setAttribute('aria-busy',String(value));dialog.querySelectorAll('input,select,textarea,button').forEach(control=>{control.disabled=value;});}
 function showReview(value){reviewed=value;review.hidden=value;confirm.hidden=!value;back.hidden=!value;dialog.querySelectorAll('.bulk-warehouse-fields input,.bulk-warehouse-fields select,textarea,#bulk-warehouse-all,#bulk-warehouse-list input').forEach(control=>{control.disabled=value;});}
 function updateCount(){const count=rows.filter(row=>selection.has(String(row.id))).length;get('count').textContent=count+' of '+rows.length+' selected';all.checked=!!rows.length&&count===rows.length;all.indeterminate=count>0&&count<rows.length;review.disabled=!count||busy;}
 function render(){
  list.replaceChildren();
  rows.forEach(row=>{const label=document.createElement('label');label.className='bulk-warehouse-cabinet';const check=document.createElement('input');check.type='checkbox';check.checked=selection.has(String(row.id));check.setAttribute('aria-label','Select '+row.cabinetId);check.onchange=()=>{if(check.checked)selection.add(String(row.id));else selection.delete(String(row.id));showReview(false);updateCount();};const text=document.createElement('span');const title=document.createElement('b');title.textContent=row.cabinetId||'Cabinet';const small=document.createElement('small');small.textContent=[row.permanentNumber?'Permanent #'+row.permanentNumber:'Permanent number assigned by system',row.status||'No status'].join(' · ');text.append(title,small);const result=document.createElement('span');result.dataset.bulkResult=String(row.id);result.className='bulk-warehouse-result';label.append(check,text,result);list.append(label);});
  if(!rows.length){const empty=document.createElement('p');empty.textContent='No cabinets at this site are available to move.';list.append(empty);}updateCount();
 }
 function chooseSite(){const map=cabinetCanonicalSiteMap();rows=cabinetRows.filter(row=>key(location(row,map))===key(site.value)&&!warehouse(row)).sort(cabinetNaturalSort);selection=new Set(rows.map(row=>String(row.id)));batch=[];showReview(false);render();status.textContent='';}
 function buildSites(preferred){const map=cabinetCanonicalSiteMap();const sites=[...new Set(cabinetRows.filter(row=>!warehouse(row)).map(row=>location(row,map)).filter(Boolean))].sort((a,b)=>a.localeCompare(b));site.replaceChildren();sites.forEach(name=>site.add(new Option(name,name)));if(sites.some(name=>key(name)===key(preferred)))site.value=sites.find(name=>key(name)===key(preferred));chooseSite();}
 async function open(preferred=''){
  if(currentUser?.role!=='management')return;
  if(dialog.open||busy)return;
  get('date').value=todayStr();get('handler').value=currentUser.name||currentUser.username||'';get('remarks').value='';status.textContent='Loading the current cabinet list…';list.replaceChildren();dialog.showModal();setBusy(true);
  try{const fresh=await apiGet('cabinets');if(!Array.isArray(fresh))throw Error('Cabinet list could not be verified.');cabinetRows=fresh;buildSites(preferred);}
  catch(error){rows=[];selection.clear();status.textContent=error.message||'Unable to load cabinets. Close and try again.';}
  finally{setBusy(false);showReview(false);updateCount();}
 }
 site.addEventListener('change',chooseSite);all.addEventListener('change',()=>{selection=new Set(all.checked?rows.map(row=>String(row.id)):[]);showReview(false);render();});
 review.onclick=()=>{
  if(!get('date').reportValidity()||!selection.size)return;
  batchId='BULK-'+crypto.randomUUID();
  batch=rows.filter(row=>selection.has(String(row.id))).map(row=>({id:String(row.id),name:row.cabinetId,source:site.value,reference:batchId+'-'+row.id,state:'pending'}));
  confirm.textContent='Move '+batch.length+' cabinet'+(batch.length===1?'':'s')+' to warehouse';
  status.textContent='Review: '+batch.length+' cabinet'+(batch.length===1?'':'s')+' from '+site.value+' → '+destination+' on '+get('date').value+'. Each will receive its own movement record.';showReview(true);
 };
 back.onclick=()=>{showReview(false);status.textContent='';updateCount();};
 const paintResult=(item,text)=>{const target=[...list.querySelectorAll('[data-bulk-result]')].find(node=>node.dataset.bulkResult===item.id);if(target)target.textContent=text;};
 async function reconcile(item){
  try{const [history,cabinets]=await Promise.all([apiGet('movements'),apiGet('cabinets')]);if(!Array.isArray(history)||!Array.isArray(cabinets))return false;const cabinet=cabinets.find(row=>String(row.id)===item.id);return cabinet&&key(cabinet.site)===key(destination)&&history.some(row=>String(row.cabinetRowId)===item.id&&row.referenceNo===item.reference&&key(row.toLocation)===key(destination));}catch{return false;}
 }
 confirm.onclick=async()=>{
  if(busy||!reviewed||currentUser?.role!=='management')return;
  setBusy(true);let confirmed=0,skipped=0,uncertain=false;
  try{
   const fresh=await apiGet('cabinets');if(!Array.isArray(fresh))throw Error('Cabinets could not be checked before transfer. Nothing was moved.');
   cabinetRows=fresh;const map=cabinetCanonicalSiteMap();
   for(const item of batch){
    const row=fresh.find(row=>String(row.id)===item.id);
    if(!row||warehouse(row)||key(location(row,map))!==key(item.source)){item.state='skipped';skipped++;paintResult(item,'Skipped: location changed');continue;}
    status.textContent='Moving '+(confirmed+skipped+1)+' of '+batch.length+' · '+item.name+'. Keep this page open.';paintResult(item,'Saving…');
    try{
     const number=normalizedPermanentCabinetNumber(row.permanentNumber);
     const result=await apiPost('saveMovement',{record:{cabinetRowId:item.id,movementDate:get('date').value,movementType:'Warehouse Return',toLocation:destination,statusAfter:'Warehouse / Stock',handledBy:get('handler').value.trim(),referenceNo:item.reference,remarks:get('remarks').value.trim(),allocationAfter:number?'STOCK'+number:''}});
     if(!result?.id||key(result.site)!==key(destination))throw Error('Movement confirmation was incomplete.');
     item.state='confirmed';confirmed++;paintResult(item,'Moved to warehouse');
    }catch(error){
     if(await reconcile(item)){item.state='confirmed';confirmed++;paintResult(item,'Confirmed in history');}
     else{item.state='unconfirmed';uncertain=true;paintResult(item,'Not confirmed — check history');status.textContent='Stopped at '+item.name+'. '+(error.message||'The save was not confirmed.')+' Review movement history before attempting it again.';break;}
    }
   }
  }catch(error){status.textContent=error.message||'Transfer could not start.';uncertain=true;}
  finally{
   const notAttempted=batch.filter(item=>item.state==='pending');notAttempted.forEach(item=>paintResult(item,'Not attempted'));
   const summary=confirmed+' moved, '+skipped+' skipped, '+notAttempted.length+' not attempted.';
   status.textContent=summary+(uncertain?' '+status.textContent+' No automatic retry was made.':' Transfer complete.');
   try{await window.refreshAssetsFast?.('inventory');await loadMovements();}catch{status.textContent+=' Refresh assets to verify the latest totals.';}
   setBusy(false);reviewed=false;review.hidden=true;confirm.hidden=true;back.hidden=true;
   dialog.querySelectorAll('input,select,textarea').forEach(control=>{control.disabled=true;});
  }
 };
 close.onclick=()=>{if(!busy)dialog.close();};dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
 const original=openSiteProfile;openSiteProfile=function(siteName){const result=original.apply(this,arguments);if(currentUser?.role==='management'&&!siteIsWarehouse(siteName)){const actions=document.querySelector('#site-drawer-content .drawer-actions');if(actions&&!actions.querySelector('[data-bulk-warehouse]')){const button=document.createElement('button');button.type='button';button.dataset.bulkWarehouse='true';button.textContent='Move cabinets to warehouse';button.onclick=()=>open(siteName);actions.prepend(button);}}return result;};
 const header=document.querySelector('#inventory-view-movements .section-head');
 const button=document.createElement('button');button.type='button';button.className='btn-secondary';button.dataset.role='management';button.id='bulk-warehouse-open';button.textContent='Move site cabinets to warehouse';button.onclick=()=>open();header?.append(button);
 if(currentUser?.role!=='management')button.style.setProperty('display','none','important');
})();
