/* Optional service forms share the field visit's save and audit lifecycle. */
function visitClientName() {
  const selected=document.getElementById('f-site').value;
  return selected==='Others' ? document.getElementById('f-other-client').value.trim() : canonicalSiteName(selected);
}
function validateOtherClient() {
  const input=document.getElementById('f-other-client');
  if(document.getElementById('f-site').value!=='Others'||input.value.trim())return true;
  window.setVisitWizardStep?.(1,false);
  input.required=true; input.focus(); input.reportValidity(); return false;
}
function restoreOtherClient(entry) {
  const selection=entry?.siteSelection ?? [...(entry?.audit||[])].reverse().find(item=>Object.prototype.hasOwnProperty.call(item,'siteSelection'))?.siteSelection;
  const other=selection==='Others';
  document.getElementById('f-other-client').value=other ? entry.site : '';
  if(other)document.getElementById('f-site').value='Others';
  document.getElementById('other-client-field').hidden=document.getElementById('f-site').value!=='Others';
  document.getElementById('f-other-client').required=document.getElementById('f-site').value==='Others';
}
function serviceFormForEntry(entry) {
  const decode=value=>{
    if(typeof value==='string'){try{value=JSON.parse(value);}catch{return null;}}
    return value&&typeof value==='object'&&!Array.isArray(value)?value:null;
  };
  if (Object.prototype.hasOwnProperty.call(entry, 'serviceForm')&&entry.serviceForm!==''&&entry.serviceForm!==undefined) return decode(entry.serviceForm);
  let audit=entry.audit;
  if(typeof audit==='string'){try{audit=JSON.parse(audit);}catch{audit=[];}}
  return decode([...(Array.isArray(audit)?audit:[])].reverse().find(item => item&&Object.prototype.hasOwnProperty.call(item, 'serviceForm'))?.serviceForm);
}
function serviceFormFullName(name){
  const value=String(name||'').trim();
  return {erwin:'Erwin Santos',popoy:'Lennard Manabat',ian:'Ian Ronquillo'}[value.toLowerCase()]||value;
}
function serviceFormAccount() {
  return serviceFormFullName(currentUser?.fse || currentUser?.name || currentUser?.username || '');
}
function fseSignatureKey(){return ['fse','management'].includes(currentUser?.role)?String(currentUser.username||'').trim().toLowerCase():null;}
let accountSignatureState={key:null,signature:null,loading:false,error:''};
function savedFseSignature(){
  const key=fseSignatureKey();if(!key)return null;
  return accountSignatureState.key===key&&validServiceSignature(accountSignatureState.signature?.image)?accountSignatureState.signature:null;
}
let requestFseSignature=()=>{};
async function loadAccountSignature(){
  const key=fseSignatureKey();accountSignatureState={key,signature:null,loading:true,error:''};
  if(!key){accountSignatureState.loading=false;return;}
  // Remove the old browser-only profile; it is never used as a fallback.
  try{localStorage.removeItem('opexa-fse-signature-v1:'+encodeURIComponent(key));}catch{}
  try{
    const result=await apiGet('accountSignature');
    if(fseSignatureKey()!==key)return;
    accountSignatureState={key,signature:result.signature||null,loading:false,error:''};
  }catch(error){
    if(fseSignatureKey()!==key)return;
    accountSignatureState={key,signature:null,loading:false,error:error.message||'Could not load your signature from Drive.'};
  }
  requestFseSignature();
}
function readServiceForm() {
  if (document.getElementById('f-service-needed').value !== 'yes') return null;
  const value = id => document.getElementById(id).value.trim();
  return {version: 1, checkedBy: serviceFormAccount(), technician: serviceFormFullName(document.getElementById('f-tech').value)||serviceFormAccount(),
    siteIn: value('f-service-in'), siteOut: value('f-service-out'),
    venueManager: value('f-service-manager'), cashier: value('f-service-cashier'),
    pagcorRepresentative: value('f-service-pagcor'), signatures: {...readServiceSignatures(),...(savedFseSignature()?{checkedBy:savedFseSignature()}: {})}};
}
function updateServiceForm() {
  const enabled = document.getElementById('f-service-needed').value === 'yes';
  document.getElementById('service-form-fields').hidden = !enabled;
  document.getElementById('service-form-signing-section').hidden = !enabled;
  window.refreshVisitWizard?.();
  document.querySelectorAll('#service-form-fields input').forEach(input => {input.required = enabled;});
  const text = [serviceFormAccount(), document.getElementById('f-date').value || todayStr(),
    visitClientName() || 'Select a site'].filter(Boolean).join(' · ');
  document.getElementById('service-form-context').textContent = text;
}
function restoreServiceForm(form) {
  const restoredSignatures={...(form?.signatures||{})};delete restoredSignatures.checkedBy;
  document.getElementById('f-service-signatures').value=JSON.stringify(restoredSignatures);
  document.getElementById('f-service-needed').value = form ? 'yes' : 'no';
  Object.entries({'f-service-in':'siteIn','f-service-out':'siteOut','f-service-manager':'venueManager',
    'f-service-cashier':'cashier','f-service-pagcor':'pagcorRepresentative'}).forEach(([id,key]) => {
    document.getElementById(id).value = form?.[key] || '';
  });
  updateServiceForm();
  refreshSignaturePreviews();
}
function validateServiceForm() {
  updateServiceForm();
  if (!readServiceForm()) return true;
  if (!serviceFormAccount()) {showToast('Account required','Sign in before creating a service form.','bad'); return false;}
  if(fseSignatureKey()&&!savedFseSignature()) {requestFseSignature();return false;}
  for (const input of document.querySelectorAll('#service-form-fields input')) {
    if (!input.checkValidity() || !input.value.trim()) {
      window.setVisitWizardStep?.(5, false);
      input.focus(); input.reportValidity(); return false;
    }
  }
  const signatures=readServiceSignatures();
  for(const [key,label,inputId] of serviceSigners){
    if(!validServiceSignature(signatures[key]?.image)||signatures[key].name!==document.getElementById(inputId).value.trim()){
      window.setVisitWizardStep?.(5,false);
      showToast('Signature required',label+' must sign the service form.','bad');
      document.getElementById('sign-'+key).focus();return false;
    }
  }
  return true;
}
function serviceFormDocument(entry, form) {
  const esc = escapeHtml;
  const logoUrl = new URL('service-form-reference.png', document.baseURI).href;
  const problem = [catLabel[entry.category] || entry.category, entry.issueType || entry.generalType].filter(Boolean).join(' — ');
  const signers = [['Checked by',serviceFormFullName(form.checkedBy),'checkedBy'],['Venue Manager',form.venueManager,'venueManager'],['Cashier',form.cashier,'cashier'],['PAGCOR Representative',form.pagcorRepresentative,'pagcorRepresentative']];
  return `<!doctype html><html><head><meta charset="utf-8"><title>Service Form</title><style>
    @page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}html,body{margin:0;padding:0}body{font:12px Arial,sans-serif;color:#111}
    #service-print-page{position:relative;width:272mm;height:185mm;overflow:hidden;break-inside:avoid;page-break-inside:avoid}
    #service-print-content{position:absolute;left:0;top:0;width:272mm;display:flow-root;transform-origin:top left}
    header{display:flex;gap:14px;align-items:center}header b{font-size:17px}
    .original-logo{position:relative;overflow:hidden;width:180px;height:85px;flex:0 0 180px}
    .original-logo img{position:absolute;width:1184px;height:822px;max-width:none;left:-30px;top:-15px}
    h1{text-align:center;letter-spacing:4px;font-size:25px;margin:28px 0 18px}table{border-collapse:collapse;width:100%;table-layout:fixed;margin:10px 0}
    td,th{border:1px solid #111;padding:10px;vertical-align:top;overflow-wrap:anywhere}th{background:#fafafa}p{margin:0 0 14px}
    .work td{height:44px;white-space:pre-wrap}.signatures td{height:100px;vertical-align:bottom;text-align:center}.signatures small{display:block;border-top:1px solid;margin-top:8px;padding-top:6px}
    .signature-image{display:block;width:100%;height:60px;object-fit:contain;margin:0 auto 4px}
    </style></head><body><main id="service-print-page"><div id="service-print-content"><header><div class="original-logo"><img src="${esc(logoUrl)}" alt="Breddas original logo"></div><div><b>BREDDAS INC</b><br>Building 203, Berthaphil I Compound, Jose Abad Santos Ave., Clark Freeport Zone, Pampanga, Philippines 2023</div></header>
    <h1>SERVICE FORM</h1><table><tr><td style="width:55%"><p><b>Technician:</b> ${esc(serviceFormFullName(form.technician || entry.tech))}</p><b>Date Repaired/Visit:</b> ${esc(entry.date)}</td><td><b>Site:</b><br><br>${esc(entry.site)}</td><td><p><b>Site In:</b> ${esc(form.siteIn)}</p><b>Site Out:</b> ${esc(form.siteOut)}</td></tr></table>
    <table class="work"><thead><tr><th style="width:6%">No.</th><th style="width:30%">Problem</th><th style="width:44%">Action Taken</th><th>Remarks</th></tr></thead><tbody>
    <tr><td>1</td><td>${esc(problem)}</td><td>${esc(entry.resolution)}</td><td>${esc(entry.notes)}</td></tr>${'<tr><td>&nbsp;</td><td></td><td></td><td></td></tr>'.repeat(5)}</tbody></table>
    <table class="signatures"><thead><tr>${signers.map(([label])=>`<th>${esc(label)}</th>`).join('')}</tr></thead><tbody><tr>${signers.map(([,name,key])=>`<td>${validServiceSignature(form.signatures?.[key]?.image)?`<img class="signature-image" src="${esc(form.signatures[key].image)}" alt="${esc(name)} signature">`:''}${esc(name)}<small>Signature over printed name</small></td>`).join('')}</tr></tbody></table></div></main></body></html>`;
}
function fitServiceFormPage(doc){
  const page=doc.getElementById('service-print-page'),content=doc.getElementById('service-print-content');
  // Scale the complete document, including signatures, inside a single A4 page.
  // Absolute positioning prevents the original unscaled height creating extra pages.
  content.style.transform='none';
  const scale=Math.min(1,(page.clientWidth-2)/Math.max(1,content.scrollWidth),(page.clientHeight-2)/Math.max(1,content.scrollHeight));
  content.style.transform='scale('+scale+')';
  return scale;
}
function printEntryServiceForm(id) {
  const entry = entries.find(row => String(row.id) === String(id));
  const form = entry && serviceFormForEntry(entry);
  if (!form) return;
  const frame = document.createElement('iframe');
  frame.title = 'Printable service form';
  frame.style.cssText = 'position:fixed;width:1px;height:1px;left:-10000px;border:0';
  frame.onload = async () => {
    const doc=frame.contentDocument;
    if(doc.fonts?.ready)await doc.fonts.ready;
    fitServiceFormPage(doc);
    frame.contentWindow.addEventListener('beforeprint',()=>fitServiceFormPage(doc));
    frame.contentWindow.addEventListener('afterprint', () => frame.remove(), {once:true});
    frame.contentWindow.focus(); frame.contentWindow.print();
  };
  frame.srcdoc = serviceFormDocument(entry, form);
  document.body.append(frame);
}

