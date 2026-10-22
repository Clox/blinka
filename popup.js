const $ = id => document.getElementById(id);
let activeTab;
async function send(message) {
  const response=await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || "Okänt fel");
  return response;
}
async function refresh() {
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  activeTab=tab;
  $("tab").textContent=tab?.id == null ? "Ingen aktiv flik" : `Flik ${tab.id} i fönster ${tab.windowId}`;
  $("add").disabled=tab?.id == null;
  $("attention").disabled=tab?.windowId == null;
  const {state}=await send({type:"state"});
  const favicon=state.probes?.faviconTabs?.[tab?.id];
  const names={active:"aktiv",deliverable:"resultat",handoff:"överlämning"};
  $("faviconProbe").textContent=!favicon?.lastBadge
    ? "Ingen ChatGPT-markör observerad på den här fliken."
    : `Nu: ${names[favicon.current] || "ingen"}. Senast: ${names[favicon.lastBadge]} ${new Date(favicon.lastBadgeAt).toLocaleTimeString()}.`;
  const jobs=Object.values(state.jobs).filter(job=>job.tabId===tab?.id);
  $("jobs").replaceChildren();
  for (const job of jobs) {
    const li=document.createElement("li"), button=document.createElement("button");
    li.append(`Testjobb ${job.id.slice(0,8)} `);
    button.textContent="Kvittera";
    button.onclick=()=>run(()=>send({type:"ack",id:job.id}));
    li.append(button);
    $("jobs").append(li);
  }
  if (!jobs.length) $("jobs").textContent="Inga väntande testjobb på denna flik.";
  const group=tab?.groupId >= 0 ? state.groups[tab.groupId] : null;
  $("group").replaceChildren();
  $("group").append(group
    ? `Grupp ${tab.groupId}: ${group.paused ? "Pausad efter färgändring" : "Signal aktiv"}. Ursprung: ${group.baseColor}.`
    : "Ingen aktiv Blinka-signal i denna grupp.");
  if (group?.paused) {
    const button=document.createElement("button");
    button.textContent="Återuppta signal";
    button.onclick=()=>run(()=>send({type:"resume",groupId:tab.groupId}));
    $("group").append(document.createElement("br"),button);
  }
}
async function run(fn) {
  $("error").textContent="";
  try { await fn(); await refresh(); }
  catch(error) { $("error").textContent=error.message; }
}
$("add").onclick=()=>run(()=>send({type:"add",tabId:activeTab.id}));
$("attention").onclick=()=>run(()=>send({type:"attention",windowId:activeTab.windowId}));
refresh().catch(error=>$("error").textContent=error.message);
