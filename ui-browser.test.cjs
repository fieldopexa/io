/* Run with PLAYWRIGHT_MODULE pointing to an installed Playwright package.
   Synthetic records only; all external network requests are blocked. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const baseline = execFileSync('git', ['show', 'cda82ef0619208f40ce512f6aed48f26f06894e1:index.html']);
const server = http.createServer((req,res) => {
  const pathname = new URL(req.url,'http://localhost').pathname;
  if (pathname === '/before.html') {res.setHeader('Content-Type','text/html');return res.end(baseline);}
  const file = path.join(__dirname, pathname === '/' ? 'index.html' : pathname.slice(1));
  if (!file.startsWith(__dirname + path.sep) || !fs.existsSync(file)) {res.statusCode=404;return res.end();}
  res.setHeader('Content-Type', ({'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png'})[path.extname(file)] || 'text/plain');
  res.end(fs.readFileSync(file));
});
let browser;
(async () => {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({channel:'msedge',headless:true});
  fs.mkdirSync('docs/ui-screens',{recursive:true});
  const results=[];
  for (const version of ['before','after']) {
    for (const width of [390,820,1440]) {
      const context = await browser.newContext({viewport:{width,height:960},serviceWorkers:'block'});
      await context.route('**/*',route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
      const page = await context.newPage();
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto(origin+(version==='before'?'/before.html':'/'),{waitUntil:'load'});
      await page.evaluate(() => {
        // Exercise actual renderers with isolated fixtures; do not authenticate.
        currentUser={username:'qa',name:'QA Engineer',fse:'QA Engineer',role:'management'};
        document.getElementById('login-screen').style.display='none';
        document.getElementById('app-shell').style.display='block';
        entries=[
          {id:'qa-1',date:'2026-10-27',site:'North Test Site',tech:'QA Engineer',fse:'QA Engineer',category:'Hardware',issueType:'Power supply',priority:'High',status:'Pending',notes:'Power supply requires replacement.',resolution:'Isolated equipment for assessment.'},
          {id:'qa-2',date:'2026-10-26',site:'South Test Site',tech:'QA Engineer',fse:'QA Engineer',category:'Network',priority:'Low',status:'Resolved',notes:'Connection restored.',resolution:'Replaced cable.'}
        ];
        managementPeriod='all';applyRoleUI();render();renderManagementOverview();
      });
      await page.addScriptTag({content:fs.readFileSync('preview-fixtures.js','utf8')});
      async function show(panel) {
        await page.evaluate(panel => {
          document.querySelector('.tab[data-tab="'+panel+'"]').click();
          window.refreshVisitWizard?.();window.scrollTo(0,0);
        },panel);
        await page.waitForTimeout(400);
        assert.equal(await page.locator('#panel-'+panel).isVisible(),true);
        if(panel==='log') assert.equal(await page.locator('.smart-visit-form').isVisible(),true);
        const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
        assert.equal(overflow,false,`${version} ${panel} at ${width}px must not overflow`);
      }
      for (const panel of ['dashboard','fieldlogs','log','report','inventory','audit','users']) {
        await show(panel);
        await page.screenshot({path:`docs/ui-screens/${version}-${panel}-${width}.png`,fullPage:width>900});
      }
      if (version==='after') {
        await show('users');
        assert.equal(await page.locator('#users-body tr').count(),4);
        assert.equal(await page.locator('#users-body tr:first-child td[data-column="User"]').count(),1);
        await page.locator('#add-user-toggle').click();
        assert.equal(await page.locator('#add-user-card').isVisible(),true);
        await page.locator('#add-user-toggle').click();
        await show('audit');
        await page.locator('#audit-search').fill('North Test');
        assert.equal(await page.locator('#audit-body tr').count(),1);
        await page.locator('#audit-search').fill('');
        assert.equal(await page.locator('#audit-body tr').count(),3);
        await show('report');
        assert.equal(await page.locator('#presentation-report .brief-header').isVisible(),true);
        await page.locator('[data-report-view-button="tasks"]').click();
        assert.equal(await page.locator('.report-weekly-task-view').isVisible(),true);
        await page.locator('[data-report-view-button="report"]').click();
        await show('dashboard');
        assert.equal(await page.locator('.mgmt-kpi:visible').count(),5);
        assert.equal(await page.locator('.opexa-attention-grid #mgmt-site-risk').count(),1);
        await show('fieldlogs');
        await page.locator('#global-search').fill('North Test');
        assert.equal(await page.locator('.readable-log').count(),1);
        await page.locator('.log-filter-reset').click();
        assert.equal(await page.locator('.readable-log').count(),2);
        await show('log');
        assert.equal(await page.locator('label[for="location-combobox"]').count(),1);
        if(width<=900) {
          await page.locator('#visit-step-next').click();
          assert.equal(await page.locator('.visit-step-panel.active').getAttribute('data-visit-step'),'1','missing site blocks progression');
          assert.equal(await page.evaluate(()=>document.activeElement.id),'location-combobox');
          await page.evaluate(()=>{const site=document.getElementById('f-site');site.add(new Option('North Test Site','North Test Site'));site.value='North Test Site';site.dispatchEvent(new Event('change',{bubbles:true}));});
          await page.locator('#visit-step-next').click();
          assert.equal(await page.locator('.visit-step-panel.active').getAttribute('data-visit-step'),'2');
          await page.evaluate(()=>{document.getElementById('f-service-needed').value='yes';window.refreshVisitWizard();window.setVisitWizardStep(5,false);});
          assert.equal(await page.locator('#visit-step-count').textContent(),'Step 5 of 5');
          await page.evaluate(()=>{document.getElementById('submit-btn').disabled=true;});
          await page.waitForTimeout(30);
          assert.equal(await page.locator('#mobile-save-fab').isDisabled(),true);
          await page.evaluate(()=>{document.getElementById('submit-btn').disabled=false;});
          await page.waitForTimeout(30);
          assert.equal(await page.locator('#mobile-save-fab').isDisabled(),false);
          assert.equal(await page.locator('#mobile-save-fab span').textContent(),'Save Field Visit');
          await page.locator('#mobile-menu-btn').click();
          await page.waitForTimeout(50);
          assert.equal(await page.locator('#mobile-menu-btn').getAttribute('aria-expanded'),'true');
          assert.equal(await page.evaluate(()=>document.activeElement.id),'mobile-menu-close');
          await page.keyboard.press('Escape');
          await page.waitForTimeout(50);
          assert.equal(await page.evaluate(()=>document.activeElement.id),'mobile-menu-btn');
          assert.equal(await page.locator('#mobile-nav-drawer').evaluate(el=>el.inert),true);
        } else {
          assert.equal(await page.locator('.visit-step-panel').evaluateAll(nodes=>nodes.every(el=>getComputedStyle(el).display==='contents')),true);
        }
        for (const boundary of [320,760,900,901]) {
          await page.setViewportSize({width:boundary,height:960});
          await show('log');
          assert.equal(await page.locator('.smart-visit-form').isVisible(),true);
          if(boundary<=900) {
            assert.equal(await page.locator('#mobile-bottom-nav').isVisible(),true);
            const nav=await page.locator('#mobile-bottom-nav').boundingBox();
            assert.ok(nav.height<=80 && nav.y>=850,'mobile navigation remains compact at tablet widths');
          }
        }
        // Existing role rules still hide management controls.
        await page.evaluate(()=>{currentUser={username:'qa',fse:'QA Engineer',role:'fse'};applyRoleUI();});
        assert.equal(await page.locator('.app-nav [data-tab="users"]').isVisible(),false);
        assert.equal(await page.locator('#f-tech').isDisabled(),true);
      }
      results.push({version,width,errors});
      await context.close();
    }
  }
  fs.writeFileSync('docs/ui-screens/results.json',JSON.stringify(results,null,2));
  const beforeErrors=results.filter(r=>r.version==='before').flatMap(r=>r.errors);
  for (const r of results.filter(r=>r.version==='after')) assert.deepEqual(r.errors.filter(error=>!beforeErrors.includes(error)),[], 'no new runtime errors');
  console.log(JSON.stringify(results,null,2));
  console.log('PASS: responsive layouts, KPI visibility, filters, wizard validation, save busy state, drawer keyboard behavior and role controls.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
