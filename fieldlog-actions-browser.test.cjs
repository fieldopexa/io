const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const server=http.createServer((req,res)=>{
 const name=new URL(req.url,'http://localhost').pathname;
 const file=path.join(__dirname,name==='/'?'index.html':name.slice(1));
 if(!file.startsWith(__dirname+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));
});
let browser;
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({channel:'msedge',headless:true});
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:960},serviceWorkers:'block'});
  await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);await page.addScriptTag({content:fs.readFileSync('preview-fixtures.js','utf8')});
  await page.evaluate(()=>{window.testWrites=[];apiPost=async(action,payload)=>{testWrites.push({action,payload});return {status:'ok',serviceFormSaved:true};};document.querySelector('.tab[data-tab="fieldlogs"]').click();});
  const first=page.locator('.readable-log[data-entry-id="qa-1"]');
  await first.locator('summary').click();await first.getByRole('button',{name:'Edit visit',exact:true}).click();
  assert.deepEqual(errors,[]);
  assert.equal(await page.evaluate(()=>editingEntryId),'qa-1');
  assert.equal(await page.locator('#panel-log').isVisible(),true);
  assert.equal(await page.locator('#f-tech').inputValue(),'Alex Santos');
  // Exercise the real save handler with sample data; form-signature validation is separate.
  await page.evaluate(()=>{validateServiceForm=()=>true;document.getElementById('submit-btn').click();});
  await page.waitForFunction(()=>testWrites.some(x=>x.action==='updateEntry'));
  assert.equal(await page.evaluate(()=>testWrites.find(x=>x.action==='updateEntry').payload.entry.tech),'Alex Santos');
  await page.evaluate(()=>document.querySelector('.tab[data-tab="fieldlogs"]').click());
  await first.locator('summary').click();page.once('dialog',d=>d.accept());
  await first.getByRole('button',{name:'Void visit',exact:true}).click();
  await page.waitForFunction(()=>testWrites.some(x=>x.action==='archiveEntry'));
  assert.equal(await page.evaluate(()=>entries.find(x=>x.id==='qa-1').status),'Voided');
  assert.deepEqual(errors,[]);
  console.log('PASS '+width+'px: management menu, edit form, save and void request');await context.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
