# Teknisk undersökning: ChatGPTs sidopanel och Blinka

Senast uppdaterad 2026-10-23. Aktiv Chrome-profil: `Default`. ChatGPT-tillägg: `hehggadaopoacecdllhhajmbjkdcmajg`, version `1.26.1020.11845` enligt profilens `Preferences`. Installationen har bara lästs, aldrig ändrats. Inga cookies, inloggningsuppgifter eller privata konversationer har lästs.

## Verifierat

- Sidopanelen består av en tilläggssida som visar `chatgpt.com` i en inbäddad ram. Blinkas gamla innehållsskript nådde vanliga ChatGPT-flikar men gav ingen träff i sidopanelens iframe, trots att panelen var öppen. Detta visar utebliven åtkomst i den provade konfigurationen, inte ett allmänt bevis för att varje tänkbar metod är omöjlig. Den gamla iframe-proben är borttagen ur Blinka 0.6.0.
- ChatGPT-tilläggets manifest och bakgrundskod erbjuder inget påvisat externt meddelandegränssnitt för arbetsstatus. Interna meddelanden kontrollerar avsändare från det egna tillägget. Chrome stöder kommunikation mellan tillägg, men det skapar inte ett protokoll som ChatGPT-tillägget inte erbjuder.
- När ChatGPTs webbläsaragent tar en vanlig flik i arbete kan tillägget injicera `content-scripts/codex.js` där. Det ändrar sidans favicon till en SVG-märkt variant. Koden använder lägena `active`, `deliverable` och `handoff`; bakgrundskoden härleder `active` från en aktiv agentkoppling till fliken.
- Blinka 0.5.1 observerade `active` via `tabs.onUpdated` och `favIconUrl` med rätt `tabId` i användarens verkliga sidopanelsarbetsflöde. Detta skedde både när användaren stannade på arbetsfliken och när användaren bytte flik. I det senare fallet visade popupen efteråt `Nu: ingen. Senast: aktiv`.
- ChatGPTs `deliverable`/`handoff` används bara för särskilt markerade agentflikar, och ett slutmärke behålls bara om fliken inte är synlig när turen avslutas. Inget sådant märke sågs i användarens prov. Övergången `active → ingen` är inte en säker signal för klart, väntan eller fel.
- Det manuella färgtestet har tidigare verifierats: flera väntande jobb i samma grupp håller signalen aktiv tills alla kvitteras; basfärgen återställs efteråt. MV3-alarm driver färgväxlingen, så den är inte kontinuerlig i millisekundskala. Yttre färgändring pausar testet för att undvika skrivkonflikt med användaren eller ChatGPT.

## Beslut i version 0.6.0

Parning av flik till extern server, kopierad starttext, MCP-plugin, modellrapporterade statuslägen och signalserver har tagits bort. Privata Blinka-testpluginer har avinstallerats. Cloudflare Worker `blinka-signal` och D1-databasen med samma namn har raderats; den lokala användartjänsten `blinka-signal.service` har stoppats och tagits bort. Historiken finns i Git om en framtida undersökning behöver jämföra metoder.

Blinka observerar nu endast favicon-markören och ger ett separat manuellt färgtest. Den gör **ingen automatisk bedömning av färdig uppgift**. Nästa tekniska fråga är om agentens webbläsararbetsflöde ger en mer specifik, observerbar slut- eller överlämningssignal. En paus eller försvunnen `active`-markör räcker inte som bevis.

## Källor

- [Chrome: `tabs.onUpdated` och `favIconUrl`](https://developer.chrome.com/docs/extensions/reference/api/tabs#event-onUpdated)
- [Chrome: innehållsskript](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Chrome: MV3 service worker-livscykel](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [Chrome: alarm](https://developer.chrome.com/docs/extensions/reference/api/alarms)
