/* Compact log controls; keep existing filter inputs and their event handlers. */
(function(){
 const panel=document.getElementById('panel-fieldlogs'),box=panel?.querySelector('.log-search-area');
 if(!box)return;
 const filters=document.getElementById('filters'),search=document.getElementById('global-search');
 const dates=document.getElementById('calm-date-filters');
 const categories=document.createElement('div');categories.className='log-filter-categories';categories.setAttribute('aria-label','Visit categories');
 filters.querySelectorAll('.chip').forEach(chip=>{
  categories.append(chip);chip.setAttribute('role','button');chip.tabIndex=0;
  chip.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();chip.click();}});
 });
 filters.prepend(categories);
 const status=document.createElement('select');status.id='log-status-filter';status.setAttribute('aria-label','Filter visits by status');
 [['','All statuses'],['Pending','Pending'],['Follow-up','Follow-up'],['Resolved','Resolved'],['Voided','Voided']].forEach(([value,text])=>status.add(new Option(text,value)));
 const statusRow=document.createElement('label');statusRow.className='log-status-row';statusRow.textContent='Visit status';statusRow.append(status);categories.after(statusRow);
 const categoryGroup=document.createElement('div');categoryGroup.className='log-category-group';
 const categoryLabel=document.createElement('span');categoryLabel.id='log-category-label';categoryLabel.textContent='Category';
 categories.before(categoryGroup);categoryGroup.append(categoryLabel,categories);categories.setAttribute('aria-labelledby',categoryLabel.id);
 const searchRow=document.createElement('div');searchRow.className='log-search-row';
 const searchBox=box.querySelector('.global-search'),scope=box.querySelector('.log-toolbar');
 const toggle=document.createElement('button');toggle.type='button';toggle.className='btn-secondary log-filter-toggle';toggle.textContent='Filters';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','log-filter-options');
 box.prepend(searchRow);searchRow.append(searchBox,toggle);
 const options=document.createElement('div');options.id='log-filter-options';options.hidden=true;options.setAttribute('role','region');options.setAttribute('aria-label','Visit filter options');
 searchRow.after(options);options.append(scope,filters);
 const selected=document.createElement('div');selected.className='log-active-filters';selected.setAttribute('aria-label','Active visit filters');selected.hidden=true;searchRow.after(selected);
 function setOpen(open){options.hidden=!open;toggle.setAttribute('aria-expanded',String(open));}
 toggle.addEventListener('click',()=>setOpen(options.hidden));
 options.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();setOpen(false);toggle.focus();}});
 panel.querySelectorAll('.utility-strip').forEach(strip=>{if([...strip.querySelectorAll('button')].some(button=>button.textContent==='Clear all'))strip.hidden=true;});
 scope.setAttribute('role','group');scope.setAttribute('aria-label','Technician scope');
 status.addEventListener('change',()=>{render();update();});
 search.placeholder='Search visits…';search.setAttribute('aria-label','Search visits by site, technician, issue or visit number');
 const bar=document.createElement('div');bar.className='log-filter-heading';
 const heading=document.createElement('span');heading.textContent='Find visits';
 const reset=document.createElement('button');reset.type='button';reset.className='log-filter-reset';reset.textContent='Clear filters';reset.hidden=true;
 bar.append(heading);options.prepend(bar);
 dates.open=false;
 const inputs=['date-from','date-to'].map(id=>document.getElementById(id));
 inputs.forEach((input,index)=>{input.setAttribute('aria-label',index?'End date':'Start date');input.parentElement.firstChild.textContent=index?'To':'From';});
 function update(){
  const active=categories.querySelector('.chip.active');
  categories.querySelectorAll('.chip').forEach(chip=>chip.setAttribute('aria-pressed',String(chip===active)));
  const count=inputs.filter(input=>input.value).length;
  const activeCount=Number(!!search.value.trim())+count+Number(active?.dataset.cat!=='All')+Number(!!status.value)+Number(activeWork==='mine')+Number(!!window.attentionFilter);
  heading.textContent='Filter options';toggle.textContent=activeCount?'Filters ('+activeCount+')':'Filters';
  selected.replaceChildren();
  function tag(label,remove){const button=document.createElement('button');button.type='button';button.className='log-active-chip';button.textContent=label+' ×';button.setAttribute('aria-label','Remove filter: '+label);button.addEventListener('click',()=>{remove();render();update();toggle.focus();});selected.append(button);}
  if(search.value.trim())tag('Search: '+search.value.trim(),()=>{search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));});
  if(active?.dataset.cat!=='All')tag(active?.textContent||'Category',()=>categories.querySelector('[data-cat="All"]')?.click());
  if(status.value)tag(status.value,()=>{status.value='';status.dispatchEvent(new Event('change',{bubbles:true}));});
  inputs.forEach((input,index)=>{if(input.value)tag((index?'To: ':'From: ')+input.value,()=>{input.value='';input.dispatchEvent(new Event('change',{bubbles:true}));});});
  if(activeWork==='mine')tag('My work'+(document.getElementById('my-fse').value?' · '+document.getElementById('my-fse').value:''),()=>document.querySelector('#work-toggle [data-work="all"]')?.click());
  if(window.attentionFilter)tag('Attention: '+window.attentionFilter,()=>{window.attentionFilter=null;});
  selected.hidden=!activeCount;selected.append(reset);
  dates.querySelector('summary').textContent=count?'Date range · '+count+' selected':'Date range';
  reset.hidden=!(search.value.trim()||count||active?.dataset.cat!=='All'||status.value||activeWork==='mine'||window.attentionFilter);
 }
 reset.addEventListener('click',()=>{
  status.value='';activeWork='all';window.attentionFilter=null;
  document.querySelectorAll('#work-toggle button').forEach(button=>button.classList.toggle('active',button.dataset.work==='all'));
  document.getElementById('my-fse').style.display='none';
  search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));
  inputs.forEach(input=>{input.value='';input.dispatchEvent(new Event('change',{bubbles:true}));});
  categories.querySelector('[data-cat="All"]')?.click();dates.open=false;update();
 });
 search.addEventListener('input',update);inputs.forEach(input=>input.addEventListener('change',update));
 categories.addEventListener('click',update);
 panel.addEventListener('click',event=>{if(event.target.closest('#work-toggle'))update();});
 new MutationObserver(update).observe(document.getElementById('log'),{childList:true});
 new MutationObserver(update).observe(categories,{subtree:true,attributes:true,attributeFilter:['class']});
 const css=document.createElement('style');css.textContent=`
 #panel-fieldlogs .log-search-area{padding:0!important;border:0!important;border-radius:0!important;background:transparent!important}
 #panel-fieldlogs .log-search-row{display:flex;align-items:center;gap:10px;margin:0}
 #panel-fieldlogs .log-filter-toggle{min-height:46px;white-space:nowrap;padding:10px 16px}
 #panel-fieldlogs #log-filter-options{margin-top:12px;padding:16px;border:1px solid var(--line);border-radius:10px;background:var(--card)}
 #panel-fieldlogs #log-filter-options[hidden],#panel-fieldlogs .log-active-filters[hidden],#panel-fieldlogs .utility-strip[hidden]{display:none!important}
 #panel-fieldlogs #log-filter-options .log-toolbar{margin:0 0 16px!important;justify-content:flex-start;gap:10px}
 #panel-fieldlogs .log-active-filters{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:10px}
 #panel-fieldlogs .log-active-chip{max-width:100%;overflow-wrap:anywhere;min-height:36px;padding:6px 10px;border:1px solid var(--line);border-radius:7px;background:var(--card);color:var(--ink);font:12px/1.4 'Segoe UI',sans-serif;cursor:pointer;text-align:left}
 #panel-fieldlogs .log-active-chip:hover{border-color:#899bc9}
 #panel-fieldlogs .log-search-area .global-search{flex:1;min-width:0;margin:0!important;min-height:46px!important}
 #panel-fieldlogs .log-search-row .log-toolbar{flex:0 0 auto;display:flex;align-items:center;gap:8px;margin:0!important;flex-wrap:wrap}
 #panel-fieldlogs .log-search-row .work-toggle button{min-height:40px;padding:8px 14px}
 #panel-fieldlogs #global-search{min-width:0;width:100%;font-size:14px!important}
 #panel-fieldlogs .log-filter-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:32px;margin-bottom:8px;font-size:12px;color:var(--ink-soft)}
 #panel-fieldlogs .log-filter-reset{border:0;background:transparent;color:#b8c7ee;font:inherit;cursor:pointer;min-height:32px;padding:4px 0 4px 12px}
 #panel-fieldlogs .log-filter-reset[hidden]{display:none!important}
 #panel-fieldlogs #filters{display:grid!important;grid-template-columns:minmax(0,1fr) 180px;gap:14px 24px;padding:0!important;margin:0!important;border:0!important;align-items:start}
 #panel-fieldlogs .log-category-group{min-width:0}
 #panel-fieldlogs .log-category-group>span{display:block;font-size:12px;color:var(--ink-soft);margin-bottom:8px}
 #panel-fieldlogs .log-filter-categories{display:flex;flex-wrap:wrap;gap:6px;margin:0}
 #panel-fieldlogs .log-status-row{display:flex;flex-direction:column;align-items:stretch;gap:8px;margin:0;font-size:12px;color:var(--ink-soft)}
 #panel-fieldlogs #log-status-filter{width:100%;min-width:0;max-width:100%;min-height:40px;font-size:13px}
 #panel-fieldlogs .log-filter-categories .chip{display:inline-flex;align-items:center;justify-content:center;min-height:36px;padding:7px 12px!important;margin:0!important;font-size:11px!important;border-radius:8px!important;white-space:nowrap}
 #panel-fieldlogs #calm-date-filters{grid-column:1/-1;margin:0!important;padding:0!important;border:0!important;border-top:1px solid var(--line)!important}
 #panel-fieldlogs #calm-date-filters>summary{width:100%!important;min-height:44px;padding:12px 0!important;font-size:12px!important;cursor:pointer}
 #panel-fieldlogs #calm-date-filters .calm-filter-fields{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));align-items:start!important;gap:10px!important;padding:0 0 4px!important;margin:0!important}
 #panel-fieldlogs #calm-date-filters label{display:flex!important;flex-direction:column;gap:6px;min-width:0;margin:0!important;font-size:11px;color:var(--ink-soft)}
 #panel-fieldlogs #calm-date-filters input[type=date]{display:block!important;flex:none!important;width:100%!important;min-width:0!important;max-width:100%!important;height:44px!important;min-height:44px!important;max-height:44px!important;padding:10px!important;margin:0!important;font-size:13px!important;box-sizing:border-box;color-scheme:dark;border-radius:8px!important}
 #panel-fieldlogs #calm-date-filters .calm-filter-fields>button{display:none!important}
 @media(max-width:700px){#panel-fieldlogs #filters{grid-template-columns:minmax(0,1fr);gap:14px}#panel-fieldlogs .log-status-row{display:grid;grid-template-columns:90px minmax(0,1fr);align-items:center}#panel-fieldlogs #log-status-filter{min-height:44px}}
 @media(max-width:600px){#panel-fieldlogs .log-filter-categories .chip,#panel-fieldlogs .log-active-chip,#panel-fieldlogs .log-filter-reset{min-height:44px}#panel-fieldlogs #log-filter-options{padding:12px}#panel-fieldlogs #log-filter-options .work-toggle button{min-height:44px}#panel-fieldlogs .log-filter-toggle{padding:10px 12px}}
 `;document.head.append(css);update();
})();
