/* Offline preview/test data only. Never loaded by the production index.html. */
(() => {
  const demoUsers=[
    {username:'preview',name:'Preview Manager',role:'management',active:true},
    {username:'alex.fse',name:'Alex Santos',role:'fse',fse:'Alex Santos',active:true},
    {username:'mika.fse',name:'Mika Reyes',role:'fse',fse:'Mika Reyes',active:true},
    {username:'previous.fse',name:'Previous Engineer',role:'fse',fse:'Previous Engineer',active:false}
  ];
  const date=todayStr();
  const demoEntries=[
    {id:'qa-1',date,site:'North Test Site',tech:'Alex Santos',category:'Hardware',issueType:'Power supply',priority:'High',status:'Pending',notes:'Power supply requires replacement.',resolution:'Isolated equipment for assessment.'},
    {id:'qa-2',date,site:'South Test Site',tech:'Mika Reyes',category:'Network',issueType:'Connection',priority:'Low',status:'Resolved',notes:'Connection restored after cable replacement.',resolution:'Replaced the network cable and verified connectivity.'}
  ];
  const demoSites=[{id:'site-1',name:'North Test Site',status:'Active'},{id:'site-2',name:'South Test Site',status:'Active'}];
  const demoCabinets=[
    {id:'cab-1',cabinetId:'OPX-001',cabinetNo:'OPX-001',site:'North Test Site',status:'For Repair',brand:'OPEXA',model:'Standard',serialNo:'DEMO-001',deploymentStatus:'Deployed'},
    {id:'cab-2',cabinetId:'OPX-002',cabinetNo:'OPX-002',site:'South Test Site',status:'Operational',brand:'OPEXA',model:'Standard',serialNo:'DEMO-002',deploymentStatus:'Deployed'}
  ];
  const demoAudit=[
    {id:'audit-1',timestamp:date+'T09:30:00+08:00',actorUsername:'alex.fse',actorName:'Alex Santos',actorRole:'fse',action:'CREATE',entityType:'Field Log',entityId:'qa-1',label:'North Test Site',details:'Recorded a hardware concern and requested a replacement power supply.'},
    {id:'audit-2',timestamp:date+'T10:15:00+08:00',actorUsername:'mika.fse',actorName:'Mika Reyes',actorRole:'fse',action:'UPDATE',entityType:'Field Log',entityId:'qa-2',label:'South Test Site',details:'Updated visit status to Resolved after connectivity checks.'},
    {id:'audit-3',timestamp:date+'T11:00:00+08:00',actorUsername:'preview',actorName:'Preview Manager',actorRole:'management',action:'DISABLE',entityType:'Account',entityId:'previous.fse',label:'Previous Engineer',details:'Disabled access for a former team member.'}
  ];
  const demoMovements=[
    {id:'movement-demo-1',cabinetRowId:'cab-1',cabinetId:'OPX-001',movementDate:date,movementType:'Transfer',fromLocation:'North Test Site',toLocation:'South Test Site',statusBefore:'Operational',statusAfter:'Operational',allocationBefore:'OPX-001',allocationAfter:'OPX-001',handledBy:'Alex Santos',referenceNo:'DEMO-TRANSFER-01',remarks:'Transferred for the approved site allocation.'},
    {id:'movement-demo-2',cabinetRowId:'cab-2',cabinetId:'OPX-002',movementDate:date,movementType:'For Repair',fromLocation:'South Test Site',toLocation:'Carmona Cavite Warehouse',statusBefore:'Non-Operational',statusAfter:'For Repair',allocationBefore:'OPX-002',allocationAfter:'STOCK002',handledBy:'Mika Reyes',referenceNo:'DEMO-REPAIR-02',remarks:'Returned for power supply inspection.'}
  ];
  // Guard the preview before making any renderer visible. No writes or real login.
  window.fetch=()=>Promise.reject(new Error('Offline interface preview: network requests disabled.'));
  apiPost=async action=>{
    if(action==='listUsers')return structuredClone(demoUsers);
    throw new Error('Preview only. Saving and account changes are disabled.');
  };
  apiGet=async type=>structuredClone(({entries:demoEntries,sites:demoSites.map(s=>s.name),fses:['Alex Santos','Mika Reyes'],cabinets:demoCabinets,movements:demoMovements,siteRegistry:demoSites,siteRecords:demoSites,auditTrail:demoAudit})[type]||[]);
  currentUser={username:'preview',name:'Preview Manager',role:'management'};authToken='';
  entries=structuredClone(demoEntries);fses=['Alex Santos','Mika Reyes'];sites=demoSites.map(s=>s.name);
  cabinetRows=structuredClone(demoCabinets);window.__lifecycleSites=structuredClone(demoSites);
  movementRows=structuredClone(demoMovements);
  auditRowsCache=structuredClone(demoAudit);auditLoadedOnce=true;
  document.getElementById('login-screen').style.display='none';
  document.getElementById('app-shell').style.display='block';
  document.getElementById('logged-user').textContent='Preview Manager';
  managementPeriod='all';applyRoleUI();renderFseOptions();renderSiteOptions();render();renderManagementOverview();
  document.querySelector('.tab[data-tab="dashboard"]').click();
  const notice=document.createElement('div');notice.textContent='INTERFACE PREVIEW · Sample records · Saving and account changes disabled';
  notice.style.cssText='padding:10px 14px;border:1px solid #dfbd7260;border-radius:8px;color:#dfbd72;margin-bottom:14px;font:13px Segoe UI,sans-serif';
  document.querySelector('.app-content').prepend(notice);
})();
