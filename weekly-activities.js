/* Disclosure feedback only; the existing agenda handlers own edits and saves. */
(() => {
 const form=document.getElementById('weekly-task-form');
 const add=document.getElementById('agenda-add-more');
 const status=document.getElementById('weekly-task-status');
 if(!form||!add)return;
 if(status)form.after(status);
 const sync=()=>{add.hidden=!form.hidden;add.setAttribute('aria-expanded',String(!form.hidden));};
 new MutationObserver(sync).observe(form,{attributes:true,attributeFilter:['hidden']});sync();
})();
