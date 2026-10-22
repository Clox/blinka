const KEY = "blinkaFaviconV1";
const LEGACY_KEY = "blinkaManualV1";
const ALARM = "blinkaColorTick";
const BLINK_MS = 1000;
let queue = Promise.resolve();
let blinkTimer = null;
let blinkTickPending = false;
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

function normalize(state) {
  state.tabs ||= {};
  state.previews ||= {};
  state.groups ||= {};
  state.owned ||= {};
  return state;
}
async function read() {
  const stored=await chrome.storage.local.get([KEY,LEGACY_KEY]);
  const old=stored[LEGACY_KEY];
  if (!old && stored[KEY]) return normalize(stored[KEY]);
  for (const [id,record] of Object.entries(old?.groups || {})) {
    let group;
    try { group=await chrome.tabGroups.get(Number(id)); } catch { continue; }
    if (!record.paused && group.color===record.expected && record.baseColor) {
      await chrome.tabGroups.update(Number(id),{color:record.baseColor});
    }
  }
  await chrome.alarms.clear(ALARM);
  const state=normalize(stored[KEY] || {tabs:old?.probes?.faviconTabs || {}});
  await save(state);
  if (old) await chrome.storage.local.remove(LEGACY_KEY);
  return state;
}
async function save(state) { await chrome.storage.local.set({[KEY]:state}); }
async function getTab(id) { try { return await chrome.tabs.get(Number(id)); } catch { return null; } }
async function getGroup(id) { try { return await chrome.tabGroups.get(Number(id)); } catch { return null; } }
function syncBlinkTimer(state) {
  const needsBlink=Object.keys(state.previews).length>0 && Object.values(state.groups).some(group=>!group.paused);
  if (needsBlink && blinkTimer===null) blinkTimer=setInterval(blinkTick,BLINK_MS);
  if (!needsBlink && blinkTimer!==null) { clearInterval(blinkTimer); blinkTimer=null; }
}
function blinkTick() {
  if (blinkTickPending) return;
  blinkTickPending=true;
  serial(async()=>{
    const state=await read();
    await reconcile(state);
    await paint(state);
    await save(state);
    syncBlinkTimer(state);
    if (!Object.keys(state.previews).length) await chrome.alarms.clear(ALARM);
  }).catch(console.error).finally(()=>{ blinkTickPending=false; });
}
async function setupAlarm(state) {
  syncBlinkTimer(state);
  if (Object.keys(state.previews).length) {
    if (!(await chrome.alarms.get(ALARM))) await chrome.alarms.create(ALARM,{periodInMinutes:0.5});
  }
  else await chrome.alarms.clear(ALARM);
}
async function reconcile(state) {
  for (const [id,preview] of Object.entries(state.previews)) {
    const tab=await getTab(preview.tabId);
    if (!tab) { delete state.previews[id]; continue; }
    preview.groupId=tab.groupId;
    if (tab.groupId>=0 && !state.groups[tab.groupId]) {
      const group=await getGroup(tab.groupId);
      if (group) state.groups[tab.groupId]={baseColor:group.color,expected:group.color,paused:false};
    }
  }
  for (const [id,record] of Object.entries(state.groups)) {
    if (!Object.values(state.previews).some(preview=>preview.groupId===Number(id))) {
      const group=await getGroup(id);
      if (group && !record.paused && group.color===record.expected) {
        await chrome.tabGroups.update(Number(id),{color:record.baseColor});
      }
      delete state.groups[id];
    } else if (!(await getGroup(id))) delete state.groups[id];
  }
  for (const [windowId,groupId] of Object.entries(state.owned)) {
    if (!(await getGroup(groupId))) delete state.owned[windowId];
  }
}
async function paint(state) {
  for (const [id,record] of Object.entries(state.groups)) {
    if (record.paused) continue;
    const group=await getGroup(id);
    if (!group) continue;
    if (group.color!==record.expected) {
      record.baseColor=group.color;
      record.expected=group.color;
      record.paused=true;
      continue;
    }
    const color=record.expected==="red" ? "yellow" : "red";
    if (group.color!==color) {
      record.expected=color;
      await chrome.tabGroups.update(Number(id),{color});
    }
  }
}
async function addAttention(state,tabId,source) {
  await reconcile(state);
  if (source==="manual" && Object.values(state.previews).some(preview=>preview.tabId===tabId && preview.source!=="favicon")) return state;
  const tab=await getTab(tabId);
  if (!tab) throw new Error("Fliken finns inte längre.");
  let groupId=tab.groupId;
  if (groupId<0) {
    const prior=state.owned[tab.windowId];
    const group=prior==null ? null : await getGroup(prior);
    if (group?.windowId===tab.windowId) groupId=await chrome.tabs.group({tabIds:[tabId],groupId:prior});
    else {
      groupId=await chrome.tabs.group({tabIds:[tabId],createProperties:{windowId:tab.windowId}});
      state.owned[tab.windowId]=groupId;
      await chrome.tabGroups.update(groupId,{title:"Blinka"});
    }
  }
  const group=await getGroup(groupId);
  if (!group) throw new Error("Flikgruppen finns inte längre.");
  if (!state.groups[groupId]) state.groups[groupId]={baseColor:group.color,expected:group.color,paused:false};
  const id=crypto.randomUUID();
  state.previews[id]={id,tabId,groupId,source};
  await paint(state);
  return state;
}
async function startPreview(tabId) {
  const state=await read();
  await addAttention(state,tabId,"manual");
  await save(state);
  await setupAlarm(state);
  return state;
}
async function ackPreview(id) {
  const state=await read();
  if (!state.previews[id]) throw new Error("Förhandsvisningen finns inte längre.");
  delete state.previews[id];
  await reconcile(state);
  await save(state);
  await setupAlarm(state);
  return state;
}
async function resumeGroup(groupId) {
  const state=await read();
  const record=state.groups[groupId],group=await getGroup(groupId);
  if (!record || !group) throw new Error("Flikgruppen finns inte längre.");
  record.baseColor=group.color;
  record.expected=group.color;
  record.paused=false;
  await paint(state);
  await save(state);
  await setupAlarm(state);
  return state;
}
async function recordFavicon(tabId,url) {
  const badge=chatgptFaviconBadge(url);
  const state=await read();
  const prior=state.tabs[tabId];
  if ((!badge && !prior) || prior?.current===badge) return;
  state.tabs[tabId]={
    current:badge,
    at:Date.now(),
    lastBadge:badge || prior?.lastBadge || null,
    lastBadgeAt:badge ? Date.now() : prior?.lastBadgeAt || null,
  };
  if (prior?.current==="active" && badge===null) {
    await addAttention(state,tabId,"favicon");
    await setupAlarm(state);
  }
  await save(state);
}
async function refreshState() {
  const state=await read();
  await reconcile(state);
  await save(state);
  await setupAlarm(state);
  return state;
}

