const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const api = vm.createContext({console});
vm.runInContext(fs.readFileSync('api.gs', 'utf8'), api);
const roster = ['Ian', 'Popoy', 'Erwin', 'Kenneth'];
let user, addedRows, auditCalls;
const entriesSheet = {
  getLastColumn: () => 3,
  getRange: () => ({getValues: () => [['id', 'tech', 'site']]}),
  appendRow: row => addedRows.push(row)
};
const fseSheet = {getDataRange: () => ({getValues: () => roster.map(name => [name])})};
api.SpreadsheetApp = {getActiveSpreadsheet: () => ({getSheetByName: name => name === 'Entries' ? entriesSheet : name === 'FSEs' ? fseSheet : null})};
api.requireSession_ = () => user;
api.json_ = value => value;
api.sheetObjects_ = () => [];
api.visitEntryCell_ = value => value;
api.canonicalSiteNameV2_ = site => site;
api.appendAudit_ = () => auditCalls++;
for (const name of ['ensureEntriesServiceFormColumns_', 'ensureEntriesSupportingFsesColumn_', 'ensureEntriesAttachmentCountColumn_', 'prepareVisitServiceForm_']) api[name] = () => {};
function submit(actor, selectedFse) {
  user = actor; addedRows = []; auditCalls = 0;
  const entry = {id: 'v-1', tech: selectedFse, site: 'Test Site'};
  const response = api.doPost({postData: {contents: JSON.stringify({token: 'test', action: 'addEntry', entry})}});
  return {response, row: addedRows[0], auditCalls};
}
const mgmtIan = submit({role: 'management', username: 'ian'}, 'Ian');
assert.equal(mgmtIan.response.status, 'ok');
assert.equal(mgmtIan.row[1], 'Ian');
assert.equal(mgmtIan.auditCalls, 1);
const mgmtOther = submit({role: 'management', username: 'ian'}, '  popoy ');
assert.equal(mgmtOther.response.status, 'ok');
assert.equal(mgmtOther.row[1], 'Popoy');
const fse = submit({role: 'fse', username: 'erwin', fse: 'Erwin'}, 'Ian');
assert.equal(fse.response.status, 'ok');
assert.equal(fse.row[1], 'Erwin', 'An FSE cannot choose another Primary FSE');
for (const [actor, selectedFse] of [
  [{role: 'management', username: 'ian'}, 'Unknown'],
  [{role: 'management', username: 'ian'}, ''],
  [{role: 'viewer', username: 'viewer'}, 'Ian']
]) {
  const denied = submit(actor, selectedFse);
  assert.equal(denied.response.status, 'error', JSON.stringify({actor, selectedFse}));
  assert.equal(denied.row, undefined);
  assert.equal(denied.auditCalls, 0);
}
const html = fs.readFileSync('index.html', 'utf8');
assert.match(html, /newVisitButton\.hidden=!\['fse','management'\]\.includes\(currentUser\?\.role\)/);
assert.match(html, /isEdit\?!canEditFieldLog\(existing\):!\['fse','management'\]\.includes\(currentUser\?\.role\)/);
console.log('PASS: Management can log visits for listed FSEs; FSE ownership is enforced; viewer and unknown FSE are rejected');
