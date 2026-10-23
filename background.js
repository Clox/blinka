const KEY = "blinkaFaviconV1";
const LEGACY_KEY = "blinkaManualV1";
const SETTINGS_KEY = "blinkaSettingsV1";
const CHAT_SCRIPT_ID = "blinka-chatgpt-tab";
const CHAT_ORIGIN = "https://chatgpt.com/*";
const ALARM = "blinkaColorTick";
const BLINK_MS = 1000;
const GRACE_MS = 1000;
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
  state.grace ||= {};
  state.testArmed ||= {};
  state.chatRuns ||= {};
  state.chatMonitors ||= {};
  state.chatDiagnostics ||= {};
  state.signalErrors ||= {};
  state.ownedGroups ||= {};
  return state;
}
async function settings() {
  const stored=await chrome.storage.local.get(SETTINGS_KEY);
  return {sidePanelEnabled:true,chatTabsEnabled:false,...stored[SETTINGS_KEY]};
}
async function syncChatScript() {
  const enabled=(await settings()).chatTabsEnabled;
  const permitted=await chrome.permissions.contains({origins:[CHAT_ORIGIN]});
  const registered=(await chrome.scripting.getRegisteredContentScripts({ids:[CHAT_SCRIPT_ID]})).length>0;
  if (enabled && permitted && !registered) {
    await chrome.scripting.registerContentScripts([{id:CHAT_SCRIPT_ID,matches:[CHAT_ORIGIN],js:["chatgpt-content.js"],runAt:"document_idle",persistAcrossSessions:true}]);
  } else if ((!enabled || !permitted) && registered) {
    await chrome.scripting.unregisterContentScripts({ids:[CHAT_SCRIPT_ID]});
  }
  if (enabled && permitted) {
    const tabs=await chrome.tabs.query({url:CHAT_ORIGIN});
    for (const tab of tabs) {
      try { await chrome.scripting.executeScript({target:{tabId:tab.id},files:["chatgpt-content.js"]}); } catch { /* Fliken kan vara under omladdning. */ }
    }
  } else {
    const tabs=await chrome.tabs.query({url:CHAT_ORIGIN});
    for (const tab of tabs) {
      try { await chrome.tabs.sendMessage(tab.id,{type:"stopChatMonitor"}); } catch { /* Ingen aktiv monitor. */ }
    }
  }
}
function isChatTab(url) {
  try { return new URL(url).origin==="https://chatgpt.com"; } catch { return false; }
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
    if (!tab || tab.groupId<0) {
      if (tab && preview.source==="chatgpt-tab") state.chatDiagnostics[preview.tabId]={status:"Fliken lämnade gruppen efter signalen",at:Date.now()};
      delete state.previews[id];
      continue;
    }
    preview.groupId=tab.groupId;
    if (!state.groups[tab.groupId]) {
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
  for (const id of Object.keys(state.ownedGroups)) {
    if (!(await getGroup(id))) delete state.ownedGroups[id];
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
  let groupId=Number.isInteger(tab.groupId) ? tab.groupId : -1;
  if (groupId<0) {
    try {
      for (const [id,record] of Object.entries(state.ownedGroups)) {
        if (record.windowId!==tab.windowId) continue;
        const candidate=await getGroup(id);
        if (candidate?.windowId===tab.windowId && candidate.title==="Blinka") {
          groupId=await chrome.tabs.group({tabIds:tabId,groupId:Number(id)});
          break;
        }
      }
      if (groupId<0) {
        groupId=await chrome.tabs.group({tabIds:tabId,createProperties:{windowId:tab.windowId}});
        await chrome.tabGroups.update(groupId,{title:"Blinka",color:"blue"});
        state.ownedGroups[groupId]={windowId:tab.windowId};
      }
    } catch (error) {
      state.signalErrors[tabId]={at:Date.now(),message:String(error?.message || error)};
      await save(state);
      throw error;
    }
  }
  const group=await getGroup(groupId);
  if (!group) throw new Error("Flikgruppen finns inte längre.");
  if (!state.groups[groupId]) state.groups[groupId]={baseColor:group.color,expected:group.color,paused:false};
  const id=crypto.randomUUID();
  state.previews[id]={id,tabId,groupId,source};
  await paint(state);
  delete state.signalErrors[tabId];
  return state;
}
async function startPreview(tabId) {
  const state=await read();
  const tab=await getTab(tabId);
  if (!tab) return state;
  state.testArmed[tabId]={windowId:tab.windowId};
  await save(state);
  return state;
}
async function cancelPreview(tabId) {
  const state=await read();
  delete state.testArmed[tabId];
  await save(state);
  return state;
}
async function acknowledgeTab(tabId) {
  const state=await read();
  let changed=Boolean(state.grace[tabId] || state.testArmed[tabId]);
  delete state.grace[tabId];
  delete state.testArmed[tabId];
  for (const [id,job] of Object.entries(state.previews)) {
    if (job.tabId!==tabId) continue;
    delete state.previews[id];
    changed=true;
  }
  if (!changed) return;
  await reconcile(state);
  await save(state);
  await setupAlarm(state);
}
async function acknowledgeVisibleTab(tabId,windowId) {
  const window=await chrome.windows.get(windowId);
  if (!window.focused) return;
  const tab=await getTab(tabId);
  if (tab?.windowId===windowId) await acknowledgeTab(tabId);
}
async function promoteOnLeaving(shouldPromote,at) {
  const state=await read();
  let changed=false;
  for (const [id,candidate] of Object.entries(state.grace)) {
    if (!shouldPromote(Number(id),candidate)) continue;
    delete state.grace[id];
    changed=true;
    if (at>=candidate.at && at-candidate.at<GRACE_MS) {
      await addAttention(state,Number(id),candidate.source || "favicon");
    }
  }
  for (const [id,candidate] of Object.entries(state.testArmed)) {
    if (!shouldPromote(Number(id),candidate)) continue;
    delete state.testArmed[id];
    changed=true;
    await addAttention(state,Number(id),"manual");
  }
  if (!changed) return;
  await save(state);
  await setupAlarm(state);
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
async function recordFavicon(tabId,url,observedAt,observedTab,focusedAtEvent) {
  if (!(await settings()).sidePanelEnabled || isChatTab(observedTab?.url)) return;
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
  if (badge!==null) delete state.grace[tabId];
  if (prior?.current==="active" && badge===null) {
    const tab=await getTab(tabId);
    if (tab) {
      const windowId=observedTab?.windowId ?? tab.windowId;
      const wasFocused=focusedAtEvent == null ? (await chrome.windows.get(windowId)).focused : await focusedAtEvent;
      if ((observedTab?.active ?? tab.active) && wasFocused) {
        state.grace[tabId]={at:observedAt,windowId,source:"favicon"};
      } else {
        await addAttention(state,tabId,"favicon");
        await setupAlarm(state);
      }
    }
  }
  await save(state);
}
async function recordChatRun(message,sender) {
  if (!(await settings()).chatTabsEnabled || sender.frameId!==0 || !isChatTab(sender.url) || !sender.tab?.id) return;
  const tabId=sender.tab.id;
  const state=await read();
  if (message.type==="chatMonitorReady") {
    state.chatMonitors[tabId]=Date.now();
    state.chatDiagnostics[tabId]={status:"Bevakningen anslöt",at:Date.now()};
    await save(state);
    return;
  }
  if (message.type==="chatRunStarted") {
    if (typeof message.runId!=="string" || message.runId.length>100) return;
    state.chatRuns[tabId]={runId:message.runId,at:Date.now()};
    state.chatDiagnostics[tabId]={status:"Stoppa observerad",at:Date.now()};
    delete state.grace[tabId];
    await save(state);
    return;
  }
  const run=state.chatRuns[tabId];
  if (!run || run.runId!==message.runId) return;
  if (message.type==="chatRunResumed") {
    delete run.disappeared;
    state.chatDiagnostics[tabId]={status:"Stoppa återkom",at:Date.now()};
    await save(state);
    return;
  }
  if (message.type==="chatRunDisappeared") {
    const tab=await getTab(tabId);
    if (!tab) return;
    const focused=(await chrome.windows.get(tab.windowId)).focused;
    run.disappeared={at:Date.now(),wasVisible:tab.active && focused,windowId:tab.windowId};
    state.chatDiagnostics[tabId]={status:"Stoppa försvann",at:Date.now()};
    await save(state);
    return;
  }
  const disappeared=run.disappeared;
  if (!disappeared) return;
  delete state.chatRuns[tabId];
  const tab=await getTab(tabId);
  let outcome="Ingen signal";
  if (tab) {
    const focused=(await chrome.windows.get(tab.windowId)).focused;
    const visible=tab.active && focused;
    if (disappeared.wasVisible) {
      if (visible) {
        state.grace[tabId]={at:disappeared.at,windowId:tab.windowId,source:"chatgpt-tab"};
        outcome="Fliken var synlig; ingen signal";
      }
      else if (disappeared.leftAt>=disappeared.at && disappeared.leftAt-disappeared.at<GRACE_MS) {
        await addAttention(state,tabId,"chatgpt-tab"); await setupAlarm(state);
        outcome="Uppmärksamhetssignal startad";
      }
    } else {
      await addAttention(state,tabId,"chatgpt-tab"); await setupAlarm(state);
      outcome="Uppmärksamhetssignal startad";
    }
  }
  state.chatDiagnostics[tabId]={status:outcome,at:Date.now()};
  await save(state);
}
async function markChatLeaving(shouldMark,at) {
  const state=await read();
  let changed=false;
  for (const [id,run] of Object.entries(state.chatRuns)) {
    const candidate=run.disappeared;
    if (candidate?.wasVisible && candidate.leftAt==null && shouldMark(Number(id),candidate)) {
      candidate.leftAt=at;
      changed=true;
    }
  }
  if (changed) await save(state);
}
async function refreshState() {
  const state=await read();
  await reconcile(state);
  await save(state);
  await setupAlarm(state);
  return state;
}

chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if (["chatMonitorReady","chatRunStarted","chatRunDisappeared","chatRunResumed","chatRunEnded"].includes(message?.type)) {
    serial(()=>recordChatRun(message,sender)).then(()=>respond({ok:true}),error=>respond({ok:false,error:String(error)}));
    return true;
  }
  if (!["state","preview","cancelPreview","resume","settings","setSetting"].includes(message?.type) || sender.tab) return false;
  serial(async()=>{
    if (message.type==="state") return {ok:true,state:await refreshState(),settings:await settings()};
    if (message.type==="settings") return {ok:true,settings:await settings()};
    if (message.type==="setSetting") {
      if (!["sidePanelEnabled","chatTabsEnabled"].includes(message.key) || typeof message.value!=="boolean") throw new Error("Ogiltig inställning.");
      if (message.key==="chatTabsEnabled" && message.value && !(await chrome.permissions.contains({origins:[CHAT_ORIGIN]}))) throw new Error("Ge först åtkomst till chatgpt.com.");
      const next={...await settings(),[message.key]:message.value};
      await chrome.storage.local.set({[SETTINGS_KEY]:next});
      if (message.key==="chatTabsEnabled") {
        const state=await read();
        if (!message.value) { state.chatRuns={}; state.chatMonitors={}; }
        await save(state);
        await syncChatScript();
      }
      return {ok:true,settings:next};
    }
    if (message.type==="preview") return {ok:true,state:await startPreview(message.tabId)};
    if (message.type==="cancelPreview") return {ok:true,state:await cancelPreview(message.tabId)};
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
chrome.tabs.onUpdated.addListener((tabId,change,tab)=>{
  if (change.status==="loading") serial(async()=>{
    const state=await read();
    delete state.chatRuns[tabId];
    delete state.chatMonitors[tabId];
    delete state.chatDiagnostics[tabId];
    delete state.signalErrors[tabId];
    await save(state);
  });
  if (change.favIconUrl!==undefined && !isChatTab(tab?.url)) {
    const observedAt=Date.now();
    const observedTab=tab && {active:tab.active,windowId:tab.windowId,url:tab.url};
    const focusedAtEvent=observedTab?.windowId == null ? null
      : chrome.windows.get(observedTab.windowId).then(window=>window.focused,()=>false);
    serial(()=>recordFavicon(tabId,change.favIconUrl,observedAt,observedTab,focusedAtEvent));
  }
  if (change.groupId!==undefined) serial(()=>refreshState());
});
chrome.tabs.onActivated.addListener(({tabId,windowId})=>{
  const activatedAt=Date.now();
  serial(async()=>{
    await markChatLeaving((id,candidate)=>candidate.windowId===windowId && id!==tabId,activatedAt);
    await promoteOnLeaving((id,candidate)=>candidate.windowId===windowId && id!==tabId,activatedAt);
    await acknowledgeVisibleTab(tabId,windowId);
  });
});
chrome.windows.onFocusChanged.addListener(windowId=>{
  const focusedAt=Date.now();
  serial(async()=>{
    await markChatLeaving((_id,candidate)=>windowId===chrome.windows.WINDOW_ID_NONE || candidate.windowId!==windowId,focusedAt);
    await promoteOnLeaving((_id,candidate)=>windowId===chrome.windows.WINDOW_ID_NONE || candidate.windowId!==windowId,focusedAt);
    if (windowId===chrome.windows.WINDOW_ID_NONE) return;
    const [tab]=await chrome.tabs.query({active:true,windowId});
    if (tab) await acknowledgeVisibleTab(tab.id,windowId);
  });
});
chrome.tabs.onRemoved.addListener(tabId=>serial(async()=>{
  const state=await read();
  delete state.tabs[tabId];
  delete state.grace[tabId];
  delete state.testArmed[tabId];
  delete state.chatRuns[tabId];
  delete state.chatMonitors[tabId];
  delete state.chatDiagnostics[tabId];
  delete state.signalErrors[tabId];
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
chrome.permissions.onRemoved.addListener(()=>serial(async()=>{
  if (!(await chrome.permissions.contains({origins:[CHAT_ORIGIN]}))) {
    const next={...await settings(),chatTabsEnabled:false};
    await chrome.storage.local.set({[SETTINGS_KEY]:next});
    const state=await read();
    state.chatRuns={};
    state.chatMonitors={};
    await save(state);
    await syncChatScript();
  }
}));
chrome.runtime.onInstalled.addListener(()=>serial(async()=>{ await refreshState(); await syncChatScript(); }));
chrome.runtime.onStartup.addListener(()=>serial(async()=>{ await refreshState(); await syncChatScript(); }));
serial(async()=>{ await refreshState(); await syncChatScript(); }).catch(console.error);
