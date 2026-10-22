# Blinka – första tekniska provet

Detta är ett fristående Manifest V3-tillägg för provning av en kvitterbar färgsignal. Version 0.5.0 förifyller den verifierade gemensamma serveradressen och ger en färdig starttext för ChatGPTs sidopanel. Flera **modellrapporterade lägen** från samma parning visas som separata kvitterbara jobb. Blinka avläser fortfarande ingen oberoende eller garanterad ChatGPT-arbetsstatus.

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

**Aktuellt driftläge:** Den gemensamma testservern finns på
`https://blinka-signal.blinka-signal-worker.workers.dev` med MCP på `/mcp`.
Externt HTTPS-prov har verifierat serverns MCP-verktyg, lagring och
händelsehämtning. Den privata ChatGPT-pluginen **Blinka signal** är ansluten
och visar verktyget `signalera`. Den 23 oktober 2026 verifierade användaren
ett sidopanelsprov mot den fasta adressen: ChatGPT svarade `7 + 5 = 12` och
den parade gruppen blev röd. Se [signal-worker/README.md](signal-worker/README.md)
och [DRIFT.md](DRIFT.md). Använd en ofarlig testflik utan privata formulärdata.

**Resultat hittills:** Den riktiga Chrome-sidopanelen anropade verktyget med rätt parnings-ID och den parade gruppen bytte färg. I två senare prov, utan uttrycklig uppmaning att anropa verktyget, loggade servern `vantar_pa_svar` när modellen bad om mer information och `klar` när den löst en enkel uppgift. Gruppen växlade färg i båda fallen. Detta visar att modellstyrd signalering kan fungera för båda lägena, men inte att den sker vid varje avslut eller vänteläge.

De äldre provpluginerna pekar på stängda testtunnlar. Använd den nya privata
pluginen **Blinka signal** när den är ansluten till den fasta adressen.

1. Ladda om Blinka i `chrome://extensions` efter uppdateringen till version 0.5.0.
2. Öppna Blinka-popupen på en ofarlig testflik och klicka **Para denna flik**. Den gemensamma serveradressen är förifylld. Godkänn åtkomst till just den domänen när Chrome frågar. Om fliken redan har en äldre parning, välj först **Avsluta parning**; väntande jobb kvitteras separat.
3. Klicka **Kopiera starttext**. Öppna en ny ChatGPT-chatt i sidopanelen på samma testflik. Välj **Blinka signal**, klistra in starttexten och skriv din uppgift efter den, exempelvis `Vad är 7 + 5?`.
4. Vänta upp till ungefär en minut; MV3-alarm körs tidigast var 30:e sekund och kan fördröjas. Du behöver inte byta flik.
5. Kontrollera att endast den parade testflikens grupp får färgsignal. Blinka-popupen ska visa ett väntande **MCP**-jobb med modellens rapporterade läge. Klicka **Kvittera**; gruppens färg ska återställas.

Parningen lagras med `tabId`, lästoken och läsposition i Blinkas lokala tilläggslagring. ChatGPT får endast parnings-ID:t. Servern lämnar ut händelser bara till den som har lästokenet. En parning kan ge flera jobb och går ut efter fyra timmar; **Avsluta parning** stoppar nya signaler utan att kvittera redan väntande jobb. Den gemensamma servern är fortfarande en prototyp utan användarkonton eller fullständigt missbruksskydd; använd den inte för privata formulärjobb.

Blinka 0.5.0 använder den gemensamma servern som standard. **Annan signalserver** i popupen tillåter fortfarande en valfri HTTPS-adress för utvecklingsprov. Värdtillståndet är valfritt i manifestet; Chrome ber bara om åtkomst till den **exakta adress** som används när du klickar **Para denna flik**. Servern och ChatGPT-pluginen måste peka på samma adress. En aktiv parning per flik förenklar kopplingen; avsluta den innan du skapar en ny.

