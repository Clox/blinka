# Blinka – första tekniska provet

Detta är ett fristående Manifest V3-tillägg för provning av en kvitterbar färgsignal. Version 0.2.1 kan dessutom ta emot en **uttrycklig testhändelse** via ett parat MCP-verktyg. Det avläser fortfarande ingen automatisk ChatGPT-arbetsstatus.

## Ladda i Chrome

1. Använd Chrome-profilen **Oscar** (`Default`). Öppna `chrome://extensions` själv.
2. Slå på **Utvecklarläge**, välj **Läs in okomprimerat tillägg** och ange `/home/oscar/projects/blinka`.
3. Fäst gärna Blinka vid verktygsfältet. Öppna en ofarlig testflik och klicka på Blinka-ikonen.

## Prova färgsignalen

1. Klicka **Starta nytt testjobb på denna flik**. Om fliken saknar grupp skapas en grupp med titeln Blinka. Om fliken redan har en grupp används den. Ursprunglig färg sparas.
2. Klicka igen för ett andra jobb på samma flik. Byt till en annan flik. Färgen ska växla rött/gult ungefär var 30:e sekund. Verifiera att signalen fortsätter utan att popupen är öppen och när ett annat program har fokus. Chrome kan fördröja alarm, så detta är inte en snabb eller exakt blinkning.
3. Återvänd till fliken. Signalen ska fortsätta tills du väljer **Kvittera** för vart och ett av jobben. Efter sista kvitteringen ska ursprungsfärgen återkomma.
4. Testa en redan grupperad flik med en annan ursprungsfärg. Lägg därefter till en andra flik i samma grupp och skapa ett jobb även där. Kvittera jobben en i taget; gruppen ska signalera tills det sista är kvitterat.
5. Ändra gruppens färg manuellt medan signalen är aktiv. Blinka ska pausa sina färgskrivningar och behålla din nya färg. Klicka **Återuppta signal** i popupen för att fortsätta med denna färg som ny bas, utan att skapa ett extra jobb.
6. Flytta testfliken till en annan befintlig grupp. Blinka ska följa flikens aktuella grupp vid nästa händelse eller alarm och återställa den gamla gruppen om Blinka fortfarande äger dess färg. Om fliken avgrupperas pausar synlig färgsignal tills den grupperas igen. Det kvarvarande jobbet kan fortfarande kvitteras i popupen.
7. När Chrome saknar fokus, klicka på **Påkalla fönstrets uppmärksamhet** och kontrollera om aktivitetsfältet markerar Chrome. Detta provar `windows.update({drawAttention:true})` separat; utfallet är beroende av operativsystemet och fönsterhanteraren.

## Prova parning mellan sidopanel och rätt flik

Detta prov kräver en tillfällig HTTPS-tunnel till `signal-probe/server.mjs` och den privata ChatGPT-pluginen **Blinka parningsprov**. Testservern tar bara emot slumpmässiga ID:n. Använd en ofarlig testflik utan privata formulärdata.

1. Ladda om Blinka i `chrome://extensions` efter uppdateringen till version 0.2.1.
2. Öppna Blinka-popupen på testfliken. Klistra in den aktuella testtunnelns HTTPS-adress (med eller utan `/mcp`) och klicka **Para denna flik**. Godkänn åtkomst till just testtunnelns domän när Chrome frågar.
3. Popupen visar ett parnings-ID och knappen **Kopiera provtext**. Öppna en ny ChatGPT-chatt i sidopanelen på samma testflik. Välj `@Blinka parningsprov` och klistra in provtexten efter mentionen.
4. Skicka meddelandet och byt omedelbart till en **annan** vanlig Chrome-flik. Vänta upp till ungefär en minut; MV3-alarm körs tidigast var 30:e sekund och kan fördröjas.
5. Kontrollera att endast den parade testflikens grupp får färgsignal. Återvänd till testfliken och öppna Blinka-popupen: den ska visa ett väntande jobb märkt **MCP** och senaste MCP-signal med testflikens ID. Klicka **Kvittera**; gruppens färg ska återställas.

Parningen lagras med `tabId` och ett slumpmässigt lästoken i Blinkas lokala tilläggslagring. ChatGPT får endast parnings-ID:t. Servern lämnar ut händelsen bara till den som har lästokenet. Ett parnings-ID går ut efter 30 minuter. Tunneln är ett tidsbegränsat test och saknar kontoautentisering; använd den inte för verkliga jobb.

**Fortsätt ett redan skapat MCP-jobb efter uppdatering:** Om popupen visar `Jobb … (MCP)` och `Pausad efter färgändring`, klicka **Återuppta signal**. Låt popupen stängas och vänta minst två larmperioder, ungefär en minut. Gruppen ska växla mellan rött och gult så länge jobbet är okvitterat. Klicka därefter **Kvittera** och kontrollera återställd basfärg. Ingen ny parning eller nytt pluginanrop behövs för detta prov.

**Sidopanelsprovet, version 0.1.1:** Öppna `chrome://extensions` och klicka på **Ladda om** för Blinka efter kodändringen. Ladda sedan om en vanlig `chatgpt.com`-flik. Öppna Blinka-popupen: raden `Vanlig ChatGPT-flik` ska nu få en träff. Stäng därefter ChatGPTs sidopanel helt och öppna den igen på en testflik. Öppna Blinka-popupen på nytt och kontrollera `ChatGPT-sidopanelens iframe` samt `Annan inbäddad ChatGPT-ram`. Du behöver inte skriva något till ChatGPT för detta prov; skriptet rapporterar när det laddas. Det läser endast om URL-parametern `surface` har värdet `browser_side_chat`, om ramen är toppnivå, och avsändarens tabId/frameId. Det läser inte sidans innehåll, hela URL:en, cookies eller konversationer.

Om en vanlig ChatGPT-flik ger träff men båda ramraderna saknar träff, fungerar innehållsskriptet i vanliga flikar men dess åtkomst till den faktiska sidopanelen är fortfarande obekräftad och sannolikt blockerad i detta sammanhang. Om inte ens en vanlig flik ger träff behöver installation, omladdning eller Chrome-profil kontrolleras först. En träff i ramen bevisar endast skriptåtkomst, inte att tillförlitlig arbetsstatus finns.

**Tolkning av räknarna i version 0.1.2:** Raden `Alla vanliga ChatGPT-flikar` är sparad historik för hela profilen, så den visar samma värde oavsett vilken flik som är aktiv. `Den här fliken` visar om den aktuella fliken har observerats. ChatGPT-flikar som var öppna innan Blinka laddades behöver laddas om var för sig för att innehållsskriptet ska rapportera en träff. En utebliven träff i en gammal flik säger därför inget om sidopanelens åtkomst.

## Begränsningar

- Alarmens minsta normala period är 30 sekunder och de kan fördröjas. Signalen är därför långsam färgväxling, inte ett sekundsnabbt blinkande.
- Vid en yttre färgändring pausar Blinka för att undvika att två tillägg skriver över varandra. Basfärgen blir då den nya färgen. Den ursprungliga färgen före den yttre ändringen återställs inte.
- Vid flytt mellan fönster kan Chrome ge gruppen nytt ID; Blinka följer flikens nya grupp vid avstämning. Detta behöver manuell verifiering.
- Omladdning och färgobservation i användarens Chrome måste göras manuellt. Ett direkt MCP-anrop har verifierat att serverhändelsen ger ett jobb på den parade fliken; färgväxling efter korrigeringen i 0.2.1 återstår att observera.

Se [UNDERSOKNING.md](UNDERSOKNING.md) för källbelägg och nästa steg.
