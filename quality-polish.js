(() => {
 const names={
  'period-picker':'Report period',
  'audit-action-filter':'Filter audit trail by action',
  'audit-entity-filter':'Filter audit trail by record type',
  'component-search':'Search cabinet components',
  'component-site-filter':'Filter components by location',
  'component-coverage-filter':'Filter component coverage',
  'spare-search':'Search spare parts',
  'spare-category-filter':'Filter spare parts by category'
 };
 for(const [id,name] of Object.entries(names))document.getElementById(id)?.setAttribute('aria-label',name);
 // Keep the section selector label separate from the interactive overflow menu.
 const category=document.querySelector('.asset-mobile-category');
 if(category?.tagName==='LABEL'){
  const replacement=document.createElement('div');replacement.className=category.className;
  while(category.firstChild)replacement.append(category.firstChild);
  category.replaceWith(replacement);
 }
 const summary=document.querySelector('.asset-mobile-overflow>summary');
 if(summary){
  const sync=()=>{const busy=document.getElementById('panel-inventory').getAttribute('aria-busy')==='true';summary.setAttribute('aria-label',busy?'Refreshing asset data; section actions':'Actions for current asset section');};
  new MutationObserver(sync).observe(document.getElementById('panel-inventory'),{attributes:true,attributeFilter:['aria-busy']});sync();
 }
})();