const serviceSigners=[['venueManager','Venue Manager','f-service-manager'],['cashier','Cashier','f-service-cashier'],['pagcorRepresentative','PAGCOR Representative','f-service-pagcor']];
function validServiceSignature(image){return typeof image==='string'&&image.length<150000&&/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(image);}
function readServiceSignatures(){
  try{const value=JSON.parse(document.getElementById('f-service-signatures').value||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}
}
function refreshSignaturePreviews(){
  const signatures=readServiceSignatures();
  serviceSigners.forEach(([key,label])=>{
    const image=document.getElementById('signature-preview-'+key),signed=validServiceSignature(signatures[key]?.image);
    image.hidden=!signed;if(signed)image.src=signatures[key].image;else image.removeAttribute('src');
    document.getElementById('sign-'+key).textContent=signed?'Review / sign again':'Tap to sign';
    document.getElementById('signature-status-'+key).textContent=signed?'Signature saved':'Signature required';
  });
}
(function setupServiceSignatures(){
  const fields=document.getElementById('service-form-fields');
  const storage=document.createElement('textarea');storage.id='f-service-signatures';storage.hidden=true;storage.value='{}';fields.append(storage);
  const css=document.createElement('style');css.textContent=`
    .service-signature-preview{display:block;width:100%;max-width:320px;height:90px;object-fit:contain;background:white;border:1px solid var(--line);border-radius:8px;margin:8px 0}
    .service-signature-preview[hidden]{display:none}
    #service-sign-dialog{width:min(680px,calc(100% - 24px));max-height:calc(100dvh - 24px);overflow:auto;padding:20px;border:1px solid var(--line);border-radius:14px;background:var(--card,#fff);color:var(--ink,#111)}
    #service-sign-dialog::backdrop{background:#0009}
    #service-sign-dialog button,#service-form-fields button{min-height:44px}
    #service-sign-canvas{display:block;width:100%;height:clamp(160px,35vh,280px);background:white;border:1px solid #9ba4b2;border-radius:8px;touch-action:none;cursor:crosshair}
    .service-sign-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
  `;document.head.append(css);
  const dialog=document.createElement('dialog');dialog.id='service-sign-dialog';dialog.setAttribute('aria-labelledby','service-sign-title');
  dialog.innerHTML='<h2 id="service-sign-title"></h2><p id="service-sign-name"></p><p>Draw your signature with your finger, mouse or pen.</p><canvas id="service-sign-canvas" width="1000" height="360" aria-label="Draw signature here"></canvas><p id="service-sign-message" role="status" aria-live="polite"></p><div class="service-sign-actions"><button type="button" class="btn-secondary" id="service-sign-clear">Clear</button><button type="button" class="btn-secondary" id="service-sign-cancel">Cancel</button><button type="button" class="btn-secondary" id="service-sign-save">Save signature</button></div>';
  document.body.append(dialog);
  const canvas=document.getElementById('service-sign-canvas'),context=canvas.getContext('2d'),message=document.getElementById('service-sign-message');
  let active=null,pointer=null,ink=false,loading=false,saving=false,returnFocus=null,loadVersion=0;
  function clear(){context.clearRect(0,0,canvas.width,canvas.height);ink=false;pointer=null;message.textContent='';}
  function close(){if(saving)return;loadVersion++;dialog.close();returnFocus?.focus();if(active?.key==='fse'&&!savedFseSignature())requestFseSignature();}
  const setup=document.createElement('dialog');setup.id='fse-signature-setup';setup.setAttribute('aria-labelledby','fse-signature-title');
  setup.style.cssText='width:min(460px,calc(100% - 32px));padding:24px;border:1px solid var(--line);border-radius:14px;background:var(--card,#fff);color:var(--ink,#111)';
  setup.innerHTML='<h2 id="fse-signature-title">Set up your account signature</h2><p>Your signature is required for your service form. Save it once to automatically sign the Checked by section on future service forms.</p><p class="muted">Saved privately in Drive for your account, including management. Available when you sign in on another device.</p><p id="account-signature-status" role="status" aria-live="polite"></p><button type="button" class="btn-secondary" id="fse-signature-start" style="min-height:44px">Add my signature</button>';
  document.body.append(setup);
  setup.addEventListener('cancel',event=>event.preventDefault());
  requestFseSignature=()=>{
    if(!fseSignatureKey())return;
    const start=document.getElementById('fse-signature-start');
    start.disabled=accountSignatureState.loading;
    start.textContent=accountSignatureState.error?'Retry loading signature':'Add my signature';
    document.getElementById('account-signature-status').textContent=accountSignatureState.loading?'Checking Drive for your saved signature…':accountSignatureState.error;
    if(savedFseSignature()){if(setup.open)setup.close();return;}
    if(!setup.open&&!dialog.open)setup.showModal();
  };
  document.getElementById('fse-signature-start').onclick=()=>{
    if(accountSignatureState.loading)return;
    if(accountSignatureState.error){loadAccountSignature();requestFseSignature();return;}
    setup.close();returnFocus=null;active={key:'fse',name:serviceFormAccount(),accountKey:fseSignatureKey()};loadVersion++;loading=false;clear();
    document.getElementById('service-sign-title').textContent='Your account signature';document.getElementById('service-sign-name').textContent=active.name;
    dialog.showModal();document.getElementById('service-sign-clear').focus();
  };
  serviceSigners.forEach(([key,label,inputId])=>{
    const input=document.getElementById(inputId),group=document.createElement('div');
    const preview=document.createElement('img');preview.id='signature-preview-'+key;preview.alt=label+' signature';preview.className='service-signature-preview';preview.hidden=true;
    const button=document.createElement('button');button.type='button';button.id='sign-'+key;button.className='btn-secondary';
    const status=document.createElement('small');status.id='signature-status-'+key;status.setAttribute('role','status');status.style.cssText='display:block;margin:6px 0 14px';
    group.append(preview,button,status);input.after(group);
    input.addEventListener('input',()=>{const signatures=readServiceSignatures();delete signatures[key];storage.value=JSON.stringify(signatures);refreshSignaturePreviews();});
    button.addEventListener('click',()=>{
      if(!input.value.trim()){input.focus();input.required=true;input.reportValidity();return;}
      returnFocus=button;active={key,inputId,name:input.value.trim()};clear();loading=false;
      document.getElementById('service-sign-title').textContent=label+' signature';document.getElementById('service-sign-name').textContent=active.name;
      dialog.showModal();document.getElementById('service-sign-clear').focus();
      const saved=readServiceSignatures()[key]?.image,version=++loadVersion;
      if(validServiceSignature(saved)){loading=true;const image=new Image();image.onload=()=>{if(version!==loadVersion)return;context.drawImage(image,0,0,1000,360);ink=true;loading=false;};image.onerror=()=>{if(version===loadVersion)loading=false;};image.src=saved;}
    });
  });
  const point=event=>{const rect=canvas.getBoundingClientRect();return {x:(event.clientX-rect.left)*canvas.width/rect.width,y:(event.clientY-rect.top)*canvas.height/rect.height};};
  canvas.addEventListener('pointerdown',event=>{
    if(loading||pointer!==null||(event.pointerType==='mouse'&&event.button!==0))return;
    event.preventDefault();pointer=event.pointerId;canvas.setPointerCapture(pointer);const p=point(event);
    context.lineWidth=3;context.lineCap='round';context.lineJoin='round';context.strokeStyle='#111';context.fillStyle='#111';
    context.beginPath();context.arc(p.x,p.y,1.5,0,Math.PI*2);context.fill();context.beginPath();context.moveTo(p.x,p.y);ink=true;message.textContent='';
  });
  canvas.addEventListener('pointermove',event=>{if(event.pointerId!==pointer)return;event.preventDefault();const p=point(event);context.lineTo(p.x,p.y);context.stroke();});
  const stop=event=>{if(event.pointerId===pointer){pointer=null;context.beginPath();}};
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>canvas.addEventListener(type,stop));
  document.getElementById('service-sign-clear').onclick=()=>{loadVersion++;loading=false;clear();};
  document.getElementById('service-sign-cancel').onclick=close;
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  document.getElementById('service-sign-save').onclick=async()=>{
    if(saving)return;
    if(loading)return;
    if(!ink){message.textContent='Draw your signature before saving.';return;}
    const image=canvas.toDataURL('image/png');
    if(!validServiceSignature(image)){message.textContent='Signature is too large. Clear and sign again.';return;}
    if(active.key==='fse'){
      if(active.accountKey!==fseSignatureKey()){message.textContent='Your account changed. Please sign in again.';return;}
      const key=active.accountKey;saving=true;message.textContent='Saving your signature to Drive…';
      const saveButton=document.getElementById('service-sign-save');saveButton.disabled=true;
      try{
        const result=await apiPost('saveAccountSignature',{signature:{image}});
        if(fseSignatureKey()!==key)throw Error('Your account changed. Sign in again.');
        if(!validServiceSignature(result.signature?.image))throw Error('Drive did not confirm your saved signature.');
        accountSignatureState={key,signature:result.signature,loading:false,error:''};
        saving=false;close();showToast('Signature saved to Drive','Your signature will automatically appear on your service forms.');
      }catch(error){message.textContent=error.message||'Could not save to Drive. Please try again.';}
      finally{saving=false;saveButton.disabled=false;}
      return;
    }
    const signatures=readServiceSignatures();signatures[active.key]={image,name:active.name,signedAt:new Date().toISOString()};
    storage.value=JSON.stringify(signatures);refreshSignaturePreviews();storage.dispatchEvent(new Event('input',{bubbles:true}));close();
  };
  document.getElementById('visit-draft-controls')?.addEventListener('click',()=>queueMicrotask(refreshSignaturePreviews));
  refreshSignaturePreviews();
})();

