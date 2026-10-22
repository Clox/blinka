const $ = id => document.getElementById(id);
let activeTab;
async function send(message) { const response = await chrome.runtime.sendMessage(message); if (!response?.ok) throw new Error(response?.error || "Okänt fel"); return response; }
async function refresh() {
  const [tab] = await chrome.tabs.query({active:true,currentWindow:true}); activeTab=tab;
  $("tab").textContent = tab?.id == null ? "Ingen aktiv flik" : `Flik ${tab.id} i fönster ${tab.windowId}`;
  $("add").disabled = tab?.id == null;
  const {state} = await send({type:"state"});
  const jobs = Object.values(state.jobs).filter(j=>j.tabId===tab?.id);
  $("jobs").replaceChildren();
  for (const job of jobs) {
    const li=document.createElement("li"), button=document.createElement("button");
    li.append(`Jobb ${job.id.slice(0,8)} `); button.textContent="Kvittera";
    button.onclick=()=>run(async()=>{await send({type:"ack",id:job.id});}); li.append(button); $("jobs").append(li);
  }
  if (!jobs.length) $("jobs").textContent="Inga väntande jobb på denna flik.";
  const group = tab?.groupId >= 0 ? state.groups[tab.groupId] : null;
  $("group").textContent=group ? `Grupp ${tab.groupId}: ${group.paused ? "Pausad efter yttre färgändring" : "Signal aktiv"}. Ursprung: ${group.baseColor}.` : "Ingen aktiv Blinka-signal i denna grupp.";
  const p=state.probes || {};
  const format = item => item ? `träffar ${item.count}, senast ${new Date(item.at).toLocaleTimeString()}, tabId ${item.tabId ?? "saknas"}, frameId ${item.frameId ?? "saknas"}` : "ingen träff";
  const current=p.regularTabs?.[tab?.id] || (p.regular?.tabId===tab?.id ? p.regular : null);
  const chatgptTab=tab?.url?.startsWith("https://chatgpt.com/");
  $("probeCurrent").textContent=`Den här fliken: ${!chatgptTab ? "inte en vanlig ChatGPT-flik" : current ? `observerad ${new Date(current.at).toLocaleTimeString()}` : "ingen träff; ladda om fliken för kontroll"}`;
  $("probeRegular").textContent=`Alla vanliga ChatGPT-flikar (sparad historik): ${format(p.regular)}`;
  $("probePanel").textContent=`ChatGPT-sidopanelens iframe: ${format(p.panel)}`;
  $("probeOtherFrame").textContent=`Annan inbäddad ChatGPT-ram: ${format(p.otherFrame)}`;
}
async function run(fn) { $("error").textContent=""; try { await fn(); await refresh(); } catch(e) { $("error").textContent=e.message; } }
$("add").onclick=()=>run(()=>send({type:"add",tabId:activeTab.id}));
$("attention").onclick=()=>run(()=>send({type:"attention",windowId:activeTab.windowId}));
refresh().catch(e=>$("error").textContent=e.message);
