const $ = id => document.getElementById(id);
const STATUS_LABELS = {
  klar: "Klart",
  vantar_pa_svar: "Väntar på svar",
  vantar_pa_godkannande: "Väntar på godkännande",
  avbruten: "Avbrutet",
  fel: "Fel",
};
let activeTab;
async function send(message) { const response = await chrome.runtime.sendMessage(message); if (!response?.ok) throw new Error(response?.error || "Okänt fel"); return response; }
async function refresh() {
  const [tab] = await chrome.tabs.query({active:true,currentWindow:true}); activeTab=tab;
  const savedEndpoint=await chrome.storage.local.get("blinkaEndpoint");
  if (savedEndpoint.blinkaEndpoint && !$('endpoint').value) $('endpoint').value=savedEndpoint.blinkaEndpoint;
  $("tab").textContent = tab?.id == null ? "Ingen aktiv flik" : `Flik ${tab.id} i fönster ${tab.windowId}`;
  $("add").disabled = tab?.id == null;
  $("pair").disabled = tab?.id == null;
  const {state} = await send({type:"state"});
  $("pairs").replaceChildren();
  const pairs=Object.values(state.pairs||{}).filter(p=>p.tabId===tab?.id);
  for (const pair of pairs) {
    const li=document.createElement("li"), id=document.createElement("span"), button=document.createElement("button");
    id.className="code"; id.textContent=pair.pairId;
    button.textContent="Kopiera parnings-ID";
    button.onclick=()=>run(async()=>{await navigator.clipboard.writeText(pair.pairId);});
    li.append("Parnings-ID: ",id,document.createElement("br"),button); $("pairs").append(li);
  }
  if (!pairs.length) $("pairs").textContent="Ingen väntande parning på denna flik.";
  const last=state.lastRemoteSignal;
  $("lastSignal").textContent=last ? `Senaste MCP-signal: ${STATUS_LABELS[last.lage] ? `${STATUS_LABELS[last.lage]}, ` : ""}flik ${last.tabId}, ${new Date(last.at).toLocaleTimeString()}.` : "Ingen MCP-signal mottagen av Blinka ännu.";
  const jobs = Object.values(state.jobs).filter(j=>j.tabId===tab?.id);
  $("jobs").replaceChildren();
  for (const job of jobs) {
    const li=document.createElement("li"), button=document.createElement("button");
    li.append(`Jobb ${job.id.slice(0,8)}${job.source==="plugin" ? ` (MCP${STATUS_LABELS[job.lage] ? `: ${STATUS_LABELS[job.lage]}` : ""})` : ""} `); button.textContent="Kvittera";
    button.onclick=()=>run(async()=>{await send({type:"ack",id:job.id});}); li.append(button); $("jobs").append(li);
  }
  if (!jobs.length) $("jobs").textContent="Inga väntande jobb på denna flik.";
  const group = tab?.groupId >= 0 ? state.groups[tab.groupId] : null;
  $("group").replaceChildren();
  $("group").append(group ? `Grupp ${tab.groupId}: ${group.paused ? "Pausad efter färgändring" : "Signal aktiv"}. Ursprung: ${group.baseColor}.` : "Ingen aktiv Blinka-signal i denna grupp.");
  if (group?.paused) {
    const button=document.createElement("button"); button.textContent="Återuppta signal";
    button.onclick=()=>run(()=>send({type:"resume",groupId:tab.groupId}));
    $("group").append(document.createElement("br"),button);
  }
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
$("pair").onclick=()=>run(async()=>{
  const url=new URL($("endpoint").value);
  if (url.protocol!=="https:" || !url.hostname.endsWith(".trycloudflare.com")) throw new Error("Ange testtunnelns HTTPS-adress.");
  const origin=url.origin;
  const granted=await chrome.permissions.request({origins:[`${origin}/*`]});
  if (!granted) throw new Error("Blinka behöver tillåtelse att nå testservern.");
  await chrome.storage.local.set({blinkaEndpoint:origin});
  await send({type:"pair",tabId:activeTab.id,origin});
});
$("attention").onclick=()=>run(()=>send({type:"attention",windowId:activeTab.windowId}));
refresh().catch(e=>$("error").textContent=e.message);
