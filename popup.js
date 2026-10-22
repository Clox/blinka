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
  $("preview").disabled=tab?.id == null || Boolean(manual);
  $("preview").onclick=()=>run(()=>send({type:"preview",tabId:tab.id}));
  $("previewControls").replaceChildren();
  for (const job of jobs) {
    const row=document.createElement("div");
    row.textContent=job.source==="favicon"
      ? "ChatGPT slutade styra fliken – kontrollera resultatet. "
      : "Simulerad färdigsignal. ";
    const ack=document.createElement("button");
    ack.textContent="Kvittera";
    ack.onclick=()=>run(()=>send({type:"ack",id:job.id}));
    row.append(ack);
    $("previewControls").append(row);
  }
  const groupId=jobs.find(item=>item.groupId>=0)?.groupId;
  const group=groupId == null ? null : state.groups[groupId];
  $("previewStatus").textContent=jobs.length
    ? group?.paused ? "Färgväxlingen pausades efter en annan färgändring." : group ? "Färgväxlingen pågår tills du kvitterar." : "Fliken har lämnat den signalerande gruppen."
    : "Ingen signal att kvittera på denna flik.";
  if (group?.paused) {
    const resume=document.createElement("button");
    resume.textContent="Återuppta färgväxling";
    resume.onclick=()=>run(()=>send({type:"resume",groupId}));
    $("previewControls").append(resume);
  }
}
refresh().catch(error=>$("error").textContent=error.message);
