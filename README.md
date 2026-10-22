# Blinka

Blinka är ett fristående Chrome-tillägg (Manifest V3) som observerar när ChatGPT Work arbetar på en vanlig webbsida. Version **0.10.0** använder övergången från aktivitetsmärke till vanlig favicon som en **kvitterbar signal om att kontrollera ChatGPT**. En knapp kan starta samma färgväxling manuellt. Ingen parning, plugin eller signalserver används.

## Vad som är verifierat

När ChatGPT Work i sidopanelen faktiskt arbetar på en webbsida har Blinka sett favicon-markören `aktiv` på rätt flik, både när användaren stannade på fliken och när en annan flik valdes. Blinka läser inte sidans DOM, konversationer eller formulär. Chrome skickar favicon-ändringen tillsammans med `tabId` till `chrome.tabs.onUpdated`; Blinka sparar bara märkets typ och tidsstämpel.

När markören försvinner efter `aktiv` startar Blinka en färgsignal på rätt flikgrupp. Detta är ännu **inte praktiskt verifierat i Chrome för version 0.10.0**. Övergången är heller inte en säker status för `klar`, `väntar på svar`, `avbruten` eller `fel`: ChatGPTs lokala tilläggskod kan släppa fliken av flera skäl. Inget slutmärke (`resultat` eller `överlämning`) har observerats i användarens prov.

## Ladda och prova

1. Öppna `chrome://extensions` i Chrome. Ladda `/home/oscar/projects/blinka` som okomprimerat tillägg, eller klicka **Ladda om** om Blinka redan är installerat.
2. Låt ChatGPT Work arbeta på en testflik. Blinkas popup visar aktuell och senast observerad favicon-markör under **Agentaktivitet**. När `aktiv` återgår till vanlig favicon ska färgväxlingen starta automatiskt på flikens grupp.
3. Klicka **Kvittera** i Blinkas popup på arbetsfliken efter att du kontrollerat ChatGPT. Färgen återställs när alla signaler i gruppen är kvitterade.
4. **Simulera färdigt jobb på denna flik** startar samma färgväxling manuellt för ett separat test.

Ingen signal startas bara för att ChatGPT börjar arbeta. Varje observerad `aktiv → vanlig favicon` kan skapa en signal, även om föregående signal ännu inte är kvitterad. Knappen skapar ett separat manuellt test. Finns fliken redan i en grupp används den; annars skapas eller återanvänds en Blinka-grupp i samma fönster. Om användaren eller ett annat tillägg ändrar gruppfärgen pausar Blinka färgväxlingen för att undvika en skrivkonflikt. Under en aktiv signal växlar färgen ungefär varje sekund. Ett MV3-alarm var 30:e sekund återstartar den snabba växlingen om bakgrundsprocessen avslutas oväntat. Därför kan en kort paus uppstå, och frekvensen är inte garanterad när Chrome eller datorn sover.

Vid uppdatering från en äldre version återställs gamla testsignaler bara om gruppen fortfarande har den färg Blinka senast satte. En Blinka-grupp kan ligga kvar efter kvittering och avgrupperas i Chrome. Tidigare server- och pluginexperiment finns kvar i Git-historiken men används inte längre.

## Nästa steg

Prova övergången med ett verkligt sidopanelsjobb, både när du är kvar på fliken och när du arbetar i en annan flik. Kontrollera om signalen någon gång kommer för tidigt eller uteblir. En mer specifik statuskälla behövs fortfarande för att skilja avslut, väntan och fel. Se [UNDERSOKNING.md](UNDERSOKNING.md).
