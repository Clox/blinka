# Blinka – kort lägesrapport

*22 oktober 2026*

## Genomfört

- Skapade ett versionshanterat Manifest V3-projekt i `/home/oscar/projects/blinka`.
- Byggde ett manuellt färgprov: starta flera jobb på flikar, växla gruppfärg med Chrome-alarm, kvittera varje jobb och återställ gruppens basfärg när alla jobb i gruppen är kvitterade. Provet använder en befintlig grupp eller skapar/återanvänder en Blinka-grupp. Vid en yttre färgändring pausar Blinka sina egna färgskrivningar.
- Lade till ett separat injektionsprov som endast rapporterar metadata om vanlig ChatGPT-flik respektive inbäddad ram. Ingen konversationstext, cookie eller inloggningsuppgift läses.
- Kontrollerade manifest och JavaScript-syntax lokalt. Användaren har laddat tillägget i Chrome och rapporterat att det mesta i färgprovet fungerar. Samtliga flytt- och fönsterfall är ännu inte bekräftade var för sig.

## Teknisk undersökning

Den aktiva Chrome-profilen är `Default` (Oscar). Installerat ChatGPT-tillägg har ID `hehggadaopoacecdllhhajmbjkdcmajg` och version `1.26.1015.10801`. Installationen lästes utan ändringar.

ChatGPTs sidopanel är en tilläggssida med en iframe som laddar `chatgpt.com` med `surface=browser_side_chat`. ChatGPTs kod kopplar panelkontext till en flik internt, men exponerar ingen verifierad mappning från promptens status till formulärfliken. Tillägget kan skapa, namnge, färga och ta bort flikgrupper när agentflikar används; en gruppändring bevisar därför varken att panelen öppnats eller att ett jobb är färdigt.

Chrome stöder [meddelanden mellan tillägg](https://developer.chrome.com/docs/extensions/develop/concepts/messaging), men den installerade ChatGPT-koden har inga `onMessageExternal` eller `onConnectExternal`. Interna meddelandelyssnare finns, men är inte ett gränssnitt för Blinka. [Chromes panelhändelser](https://developer.chrome.com/docs/extensions/reference/api/sidePanel) gäller det egna tilläggets panel, inte ChatGPTs.

## Resultat av användarens prov

Blinkas innehållsskript rapporterade en träff i en vanlig ChatGPT-flik (`frameId 0`). Det rapporterade **ingen träff från ChatGPTs sidopanelsiframe**, trots att användaren hade panelen öppen från flera flikar. Provet visar att meddelandevägen fungerar i en vanlig flik, men ingen åtkomst till panelens iframe har påvisats. Det bevisar inte att varje tänkbar metod är omöjlig.

## Bedömning och nästa steg

Med de undersökta tilläggs-API:erna finns **ingen verifierad, tillförlitlig automatisk signal** för att ChatGPTs sidopanel öppnats, väntar på användaren, är färdig eller har stannat med fel. Aktivitetspaus och flikgruppsfärg får inte tolkas som färdigstatus. Det manuella färgprovet kan användas separat.

Nästa tekniska steg är ett avsett statusgränssnitt från ChatGPT-tillägget, eller en separat, uttryckligen avgränsad undersökning av andra åtkomstmetoder. Bevakning av vanliga ChatGPT-flikar ska utredas separat från sidopanelen. Fulla källbelägg, instruktioner och begränsningar finns i [UNDERSOKNING.md](UNDERSOKNING.md) och [README.md](README.md).
