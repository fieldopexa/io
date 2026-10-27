/* Reuse existing cabinet search/filter handlers and management actions. */
(() => {
 const panel=document.getElementById('inventory-view-cabinets');
 const toolbar=panel?.querySelector('.cabinet-toolbar');
 if(!toolbar)return;
 const search=document.getElementById('cabinet-search'),site=document.getElementById('cabinet-site-filter'),status=document.getElementById('cabinet-status-filter');
 search.placeholder='Search cabinets…';search.setAttribute('aria-label','Search cabinets by ID, location or technical details');
 const button=document.createElement('button');button.type='button';button.className='btn-secondary cabinet-filter-toggle';button.textContent='Filters';button.setAttribute('aria-controls','cabinet-filter-options');button.setAttribute('aria-expanded','false');
 toolbar.append(button);
 const options=document.createElement('div');options.id='cabinet-filter-options';options.hidden=true;options.setAttribute('role','region');options.setAttribute('aria-label','Cabinet filters');toolbar.after(options);
 [[site,'Site / Location'],[status,'Status']].forEach(([control,text])=>{const label=document.createElement('label');label.textContent=text;label.append(control);options.append(label);});
 const selected=document.createElement('div');selected.className='cabinet-active-filters';selected.hidden=true;options.after(selected);
 function setOpen(open){options.hidden=!open;button.setAttribute('aria-expanded',String(open));}
 button.addEventListener('click',()=>setOpen(options.hidden));
 options.addEventListener('keydown',event=>{if(event.key==='Escape'){setOpen(false);button.focus();}});
 function update(){
  selected.replaceChildren();const active=[site,status].filter(control=>control.value!=='All');
  button.textContent=active.length?'Filters ('+active.length+')':'Filters';selected.hidden=!active.length;
  active.forEach(control=>{const chip=document.createElement('button');chip.type='button';chip.className='btn-secondary';chip.textContent=control.value+' ×';chip.setAttribute('aria-label','Remove '+(control===site?'location':'status')+' filter: '+control.value);chip.onclick=()=>{control.value='All';control.dispatchEvent(new Event('change',{bubbles:true}));button.focus();};selected.append(chip);});
 }
 [site,status].forEach(control=>control.addEventListener('change',update));
 new MutationObserver(update).observe(document.getElementById('cabinet-body'),{childList:true});update();

 // FSE retains the technical fields previously shown in the list, read-only.
 const dialog=document.createElement('dialog');dialog.id='cabinet-registry-details';dialog.setAttribute('aria-labelledby','cabinet-registry-details-title');
 const close=document.createElement('button');close.type='button';close.className='btn-secondary';close.textContent='Close';close.onclick=()=>dialog.close();
 const content=document.createElement('div');dialog.append(close,content);document.body.append(dialog);
 document.addEventListener('click',event=>{
  const target=event.target.closest('[data-cab-readonly]');
  if(target){
   const row=cabinetRows.find(row=>String(row.id)===target.dataset.cabReadonly);if(!row)return;
   const fields=[['Permanent Cabinet No.',row.permanentNumber],['Label',row.label],['Site / Location',canonicalCabinetSite(row,cabinetCanonicalSiteMap())],['Status',cabinetDisplayStatus(row)],['Cabinet Serial',row.cabinetSerial],['Token',row.token],['TeamViewer ID',row.teamviewerId],['Bill Validator',row.bvModel],['BV Serial',row.bvSerial],['Printer',row.printerModel],['Printer Serial',row.printerSerial],['System / MPU',row.mpuSerial],['Network',row.networkNote]];
   content.innerHTML='<h2 id="cabinet-registry-details-title">'+escapeHtml(row.cabinetId||'Cabinet details')+'</h2><dl>'+fields.map(([label,value])=>'<div><dt>'+escapeHtml(label)+'</dt><dd>'+escapeHtml(String(value||'—'))+'</dd></div>').join('')+'</dl>';
   dialog.showModal();
  }
  document.querySelectorAll('.cabinet-row-menu[open]').forEach(menu=>{if(!menu.contains(event.target)||event.target.closest('button'))menu.open=false;});
 });
 document.addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelectorAll('.cabinet-row-menu[open]').forEach(menu=>{menu.open=false;menu.querySelector('summary').focus();});});
})();