document.getElementById('f-service-needed').addEventListener('change', updateServiceForm);
document.querySelector('.smart-visit-form').addEventListener('input', updateServiceForm);
document.querySelector('.smart-visit-form').addEventListener('change', updateServiceForm);
document.querySelector('#cat-picker').addEventListener('click', updateServiceForm);
document.getElementById('fieldlogs-new-btn').addEventListener('click', () => {restoreServiceForm(null);restoreOtherClient();});
document.getElementById('cancel-visit-edit').addEventListener('click', () => {restoreServiceForm(null);restoreOtherClient();});
document.getElementById('visit-draft-controls')?.addEventListener('click', () => queueMicrotask(updateServiceForm));
// Duplicated visits require their own signatories and site times.
const duplicateWithoutServiceForm = duplicateEntry;
duplicateEntry = function(id) { duplicateWithoutServiceForm(id); restoreOtherClient(entries.find(row=>String(row.id)===String(id)));restoreServiceForm(null); };
const editWithOtherClient=editFieldLog;
editFieldLog=function(id){editWithOtherClient(id);restoreOtherClient(entries.find(row=>String(row.id)===String(id)));updateServiceForm();};
updateServiceForm();
const showAppWithSignature=showApp;
showApp=function(user){const result=showAppWithSignature(user);loadAccountSignature();return result;};
if(currentUser)loadAccountSignature();
