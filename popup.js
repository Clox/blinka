const $ = id => document.getElementById(id);
async function refresh() {
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  $("tab").textContent=tab?.id == null ? "Ingen aktiv flik" : `Flik ${tab.id}`;
  $("attention").disabled=tab?.windowId == null;
  $("attention").onclick=async()=>{
    $("error").textContent="";
    $("attentionStatus").textContent="";
    try {
      const result=await chrome.runtime.sendMessage({type:"attention",windowId:tab.windowId});
      if (!result?.ok) throw new Error(result?.error || "Okänt fel");
      $("attentionStatus").textContent="Begärde uppmärksamhet för Chrome-fönstret.";
    } catch(error) { $("error").textContent=error.message; }
  };
  const response=await chrome.runtime.sendMessage({type:"state"});
  if (!response?.ok) throw new Error(response?.error || "Okänt fel");
  const favicon=response.state.tabs[tab?.id];
  const names={active:"aktiv",deliverable:"resultat",handoff:"överlämning"};
  $("faviconProbe").textContent=!favicon?.lastBadge
    ? "Ingen ChatGPT-markör observerad på den här fliken."
    : `Nu: ${names[favicon.current] || "ingen"}. Senast: ${names[favicon.lastBadge]} ${new Date(favicon.lastBadgeAt).toLocaleTimeString()}.`;
}
refresh().catch(error=>$("error").textContent=error.message);
