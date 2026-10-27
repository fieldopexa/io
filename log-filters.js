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
 status.addEventListener('change',()=>{render();update();});
 search.placeholder='Search visits…';search.setAttribute('aria-label','Search visits by site, technician, issue or visit number');
 const bar=document.createElement('div');bar.className='log-filter-heading';
 const heading=document.createElement('span');heading.textContent='Filter visits';
 const reset=document.createElement('button');reset.type='button';reset.className='log-filter-reset';reset.textContent='Clear filters';reset.hidden=true;
 bar.append(heading,reset);filters.before(bar);
 dates.open=false;
 const inputs=['date-from','date-to'].map(id=>document.getElementById(id));
 inputs.forEach((input,index)=>{input.setAttribute('aria-label',index?'End date':'Start date');input.parentElement.firstChild.textContent=index?'To':'From';});
 function update(){
  const active=categories.querySelector('.chip.active');
  categories.querySelectorAll('.chip').forEach(chip=>chip.setAttribute('aria-pressed',String(chip===active)));
  const count=inputs.filter(input=>input.value).length;
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
 #panel-fieldlogs .log-search-area{padding:16px!important;border-radius:14px!important;background:var(--card)!important}
 #panel-fieldlogs .log-search-area .global-search{margin:0 0 14px!important;min-height:46px!important}
 #panel-fieldlogs #global-search{min-width:0;width:100%;font-size:14px!important}
 #panel-fieldlogs .log-filter-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:32px;margin-bottom:8px;font-size:11px;color:var(--ink-soft)}
 #panel-fieldlogs .log-filter-reset{border:0;background:transparent;color:#b8c7ee;font:inherit;cursor:pointer;min-height:32px;padding:4px 0 4px 12px}
 #panel-fieldlogs .log-filter-reset[hidden]{display:none!important}
 #panel-fieldlogs #filters{display:block!important;padding:0!important;margin:0!important;border:0!important}
 #panel-fieldlogs .log-filter-categories{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}
 #panel-fieldlogs .log-status-row{display:flex;align-items:center;gap:12px;margin:0 0 12px;font-size:12px;color:var(--ink-soft)}
 #panel-fieldlogs #log-status-filter{width:auto;min-width:150px;max-width:100%;min-height:44px;font-size:13px}
 #panel-fieldlogs .log-filter-categories .chip{display:inline-flex;align-items:center;justify-content:center;min-height:36px;padding:7px 12px!important;margin:0!important;font-size:11px!important;border-radius:8px!important;white-space:nowrap}
 #panel-fieldlogs #calm-date-filters{margin:0!important;padding:0!important;border:0!important;border-top:1px solid var(--line)!important}
 #panel-fieldlogs #calm-date-filters>summary{width:100%!important;min-height:44px;padding:12px 0!important;font-size:12px!important;cursor:pointer}
 #panel-fieldlogs #calm-date-filters .calm-filter-fields{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));align-items:start!important;gap:10px!important;padding:0 0 4px!important;margin:0!important}
 #panel-fieldlogs #calm-date-filters label{display:flex!important;flex-direction:column;gap:6px;min-width:0;margin:0!important;font-size:11px;color:var(--ink-soft)}
 #panel-fieldlogs #calm-date-filters input[type=date]{display:block!important;flex:none!important;width:100%!important;min-width:0!important;max-width:100%!important;height:44px!important;min-height:44px!important;max-height:44px!important;padding:10px!important;margin:0!important;font-size:13px!important;box-sizing:border-box;color-scheme:dark;border-radius:8px!important}
 #panel-fieldlogs #calm-date-filters .calm-filter-fields>button{display:none!important}
 @media(max-width:600px){#panel-fieldlogs .log-search-area{padding:12px!important}#panel-fieldlogs .log-filter-categories .chip{min-height:40px}}
 `;document.head.append(css);update();
})();
