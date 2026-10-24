const $ = id => document.getElementById(id);
const popupPort=chrome.runtime.connect({name:"blinka-popup"});
let currentBlinkColors={colorA:"red",colorB:"yellow"};
function validSpeed(value) {
  const ms=Number(value);
  return Number.isInteger(ms) && ms>=500 && ms<=3000 && ms%250===0 ? ms : 1000;
}
function showSpeed(ms) { $("blinkSpeedValue").textContent=`${(validSpeed(ms)/1000).toLocaleString("sv-SE")} s`; }
function selectedColor(name) { return document.querySelector(`input[name="${name}"]:checked`).value; }
function showColor(name,color) { document.querySelector(`input[name="${name}"][value="${color}"]`).checked=true; }
async function send(message) {
  const response=await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || "Okänt fel");
  return response;
}
async function run(fn) {
  $("error").textContent="";
  try { await fn(); }
  catch(error) { $("error").textContent=error.message; }
  await refresh().catch(error=>$("error").textContent=error.message);
}
async function refresh() {
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  $("tab").textContent=tab?.id == null ? "Ingen aktiv flik" : `Flik ${tab.id}`;
  const {state,settings}=await send({type:"state"});
  $("sidePanelEnabled").checked=settings.sidePanelEnabled;
  $("chatTabsEnabled").checked=settings.chatTabsEnabled;
  currentBlinkColors={colorA:settings.blinkColorA || "red",colorB:settings.blinkColorB || "yellow"};
  showColor("blinkColorA",currentBlinkColors.colorA);
  showColor("blinkColorB",currentBlinkColors.colorB);
  const speed=validSpeed(settings.blinkIntervalMs);
  $("blinkSpeed").value=speed;
  showSpeed(speed);
  const favicon=state.tabs[tab?.id];
  const names={active:"aktiv",deliverable:"resultat",handoff:"överlämning"};
  const chatTab=tab?.url?.startsWith("https://chatgpt.com/");
  let monitor=null;
  if (chatTab && settings.chatTabsEnabled) {
    try { monitor=await chrome.tabs.sendMessage(tab.id,{type:"chatMonitorPing"}); } catch { /* Skriptet körs inte på fliken. */ }
  }
  $("faviconProbe").textContent=chatTab
    ? !settings.chatTabsEnabled ? "Bevakning av vanliga ChatGPT-flikar är avstängd."
      : !monitor ? "Bevakningen har inte anslutit till den här fliken. Ladda om ChatGPT-fliken."
      : monitor.stopVisible ? "Stoppa-knappen finns: körning pågår eller avslutas."
      : state.chatRuns?.[tab.id] ? "Stoppa-knappen har försvunnit; Blinka väntar kort innan signalen." : "Bevakningen är aktiv. Ingen Stoppa-knapp finns just nu."
    : !favicon?.lastBadge
      ? "Ingen ChatGPT-markör observerad på den här fliken."
      : `Nu: ${names[favicon.current] || "ingen"}. Senast: ${names[favicon.lastBadge]} ${new Date(favicon.lastBadgeAt).toLocaleTimeString()}.`;
  $("faviconNote").textContent=chatTab
    ? `${state.signalErrors?.[tab.id] ? `Gruppfel: ${state.signalErrors[tab.id].message}. ` : ""}${state.chatDiagnostics?.[tab.id] ? `Senast: ${state.chatDiagnostics[tab.id].status} ${new Date(state.chatDiagnostics[tab.id].at).toLocaleTimeString()}. ` : ""}När Stoppa försvinner kan tråden behöva kontrolleras. Det bevisar inte att svaret är färdigt.`
    : "Resultat eller överlämning ger signal direkt. Om aktiv-märket försvinner väntar Blinka 10 sekunder utan märke innan en osäker kontrollsignal. Om aktiv återkommer upphör reservsignalen. Ett längre uppehåll bevisar inte att jobbet är klart.";
  const history=Array.isArray(favicon?.history) ? favicon.history : [];
  $("faviconHistoryDetails").hidden=chatTab || history.length===0;
  $("faviconHistory").textContent=history.slice().reverse().map(entry=>{
    const date=new Date(entry.at);
    const time=[date.getHours(),date.getMinutes(),date.getSeconds()].map(part=>String(part).padStart(2,"0")).join(":")+
      `.${String(date.getMilliseconds()).padStart(3,"0")}`;
    return `${names[entry.badge] || "inget ChatGPT-märke"}  ${time}`;
  }).join("\n");
  const jobs=Object.values(state.previews).filter(item=>item.tabId===tab?.id);
  const manual=jobs.find(item=>item.source==="manual");
  const armed=Boolean(state.testArmed?.[tab?.id]);
  const pending=Boolean(state.pendingAttention?.[tab?.id]);
  $("preview").disabled=tab?.id == null || Boolean(manual);
  $("preview").textContent=armed ? "Avbryt testsignal" : "Förbered manuell testsignal";
  $("preview").onclick=()=>run(()=>send({type:armed ? "cancelPreview" : "preview",tabId:tab.id}));
  $("previewControls").replaceChildren();
  const groupId=jobs.find(item=>item.groupId>=0)?.groupId;
  const group=groupId == null ? null : state.groups[groupId];
  $("previewStatus").textContent=jobs.length
    ? group?.paused ? "Färgväxlingen pausades efter en annan färgändring." : group ? "Den här fliken har en väntande signal. Välj en annan flik och kom tillbaka för att kvittera." : "Fliken har lämnat den signalerande gruppen."
    : armed ? "Testsignalen startar när du lämnar fliken. Välj tillbaka för att stoppa den."
    : pending ? "Chrome tillåter inte gruppändring just nu. Blinka provar igen när fliken går att ändra."
    : tab?.groupId<0 ? "Fliken saknar grupp. Blinka skapar en när fliken behöver uppmärksamhet."
    : "Ingen väntande signal på denna flik.";
  const groupJobs=Object.values(state.previews).filter(item=>item.groupId===tab?.groupId);
  $("groupStatus").textContent=tab?.groupId>=0
    ? `Väntande signaler i gruppen: ${groupJobs.length}${groupJobs.length ? ` (flik ${[...new Set(groupJobs.map(item=>item.tabId))].join(", ")})` : ""}.`
    : "";
  if (group?.paused) {
    const resume=document.createElement("button");
    resume.textContent="Återuppta färgväxling";
    resume.onclick=()=>run(()=>send({type:"resume",groupId}));
    $("previewControls").append(resume);
  }
}
$("sidePanelEnabled").onchange=()=>run(()=>send({type:"setSetting",key:"sidePanelEnabled",value:$("sidePanelEnabled").checked}));
$("chatTabsEnabled").onchange=()=>run(async()=>{
  const value=$("chatTabsEnabled").checked;
  if (value) {
    const granted=await chrome.permissions.request({origins:["https://chatgpt.com/*"]});
    if (!granted) throw new Error("Åtkomst till chatgpt.com nekades.");
  }
  await send({type:"setSetting",key:"chatTabsEnabled",value});
});
$("blinkColorA").onchange=()=>run(()=>{
  const colorA=selectedColor("blinkColorA");
  const colorB=colorA===selectedColor("blinkColorB") ? currentBlinkColors.colorA : selectedColor("blinkColorB");
  return send({type:"setBlinkColors",colorA,colorB});
});
$("blinkColorB").onchange=()=>run(()=>{
  const colorB=selectedColor("blinkColorB");
  const colorA=colorB===selectedColor("blinkColorA") ? currentBlinkColors.colorB : selectedColor("blinkColorA");
  return send({type:"setBlinkColors",colorA,colorB});
});
$("blinkSpeed").oninput=()=>showSpeed(Number($("blinkSpeed").value));
$("blinkSpeed").onchange=()=>run(()=>{
  const speed=validSpeed($("blinkSpeed").value);
  $("blinkSpeed").value=speed;
  showSpeed(speed);
  return send({type:"setSetting",key:"blinkIntervalMs",value:speed});
});
refresh().catch(error=>$("error").textContent=error.message);
