# Blinka

Blinka är ett fristående Chrome-tillägg (Manifest V3) som observerar när ChatGPT Work arbetar på en vanlig webbsida. Version **0.8.0** visar ChatGPTs favicon-markör och har en **manuell förhandsvisning av flikgruppens färgsignal för ett färdigt jobb**. Ingen parning, plugin eller signalserver används.

## Vad som är verifierat

När ChatGPT Work i sidopanelen faktiskt arbetar på en webbsida har Blinka sett favicon-markören `aktiv` på rätt flik, både när användaren stannade på fliken och när en annan flik valdes. Blinka läser inte sidans DOM, konversationer eller formulär. Chrome skickar favicon-ändringen tillsammans med `tabId` till `chrome.tabs.onUpdated`; Blinka sparar bara märkets typ och tidsstämpel.

Att markören försvinner är **inte** verifierat som `klar`, `väntar på svar`, `avbruten` eller `fel`. Inget slutmärke (`resultat` eller `överlämning`) har observerats i användarens prov. Därför startar favicon-ändringar ännu ingen automatisk färgsignal.

## Ladda och prova

1. Öppna `chrome://extensions` i Chrome. Ladda `/home/oscar/projects/blinka` som okomprimerat tillägg, eller klicka **Ladda om** om Blinka redan är installerat.
2. Låt ChatGPT Work arbeta på en testflik. Blinkas popup visar aktuell och senast observerad favicon-markör under **Agentaktivitet**.
3. Förhandsvisa en framtida uppmärksamhetssignal med **Simulera färdigt jobb på denna flik**. Knappen använder flikens befintliga grupp, eller skapar/återanvänder en Blinka-grupp. Gruppen växlar mellan rött och gult tills **Kvittera simulering** klickas. Färgen återställs därefter. Flera simulerade jobb i samma grupp håller signalen aktiv tills alla kvitteras.

Förhandsvisningen är helt manuell. Den startas **inte** när ChatGPT börjar arbeta och den påstår inte att ChatGPT är färdig. Om användaren eller ett annat tillägg ändrar gruppfärgen pausar Blinka färgväxlingen för att undvika en skrivkonflikt. MV3-alarm ger ungefär 30 sekunder mellan växlingarna, inte en snabb animation.

Vid uppdatering från en äldre version återställs gamla testsignaler bara om gruppen fortfarande har den färg Blinka senast satte. En Blinka-grupp kan ligga kvar efter kvittering och avgrupperas i Chrome. Tidigare server- och pluginexperiment finns kvar i Git-historiken men används inte längre.

## Nästa steg

Använd den verifierade `aktiv`-händelsen för att hitta arbetsfliken automatiskt. Undersök separat en tillförlitlig händelse som säger att ChatGPT faktiskt behöver användarens uppmärksamhet. En försvunnen `aktiv`-markör räcker inte. Se [UNDERSOKNING.md](UNDERSOKNING.md).
