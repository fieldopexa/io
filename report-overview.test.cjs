const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=http.createServer((req,res)=>{
 const file=path.join(__dirname,new URL(req.url,'http://localhost').pathname==='/'?'index.html':new URL(req.url,'http://localhost').pathname.slice(1));
 if(!file.startsWith(__dirname+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));
});
let browser;
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({channel:'msedge',headless:true});fs.mkdirSync('docs/report-screens',{recursive:true});
 for(const width of [390,820,1440]){
  const context=await browser.newContext({viewport:{width,height:960},serviceWorkers:'block'});
  await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);await page.addScriptTag({content:fs.readFileSync('preview-fixtures.js','utf8')});
  await page.evaluate(()=>{
   const date=todayStr();entries=Array.from({length:10},(_,i)=>({id:'report-'+i,date,site:i%2?'North Test Site':'South Test Site',tech:i%2?'Alex Santos':'Mika Reyes',category:i%2?'Hardware':'Network',issueType:'Concern '+i,notes:'Visit note '+i,resolution:'Action '+i,status:i<3?'Resolved':i===3?'Follow-up':'Pending',priority:i===3?'Critical':i===4?'High':'Low'}));
   entries.push({id:'voided',date,site:'Void site',status:'Voided',priority:'Critical'},{id:'old',date:'2020-01-01',site:'Old site',status:'Pending',priority:'Critical'});
   document.querySelector('.tab[data-tab="report"]').click();
  });
  await page.waitForTimeout(350);
  assert.deepEqual(await page.locator('.brief-metrics b').allTextContents(),['10','3','7','2']);
  assert.equal(await page.locator('.report-attention-row').count(),5);
  assert.match(await page.locator('.report-attention-row:first-of-type').textContent(),/Critical priority/);
  assert.equal(await page.locator('.report-breakdown').getAttribute('open'),null);
  assert.equal(await page.locator('.report-records').getAttribute('open'),null);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:`docs/report-screens/overview-${width}.png`,fullPage:width>900});
  await page.locator('.report-records>summary').click();
  assert.equal(await page.locator('.visit-remarks-table tbody tr:visible').count(),10);
  await page.locator('.report-records>summary').click();
  await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
  assert.equal(await page.locator('.report-records').evaluate(n=>n.open),true);
  await page.emulateMedia({media:'print'});
  assert.equal(await page.locator('.visit-remarks-table tbody tr:visible').count(),10);
  await page.emulateMedia({media:'screen'});
  await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
  assert.equal(await page.locator('.report-records').evaluate(n=>n.open),false);
  await page.evaluate(()=>document.getElementById('present-report-btn').click());
  await page.waitForTimeout(40);
  assert.equal(await page.locator('.report-attention').isVisible(),true);
  await page.locator('.report-page-controls button').last().click();
  assert.equal(await page.locator('.report-attention').isVisible(),false);
  assert.equal(await page.locator('.visit-remarks-table tbody tr:visible').count(),5);
  await page.keyboard.press('Escape');
  await page.locator('.report-attention-row').first().click();
  assert.equal(await page.locator('#detail-overlay').isVisible(),true);
  await page.evaluate(()=>{closeDetail();entries=[];renderReport();});
  await page.waitForTimeout(30);
  assert.equal(await page.locator('.report-attention-row').count(),0);
  assert.match(await page.locator('.report-attention').textContent(),/No open visits/);
  assert.deepEqual(errors,[]);
  console.log('PASS '+width+'px: scoped totals, priority order, 5-item cap, expandable full records, print, presentation and empty state');
  await context.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
