# Teknisk undersökning: ChatGPTs sidopanel och Blinka

Senast uppdaterad 2026-10-23. Aktiv Chrome-profil: `Default`. ChatGPT-tillägg: `hehggadaopoacecdllhhajmbjkdcmajg`, version `1.26.1020.11845` enligt profilens `Preferences`. Installationen har bara lästs, aldrig ändrats. Inga cookies, inloggningsuppgifter eller privata konversationer har lästs.

## Vanliga ChatGPT-flikar (version 0.14.0)

I en ny, separat testtråd på `chatgpt.com` visades en knapp med `aria-label="Stoppa"` medan svaret genererades och försvann efteråt. Detta observerades en gång vardera i Chat och Work i den aktuella Chrome-miljön. Det är en DOM-observation, inte ett officiellt statusgränssnitt. En försvunnen knapp kan även bero på avbrott, fel, navigering eller ändrat gränssnitt. Den kan inte ensam skilja `klar` från `väntar på användaren` eller `fel`.

Blinkas nya, separat aktiverbara bevakning begär frivillig värdåtkomst till `https://chatgpt.com/*`. Ett isolerat innehållsskript i huvudramen observerar bara om **Stoppa** finns och skickar `start`, `försvann`, `återkom` och `slut` till Blinkas service worker. Ingen chatttext läses eller skickas. Service workern tar `tabId` från Chromes meddelandeavsändare, inte från sidans innehåll, och använder samma gruppblinkning och kvittering som sidopanelsignalen. Kortare försvinnanden under 900 ms ignoreras. Befintliga ChatGPT-flikar injiceras när användaren aktiverar bevakningen. Frivillig åtkomst behålls i Chrome om reglaget stängs av, men skriptet avregistreras och stoppas. Användaren kan återkalla åtkomsten i Chromes tilläggsinställningar.

I version 0.14.0 infördes automatisk gruppskapning först när en grupplös flik får en uppmärksamhetssignal. Version 0.15.0 anger uttryckligen målflikens fönster vid `chrome.tabs.group()` och visar gruppfel i popupen. Användaren verifierade att 0.15.0 skapar en grupp och blinkar. I version 0.16.0 skapas en ny Blinka-grupp för varje tidigare grupplös flik. En grupp som fliken redan ligger i återanvänds, även om den innehåller andra flikar. Den tidigare regeln om att flytta en annan grupplös flik till en äldre Blinka-grupp har tagits bort. Gruppens basfärg återställs efter kvittering. Popupen pingar innehållsskriptet på den aktuella ChatGPT-fliken och visar om det svarar och om **Stoppa** finns, så att aktivering och detektion kan skiljas från gruppblinkningen. UI-markören kan ändras i framtida ChatGPT-versioner.

Användaren observerade i en äldre delad Blinka-grupp att färgväxlingen fortsatte trots att båda flikarna hade besökts. Färgväxlingen upphörde när popupen öppnades; det tyder på att dess tillståndskontroll kvitterade en kvarvarande signal, men den exakta orsaken är inte verifierad. Version 0.17.0 gör därför en omkontroll 250 ms efter flikaktivering eller fönsterfokus och lägger till en återkommande synlighetskontroll: en väntande signal tas bort om dess flik är aktiv i ett fokuserat Chrome-fönster. Popupen visar antal väntande signaler och flik-ID:n i den aktuella gruppen.

Version 0.18.0 lagrar två valda Chrome-gruppfärger och ett intervall per färg (500–3000 ms i steg om 250 ms). Standardvärdena är röd, gul och 1000 ms. Inställningarna gäller alla Blinka-signaler, även redan pågående signaler. En ny färgkombination målas direkt; en ny hastighet startar om den aktiva intervalltimern. Ursprunglig gruppfärg sparas separat och återställs vid kvittering om ingen annan har ändrat färgen. Chrome stöder bara nio fasta gruppfärger. Bakgrundsprocessens intervalltimer kan avbrytas av MV3-livscykeln; det befintliga 30-sekundersalarmet återupptar den vid behov. Därför är vald hastighet en måltakt, inte en tidsmässig garanti.

## Verifierat

