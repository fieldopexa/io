/* Run build-preview.cjs first; pass the offline preview HTML path. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const preview=process.argv[2];if(!preview)throw Error('Supply the offline preview HTML path.');
let browser;
(async()=>{
 browser=await chromium.launch({channel:'msedge',headless:true});
 fs.mkdirSync('docs/quality-screens',{recursive:true});
 for(const width of [320,390,820,1440]){
  const page=await browser.newPage({viewport:{width,height:960}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto(pathToFileURL(path.resolve(preview)).href);
  async function check(name){
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' page overflow at '+width);
   const missing=await page.evaluate(()=>Array.from(document.querySelectorAll('.panel.active input:not([type=hidden]),.panel.active select,.panel.active textarea')).filter(e=>e.getClientRects().length&&!e.labels?.length&&!e.getAttribute('aria-label')&&!e.getAttribute('aria-labelledby')).map(e=>e.id));
   assert.deepEqual(missing,[],name+' accessible names');
  }
  for(const tab of ['dashboard','fieldlogs','log','report','inventory','users','audit']){
   await page.evaluate(t=>document.querySelector('.tab[data-tab='+t+']').click(),tab);await page.waitForTimeout(40);await check(tab);
   if(['dashboard','report'].includes(tab)&&[390,1440].includes(width))await page.screenshot({path:'docs/quality-screens/'+tab+'-'+width+'.png'});
  }
  await page.evaluate(()=>document.querySelector('.tab[data-tab=inventory]').click());
  for(const view of ['sites','cabinets','components','spares','requests','movements','maintenance']){await page.evaluate(v=>setInventoryView(v),view);await page.waitForTimeout(40);await check(view);}
  await page.evaluate(()=>{window.qaPreviousRows=cabinetRows;apiGet=async()=>{throw Error('Simulated network failure');};});
  await page.evaluate(()=>loadCabinets());
  assert(await page.evaluate(()=>cabinetRows===window.qaPreviousRows),'failed reload preserves cabinet list');
  await page.evaluate(()=>setInventoryLoadState('Refreshing',false,true));
  assert.equal(await page.locator('.asset-loading-logo img').count(),0,'no branded loader');
  assert.equal(await page.locator('#panel-inventory').getAttribute('aria-busy'),'true');
  await page.evaluate(()=>setInventoryLoadState('Updated',false,false));
  assert(await page.locator('.asset-load-status .asset-loading-logo').evaluate(e=>e.hidden));
  assert.deepEqual(errors,[],'runtime errors');
  console.log('PASS '+width+'px: all sections, labels, overflow, refresh failure retention and spinner state');await page.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();});