chrome.runtime.onMessage.addListener((message,_sender,respond)=>{
  if (!["state","preview","ack","resume"].includes(message?.type)) return false;
  serial(async()=>{
    if (message.type==="state") return {ok:true,state:await refreshState()};
    if (message.type==="preview") return {ok:true,state:await startPreview(message.tabId)};
    if (message.type==="ack") return {ok:true,state:await ackPreview(message.id)};
    return {ok:true,state:await resumeGroup(message.groupId)};
  }).then(respond,error=>respond({ok:false,error:String(error?.message || error)}));
  return true;
});
chrome.alarms.onAlarm.addListener(alarm=>{
  if (alarm.name!==ALARM) return;
  serial(async()=>{
    const state=await read();
    await reconcile(state);
    await paint(state);
    await save(state);
    await setupAlarm(state);
  });
});
chrome.tabs.onUpdated.addListener((tabId,change)=>{
  if (change.favIconUrl!==undefined) serial(()=>recordFavicon(tabId,change.favIconUrl));
  if (change.groupId!==undefined) serial(()=>refreshState());
});
chrome.tabs.onRemoved.addListener(tabId=>serial(async()=>{
  const state=await read();
  delete state.tabs[tabId];
  await reconcile(state);
  await save(state);
  await setupAlarm(state);
}));
chrome.tabs.onDetached.addListener(()=>serial(()=>refreshState()));
chrome.tabGroups.onUpdated.addListener(group=>serial(async()=>{
  const state=await read();
  const record=state.groups[group.id];
  if (!record) return;
  const current=await getGroup(group.id);
  if (current && current.color!==record.expected) {
    record.baseColor=current.color;
    record.expected=current.color;
    record.paused=true;
    await save(state);
    syncBlinkTimer(state);
  }
}));
chrome.tabGroups.onRemoved.addListener(()=>serial(()=>refreshState()));
chrome.runtime.onInstalled.addListener(()=>serial(()=>refreshState()));
chrome.runtime.onStartup.addListener(()=>serial(()=>refreshState()));
serial(()=>refreshState()).catch(console.error);
