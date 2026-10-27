const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname,file=path.join(__dirname,name==='/'?'index.html':name.slice(1));if(!file.startsWith(__dirname+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));});
let browser;
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({channel:'msedge',headless:true});fs.mkdirSync('docs/movement-screens',{recursive:true});
 for(const width of [390,820,1440]){
  const context=await browser.newContext({viewport:{width,height:960},serviceWorkers:'block'});await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);await page.addScriptTag({content:fs.readFileSync('preview-fixtures.js','utf8')});await page.waitForTimeout(350);
  await page.evaluate(()=>{document.querySelector('.tab[data-tab="inventory"]').click();document.querySelector('[data-inventory-view="movements"]').click();});await page.waitForTimeout(350);
  assert.equal(await page.locator('#inventory-view-movements thead th').count(),5);
  assert.equal(await page.locator('#movement-body tr').count(),2);
  assert.equal(await page.locator('#movement-filter-options').isVisible(),false);
  await page.locator('.movement-filter-toggle').click();await page.locator('#movement-type-filter').selectOption('Transfer');
  assert.equal(await page.locator('#movement-body tr').count(),1);await page.locator('#movement-type-filter').press('Escape');
  assert.equal(await page.locator('#movement-filter-options').isVisible(),false);
  await page.getByRole('button',{name:'Remove movement type filter: Transfer',exact:true}).click();
  assert.equal(await page.locator('#movement-body tr').count(),2);
  await page.locator('#movement-search').fill('DEMO-REPAIR-02');assert.equal(await page.locator('#movement-body tr').count(),1);
  await page.locator('[data-movement-details]').click();assert.equal(await page.locator('#movement-details-dialog').isVisible(),true);
  for(const value of ['Mika Reyes','DEMO-REPAIR-02','power supply inspection','STOCK002','Non-Operational'])assert.match(await page.locator('#movement-details-dialog').textContent(),new RegExp(value));
  await page.keyboard.press('Escape');assert.equal(await page.locator('#movement-details-dialog').isVisible(),false);
  await page.locator('#movement-search').fill('');
  await page.locator('[data-mov-cab]').first().click();assert.equal(await page.locator('#cabinet-profile-overlay').isVisible(),true);await page.evaluate(()=>closeCabinetProfile());
  if(width<=700){await page.locator('.asset-mobile-overflow summary').click();await page.locator('.asset-mobile-overflow-list').getByRole('button',{name:'＋ Record Movement',exact:true}).click();}else await page.locator('#movement-add-btn').click();assert.equal(await page.locator('#movement-form').isVisible(),true);await page.locator('#movement-cancel-btn').click();
  await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(150);await page.screenshot({path:`docs/movement-screens/movements-${width}.png`,fullPage:width>900});
  await page.evaluate(()=>{currentUser={role:'fse',username:'alex.fse',fse:'Alex Santos'};applyRoleUI();renderMovements();});
  assert.equal(await page.locator('#movement-add-btn').isVisible(),false);
  await page.locator('[data-movement-details]').first().click();assert.equal(await page.locator('#movement-details-dialog').isVisible(),true);await page.locator('#movement-details-dialog>button').click();
  await page.locator('#movement-search').fill('no matching record');assert.match(await page.locator('#movement-body').textContent(),/No movements match/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  console.log('PASS '+width+'px: 5 columns, filters/reset, hidden-reference search, complete details, profile link, movement form and FSE controls');await context.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