- Sidopanelen består av en tilläggssida som visar `chatgpt.com` i en inbäddad ram. Blinkas gamla innehållsskript nådde vanliga ChatGPT-flikar men gav ingen träff i sidopanelens iframe, trots att panelen var öppen. Det visar utebliven åtkomst i den provade konfigurationen, inte ett allmänt förbud. Iframe-proben är borttagen.
- ChatGPT-tilläggets manifest och bakgrundskod erbjuder inget påvisat externt meddelandegränssnitt för arbetsstatus. Interna meddelanden kontrollerar avsändare från det egna tillägget.
- När ChatGPTs webbläsaragent tar en vanlig flik i arbete injicerar tillägget ibland `content-scripts/codex.js` där. Det ändrar sidans favicon till en SVG-märkt variant. Koden känner lägena `active`, `deliverable` och `handoff`; `active` följer en aktiv agentkoppling till fliken.
- Blinka observerade `active` via `tabs.onUpdated` och `favIconUrl` med rätt `tabId` i användarens verkliga sidopanelsarbetsflöde. Det skedde både när användaren stannade på arbetsfliken och när användaren bytte flik. Efter bakgrundsprovet stod det `Nu: ingen. Senast: aktiv`.
- `deliverable` och `handoff` används bara för särskilt markerade agentflikar; ett slutmärke behålls bara om fliken inte är synlig när turen avslutas. Inget sådant märke sågs i användarens prov. ChatGPT-koden släpper också flikkopplingen vid exempelvis avbruten eller förlorad session. Övergången `active → ingen` visar att agenten inte längre styr fliken, men kan inte ensam avgöra klart, väntan eller fel.
- Ett separat manuellt gruppfärgtest verifierade tidigare färgväxling och återställning efter kvittering. Det testet sa inget om ChatGPTs arbetsstatus.

## Nuvarande avgränsning

Sedan version 0.12.0 startas automatiskt en **kontrollsignal** vid observerad `active → vanlig favicon` på en flik utom synhåll. Om fliken är vald i ett fokuserat fönster undertrycks signalen, men den startar om användaren byter flik eller lämnar Chrome inom en sekund efter övergången. Fram till version 0.13.0 krävdes en befintlig grupp; version 0.14.0 skapar vid behov en Blinka-grupp när signalen behövs. Signalen växlar flikgruppens färg ungefär varje sekund. När användaren väljer fliken, eller återgår till Chrome-fönstret där fliken redan är vald, kvitteras dess väntande signaler. Gruppen slutar blinka när inga flikar i den längre har väntande signaler. Ett MV3-alarm på 30 sekunder är reserv om bakgrundsprocessen avslutas; blinkningen kan då pausa tills den startas om. Signalen börjar inte när `active` visas. En knapp kan förbereda en manuell testsignal som startar först när fliken lämnas. Basfärgen återställs endast om gruppen fortfarande har Blinkas förväntade färg; yttre färgändringar pausar signalen. Knappen för att begära uppmärksamhet för hela Chrome-fönstret är borttagen.

Äldre parnings-, starttext-, MCP-, plugin- och serverlösningar är borttagna ur projektet. Privata Blinka-testpluginer har avinstallerats. Cloudflare Worker `blinka-signal`, dess D1-databas och den lokala användartjänsten har raderats eller stoppats. Git-historiken behåller undersökningsspåren.

Nästa tekniska fråga är hur ofta `active → vanlig favicon` inträffar för tidigt eller uteblir i verkliga jobb, samt om agentens webbläsararbetsflöde ger en mer specifik slut- eller överlämningssignal. Den nuvarande signalen ska tolkas som **kontrollera ChatGPT**, inte som bevis för ett lyckat avslut.

## Källor

- [Chrome: `tabs.onUpdated` och `favIconUrl`](https://developer.chrome.com/docs/extensions/reference/api/tabs#event-onUpdated)
- [Chrome: `tabGroups`](https://developer.chrome.com/docs/extensions/reference/api/tabGroups)
- [Chrome: MV3 service worker-livscykel](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [Chrome: alarm](https://developer.chrome.com/docs/extensions/reference/api/alarms)
