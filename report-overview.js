/* Keep every report record available for print and presentation. */
(() => {
 document.getElementById('presentation-report')?.addEventListener('click',event=>{
  const button=event.target.closest('[data-report-visit]');
  if(button)openDetail(button.dataset.reportVisit);
 });
 const saved=new Map();
 function expand(){document.querySelectorAll('.report-secondary-details').forEach(details=>{if(!saved.has(details))saved.set(details,details.open);details.open=true;});}
 function restore(){saved.forEach((open,details)=>{if(details.isConnected)details.open=open;});saved.clear();}
 window.addEventListener('beforeprint',expand);window.addEventListener('afterprint',()=>{if(!document.body.classList.contains('report-presenting'))restore();});
 new MutationObserver(()=>{if(document.body.classList.contains('report-presenting'))expand();else restore();}).observe(document.body,{attributes:true,attributeFilter:['class']});
 function tidyAgenda(){
  document.querySelectorAll('#presentation-report > .report-agenda-details').forEach(details=>{if(!details.querySelector('.brief-agenda,.report-agenda-section'))details.remove();});
  const agenda=document.querySelector('#presentation-report > .brief-agenda,#presentation-report > .report-agenda-section');
  if(agenda){const details=document.createElement('details');details.className='report-secondary-details report-agenda-details';const summary=document.createElement('summary');summary.textContent='Agenda & other work';agenda.before(details);details.append(summary,agenda);}
  if(document.body.classList.contains('report-presenting'))expand();
 }
 new MutationObserver(tidyAgenda).observe(document.getElementById('presentation-report'),{childList:true});tidyAgenda();
})();
