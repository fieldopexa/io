/* Small improvements to the existing visit form; retain all save handlers. */
(() => {
  const form=document.querySelector('#panel-log .smart-visit-form');
  const status=document.getElementById('visit-save-status');
  if(form&&status)form.before(status);
  const submit=document.getElementById('submit-btn');
  const mobile=document.getElementById('mobile-save-fab');
  if(submit&&mobile){
    const sync=()=>{
      mobile.disabled=submit.disabled;
      mobile.setAttribute('aria-busy',String(submit.disabled));
      submit.setAttribute('aria-busy',String(submit.disabled));
      const label=mobile.querySelector('span');
      if(label)label.textContent=submit.disabled?'Saving visit…':(editingEntryId?'Save Changes':'Save Field Visit');
    };
    new MutationObserver(sync).observe(submit,{attributes:true,attributeFilter:['disabled'],childList:true,subtree:true,characterData:true});sync();
  }
  const client=document.getElementById('location-combobox');
  const error=document.getElementById('site-err');
  if(client&&error){
    client.setAttribute('aria-describedby',error.id);client.setAttribute('aria-required','true');
    error.setAttribute('role','alert');
    const sync=()=>client.setAttribute('aria-invalid',String(error.style.display==='block'));
    new MutationObserver(sync).observe(error,{attributes:true,attributeFilter:['style']});sync();
    document.querySelector('#f-site')?.closest('.field')?.querySelector('label')?.setAttribute('for',client.id);
  }
})();
