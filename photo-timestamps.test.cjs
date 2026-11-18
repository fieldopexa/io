const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
function extract(name, signature){
  const match=html.match(new RegExp('function '+name+'\\('+signature+'\\)\\{[\\s\\S]*?\\n\\}'));
  assert.ok(match, name+' exists');
  return match[0];
}
const sandbox={};
vm.runInNewContext(
  extract('formatVisitAttachmentUploadTime','value')+'\n'+
  extract('visitPhotoUploadStamp','item')+'\\n'+
  'this.formatTime=formatVisitAttachmentUploadTime;this.photoStamp=visitPhotoUploadStamp;',
  sandbox
);
const {formatTime,photoStamp}=sandbox;

test('photo upload timestamps use Philippine Time including seconds',()=>{
  assert.match(formatTime('2026-11-18T09:28:34.000Z'),/Nov 18, 2026.*5:28:34 PM PHT/);
  assert.match(formatTime('2026-11-18T19:28:34.000Z'),/Nov 19, 2026.*3:28:34 AM PHT/);
});

test('only photos receive an on-image upload-time badge',()=>{
  assert.match(photoStamp({mimeType:'image/jpeg',uploadedAt:'2026-11-18T09:28:34.000Z'}),/^Uploaded: Nov 18, 2026.*PHT$/);
  assert.match(photoStamp({mimeType:'image/png',uploadedAt:'2026-11-18T09:28:34.000Z'}),/^Uploaded: /);
  assert.match(photoStamp({mimeType:'image/webp',uploadedAt:'2026-11-18T09:28:34.000Z'}),/^Uploaded: /);
  assert.equal(photoStamp({mimeType:'application/pdf',uploadedAt:'2026-11-18T09:28:34.000Z'}),'');
  assert.equal(photoStamp({mimeType:'image/jpeg',uploadedAt:null}),'Upload time unavailable');
  assert.equal(formatTime('not-a-date'),'');
});

test('thumbnail and preview both display the server upload time and clear stale values',()=>{
  assert.match(html,/data-thumbnail-for="\\$\\{escapeHtml\\(item\\.id\\)\\}" data-upload-stamp="\\$\\{escapeHtml\\(visitPhotoUploadStamp\\(item\\)\\)\\}"/);
  assert.match(html,/modal\\.querySelector\\('#attachment-preview-body'\\)\\.dataset\\.uploadStamp=photoStamp/);
  assert.match(html,/modal\\.querySelector\\('#attachment-preview-body'\\)\\.removeAttribute\\('data-upload-stamp'\\)/);
  assert.match(html,/\\.vd-attachment-thumb\\[data-upload-stamp\\]:not\\(\\[data-upload-stamp=""\\]\\)::after/);
  assert.match(html,/\\.attachment-preview-body\\[data-upload-stamp\\]:not\\(\\[data-upload-stamp=""\\]\\)::after/);
  assert.match(sw,/20261118-photo-upload-timestamps/);
});
