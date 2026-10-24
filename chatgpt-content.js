// Körs endast efter att användaren aktiverat bevakning av vanliga ChatGPT-flikar.
// Läser ingen chatttext. Observerar bara Stoppa-knappens förekomst.
(() => {
  // En äldre instans kan finnas kvar i en öppen flik efter omladdning av tillägget.
  try { globalThis.__blinkaChatMonitor?.stop(); } catch { delete globalThis.__blinkaChatMonitor; }
  const SELECTOR = 'button[aria-label="Stoppa"],button[aria-label="Stop"],button[aria-label="Stop generating"]';
  const END_DELAY_MS = 900;
  let running = false;
  let runId = null;
  let endTimer = null;
  let observer = null;
  let stopped = false;
  const monitor = {stop};
  function send(message) {
    if (stopped) return false;
    try {
      Promise.resolve(chrome.runtime.sendMessage(message)).catch(() => {});
      return true;
    } catch {
      // Chrome kan ogiltigförklara en gammal innehållsskriptsinstans vid omladdning.
      stop();
      return false;
    }
  }
  function report(type, at) {
    return send({type, runId, at});
  }
  function check() {
    if (stopped) return;
    const hasStop = Boolean(document.querySelector(SELECTOR));
    if (hasStop) {
      if (endTimer) { clearTimeout(endTimer); endTimer = null; if (!report('chatRunResumed', Date.now())) return; }
      if (!running) {
        running = true;
        runId = crypto.randomUUID();
        if (!report('chatRunStarted', Date.now())) return;
      }
    } else if (running && !endTimer) {
      const disappearedAt = Date.now();
      if (!report('chatRunDisappeared', disappearedAt)) return;
      endTimer = setTimeout(() => {
        endTimer = null;
        if (stopped || document.querySelector(SELECTOR)) { check(); return; }
        report('chatRunEnded', disappearedAt);
        running = false;
        runId = null;
      }, END_DELAY_MS);
    }
  }
  function stop() {
    if (stopped) return;
    stopped = true;
    observer?.disconnect();
    if (endTimer) clearTimeout(endTimer);
    try { chrome.runtime.onMessage.removeListener(onMessage); } catch { /* Gammalt tilläggssammanhang. */ }
    if (globalThis.__blinkaChatMonitor === monitor) delete globalThis.__blinkaChatMonitor;
  }
  function onMessage(message,_sender,respond) {
    if (message?.type === 'stopChatMonitor') stop();
    if (message?.type === 'chatMonitorPing') respond({running,stopVisible:Boolean(document.querySelector(SELECTOR))});
  }
  globalThis.__blinkaChatMonitor = monitor;
  try { chrome.runtime.onMessage.addListener(onMessage); } catch { stop(); return; }
  observer = new MutationObserver(check);
  observer.observe(document.documentElement, {childList:true, subtree:true, attributes:true, attributeFilter:['aria-label']});
  if (!send({type:'chatMonitorReady'})) return;
  check();
})();
