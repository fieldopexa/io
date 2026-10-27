const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
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
  fs.mkdirSync('docs/usability-screens',{recursive:true});
  for(const width of [390,820,1440]){
    const context=await browser.newContext({viewport:{width,height:960},serviceWorkers:'block'});
    await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin,{waitUntil:'load'});
    await page.addScriptTag({content:fs.readFileSync('preview-fixtures.js','utf8')});
    await page.evaluate(()=>document.querySelector('.tab[data-tab="fieldlogs"]').click());
    await page.locator('#log-status-filter').selectOption('Pending');
    assert.equal(await page.locator('.readable-log').count(),1);
    assert.match(await page.locator('.readable-log-site').textContent(),/North/);
    await page.locator('#global-search').fill('no matching site');
    assert.match(await page.locator('#log .empty').textContent(),/No visits match/);
    await page.locator('.log-filter-reset').click();
    assert.equal(await page.locator('#log-status-filter').inputValue(),'');
    assert.equal(await page.locator('.readable-log').count(),2);
    await page.locator('#log-status-filter').selectOption('Resolved');
    await page.waitForTimeout(350);
    await page.screenshot({path:`docs/usability-screens/logs-${width}.png`,fullPage:width>900});
    await page.evaluate(()=>document.querySelector('.tab[data-tab="log"]').click());
    if(width<=900){
      await page.locator('#visit-step-next').click();
      assert.equal(await page.evaluate(()=>document.activeElement.id),'location-combobox');
      assert.equal(await page.locator('#location-combobox').getAttribute('aria-invalid'),'true');
    }
    await page.evaluate(()=>{
      const site=document.getElementById('f-site');site.value='North Test Site';site.dispatchEvent(new Event('change',{bubbles:true}));
      document.getElementById('f-notes').value='Preserve these notes after a failed save';
      document.getElementById('f-ticket').value='RETRY-TEST';
      window.confirm=()=>true;
      apiPost=()=>new Promise((resolve,reject)=>{window.qaResolve=resolve;window.qaReject=reject;});
      window.setVisitWizardStep?.(4,false);
      document.getElementById('submit-btn').click();
    });
    await page.waitForFunction(()=>typeof window.qaReject==='function');
    assert.equal(await page.locator('#mobile-save-fab').isDisabled(),true);
    assert.match(await page.locator('#visit-save-status').textContent(),/Saving visit/);
    await page.evaluate(()=>window.qaReject(new Error('Test connection failure')));
    await page.waitForFunction(()=>!document.getElementById('submit-btn').disabled);
    assert.equal(await page.locator('#f-notes').inputValue(),'Preserve these notes after a failed save');
    assert.equal(await page.locator('#f-ticket').inputValue(),'RETRY-TEST');
    assert.equal(await page.evaluate(()=>entries.length),2,'failed optimistic write rolls back');
    assert.match(await page.locator('#visit-save-status').textContent(),/Save not confirmed/);
    assert.equal(await page.locator('#mobile-save-fab').isDisabled(),false);
    await page.waitForTimeout(350);
    assert.equal(await page.locator('.smart-visit-form').isVisible(),true);
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:`docs/usability-screens/save-failure-${width}.png`,fullPage:width>900});
    await page.evaluate(()=>{window.qaResolve=null;document.getElementById('submit-btn').click();});
    await page.waitForFunction(()=>typeof window.qaResolve==='function');
    await page.evaluate(()=>window.qaResolve({success:true}));
    await page.waitForFunction(()=>!document.getElementById('submit-btn').disabled);
    assert.match(await page.locator('#visit-save-status').textContent(),/Saved to the shared sheet/);
    assert.equal(await page.locator('#f-notes').inputValue(),'');
    assert.equal(await page.evaluate(()=>entries.length),3,'confirmed write remains in Field Logs');
    assert.deepEqual(errors,[],'no runtime errors');
    console.log('PASS '+width+'px: status/search/reset, client validation, actual submit failure/rollback/retry/success and mobile busy feedback');
    await context.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
