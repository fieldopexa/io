const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
(async()=>{
const profiles=new Map();

const nodes = new Map();
const drawing = {clearRect(){},beginPath(){},arc(){},fill(){},moveTo(){},lineTo(){},stroke(){},drawImage(){}};
class Element {
  constructor(id=''){this.id=id;this.value='';this.listeners={};this.style={};this.hidden=false;}
  append(...children){for(const child of children)if(child.id)nodes.set(child.id,child);}
  after(){}
  setAttribute(){}
  removeAttribute(){}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
  dispatchEvent(event){for(const fn of this.listeners[event.type]||[])fn(event);}
  focus(){}
  checkValidity(){return !this.required||!!this.value.trim();}
  reportValidity(){return this.checkValidity();}
  showModal(){this.open=true;}
  close(){this.open=false;}
  getContext(){return drawing;}
  getBoundingClientRect(){return {left:0,top:0,width:500,height:180};}
  setPointerCapture(){}
  toDataURL(){return 'data:image/png;base64,aGVsbG8=';}
  set innerHTML(html){for(const [,id] of html.matchAll(/id="([^"]+)"/g))nodes.set(id,new Element(id));}
}
function get(id){if(!nodes.has(id))nodes.set(id,new Element(id));return nodes.get(id);}
const inputIds=['f-service-in','f-service-out','f-service-manager','f-service-cashier','f-service-pagcor'];
const context={
  document:{baseURI:'https://example.com/io/',head:new Element(),body:new Element(),getElementById:get,
    createElement:()=>new Element(),querySelector:selector=>get(selector),
    querySelectorAll:()=>inputIds.map(get)},
  currentUser:{fse:'Engineer'},todayStr:()=> '2026-10-20',canonicalSiteName:value=>value,
  catLabel:{Hardware:'Hardware'},escapeHtml:value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),
  duplicateEntry(){},editFieldLog(){},showApp(user){context.currentUser=user;},entries:[],window:{},showToast(){},
  localStorage:{removeItem(){}},
  apiGet:async()=>({signature:profiles.get(context.currentUser.username)||null}),
  apiPost:async(action,payload)=>{assert.equal(action,'saveAccountSignature');const signature={...payload.signature,name:context.serviceFormAccount(),signedAt:new Date().toISOString()};profiles.set(context.currentUser.username,signature);return {signature};},
  URL,Event:class {constructor(type){this.type=type;}},Image:class {},queueMicrotask:fn=>fn()
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('service-form.js','utf8'),context);
get('service-sign-canvas').width=1000;get('service-sign-canvas').height=360;
get('f-service-needed').value='yes';get('f-site').value='Test Site';
inputIds.forEach(id=>get(id).value=id.includes('-in')?'09:00':id.includes('-out')?'10:00':'Test name');
assert.equal(context.validateServiceForm(),false,'unsigned form must not submit');
const fire=(id,type,extra={})=>get(id).dispatchEvent({type,preventDefault(){},...extra});
for(const key of ['venueManager','cashier','pagcorRepresentative']){
  fire('sign-'+key,'click');
  get('service-sign-save').onclick();
  assert.equal(context.readServiceSignatures()[key],undefined,'blank pad must not save');
  fire('service-sign-canvas','pointerdown',{pointerId:1,clientX:20,clientY:30,pointerType:'touch'});
  fire('service-sign-canvas','pointermove',{pointerId:1,clientX:80,clientY:50});
  fire('service-sign-canvas','pointerup',{pointerId:1});
  get('service-sign-save').onclick();
  assert.ok(context.readServiceSignatures()[key].signedAt);
}
assert.equal(context.validateServiceForm(),true,'three signatures permit submission');
const saved=JSON.parse(JSON.stringify(context.readServiceForm()));
assert.equal(context.serviceFormForEntry({serviceForm:JSON.stringify(saved)}).venueManager,saved.venueManager);
assert.equal(context.serviceFormForEntry({audit:JSON.stringify([{serviceForm:saved}])}).venueManager,saved.venueManager);
assert.equal(context.serviceFormForEntry({serviceForm:null,audit:[{serviceForm:saved}]}),null);
context.restoreServiceForm(null);
assert.equal(Object.keys(context.readServiceSignatures()).length,0,'new form clears signatures');
context.restoreServiceForm(saved);
assert.equal(context.validateServiceForm(),true,'editing restores saved signatures');
const html=context.serviceFormDocument({site:'Test Site',date:'2026-10-20',category:'Hardware',issueType:'Logic Unit',notes:'Notes',resolution:'Replaced unit'},saved);
assert.equal((html.match(/class="signature-image"/g)||[]).length,3,'print contains all three signatures');
saved.signatures.cashier.image='javascript:alert(1)';
assert.ok(!context.serviceFormDocument({},saved).includes('javascript:'),'invalid signature URLs cannot render');
fire('sign-cashier','click');get('service-sign-clear').onclick();get('service-sign-cancel').onclick();
assert.ok(context.readServiceSignatures().cashier,'cancel preserves saved signature');
fire('f-service-cashier','input');
assert.equal(context.readServiceSignatures().cashier,undefined,'name change clears signature');
assert.equal(context.validateServiceForm(),false);
get('f-service-needed').value='no';assert.equal(context.readServiceForm(),null);
context.showApp({role:'fse',username:'engineer1',fse:'Engineer One'});
await context.loadAccountSignature();
assert.equal(get('fse-signature-setup').open,true,'first FSE login requests signature');
get('fse-signature-start').onclick();
fire('service-sign-canvas','pointerdown',{pointerId:2,clientX:30,clientY:40,pointerType:'mouse',button:0});
fire('service-sign-canvas','pointerup',{pointerId:2});await get('service-sign-save').onclick();
assert.ok(context.savedFseSignature(),'FSE signature is saved');
get('f-service-needed').value='yes';
assert.ok(context.readServiceForm().signatures.checkedBy,'checked-by is automatically signed');
context.showApp({role:'fse',username:'engineer1',fse:'Engineer One'});
await context.loadAccountSignature();
assert.equal(get('fse-signature-setup').open,false,'saved FSE is not asked again');
context.showApp({role:'fse',username:'engineer2',fse:'Engineer Two'});
await context.loadAccountSignature();
assert.equal(context.savedFseSignature(),null,'different account cannot reuse signature');
assert.equal(get('fse-signature-setup').open,true,'different FSE sets up own signature');
get('fse-signature-setup').close();
context.showApp({role:'management',username:'ian',name:'Ian'});
await context.loadAccountSignature();
assert.equal(get('fse-signature-setup').open,true,'Ian management account gets signature setup');
context.apiGet=async()=>{throw Error('Drive unavailable');};
await context.loadAccountSignature();
assert.equal(get('fse-signature-start').textContent,'Retry loading signature','read failure offers retry rather than replacement');
for(const height of [500,800,5000,50000]){
  const page={clientWidth:1028,clientHeight:699},content={scrollWidth:1028,scrollHeight:height,style:{}};
  const scale=context.fitServiceFormPage({getElementById:id=>id==='service-print-page'?page:content});
  assert.ok(height*scale<=page.clientHeight-2,'all details and signatures fit vertically');
  assert.ok(content.scrollWidth*scale<=page.clientWidth-2,'content fits horizontally');
}
const longText='Detailed service notes\n'.repeat(5000);
const longForm=context.serviceFormDocument({notes:longText,resolution:longText},saved);
assert.ok(longForm.includes(longText),'long details are retained without truncation');
assert.ok(longForm.indexOf('class="signatures"')<longForm.indexOf('</main>'),'signature table is inside fitted page');
for(const [nickname,fullName] of [['Erwin','Erwin Santos'],['Popoy','Lennard Manabat'],['Ian','Ian Ronquillo']]){
  assert.equal(context.serviceFormFullName(nickname),fullName);
  const printed=context.serviceFormDocument({tech:nickname},{technician:nickname,checkedBy:nickname});
  assert.ok(printed.includes('<b>Technician:</b> '+fullName),'existing service forms print full technician name');
}
const wizardForm=get('#panel-log .smart-visit-form');
const panels=[1,2,3,4,5].map(step=>{
  const panel=new Element();panel.dataset={visitStep:String(step)};
  panel.classList={toggle(name,on){panel.active=on;},remove(){panel.active=false;}};
  panel.append=child=>{child.parentStep=step;};return panel;
});
wizardForm.querySelectorAll=()=>panels;
wizardForm.classList={toggle(){}};
context.window.matchMedia=()=>({matches:true,addEventListener(){}});
context.window.scrollTo=()=>{};context.window.scrollY=0;
context.isAutoGeneralActivity=()=>false;
const htmlSource=fs.readFileSync('index.html','utf8');
get('f-service-needed').value='yes';
vm.runInContext(htmlSource.match(/<script id="mobile-visit-wizard">([\s\S]*?)<\/script>/)[1],context);
context.window.setVisitWizardStep(4,false);
assert.equal(get('visit-step-count').textContent,'Step 4 of 5');
assert.equal(get('visit-save-actions').parentStep,5,'save moves after signatures');
fire('visit-step-next','click');
assert.equal(panels[4].active,true,'next opens signature page');
assert.equal(get('visit-step-short-title').textContent,'Names & signatures');
fire('visit-step-back','click');assert.equal(panels[3].active,true);
get('f-service-needed').value='no';fire('f-service-needed','change');
assert.equal(get('visit-step-count').textContent,'Step 4 of 4');
assert.equal(get('visit-save-actions').parentStep,4,'no service form saves at attachments');
console.log('PASS: touch signing, blank validation, save, cancel, edit, reset, name change, print and URL validation');
})().catch(error=>{console.error(error);process.exitCode=1;});
