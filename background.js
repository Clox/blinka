const KEY = "blinkaFaviconV1";
const LEGACY_KEY = "blinkaManualV1";
const LEGACY_ALARM = "blinkaColorTick";
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

async function read() {
  const stored=await chrome.storage.local.get([KEY,LEGACY_KEY]);
  const old=stored[LEGACY_KEY];
  if (!old && stored[KEY]) return stored[KEY];
  for (const [id,record] of Object.entries(old?.groups || {})) {
    let group;
    try { group=await chrome.tabGroups.get(Number(id)); } catch { continue; }
    if (!record.paused && group.color===record.expected && record.baseColor) {
      await chrome.tabGroups.update(Number(id),{color:record.baseColor});
    }
  }
  await chrome.alarms.clear(LEGACY_ALARM);
  const state={tabs:stored[KEY]?.tabs || old?.probes?.faviconTabs || {}};
  await chrome.storage.local.set({[KEY]:state});
  if (old) await chrome.storage.local.remove(LEGACY_KEY);
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
  await chrome.storage.local.set({[KEY]:state});
}

chrome.runtime.onMessage.addListener((message,_sender,respond)=>{
  if (message?.type!=="state" && message?.type!=="attention") return false;
  serial(async()=>{
    if (message.type==="state") return {ok:true,state:await read()};
    if (!Number.isSafeInteger(message.windowId)) throw new Error("Ogiltigt fönster-ID.");
    await chrome.windows.update(message.windowId,{drawAttention:true});
    return {ok:true};
  })
    .then(respond,error=>respond({ok:false,error:String(error?.message || error)}));
  return true;
});
chrome.tabs.onUpdated.addListener((tabId,change)=>{
  if (change.favIconUrl!==undefined) serial(()=>recordFavicon(tabId,change.favIconUrl));
});
chrome.tabs.onRemoved.addListener(tabId=>serial(async()=>{
  const state=await read();
  if (!(tabId in state.tabs)) return;
  delete state.tabs[tabId];
  await chrome.storage.local.set({[KEY]:state});
}));
chrome.runtime.onInstalled.addListener(()=>serial(()=>read()));
chrome.runtime.onStartup.addListener(()=>serial(()=>read()));
