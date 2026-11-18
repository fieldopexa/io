const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');

const html=fs.readFileSync('index.html','utf8');
const sw=fs.readFileSync('sw.js','utf8');
function sourceFor(name){
  const start=html.indexOf('function '+name+'(');
  assert.ok(start>=0,name+' should exist');
  const end=html.indexOf('\n}',start);
  assert.ok(end>start,name+' should close');
  return html.slice(start,end+2);
}
const functions=['formatVisitAttachmentUploadTime','managementVisitPhotoStamp','renderVisitAttachmentsPanel'].map(sourceFor).join('\n');
const sample=[
  {id:'A1',fileName:'photo.jpg',mimeType:'image/jpeg',uploadedAt:'2026-11-18T09:28:34.000Z',uploadedBy:'FSE',sizeBytes:1024},
  {id:'A2',fileName:'report.pdf',mimeType:'application/pdf',uploadedAt:'2026-11-18T09:28:34.000Z',uploadedBy:'FSE',sizeBytes:1024},
  {id:'A3',fileName:'historical.png',mimeType:'image/png',uploadedAt:null,uploadedBy:'FSE',sizeBytes:1024}
];
function renderFor(role){
  return new Function([
    'const currentUser='+JSON.stringify({role})+';',
    'const list={innerHTML:""},count={textContent:""};',
    'const panel={dataset:{visitId:"V1"},querySelector(sel){return sel===".vd-attachment-list"?list:sel==="[data-attachment-count]"?count:null}};',
    'const document={getElementById:()=>panel},window={};',
    'const entries=[{id:"V1"}],STORAGE_KEY="fixture",storageSet=()=>{};',
    'const escapeHtml=x=>String(x??"").replace(/&/g,"&amp;").replace(/"/g,"&quot;");',
    'const escapeJs=x=>String(x),attachmentSizeLabel=x=>x+" B";',
    'const visitAttachmentThumbnailObserver=null;',
    'let attachmentThumbnailQueue=[];',
    functions,
    'renderVisitAttachmentsPanel("V1",'+JSON.stringify(sample)+');',
    'return {html:list.innerHTML,count:count.textContent};'
  ].join('\n'))();
}
test('management can view a photo upload time in Manila time',()=>{
  const markup=renderFor('management').html;
  assert.match(markup,/Uploaded: Nov 18, 2026, 5:28:34 PM PHT/);
  assert.match(markup,/data-upload-stamp="Uploaded:/);
  assert.match(markup,/class="vd-attachment-time"/);
});
test('FSE and unrecognized roles cannot see timestamp labels',()=>{
  for(const role of ['fse','viewer','']){
    const markup=renderFor(role).html;
    assert.doesNotMatch(markup,/Uploaded:| PHT|vd-attachment-time/);
    assert.doesNotMatch(markup,/data-upload-stamp="Uploaded:/);
  }
});
test('PDFs and photographs without recorded upload time do not have a badge',()=>{
  const markup=renderFor('management').html;
  assert.match(markup,/data-file-name="report.pdf" data-upload-stamp=""/);
  assert.match(markup,/data-file-name="historical.png" data-upload-stamp=""/);
});
test('preview checks role and clears any stale overlay',()=>{
  assert.match(html,/if\(currentUser\?\.role==='management'&&row\?\.dataset\.uploadStamp\)/);
  assert.match(html,/removeAttribute\('data-upload-stamp'\)/);
  assert.match(sw,/20261119-management-photo-upload-timestamps/);
});
