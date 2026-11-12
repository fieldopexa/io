const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const service = fs.readFileSync('service-form.js', 'utf8');
const src = fs.readFileSync('api.gs', 'utf8');

// Browser: On-site work uses a client selector; miscellaneous duty requires
// only a free-text Client / site name field, with no duplicate dropdown.
for (const location of ['EM Office', 'On-Site Visit', 'Others']) {
  assert.match(html, new RegExp('<option value="' + location + '"'));
}
assert.match(html, /<option value="EM Office">EM Office \/ OPD<\/option>/);
assert.doesNotMatch(html, /<option value="OPD">/);
assert.match(html, /id="f-work-location"/);
assert.match(html, /id="f-visit-type"/);
const locationMarkup=html.slice(html.indexOf('<div class="row" id="visit-work-location-row">'),html.indexOf('<div class="row" id="visit-type-row">'));
const supportMarkup=html.slice(html.indexOf('<div class="row" id="visit-type-row">'),html.indexOf('<div class="row" id="visit-site-fields">'));
const additionalMarkup=html.slice(html.indexOf('<details class="visit-more-details" id="visit-additional-details"'),html.indexOf('<div class="visit-step-panel" data-visit-step="2">'));
assert.match(locationMarkup, /id="f-work-location"/);
assert.match(locationMarkup, /id="f-visit-type"/);
assert.doesNotMatch(locationMarkup, /id="f-resolved-via"/);
assert.match(supportMarkup, /id="f-resolved-via"/);
assert.match(supportMarkup, /id="f-supporting-options"/);
assert.doesNotMatch(supportMarkup, /id="f-visit-type"/);
assert.match(additionalMarkup, /id="f-ticket"/);
assert.doesNotMatch(additionalMarkup, /id="f-supporting-options"/);
assert.equal((html.match(/id="f-supporting-options"/g)||[]).length,1);
assert.match(html, /#panel-log #field-visit-support-mode\[hidden\]\{display:none!important\}/);
assert.match(html, /if\(supportField\)supportField\.hidden=location==='EM Office'/);
assert.match(html, /resolvedVia:visitWorkLocation\(\)==='EM Office'\?\(existing\?\.resolvedVia\|\|''\)/);
assert.match(html, /id="log-work-location-filter"/);
assert.match(html, /id="visit-site-client-selector"/);
assert.match(html, /id="visit-site-cabinet-fields"/);
assert.match(html, /const showOtherClient=otherDuty\|\|\(onsite/);
assert.match(html, /siteFields\.style\.display=\(onsite\|\|otherDuty\)/);
assert.match(html, /if\(clientSelector\)clientSelector\.hidden=!onsite/);
assert.match(html, /if\(cabinetFields\)cabinetFields\.hidden=!onsite/);
assert.match(html, /visitWorkLocation\(\)==='On-Site Visit'&&!document.getElementById\('f-site'\)/);
assert.match(html, /workLocation:visitWorkLocation\(\)/);
assert.doesNotMatch(html, /id="f-work-location-detail"/);
assert.doesNotMatch(html, /id="visit-work-location-detail-row"/);
assert.doesNotMatch(html, /validateWorkLocationDetail/);
assert.match(html, /workLocationDetail:String\(existing\?\.workLocationDetail\|\|''\)/);
assert.match(html, /renderWorkLocationSummary\('work-location-dashboard',period\)/);
assert.match(html, /renderWorkLocationSummary\('work-location-report',rows\)/);

// Support Type is hidden for office duty, visible for on-site and Others.
const supportNodes={
  'f-work-location':{value:'On-Site Visit'},
  'visit-site-fields':{style:{}},
  'visit-site-client-selector':{hidden:false},
  'visit-site-cabinet-fields':{hidden:false},
  'visit-cabinet-card':{style:{}},
  'field-visit-support-mode':{hidden:false},
  'visit-type-row':{classList:{classes:new Set(),toggle(name,state){if(state)this.classes.add(name);else this.classes.delete(name);}}},
  'other-client-field':{hidden:true,style:{}},
  'f-other-client':{required:false},
  'f-site':{value:''},
  'site-profile':{style:{}},
  'site-err':{style:{}},
  'location-combobox':{setAttribute(){}}
};
const workUI=vm.createContext({
  document:{getElementById:id=>supportNodes[id]},
  visitWorkLocation:()=>supportNodes['f-work-location'].value
});
vm.runInContext(html.slice(html.indexOf('function updateWorkLocationUI(){'),html.indexOf('function isSiteWorkLocation(entry){')),workUI);
supportNodes['f-work-location'].value='EM Office';
workUI.updateWorkLocationUI();
assert.equal(supportNodes['field-visit-support-mode'].hidden,true);
assert.equal(supportNodes['visit-type-row'].classList.classes.has('office-duty'),true);
supportNodes['f-work-location'].value='On-Site Visit';
workUI.updateWorkLocationUI();
assert.equal(supportNodes['field-visit-support-mode'].hidden,false);
assert.equal(supportNodes['visit-type-row'].classList.classes.has('office-duty'),false);
supportNodes['f-work-location'].value='Others';
workUI.updateWorkLocationUI();
assert.equal(supportNodes['field-visit-support-mode'].hidden,false);

// Office work needs no client. Others requires just a typed name, and
// On-Site Visit still allows both an existing client and custom location.
let dutyType='EM Office', focused=false;
const clientFields={
  'f-site':{value:''},
  'f-other-client':{value:'',required:false,focus(){focused=true;},reportValidity(){return false;}},
  'other-client-field':{hidden:true}
};
const clients=vm.createContext({
  document:{getElementById:id=>clientFields[id]},
  canonicalSiteName:v=>v,
  visitWorkLocation:()=>dutyType,
  updateWorkLocationUI:()=>{},
  window:{setVisitWizardStep:()=>{}}
});
vm.runInContext(service.slice(service.indexOf('function visitClientName()'),service.indexOf('function serviceFormForEntry(')), clients);
assert.equal(clients.visitClientName(),'EM Office');
assert.equal(clients.validateOtherClient(),true);
dutyType='Others';
assert.equal(clients.visitClientName(),'');
assert.equal(clients.validateOtherClient(),false);
assert.equal(focused,true);
clientFields['f-other-client'].value='Offsite Meeting';
assert.equal(clients.visitClientName(),'Offsite Meeting');
assert.equal(clients.validateOtherClient(),true);
clients.restoreOtherClient({site:'Supplier Workshop',workLocation:'Others'});
assert.equal(clientFields['f-other-client'].value,'Supplier Workshop');
dutyType='On-Site Visit';
clientFields['f-site'].value='ECP Lipa';
assert.equal(clients.visitClientName(),'ECP Lipa');
assert.equal(clients.validateOtherClient(),true);
clientFields['f-site'].value='Others';
clientFields['f-other-client'].value='';
assert.equal(clients.validateOtherClient(),false);
clients.restoreOtherClient({site:'New Site',siteSelection:'Others'});
assert.equal(clients.visitClientName(),'New Site');
assert.equal(clients.validateOtherClient(),true);
dutyType='EM Office';assert.equal(clients.validateOtherClient(),true);

// Historic OPD records are grouped with EM Office without changing stored Sheets rows.
const summaryNode={innerHTML:''};
const locations=vm.createContext({
  document:{getElementById:id=>id==='work-location-dashboard'?summaryNode:{value:'EM Office'}},
  escapeHtml:value=>value
});
vm.runInContext(html.slice(html.indexOf('const FSM_WORK_LOCATIONS='), html.indexOf('function normalizeEntry(e)')), locations);
vm.runInContext(html.slice(html.indexOf('function normalizeSiteKey('), html.indexOf('function canonicalSiteName(')), locations);
assert.equal(locations.workLocationForEntry({workLocation:'OPD'}),'EM Office');
assert.equal(locations.workLocationForEntry({workLocation:'EM Office'}),'EM Office');
assert.equal(locations.workLocationLabel('EM Office'),'EM Office / OPD');
assert.equal(locations.isSiteWorkLocation({workLocation:'OPD'}),false);
locations.renderWorkLocationSummary('work-location-dashboard',[
  {workLocation:'OPD',status:'Resolved'},
  {workLocation:'EM Office',status:'Resolved'}
]);
assert.match(summaryNode.innerHTML, /EM Office \/ OPD<\/span><b>2<\/b>/);

// Confirm all 15 approved sites are recognized without changing stored records.
assert.equal(vm.runInContext('SITE_DIRECTORY.length',locations),15);
for(const record of vm.runInContext('SITE_DIRECTORY.map(({name,code})=>({name,code}))',locations)){
  assert.equal(locations.workLocationForEntry({site:record.name}), 'On-Site Visit',record.name);
  assert.equal(locations.workLocationForEntry({site:record.code}), 'On-Site Visit',record.code);
}
for(const alias of ['ECP Angono','ECP Lipa','BigA QC','Venezia Bingo Botique SJDM*']){
  assert.equal(locations.workLocationForEntry({site:alias}),'On-Site Visit',alias);
}
assert.equal(locations.workLocationForEntry({site:'Big A Gaming Corp. Quezon City',workLocation:'Others'}),'Others');
assert.equal(locations.workLocationForEntry({site:'Big A Gaming Corp. Quezon City',workLocation:'EM Office'}),'EM Office');
assert.equal(locations.workLocationForEntry({site:'Unknown location'}),'Legacy / Unclassified');
assert.equal(locations.workLocationForEntry({site:'EM Office'}),'Legacy / Unclassified');
assert.equal(locations.isSiteWorkLocation({site:'Unknown location'}),false);
assert.equal(locations.isSiteWorkLocation({site:'ECP Lipa'}),true);
locations.renderWorkLocationSummary('work-location-dashboard',[
  {site:'ECP Angono',status:'Resolved'},
  {site:'Big A Gaming Corp. Quezon City',status:'Resolved'},
  {site:'ECP Lipa',workLocation:'Others',status:'Resolved'},
  {site:'Unrecognized',status:'Resolved'}
]);
assert.match(summaryNode.innerHTML, /On-Site Visit<\/span><b>2<\/b>/);
assert.match(summaryNode.innerHTML, /Others<\/span><b>1<\/b>/);
assert.match(summaryNode.innerHTML, /Legacy \/ Unclassified<\/span><b>1<\/b>/);

// Server: migration adds dedicated fields once without erasing historic data.
const api = vm.createContext({console});
vm.runInContext(src, api);
const headers = ['id', 'tech', 'site'];
const written = [];
let appended = [], currentUser = {role:'fse',username:'ian',fse:'Ian'};
const entriesSheet = {
  getLastColumn:() => headers.length,
  getRange:(_row,col) => ({
    getValues:() => [headers.slice()],
    setValue:value => {headers[col-1]=value;written.push(value);}
  }),
  appendRow:row=>appended.push(row)
};
const roster = ['Ian','Popoy','Erwin','Kenneth'];
const fseSheet = {getDataRange:() => ({getValues:()=>roster.map(name=>[name])})};
const spreadsheet = {getSheetByName:name=>name==='Entries'?entriesSheet:name==='FSEs'?fseSheet:null};
api.SpreadsheetApp = {getActiveSpreadsheet:() => spreadsheet};
api.ensureEntriesServiceFormColumns_=()=>{};
api.ensureEntriesSupportingFsesColumn_=()=>{};
api.ensureEntriesAttachmentCountColumn_=()=>{};
api.prepareVisitServiceForm_=()=>{};
api.sheetObjects_=()=>[];
api.visitEntryCell_=value=>value;
api.canonicalSiteNameV2_=value=>value;
api.appendAudit_=()=>{};
api.requireSession_=()=>currentUser;
api.json_=value=>value;
api.ensureEntriesWorkLocationColumns_();
assert.deepEqual(headers,['id','tech','site','workLocation','workLocationDetail']);
assert.deepEqual(written,['workLocation','workLocationDetail']);
api.ensureEntriesWorkLocationColumns_();
assert.equal(written.length,2,'migration is idempotent');
for(const location of ['EM Office','OPD','On-Site Visit','Others']) {
  appended=[];
  const result=api.doPost({postData:{contents:JSON.stringify({action:'addEntry',token:'test',entry:{
    id:'visit-'+location,site:location,tech:'Forged FSE',workLocation:location,
    workLocationDetail:'Sample work performed'
  }})}});
  assert.equal(result.status,'ok',JSON.stringify(result));
  assert.equal(appended[0][headers.indexOf('tech')],'Ian','Primary FSE must come from session');
  assert.equal(appended[0][headers.indexOf('workLocation')],location);
  assert.equal(appended[0][headers.indexOf('workLocationDetail')],'Sample work performed');
}
assert.equal(api.normalizeFsmWorkLocation_('invalid'),'On-Site Visit');
console.log('PASS: work-location categories, validation, persistence, idempotent schema migration, and FSE identity');
