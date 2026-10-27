const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const closed=new Set(['tregs bypass']);
const context={
 siteIsClosed:name=>closed.has(String(name||'').trim().toLowerCase()),
 canonicalSiteName:value=>String(value||'').trim(),normalizeSiteKey:value=>String(value||'').trim().toLowerCase(),
 cabinetRows:[],inventoryRows:[],
 cabinetCanonicalSiteMap:()=>({}),canonicalCabinetSite:row=>row.site,
 registeredCabinetRows:()=>context.cabinetRows.filter(row=>!context.siteIsClosed(row.site))
};
vm.createContext(context);
vm.runInContext(html.match(/^function siteIsWarehouse\(name\).*$/m)[0],context);
vm.runInContext(html.slice(html.indexOf('function isWarehouseMovementLocation('),html.indexOf('function allocationPrefixForSite(')),context);
vm.runInContext(html.slice(html.indexOf('function cabinetIsWarehouseStock('),html.indexOf('function maskToken(')),context);
const cabinet={id:'cabinet-1',cabinetId:'TREGS001',site:'Tregs Bypass',status:'Operational'};
context.cabinetRows=[cabinet];
assert.equal(context.cabinetSummary().ready,0,'closing a source site alone does not create warehouse stock');
assert.equal(context.cabinetDisplayStatus(cabinet),'Closed site — transfer pending');
cabinet.site='Carmona Cavite Warehouse';cabinet.cabinetId='STOCK001';cabinet.status='Warehouse / Stock';
context.inventoryRows=[{site:cabinet.site,operationalStatus:'Non-Operational'}];
assert.equal(context.cabinetSummary().ready,1,'transferred warehouse cabinet counts despite inventory operational status');
assert.equal(context.cabinetSummary().nonop,0);
assert.equal(context.cabinetDisplayStatus(cabinet),'Warehouse / Stock');
for(const warehouse of ['Warehouse','Warehouse / Stock','Stock','Carmona Cavite Warehouse','Endlessmotion Warehouse']){
 cabinet.site=warehouse;cabinet.status='For Repair';
 assert.equal(context.cabinetSummary().ready,1,'warehouse location counts as stock: '+warehouse);
 assert.equal(cabinet.status,'For Repair','physical cabinet condition remains untouched');
}
cabinet.site='Active Site';cabinet.status='Operational';
assert.equal(context.cabinetSummary().ready,0,'deployment out of warehouse removes cabinet from stock');
assert.equal(context.cabinetSummary().operational,1);
cabinet.site='Tregs Bypass';cabinet.status='Ready to Deploy';
assert.equal(context.cabinetSummary().ready,0,'old ready status at a closed source site does not count as transferred');
console.log('PASS: closed site → transfer pending → warehouse stock → deployment; inventory overrides and physical condition retention');
