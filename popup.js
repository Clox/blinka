const $ = id => document.getElementById(id);
async function send(message) {
  const response=await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || "Okänt fel");
  return response;
}
async function run(fn) {
  $("error").textContent="";
  try { await fn(); await refresh(); }
  catch(error) { $("error").textContent=error.message; }
}
async function refresh() {
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  $("tab").textContent=tab?.id == null ? "Ingen aktiv flik" : `Flik ${tab.id}`;
  const {state}=await send({type:"state"});
  const favicon=state.tabs[tab?.id];
  const names={active:"aktiv",deliverable:"resultat",handoff:"överlämning"};
  $("faviconProbe").textContent=!favicon?.lastBadge
    ? "Ingen ChatGPT-markör observerad på den här fliken."
    : `Nu: ${names[favicon.current] || "ingen"}. Senast: ${names[favicon.lastBadge]} ${new Date(favicon.lastBadgeAt).toLocaleTimeString()}.`;
  const jobs=Object.values(state.previews).filter(item=>item.tabId===tab?.id);
  const manual=jobs.find(item=>item.source!=="favicon");
  const armed=Boolean(state.testArmed?.[tab?.id]);
  $("preview").disabled=tab?.id == null || tab.groupId<0 || Boolean(manual);
  $("preview").textContent=armed ? "Avbryt testsignal" : "Förbered manuell testsignal";
  $("preview").onclick=()=>run(()=>send({type:armed ? "cancelPreview" : "preview",tabId:tab.id}));
  $("previewControls").replaceChildren();
  const groupId=jobs.find(item=>item.groupId>=0)?.groupId;
  const group=groupId == null ? null : state.groups[groupId];
  $("previewStatus").textContent=jobs.length
    ? group?.paused ? "Färgväxlingen pausades efter en annan färgändring." : group ? "Den här fliken har en väntande signal. Välj en annan flik och kom tillbaka för att kvittera." : "Fliken har lämnat den signalerande gruppen."
    : armed ? "Testsignalen startar när du lämnar fliken. Välj tillbaka för att stoppa den."
    : tab?.groupId<0 ? "Fliken saknar grupp. Blinka skapar ingen grupp automatiskt."
    : "Ingen väntande signal på denna flik.";
  if (group?.paused) {
    const resume=document.createElement("button");
    resume.textContent="Återuppta färgväxling";
    resume.onclick=()=>run(()=>send({type:"resume",groupId}));
    $("previewControls").append(resume);
  }
}
refresh().catch(error=>$("error").textContent=error.message);
