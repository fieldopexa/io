const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const context={currentUser:null,entryParticipants:entry=>[entry.tech,...String(entry.supportingFses||'').split(',')].filter(Boolean)};
vm.createContext(context);
vm.runInContext(html.slice(html.indexOf('function scopeVisitEntries('),html.indexOf('function parseVisitAudit(')),context);
vm.runInContext(fs.readFileSync('api.gs','utf8'),context);
const rows=[{id:'ian',tech:'Ian'},{id:'kenneth',tech:'Kenneth'},{id:'team',tech:'Erwin',supportingFses:'Popoy, Ian'}];
for(const user of [{role:'fse',fse:'Ian'},{role:'fse',fse:'Kenneth'},{role:'fse',fse:'Erwin'},{role:'fse',fse:'Popoy'}]){
 const expected=rows.filter(row=>context.fseOwnsVisit_(user,row)).map(row=>row.id);
 assert.deepEqual(Array.from(context.scopeVisitEntries(rows,user),row=>row.id),expected,'cached scope matches backend ownership');
}
assert.equal(context.scopeVisitEntries(rows,{role:'management'}).length,3);
assert.equal(context.scopeVisitEntries(rows,null).length,0);
assert.equal(context.scopeVisitEntries(rows,{role:'fse'}).length,0);
assert.ok(!html.includes('data-tab="report" data-role="management"'));
assert.ok(!html.includes('data-mobile-tab="report" data-mobile-role="management"'));
console.log('PASS: personal report access, supporting visits, management scope, cached privacy and shared report navigation');
