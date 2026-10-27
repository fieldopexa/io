/* Keep movement entry/save logic unchanged; simplify browsing history. */
(() => {
 const panel=document.getElementById('inventory-view-movements'),toolbar=panel?.querySelector('.movement-toolbar');
 if(!toolbar)return;
 const search=document.getElementById('movement-search'),type=document.getElementById('movement-type-filter');
 search.placeholder='Search movements…';search.setAttribute('aria-label','Search movements by cabinet, location, handler or reference');
 const toggle=document.createElement('button');toggle.type='button';toggle.className='btn-secondary movement-filter-toggle';toggle.textContent='Filters';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','movement-filter-options');toolbar.append(toggle);
 const options=document.createElement('div');options.id='movement-filter-options';options.hidden=true;options.setAttribute('role','region');options.setAttribute('aria-label','Movement filters');
 const label=document.createElement('label');label.textContent='Movement type';label.append(type);options.append(label);toolbar.after(options);
 const selected=document.createElement('div');selected.className='movement-active-filter';selected.hidden=true;options.after(selected);
 function open(value){options.hidden=!value;toggle.setAttribute('aria-expanded',String(value));}
 toggle.onclick=()=>open(options.hidden);options.addEventListener('keydown',event=>{if(event.key==='Escape'){open(false);toggle.focus();}});
 function update(){selected.replaceChildren();const active=type.value!=='All';selected.hidden=!active;toggle.textContent=active?'Filters (1)':'Filters';if(active){const chip=document.createElement('button');chip.type='button';chip.className='btn-secondary';chip.textContent=type.value+' ×';chip.setAttribute('aria-label','Remove movement type filter: '+type.value);chip.onclick=()=>{type.value='All';type.dispatchEvent(new Event('change',{bubbles:true}));toggle.focus();};selected.append(chip);}}
 type.addEventListener('change',update);new MutationObserver(update).observe(document.getElementById('movement-body'),{childList:true});update();
 const dialog=document.createElement('dialog');dialog.id='movement-details-dialog';dialog.setAttribute('aria-labelledby','movement-details-title');
 const close=document.createElement('button');close.type='button';close.className='btn-secondary';close.textContent='Close';close.onclick=()=>dialog.close();
 const content=document.createElement('div');dialog.append(close,content);document.body.append(dialog);
 document.getElementById('movement-body').addEventListener('click',event=>{
  const button=event.target.closest('[data-movement-details]');if(!button)return;
  const row=movementRows[Number(button.dataset.movementDetails)];if(!row)return;
  const fields=[['Date',row.movementDate],['Movement',row.movementType],['Cabinet',row.cabinetId],['Allocation before',row.allocationBefore||row.cabinetId],['Allocation after',row.allocationAfter],['From',row.fromLocation],['To',row.toLocation],['Status before',row.statusBefore],['Status after',row.statusAfter],['Handled by',row.handledBy],['Reference',row.referenceNo],['Remarks',row.remarks]];
  content.innerHTML='<h2 id="movement-details-title">Movement details</h2><dl>'+fields.map(([name,value])=>'<div><dt>'+escapeHtml(name)+'</dt><dd>'+escapeHtml(String(value||'—'))+'</dd></div>').join('')+'</dl>';dialog.showModal();
 });
})();
