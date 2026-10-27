const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname,file=path.join(__dirname,name==='/'?'index.html':name.slice(1));if(!file.startsWith(__dirname+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));});
let browser;
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({channel:'msedge',headless:true});fs.mkdirSync('docs/bulk-warehouse-screens',{recursive:true});
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:960},serviceWorkers:'block'});await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);await page.addScriptTag({content:fs.readFileSync('preview-fixtures.js','utf8')});await page.waitForTimeout(350);
  await page.evaluate(()=>{
   window.qaSource='Big A Gaming Corp. Quezon City';
   window.__lifecycleSites=[{name:qaSource,status:'Closed'},{name:'Carmona Cavite Warehouse',status:'Active'},{name:'Other Site',status:'Active'}];
   window.qaReset=()=>{window.qaRows=Array.from({length:3},(_,i)=>({id:'bulk-'+(i+1),cabinetId:'BRRQC00'+(i+1),permanentNumber:i+1,site:qaSource,status:'Non-Operational'}));qaRows.push({id:'stock-4',cabinetId:'STOCK004',permanentNumber:4,site:'Carmona Cavite Warehouse',status:'Warehouse / Stock'});window.qaMoves=[];window.qaCalls=[];window.qaMode='ok';cabinetRows=structuredClone(qaRows);inventoryRows=[];};qaReset();
   apiGet=async type=>structuredClone(type==='cabinets'?qaRows:type==='movements'?qaMoves:[]);
   apiPost=async(action,payload)=>{
    if(action!=='saveMovement')throw Error('Unexpected write: '+action);
    const record=payload.record;qaCalls.push(structuredClone(record));
    if(qaMode==='fail-second'&&qaCalls.length===2)throw Error('Simulated connection failure');
    const row=qaRows.find(row=>row.id===record.cabinetRowId),id='MOV-'+qaCalls.length;
    qaMoves.push({...record,id,cabinetId:row.cabinetId});
    if(qaMode==='ledger-only')throw Error('Cabinet update not confirmed');
    row.site=record.toLocation;row.status=record.statusAfter;row.cabinetId='STOCK'+String(row.permanentNumber).padStart(3,'0');
    if(qaMode==='lost-response')throw Error('Response lost after successful save');
    return {id,site:row.site,cabinetId:row.cabinetId,cabinetStatus:row.status};
   };
   window.refreshAssetsFast=async()=>{cabinetRows=structuredClone(qaRows);renderCabinets();};
  });
  async function open(){await page.evaluate(()=>{openSiteProfile(qaSource);document.querySelector('#site-drawer-content [data-bulk-warehouse]').click();});await page.waitForFunction(()=>document.getElementById('bulk-warehouse-dialog').getAttribute('aria-busy')==='false');}
  async function review(){await page.locator('#bulk-warehouse-review').click();}
  async function confirm(){await page.locator('#bulk-warehouse-confirm').click();await page.waitForFunction(()=>document.getElementById('bulk-warehouse-dialog').getAttribute('aria-busy')==='false');}
  await open();assert.equal(await page.locator('#bulk-warehouse-list input:checked').count(),3);
  await page.locator('#bulk-warehouse-list input').last().uncheck();await review();
  assert.match(await page.locator('#bulk-warehouse-confirm').textContent(),/2 cabinets/);
  await page.screenshot({path:`docs/bulk-warehouse-screens/review-${width}.png`,fullPage:false});
  await confirm();assert.match(await page.locator('#bulk-warehouse-status').textContent(),/2 moved/);
  assert.equal(await page.evaluate(()=>qaCalls.length),2);assert.equal(await page.evaluate(()=>new Set(qaCalls.map(r=>r.referenceNo)).size),2);
  assert.equal(await page.evaluate(()=>cabinetSummary().ready),3);assert.equal(await page.evaluate(()=>qaRows.find(r=>r.id==='bulk-3').site),await page.evaluate(()=>qaSource));
  await page.locator('#bulk-warehouse-close').click();

  await page.evaluate(()=>{qaReset();qaMode='fail-second';});await open();await review();await confirm();
  assert.equal(await page.evaluate(()=>qaCalls.length),2,'stop after uncertain write; third cabinet not attempted');
  assert.match(await page.locator('#bulk-warehouse-status').textContent(),/1 moved.*1 not attempted/);
  assert.match(await page.locator('#bulk-warehouse-status').textContent(),/No automatic retry/);
  assert.equal(await page.locator('#bulk-warehouse-confirm').isVisible(),false);
  await page.locator('#bulk-warehouse-close').click();

  await page.evaluate(()=>{qaReset();qaMode='lost-response';});await open();await review();await confirm();
  assert.equal(await page.evaluate(()=>qaCalls.length),3,'reconcile lost responses without duplicate saves');
  assert.match(await page.locator('#bulk-warehouse-status').textContent(),/3 moved/);
  await page.locator('#bulk-warehouse-close').click();

  await page.evaluate(()=>{qaReset();qaMode='ledger-only';});await open();await review();await confirm();
  assert.match(await page.locator('#bulk-warehouse-status').textContent(),/0 moved/);
  assert.equal(await page.evaluate(()=>qaCalls.length),1,'history row alone does not confirm a cabinet transfer');
  await page.locator('#bulk-warehouse-close').click();

  await page.evaluate(()=>qaReset());await open();await review();
  await page.evaluate(()=>{qaRows[2].site='Other Site';qaRows[2].cabinetId='OTHER003';});await confirm();
  assert.match(await page.locator('#bulk-warehouse-status').textContent(),/2 moved, 1 skipped/);
  await page.locator('#bulk-warehouse-close').click();
  await page.evaluate(()=>{closeSiteProfile();currentUser={role:'fse',username:'alex.fse',fse:'Alex Santos'};applyRoleUI();openSiteProfile(qaSource);});
  assert.equal(await page.locator('#site-drawer-content [data-bulk-warehouse]').count(),0);
  assert.equal(await page.locator('#bulk-warehouse-open').isVisible(),false);assert.deepEqual(errors,[]);
  console.log('PASS '+width+'px: selection/review, separate movements, stock totals, partial failure, response reconciliation, source changes and FSE restrictions');await context.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
