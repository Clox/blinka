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
  const preview=Object.values(state.previews).find(item=>item.tabId===tab?.id);
  $("preview").disabled=tab?.id == null || Boolean(preview);
  $("preview").onclick=()=>run(()=>send({type:"preview",tabId:tab.id}));
  $("previewControls").replaceChildren();
  if (preview) {
    const ack=document.createElement("button");
    ack.textContent="Kvittera simulering";
    ack.onclick=()=>run(()=>send({type:"ack",id:preview.id}));
    $("previewControls").append(ack);
  }
  const group=preview?.groupId>=0 ? state.groups[preview.groupId] : null;
  $("previewStatus").textContent=preview
    ? group?.paused ? "Färgväxlingen pausades efter en annan färgändring." : group ? "Färgväxlingen pågår tills du kvitterar." : "Fliken har lämnat den signalerande gruppen."
    : "Ingen simulering på denna flik.";
  if (group?.paused) {
    const resume=document.createElement("button");
    resume.textContent="Återuppta färgväxling";
    resume.onclick=()=>run(()=>send({type:"resume",groupId:preview.groupId}));
    $("previewControls").append(resume);
  }
}
refresh().catch(error=>$("error").textContent=error.message);
