# Blinka

Blinka är ett fristående Chrome-tillägg (Manifest V3) som observerar när ChatGPT Work arbetar på en vanlig webbsida. Version **0.12.0** använder övergången från aktivitetsmärke till vanlig favicon som en **signal om att kontrollera ChatGPT** när den grupperade fliken inte är synlig. Signalen kvitteras när fliken väljs. En knapp kan förbereda en manuell testsignal. Ingen parning, plugin eller signalserver används.

## Vad som är verifierat

När ChatGPT Work i sidopanelen faktiskt arbetar på en webbsida har Blinka sett favicon-markören `aktiv` på rätt flik, både när användaren stannade på fliken och när en annan flik valdes. Blinka läser inte sidans DOM, konversationer eller formulär. Chrome skickar favicon-ändringen tillsammans med `tabId` till `chrome.tabs.onUpdated`; Blinka sparar bara märkets typ och tidsstämpel.

När markören försvinner efter `aktiv` startar Blinka en färgsignal på rätt flikgrupp om fliken inte är synlig. Om den redan är vald i ett fokuserat Chrome-fönster startar normalt ingen signal. Om du lämnar fliken eller fönstret inom en sekund efter favicon-övergången startar signalen ändå. Denna tidsregel är ännu **inte praktiskt verifierad i Chrome för version 0.12.0**. Övergången är heller inte en säker status för `klar`, `väntar på svar`, `avbruten` eller `fel`: ChatGPTs lokala tilläggskod kan släppa fliken av flera skäl. Inget slutmärke (`resultat` eller `överlämning`) har observerats i användarens prov.

## Ladda och prova

1. Öppna `chrome://extensions` i Chrome. Ladda `/home/oscar/projects/blinka` som okomprimerat tillägg, eller klicka **Ladda om** om Blinka redan är installerat.
2. Låt ChatGPT Work arbeta på en flik som redan ingår i en grupp. Blinkas popup visar aktuell och senast observerad favicon-markör under **Agentaktivitet**. Om `aktiv` återgår till vanlig favicon när du är på en annan flik eller i ett annat program ska gruppen börja blinka.
3. Välj fliken som signalerar. Alla väntande signaler på just den fliken kvitteras. När ingen flik i gruppen längre signalerar återställs gruppens ursprungliga färg. Att återgå till Chrome-fönstret med fliken redan vald kvitterar också.
4. **Förbered manuell testsignal** startar en färgväxling när du lämnar fliken. Välj fliken igen för att stoppa den. Du kan avbryta förberedelsen i popupen innan du lämnar fliken. Knappen är avstängd på flikar utan grupp.

Ingen signal startas bara för att ChatGPT börjar arbeta. Varje observerad `aktiv → vanlig favicon` på en grupperad flik som inte är synlig kan skapa en signal, även om föregående signal ännu inte är kvitterad. Blinka skapar inte grupper för flikar utan grupp. Testknappen förbereder ett separat manuellt test som startar först när fliken lämnas. Flera flikar i samma grupp kvitteras var för sig; gruppen blinkar tills den sista väntande fliken har valts. Om användaren eller ett annat tillägg ändrar gruppfärgen pausar Blinka färgväxlingen för att undvika en skrivkonflikt. Under en aktiv signal växlar färgen ungefär varje sekund. Ett MV3-alarm var 30:e sekund återstartar den snabba växlingen om bakgrundsprocessen avslutas oväntat. Därför kan en kort paus uppstå, och frekvensen är inte garanterad när Chrome eller datorn sover.

Vid uppdatering från en äldre version återställs gamla testsignaler bara om gruppen fortfarande har den färg Blinka senast satte. Redan väntande signaler från föregående version kvitteras också vid flikval. En Blinka-grupp kan ligga kvar efter kvittering och avgrupperas i Chrome. Tidigare server- och pluginexperiment finns kvar i Git-historiken men används inte längre.

## Nästa steg

Prova övergången med ett verkligt sidopanelsjobb, både när du är kvar på fliken och när du arbetar i en annan flik. Kontrollera om signalen någon gång kommer för tidigt eller uteblir. En mer specifik statuskälla behövs fortfarande för att skilja avslut, väntan och fel. Se [UNDERSOKNING.md](UNDERSOKNING.md).
