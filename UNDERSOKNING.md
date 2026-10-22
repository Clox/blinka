# Teknisk undersökning: ChatGPTs sidopanel och Blinka

Senast uppdaterad 2026-10-23. Aktiv Chrome-profil: `Default`. ChatGPT-tillägg: `hehggadaopoacecdllhhajmbjkdcmajg`, version `1.26.1020.11845` enligt profilens `Preferences`. Installationen har bara lästs, aldrig ändrats. Inga cookies, inloggningsuppgifter eller privata konversationer har lästs.

## Verifierat

- Sidopanelen består av en tilläggssida som visar `chatgpt.com` i en inbäddad ram. Blinkas gamla innehållsskript nådde vanliga ChatGPT-flikar men gav ingen träff i sidopanelens iframe, trots att panelen var öppen. Det visar utebliven åtkomst i den provade konfigurationen, inte ett allmänt förbud. Iframe-proben är borttagen.
- ChatGPT-tilläggets manifest och bakgrundskod erbjuder inget påvisat externt meddelandegränssnitt för arbetsstatus. Interna meddelanden kontrollerar avsändare från det egna tillägget.
- När ChatGPTs webbläsaragent tar en vanlig flik i arbete injicerar tillägget ibland `content-scripts/codex.js` där. Det ändrar sidans favicon till en SVG-märkt variant. Koden känner lägena `active`, `deliverable` och `handoff`; `active` följer en aktiv agentkoppling till fliken.
- Blinka observerade `active` via `tabs.onUpdated` och `favIconUrl` med rätt `tabId` i användarens verkliga sidopanelsarbetsflöde. Det skedde både när användaren stannade på arbetsfliken och när användaren bytte flik. Efter bakgrundsprovet stod det `Nu: ingen. Senast: aktiv`.
- `deliverable` och `handoff` används bara för särskilt markerade agentflikar; ett slutmärke behålls bara om fliken inte är synlig när turen avslutas. Inget sådant märke sågs i användarens prov. Övergången `active → ingen` får inte ensam tolkas som klart, väntan eller fel.
- Ett separat manuellt gruppfärgtest verifierade tidigare färgväxling och återställning efter kvittering. Det testet sa inget om ChatGPTs arbetsstatus.

## Nuvarande avgränsning

Version 0.8.0 har kvar favicon-observationen och en knapp för att **manuellt simulera hur en framtida färdigsignal skulle se ut**. Simuleringen börjar bara vid knapptryck, växlar flikgruppens färg via MV3-alarm och slutar först vid kvittering. Den aktiveras inte av `active`, `active → ingen` eller någon annan favicon-händelse. Basfärgen återställs endast om gruppen fortfarande har Blinkas förväntade färg; yttre färgändringar pausar signalen. Knappen för att begära uppmärksamhet för hela Chrome-fönstret är borttagen.

Äldre parnings-, starttext-, MCP-, plugin- och serverlösningar är borttagna ur projektet. Privata Blinka-testpluginer har avinstallerats. Cloudflare Worker `blinka-signal`, dess D1-databas och den lokala användartjänsten har raderats eller stoppats. Git-historiken behåller undersökningsspåren.

Nästa tekniska fråga är om agentens webbläsararbetsflöde ger en mer specifik, observerbar slut- eller överlämningssignal. Tills dess förblir färdigsignalen en manuell förhandsvisning.

## Källor

- [Chrome: `tabs.onUpdated` och `favIconUrl`](https://developer.chrome.com/docs/extensions/reference/api/tabs#event-onUpdated)
- [Chrome: `tabGroups`](https://developer.chrome.com/docs/extensions/reference/api/tabGroups)
- [Chrome: MV3 service worker-livscykel](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [Chrome: alarm](https://developer.chrome.com/docs/extensions/reference/api/alarms)
