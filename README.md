# Blinka – första tekniska provet

Detta är ett fristående Manifest V3-tillägg för **manuell** provning av en kvitterbar färgsignal. Det avläser ingen ChatGPT-arbetsstatus. Projektet har avsiktligt ingen större kontrollpanel eller automatisk ChatGPT-integration.

## Ladda i Chrome

1. Använd Chrome-profilen **Oscar** (`Default`). Öppna `chrome://extensions` själv.
2. Slå på **Utvecklarläge**, välj **Läs in okomprimerat tillägg** och ange `/home/oscar/projects/blinka`.
3. Fäst gärna Blinka vid verktygsfältet. Öppna en ofarlig testflik och klicka på Blinka-ikonen.

## Prova färgsignalen

1. Klicka **Starta nytt testjobb på denna flik**. Om fliken saknar grupp skapas en grupp med titeln Blinka. Om fliken redan har en grupp används den. Ursprunglig färg sparas.
2. Klicka igen för ett andra jobb på samma flik. Byt till en annan flik. Färgen ska växla rött/gult ungefär var 30:e sekund. Verifiera att signalen fortsätter utan att popupen är öppen och när ett annat program har fokus. Chrome kan fördröja alarm, så detta är inte en snabb eller exakt blinkning.
3. Återvänd till fliken. Signalen ska fortsätta tills du väljer **Kvittera** för vart och ett av jobben. Efter sista kvitteringen ska ursprungsfärgen återkomma.
4. Testa en redan grupperad flik med en annan ursprungsfärg. Lägg därefter till en andra flik i samma grupp och skapa ett jobb även där. Kvittera jobben en i taget; gruppen ska signalera tills det sista är kvitterat.
5. Ändra gruppens färg manuellt medan signalen är aktiv. Blinka ska pausa sina färgskrivningar och behålla din nya färg. Ett nytt klick på **Starta nytt testjobb** i gruppen återupptar signalen med denna färg som ny bas.
6. Flytta testfliken till en annan befintlig grupp. Blinka ska följa flikens aktuella grupp vid nästa händelse eller alarm och återställa den gamla gruppen om Blinka fortfarande äger dess färg. Om fliken avgrupperas pausar synlig färgsignal tills den grupperas igen. Det kvarvarande jobbet kan fortfarande kvitteras i popupen.
7. När Chrome saknar fokus, klicka på **Påkalla fönstrets uppmärksamhet** och kontrollera om aktivitetsfältet markerar Chrome. Detta provar `windows.update({drawAttention:true})` separat; utfallet är beroende av operativsystemet och fönsterhanteraren.

**Sidopanelsprovet, version 0.1.1:** Öppna `chrome://extensions` och klicka på **Ladda om** för Blinka efter kodändringen. Ladda sedan om en vanlig `chatgpt.com`-flik. Öppna Blinka-popupen: raden `Vanlig ChatGPT-flik` ska nu få en träff. Stäng därefter ChatGPTs sidopanel helt och öppna den igen på en testflik. Öppna Blinka-popupen på nytt och kontrollera `ChatGPT-sidopanelens iframe` samt `Annan inbäddad ChatGPT-ram`. Du behöver inte skriva något till ChatGPT för detta prov; skriptet rapporterar när det laddas. Det läser endast om URL-parametern `surface` har värdet `browser_side_chat`, om ramen är toppnivå, och avsändarens tabId/frameId. Det läser inte sidans innehåll, hela URL:en, cookies eller konversationer.

Om en vanlig ChatGPT-flik ger träff men båda ramraderna saknar träff, fungerar innehållsskriptet i vanliga flikar men dess åtkomst till den faktiska sidopanelen är fortfarande obekräftad och sannolikt blockerad i detta sammanhang. Om inte ens en vanlig flik ger träff behöver installation, omladdning eller Chrome-profil kontrolleras först. En träff i ramen bevisar endast skriptåtkomst, inte att tillförlitlig arbetsstatus finns.

## Begränsningar

- Alarmens minsta normala period är 30 sekunder och de kan fördröjas. Signalen är därför långsam färgväxling, inte ett sekundsnabbt blinkande.
- Vid en yttre färgändring pausar Blinka för att undvika att två tillägg skriver över varandra. Basfärgen blir då den nya färgen. Den ursprungliga färgen före den yttre ändringen återställs inte.
- Vid flytt mellan fönster kan Chrome ge gruppen nytt ID; Blinka följer flikens nya grupp vid avstämning. Detta behöver manuell verifiering.
- Browserkontrollen i denna Codex-session blockerade `chrome://extensions`. Tillägget kunde inte laddas eller provas i den öppna Chrome-sessionen här. Syntax och manifest har kontrollerats lokalt.

Se [UNDERSOKNING.md](UNDERSOKNING.md) för källbelägg och nästa steg.