**Flera turer i samma chatt:** Ge parnings-ID:t i första meddelandet och välj **Blinka signal**. Pluginens instruktion ber modellen återanvända ID:t före senare svar i *samma* chatt när kopplingen är tydlig. Detta är ännu inte verifierat i sidopanelen. Använd en ny parning om du byter chatt eller formulärflik; modellen kan glömma ID:t eller missa att anropa verktyget.

**Fortsätt ett redan skapat MCP-jobb efter uppdatering:** Om popupen visar `Jobb … (MCP)` och `Pausad efter färgändring`, klicka **Återuppta signal**. Låt popupen stängas och vänta minst två larmperioder, ungefär en minut. Gruppen ska växla mellan rött och gult så länge jobbet är okvitterat. Klicka därefter **Kvittera** och kontrollera återställd basfärg. Ingen ny parning eller nytt pluginanrop behövs för detta prov.

**Tidigare beteendeprov:** Ett meddelande som bara innehöll ett parnings-ID och frågan `Vad är 7 + 5?` fick modellen att anropa verktyget utan att användaren nämnde det. Servern loggade samma ID och gruppen blev röd. Detta visar modellens följsamhet i ett enskilt prov, inte en garanterad signal vid varje framtida avslut, väntan eller fel. Detaljer finns i [HOOKS_OCH_PLUGIN.md](HOOKS_OCH_PLUGIN.md).

**Sidopanelsprovet, version 0.1.1:** Öppna `chrome://extensions` och klicka på **Ladda om** för Blinka efter kodändringen. Ladda sedan om en vanlig `chatgpt.com`-flik. Öppna Blinka-popupen: raden `Vanlig ChatGPT-flik` ska nu få en träff. Stäng därefter ChatGPTs sidopanel helt och öppna den igen på en testflik. Öppna Blinka-popupen på nytt och kontrollera `ChatGPT-sidopanelens iframe` samt `Annan inbäddad ChatGPT-ram`. Du behöver inte skriva något till ChatGPT för detta prov; skriptet rapporterar när det laddas. Det läser endast om URL-parametern `surface` har värdet `browser_side_chat`, om ramen är toppnivå, och avsändarens tabId/frameId. Det läser inte sidans innehåll, hela URL:en, cookies eller konversationer.

Om en vanlig ChatGPT-flik ger träff men båda ramraderna saknar träff, fungerar innehållsskriptet i vanliga flikar men dess åtkomst till den faktiska sidopanelen är fortfarande obekräftad och sannolikt blockerad i detta sammanhang. Om inte ens en vanlig flik ger träff behöver installation, omladdning eller Chrome-profil kontrolleras först. En träff i ramen bevisar endast skriptåtkomst, inte att tillförlitlig arbetsstatus finns.

**Tolkning av räknarna i version 0.1.2:** Raden `Alla vanliga ChatGPT-flikar` är sparad historik för hela profilen, så den visar samma värde oavsett vilken flik som är aktiv. `Den här fliken` visar om den aktuella fliken har observerats. ChatGPT-flikar som var öppna innan Blinka laddades behöver laddas om var för sig för att innehållsskriptet ska rapportera en träff. En utebliven träff i en gammal flik säger därför inget om sidopanelens åtkomst.

## Begränsningar

- Alarmens minsta normala period är 30 sekunder och de kan fördröjas. Signalen är därför långsam färgväxling, inte ett sekundsnabbt blinkande.
- Vid en yttre färgändring pausar Blinka för att undvika att två tillägg skriver över varandra. Basfärgen blir då den nya färgen. Den ursprungliga färgen före den yttre ändringen återställs inte.
- Vid flytt mellan fönster kan Chrome ge gruppen nytt ID; Blinka följer flikens nya grupp vid avstämning. Detta behöver manuell verifiering.
- Användaren har verifierat färgväxling och återställning för ett MCP-jobb samt sidopanelsignaler för `vantar_pa_svar` och `klar`. Serverns kö för flera händelser är automatiskt provad. Flera signaler från samma parning i sidopanelen återstår att kontrollera; det är ett funktionsprov, ingen ny transportundersökning.

Se [UNDERSOKNING.md](UNDERSOKNING.md) för källbelägg och nästa steg.
