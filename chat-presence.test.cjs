const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const js=fs.readFileSync('live-chat.js','utf8');
const directory=js.match(/const TEAM_DIRECTORY=(\[[\s\S]*?\]);/)[1];
function source(name){
  const start=js.indexOf('  function '+name+'(');
  const asyncStart=js.indexOf('  async function '+name+'(');
  const at=start<0?asyncStart:start;
  assert(at>=0,'Missing function '+name);
  return js.slice(at,js.indexOf('\n  }',at)+4);
}
const state={user:{uid:'viewer'},member:{active:true,role:'fse'},profiles:[],presence:{}};
let writes=0;
state.lib={doc:()=>({}),serverTimestamp:()=>Date.now(),setDoc:async()=>{writes++;}};
const context=vm.createContext({state,document:{visibilityState:'visible'},Date,btoa:s=>Buffer.from(s).toString('base64'),console});
vm.runInContext('const TEAM_DIRECTORY='+directory+';'+['uidForFsmUsername','showsActivity','isRecentlyActive','lastActiveText','groupActiveText','syncPresence'].map(source).join('\n'),context);
const ian=context.uidForFsmUsername('ian');
const fse=context.uidForFsmUsername('popoy');
const manager=context.uidForFsmUsername('manager');
state.profiles=[{uid:ian,active:true},{uid:fse,active:true},{uid:manager,active:true,role:'management'}];
for(const uid of [ian,fse,manager])state.presence[uid]={toMillis:()=>Date.now()};
for(const uid of [ian,manager]){
  assert.equal(context.isRecentlyActive(uid),false,'Management must have no green dot or Active now badge');
  assert.equal(context.lastActiveText(uid),'Private message','Management must have no activity timestamp');
}
assert.equal(context.isRecentlyActive(fse),true);
assert.equal(context.lastActiveText(fse),'Active now');
assert.equal(context.groupActiveText(),'1 active recently','Management excluded from group activity count');
(async()=>{
  await context.syncPresence();
  assert.equal(writes,1,'FSE presence still publishes');
  state.member.role='management';
  await context.syncPresence();
  assert.equal(writes,1,'Management presence must not publish');
  state.user.uid=ian;state.member.role='fse';
  await context.syncPresence();
  assert.equal(writes,1,'Legacy Ian account must not publish');
  console.log('PASS: management activity hidden; FSE activity retained.');
})().catch(error=>{console.error(error);process.exitCode=1;});
