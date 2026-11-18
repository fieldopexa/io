const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');

const html=fs.readFileSync('index.html','utf8');
const sw=fs.readFileSync('sw.js','utf8');
function extract(name){
  const start=html.indexOf('function '+name+'(');
  assert.ok(start>=0,name+' exists');
  const end=html.indexOf(String.fromCharCode(10)+'}',start);
  assert.ok(end>start,name+' is complete');
  return html.slice(start,end+2);
}
const sandbox={};
vm.runInNewContext([
  extract('formatVisitAttachmentUploadTime'),
  extract('visitPhotoUploadStamp'),
  'this.formatTime=formatVisitAttachmentUploadTime;this.photoStamp=visitPhotoUploadStamp;'
].join(String.fromCharCode(10)),sandbox);
const {formatTime,photoStamp}=sandbox;

test('timestamps display Philippine Time including seconds and next-day rollover',()=>{
  assert.match(formatTime('2026-11-18T09:28:34.000Z'),/Nov 18, 2026.*5:28:34 PM PHT/);
  assert.match(formatTime('2026-11-18T19:28:34.000Z'),/Nov 19, 2026.*3:28:34 AM PHT/);
});

test('only photos get an overlay and missing historical data is not fabricated',()=>{
  const time='2026-11-18T09:28:34.000Z';
  for(const type of ['image/jpeg','image/png','image/webp']){
    assert.match(photoStamp({mimeType:type,uploadedAt:time}),/^Uploaded: Nov 18, 2026.*PHT$/);
  }
  assert.equal(photoStamp({mimeType:'application/pdf',uploadedAt:time}),'');
  assert.equal(photoStamp({mimeType:'image/jpeg',uploadedAt:null}),'Upload time unavailable');
  assert.equal(formatTime('not-a-date'),'');
});

test('timestamp appears on both the thumbnail and preview without editing photo contents',()=>{
  assert.ok(html.includes('data-thumbnail-for='));
  assert.ok(html.includes('data-upload-stamp='));
  assert.ok(html.includes('escapeHtml(visitPhotoUploadStamp(item))'));
  assert.ok(html.includes("modal.querySelector('#attachment-preview-body').dataset.uploadStamp=photoStamp"));
  assert.ok(html.includes("modal.querySelector('#attachment-preview-body').removeAttribute('data-upload-stamp')"));
  assert.ok(html.includes('.vd-attachment-thumb[data-upload-stamp]:not([data-upload-stamp=""])::after'));
  assert.ok(html.includes('.attachment-preview-body[data-upload-stamp]:not([data-upload-stamp=""])::after'));
  assert.ok(sw.includes('20261118-photo-upload-timestamps'));
});
