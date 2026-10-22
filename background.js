const KEY = "blinkaManualV1";
const ALARM = "blinkaColorTick";
const COLORS = ["red", "yellow"];
const REMOTE_STATUSES = new Set(["klar", "vantar_pa_svar", "vantar_pa_godkannande", "avbruten", "fel"]);
let queue = Promise.resolve();
function serial(fn) { const next=queue.then(fn); queue=next.catch(console.error); return next; }
function chatgptFaviconBadge(url) {
  if (typeof url!=="string" || !url.startsWith("data:image/svg+xml,")) return null;
  let svg;
  try { svg=decodeURIComponent(url.slice("data:image/svg+xml,".length)); } catch { return null; }
  if (!svg.includes('data-codex-favicon-badge="codex-favicon-badge"')) return null;
  if (svg.includes('<circle cx="24" cy="24" r="7" fill="#22c55e"')) return "deliverable";
  if (svg.includes('<circle cx="24" cy="24" r="7" fill="#facc15"')) return "handoff";
  return "active";
}
async function recordFaviconProbe(tabId,url) {
  const badge=chatgptFaviconBadge(url);
  const s=await read(); s.probes ||= {}; s.probes.faviconTabs ||= {};
  const prior=s.probes.faviconTabs[tabId];
  if (!badge && !prior) return;
  if (prior?.current===badge) return;
  s.probes.faviconTabs[tabId]={current:badge,at:Date.now(),lastBadge:badge || prior?.lastBadge || null,lastBadgeAt:badge ? Date.now() : prior?.lastBadgeAt || null};
  await save(s);
}
async function read() { return (await chrome.storage.local.get(KEY))[KEY] || {jobs:{},groups:{},owned:{},phase:0,probes:{}}; }
async function save(s) { await chrome.storage.local.set({[KEY]:s}); }
async function getGroup(id) { try { return await chrome.tabGroups.get(Number(id)); } catch { return null; } }
async function getTab(id) { try { return await chrome.tabs.get(Number(id)); } catch { return null; } }
async function setupAlarm(s) {
  if (Object.keys(s.pairs || {}).length || Object.keys(s.jobs).some(id=>s.jobs[id].groupId >= 0)) await chrome.alarms.create(ALARM,{periodInMinutes:0.5});
  else await chrome.alarms.clear(ALARM);
}
async function restore(groupId, record) {
  const group=await getGroup(groupId);
  if (group && !record.paused && group.color===record.expected) await chrome.tabGroups.update(Number(groupId),{color:record.baseColor});
}
async function reconcile(s) {
  for (const [id,job] of Object.entries(s.jobs)) {
    const tab=await getTab(job.tabId);
    if (!tab) { delete s.jobs[id]; continue; }
    job.groupId=tab.groupId;
    if (tab.groupId >= 0 && !s.groups[tab.groupId]) {
      const group=await getGroup(tab.groupId);
      if (group) s.groups[tab.groupId]={baseColor:group.color,expected:group.color,paused:false};
    }
  }
  for (const [id,record] of Object.entries(s.groups)) {
    if (!Object.values(s.jobs).some(j=>j.groupId===Number(id))) { await restore(id,record); delete s.groups[id]; }
    else if (!(await getGroup(id))) delete s.groups[id];
  }
  for (const [windowId,groupId] of Object.entries(s.owned)) if (!(await getGroup(groupId))) delete s.owned[windowId];
}
async function paint(s) {
  for (const [id,record] of Object.entries(s.groups)) {
    if (record.paused) continue;
    const group=await getGroup(id);
    if (!group) continue;
    if (group.color!==record.expected) {
      record.baseColor=group.color; record.expected=group.color; record.paused=true;
      continue;
    }
    const color=COLORS[s.phase % COLORS.length];
    if (group.color!==color) { record.expected=color; await chrome.tabGroups.update(Number(id),{color}); }
  }
  s.phase++;
}
async function createJobInState(s,tabId,source="manual",pairId=null,lage=null) {
  const tab=await getTab(tabId); if (!tab) throw new Error("Fliken finns inte längre.");
  let groupId=tab.groupId;
  if (groupId<0) {
    const prior=s.owned[tab.windowId], group=prior==null?null:await getGroup(prior);
    if (group?.windowId===tab.windowId) groupId=await chrome.tabs.group({tabIds:[tabId],groupId:prior});
    else {
      groupId=await chrome.tabs.group({tabIds:[tabId],createProperties:{windowId:tab.windowId}});
      s.owned[tab.windowId]=groupId;
      await chrome.tabGroups.update(groupId,{title:"Blinka"});
    }
  }
  const group=await getGroup(groupId);
  if (!s.groups[groupId]) s.groups[groupId]={baseColor:group.color,expected:group.color,paused:false};
  else if (s.groups[groupId].paused) { s.groups[groupId].baseColor=group.color; s.groups[groupId].expected=group.color; s.groups[groupId].paused=false; }
  const id=crypto.randomUUID(); s.jobs[id]={id,tabId,groupId,source,pairId,lage};
  return id;
}
async function add(tabId) {
  const s=await read(); await reconcile(s);
  const id=await createJobInState(s,tabId);
  await paint(s); await save(s); await setupAlarm(s); return id;
}
function endpoint(origin,path) { return `${origin}${path}`; }
async function postJson(url,body) {
  const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  if (!response.ok) { const error=new Error(`Servern svarade ${response.status}.`); error.status=response.status; throw error; }
  return response.json();
}
async function pair(tabId,origin) {
  const url=new URL(origin);
  if (url.protocol!=="https:" || !url.hostname || url.username || url.password || url.pathname!=="/" || url.search || url.hash) throw new Error("Ange en HTTPS-adress utan sökväg eller inloggningsuppgifter.");
  if (!(await chrome.permissions.contains({origins:[`${url.origin}/*`]}))) throw new Error("Blinka saknar åtkomst till signalservern.");
  const tab=await getTab(tabId); if (!tab) throw new Error("Fliken finns inte längre.");
  const s=await read(); s.pairs ||= {};
  const pairId=crypto.randomUUID(), readToken=crypto.randomUUID();
  await postJson(endpoint(url.origin,"/pair"),{pair_id:pairId,read_token:readToken});
  s.pairs[pairId]={pairId,readToken,tabId,windowId:tab.windowId,origin:url.origin,createdAt:Date.now(),cursor:0};
  await save(s); await setupAlarm(s); return pairId;
}
async function pollPairs(s) {
  for (const [pairId,pair] of Object.entries(s.pairs || {})) {
    if (Date.now()-pair.createdAt>4*60*60*1000 || !(await getTab(pair.tabId))) { delete s.pairs[pairId]; continue; }
    try {
      const result=await postJson(endpoint(pair.origin,"/events"),{pair_id:pairId,read_token:pair.readToken,after:pair.cursor||0});
      if (!Array.isArray(result.events)) throw new Error("Ogiltigt svar från signalservern.");
      for (const event of result.events) {
        if (!Number.isSafeInteger(event.id) || event.id <= (pair.cursor||0) || !REMOTE_STATUSES.has(event.lage)) throw new Error("Ogiltig händelse från signalservern.");
        const jobId=await createJobInState(s,pair.tabId,"plugin",pairId,event.lage);
        pair.cursor=event.id;
        s.lastRemoteSignal={pairId,tabId:pair.tabId,jobId,lage:event.lage,at:Date.now()};
      }
    } catch (error) {
      s.lastRemoteError=String(error?.message||error);
      if (error?.status===404) delete s.pairs[pairId];
    }
  }
}
async function unpair(pairId) {
  const s=await read(), pair=s.pairs?.[pairId];
  if (!pair) throw new Error("Parningen finns inte längre.");
  delete s.pairs[pairId];
  await save(s); await setupAlarm(s);
  try { await postJson(endpoint(pair.origin,"/unpair"),{pair_id:pairId,read_token:pair.readToken}); } catch {}
}
async function ack(id) {
  const s=await read(); if (!s.jobs[id]) throw new Error("Jobbet finns inte längre.");
  delete s.jobs[id]; await reconcile(s); await save(s); await setupAlarm(s);
}
async function resume(groupId) {
  const s=await read(); await reconcile(s);
  const record=s.groups[groupId], group=await getGroup(groupId);
  if (!record || !group) throw new Error("Gruppen finns inte längre.");
  record.baseColor=group.color; record.expected=group.color; record.paused=false;
  await paint(s); await save(s); await setupAlarm(s);
}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  serial(async()=>{
    if (message?.type==="probe") {
      const s=await read(); s.probes ||= {};
      const kind=message.topFrame===false ? (message.surface==="browser_side_chat" ? "panel" : "otherFrame") : "regular";
      const previous=s.probes[kind];
      s.probes[kind]={count:(previous?.count||0)+1,tabId:sender.tab?.id ?? null,frameId:sender.frameId ?? null,at:Date.now()};
      if (kind==="regular" && sender.tab?.id != null) {
        s.probes.regularTabs ||= {};
        s.probes.regularTabs[sender.tab.id]={at:Date.now(),frameId:sender.frameId ?? null};
      }
      await save(s);
      return {ok:true};
    }
    if (message?.type==="state") { const s=await read(); await reconcile(s); await save(s); return {ok:true,state:s}; }
    if (message?.type==="add") return {ok:true,id:await add(message.tabId)};
    if (message?.type==="pair") return {ok:true,pairId:await pair(message.tabId,message.origin)};
    if (message?.type==="unpair") { await unpair(message.pairId); return {ok:true}; }
    if (message?.type==="ack") { await ack(message.id); return {ok:true}; }
    if (message?.type==="resume") { await resume(message.groupId); return {ok:true}; }
    if (message?.type==="attention") { await chrome.windows.update(message.windowId,{drawAttention:true}); return {ok:true}; }
    return {ok:false,error:"Okänt kommando"};
  }).then(respond,e=>respond({ok:false,error:String(e?.message||e)}));
  return true;
});
chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name===ALARM) serial(async()=>{const s=await read(); await reconcile(s); await pollPairs(s); await paint(s); await save(s); await setupAlarm(s);});});
chrome.tabs.onUpdated.addListener((tabId,change)=>{
  if (change.favIconUrl!==undefined) serial(()=>recordFaviconProbe(tabId,change.favIconUrl));
  if (change.groupId!==undefined) serial(async()=>{const s=await read(); await reconcile(s); await save(s); await setupAlarm(s);});
});
chrome.tabs.onRemoved.addListener(tabId=>serial(async()=>{const s=await read(); if(s.probes?.regularTabs) delete s.probes.regularTabs[tabId]; if(s.probes?.faviconTabs) delete s.probes.faviconTabs[tabId]; await reconcile(s); await save(s); await setupAlarm(s); }));
chrome.tabs.onDetached.addListener(()=>serial(async()=>{const s=await read(); await reconcile(s); await save(s); await setupAlarm(s);}));
chrome.tabGroups.onUpdated.addListener(group=>serial(async()=>{const s=await read(); const r=s.groups[group.id]; if(!r) return; const current=await getGroup(group.id); if(current && current.color!==r.expected){r.baseColor=current.color;r.expected=current.color;r.paused=true;await save(s);} }));
chrome.tabGroups.onRemoved.addListener(()=>serial(async()=>{const s=await read(); await reconcile(s); await save(s); await setupAlarm(s);}));
chrome.runtime.onStartup.addListener(()=>serial(async()=>{const s=await read(); await reconcile(s); await save(s); await setupAlarm(s);}));
