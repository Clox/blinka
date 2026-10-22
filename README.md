# Blinka

Blinka är ett fristående Chrome-tillägg (Manifest V3) för att undersöka signaler från ChatGPTs arbete på en webbsida. Version **0.7.1** läser ChatGPTs favicon-markör på vanliga flikar via `chrome.tabs.onUpdated` och har en separat knapp som manuellt begär uppmärksamhet för Chrome-fönstret. Ingen parning, plugin, signalserver eller färgväxling används.

## Vad som är verifierat

När ChatGPT Work i sidopanelen faktiskt arbetar på en webbsida har Blinka sett markören `aktiv` på rätt flik. Användaren har sett detta både när arbetsfliken var öppen och när en annan flik valdes. Efter ett bakgrundsprov stod det `Nu: ingen. Senast: aktiv`.

Blinka läser **inte** sidans DOM, konversationer eller formulär för detta. ChatGPT-tillägget ändrar sidans favicon; Chrome meddelar Blinka om favicon-ändringen tillsammans med `tabId`. Blinka sparar bara märkets typ och tidsstämpel. Det finns ingen polling för denna observation.

`Aktiv` kan hjälpa Blinka att hitta vilken flik ChatGPT arbetar i. Att märket försvinner är **inte** verifierat som `klar`, `väntar på svar`, `avbruten` eller `fel`. Inget slutmärke (`resultat` eller `överlämning`) har observerats i användarens prov. Därför startar Blinka ännu ingen automatisk uppmärksamhetssignal utifrån faviconen.

## Ladda och prova

1. Öppna `chrome://extensions` i Chrome, slå på **Utvecklarläge** och välj **Läs in okomprimerat** med `/home/oscar/projects/blinka`. Om Blinka redan är inläst, klicka **Ladda om** efter uppdateringen.
2. Låt ChatGPT Work i sidopanelen arbeta på en vanlig testflik. Öppna Blinkas popup på den fliken. Under **Agentaktivitet** syns aktuell och senast observerad markör. Tidigare observationer för samma flik sparas lokalt.
3. Klicka **Påkalla fönstrets uppmärksamhet** om du vill prova hur operativsystemet markerar Chrome-fönstret. Detta är ett manuellt prov och har ingen koppling till ChatGPTs status. Effekten på denna Linux-miljö är inte verifierad.

När version 0.7.1 läses in stoppas den gamla färgtimern, kvarvarande testgrupper får sin ursprungsfärg tillbaka om Blinka fortfarande äger den aktuella färgen, och gamla testjobb och parningsuppgifter tas bort ur lokal lagring. En grupp som Blinka skapade kan ligga kvar; den kan avgrupperas manuellt i Chrome. De tillfälliga `tabGroups`- och `alarms`-behörigheterna används endast för denna engångsstädning.

Den tidigare publicerade Cloudflare-testservern, D1-databasen och lokala signaltjänsterna har stängts av; privata Blinka-testpluginer har avinstallerats. Tidigare undersökningar finns kvar i Git-historiken, men ingår inte längre i det aktiva projektet.

## Nästa steg

Använd den verifierade `aktiv`-händelsen för automatisk identifiering av arbetsflik. Undersök separat om en tillförlitlig händelse för användarens uppmärksamhet finns i samma webbläsararbetsflöde. Tolka inte `aktiv → ingen` som ett säkert avslut. Se [UNDERSOKNING.md](UNDERSOKNING.md).
