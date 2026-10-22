const $ = id => document.getElementById(id);
const STATUS_LABELS = {
  klar: "Klart",
  vantar_pa_svar: "Väntar på svar",
  vantar_pa_godkannande: "Väntar på godkännande",
  avbruten: "Avbrutet",
  fel: "Fel",
};
const DEFAULT_ENDPOINT = "https://blinka-signal.blinka-signal-worker.workers.dev";
let activeTab;
async function send(message) { const response = await chrome.runtime.sendMessage(message); if (!response?.ok) throw new Error(response?.error || "Okänt fel"); return response; }
async function refresh() {
  const [tab] = await chrome.tabs.query({active:true,currentWindow:true}); activeTab=tab;
  if (!$('endpoint').value) $('endpoint').value=DEFAULT_ENDPOINT;
  $("tab").textContent = tab?.id == null ? "Ingen aktiv flik" : `Flik ${tab.id} i fönster ${tab.windowId}`;
  $("add").disabled = tab?.id == null;
  const {state} = await send({type:"state"});
  $("pairs").replaceChildren();
  const pairs=Object.values(state.pairs||{}).filter(p=>p.tabId===tab?.id);
  $("pair").disabled = tab?.id == null || pairs.length>0;
  $("pair").textContent = pairs.length ? "Fliken är parad" : "Para denna flik";
  $("pairHint").textContent = pairs.length && pairs.some(p=>p.origin!==DEFAULT_ENDPOINT)
    ? "Den här fliken har en äldre eller egen parning. Avsluta den innan du parar mot Blinka signal."
    : "";
  for (const pair of pairs) {
    const li=document.createElement("li"), id=document.createElement("span"), button=document.createElement("button"), stop=document.createElement("button");
    id.className="code"; id.textContent=pair.pairId;
    button.textContent="Kopiera starttext";
    button.onclick=()=>run(async()=>{await navigator.clipboard.writeText(`Mitt Blinka-parnings-ID är ${pair.pairId}. `);});
    stop.textContent="Avsluta parning";
    stop.onclick=()=>run(()=>send({type:"unpair",pairId:pair.pairId}));
    li.append(`Server: ${new URL(pair.origin).hostname}`,document.createElement("br"),"Parnings-ID: ",id,document.createElement("br"),button,stop); $("pairs").append(li);
  }
  if (!pairs.length) $("pairs").textContent="Ingen aktiv parning på denna flik.";
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
  if (url.protocol!=="https:" || !url.hostname || url.username || url.password || url.search || url.hash || !["/","/mcp"].includes(url.pathname)) throw new Error("Ange serverns HTTPS-adress, eventuellt med /mcp.");
  const origin=url.origin;
  const granted=await chrome.permissions.request({origins:[`${origin}/*`]});
  if (!granted) throw new Error("Blinka behöver tillåtelse att nå signalservern.");
  await send({type:"pair",tabId:activeTab.id,origin});
});
$("attention").onclick=()=>run(()=>send({type:"attention",windowId:activeTab.windowId}));
refresh().catch(e=>$("error").textContent=e.message);
