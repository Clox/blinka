// Körs endast efter att användaren aktiverat bevakning av vanliga ChatGPT-flikar.
// Läser ingen chatttext. Observerar bara Stoppa-knappens förekomst.
(() => {
  if (globalThis.__blinkaChatMonitor) return;
  const SELECTOR = 'button[aria-label="Stoppa"],button[aria-label="Stop"],button[aria-label="Stop generating"]';
  const END_DELAY_MS = 900;
  let running = false;
  let runId = null;
  let endTimer = null;
  let observer = null;
  let stopped = false;
  function report(type, at) {
    chrome.runtime.sendMessage({type, runId, at}).catch(() => {});
  }
  function check() {
    if (stopped) return;
    const hasStop = Boolean(document.querySelector(SELECTOR));
    if (hasStop) {
      if (endTimer) { clearTimeout(endTimer); endTimer = null; report('chatRunResumed', Date.now()); }
      if (!running) {
        running = true;
        runId = crypto.randomUUID();
        report('chatRunStarted', Date.now());
      }
    } else if (running && !endTimer) {
      const disappearedAt = Date.now();
      report('chatRunDisappeared', disappearedAt);
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
    stopped = true;
    observer?.disconnect();
    if (endTimer) clearTimeout(endTimer);
    chrome.runtime.onMessage.removeListener(onMessage);
    delete globalThis.__blinkaChatMonitor;
  }
  function onMessage(message,_sender,respond) {
    if (message?.type === 'stopChatMonitor') stop();
    if (message?.type === 'chatMonitorPing') respond({running,stopVisible:Boolean(document.querySelector(SELECTOR))});
  }
  globalThis.__blinkaChatMonitor = {stop};
  chrome.runtime.onMessage.addListener(onMessage);
  observer = new MutationObserver(check);
  observer.observe(document.documentElement, {childList:true, subtree:true, attributes:true, attributeFilter:['aria-label']});
  chrome.runtime.sendMessage({type:'chatMonitorReady'}).catch(() => {});
  check();
})();
