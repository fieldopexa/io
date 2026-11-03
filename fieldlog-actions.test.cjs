const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const ui=vm.createContext({currentUser:null});
for(const [start,end] of [['function fieldLogIdentity(','function isMyFieldLogWork('],['function canEditFieldLog(','function fieldLogEditDenied(']]){
  vm.runInContext(html.slice(html.indexOf(start),html.indexOf(end)),ui);
}
const api=vm.createContext({console});
vm.runInContext(fs.readFileSync('api.gs','utf8'),api);
let user,record,writes,audits;
api.SpreadsheetApp={getActiveSpreadsheet:()=>({getSheetByName:()=>({})})};
api.requireSession_=()=>user;api.json_=x=>x;
for(const name of ['ensureEntriesServiceFormColumns_','ensureEntriesSupportingFsesColumn_','ensureEntriesAttachmentCountColumn_','prepareVisitServiceForm_'])api[name]=()=>{};
api.getRowObjectById_=()=>record;
api.updateRowById_=(_sheet,_id,patch)=>{writes++;record={...record,...patch};};
api.appendAudit_=()=>audits++;
for(const actor of [{role:'management',username:'ian'},{role:'fse',fse:'Alex Santos'},{role:'fse',fse:'Mika Reyes'},{role:'viewer' }]){
  for(const status of ['Pending','Voided']){
    ui.currentUser=user=actor;
    const allowed=status!=='Voided'&&(actor.role==='management'||actor.fse==='Alex Santos');
    assert.equal(ui.canEditFieldLog({tech:'Alex Santos',status}),allowed);
    for(const action of ['updateEntry','archiveEntry']){
      record={id:'visit-1',tech:'Alex Santos',status};writes=audits=0;
      const response=api.doPost({postData:{contents:JSON.stringify({action,token:'test',id:record.id,entry:{id:record.id,tech:'Forged owner',status:'Resolved'}})}});
      assert.equal(response.status,allowed?'ok':'error',JSON.stringify({actor,status,action,response}));
      assert.equal(writes,allowed?1:0);assert.equal(audits,allowed?1:0);
      if(allowed){assert.equal(record.tech,'Alex Santos');assert.equal(record.status,action==='archiveEntry'?'Voided':'Resolved');}
    }
  }
}
console.log('PASS: management and Primary FSE edit/void, other roles denied, voided records protected, ownership and audit retained');
