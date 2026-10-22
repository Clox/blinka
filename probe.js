// Metadata only: no page content, URLs, cookies, or conversation data.
chrome.runtime.sendMessage({
  type: "probe",
  surface: new URL(location.href).searchParams.get("surface") === "browser_side_chat" ? "browser_side_chat" : "other",
  topFrame: window.top === window
}).catch(() => {});
