# Fortsatt undersökning: hooks och pluginverktyg

*22 oktober 2026. Gäller ChatGPTs Chrome-sidopanel, inte en vanlig Codex-session.*

## 1. Automatiska livscykelhooks

**Verifierat i officiell dokumentation:** [Hooks](https://learn.chatgpt.com/docs/hooks) beskrivs som en del av **Codex-körmiljön**. Där finns bland annat `Stop` när en Codex-tur stannar, `Interrupt` när huvudtråden avbryts och `PermissionRequest` för Codex verktygsgodkännanden. `SessionEnd` betyder att sessionen stängs eller blir inaktiv; det betyder inte att ett enskilt formulärjobb är klart. Hookarnas vanliga indata innehåller Codex-session, eventuell `turn_id`, arbetskatalog och eventuell transkriptfil, men inget dokumenterat Chrome-`tabId` eller formulärflik-ID. `PermissionRequest` gäller inte generellt varje användarfråga eller godkännande i ChatGPT Work.

[Plugin-dokumentationen](https://learn.chatgpt.com/docs/plugins) säger uttryckligen att pluginhooks **inte stöds i molnorkestrerad ChatGPT Work**. Synkroniserad Work har endast vissa administratörsstyrda MCP-hooks. [Hook-dokumentationen](https://learn.chatgpt.com/docs/hooks) skiljer också molnorkestrering från körningar där både orkestrering och exekvering är lokala. Ingen av dessa källor etablerar att en användarinstallerad `Stop`-, `Interrupt`- eller godkännandehook körs för ChatGPT Work **i Chromes sidopanel**.

**Lokalt kontrollerat:** I projektet finns ingen `.codex/hooks.json` eller `.codex/config.toml`, och ingen användarfil `~/.codex/hooks.json`. Den installerade ChatGPT Chrome-tilläggsversionen är fortfarande `1.26.1015.10801`. Ingen hook installerades eller konfigurerades. Ett prov i en lokal Codex-tråd skulle endast verifiera Codex, inte sidopanelen. Därför gjordes inget sådant prov som surrogat.

**Bedömning:** Automatiska hooks är inte en verifierad kommunikationsväg för sidopanelen. Även om en hook senare visas fungera där krävs ett särskilt prov av varje läge (normal avslutning, väntan på svar, godkännande, avbrott och fel) samt en säker koppling till formulärfliken.

| Önskat läge | Närmaste dokumenterade Codex-hook | Begränsning för Blinka |
| --- | --- | --- |
| Normal tur avslutas | `Stop` | Gäller Codex-turer; inget visat stöd i ChatGPTs Chrome-sidopanel och inget formulärflik-ID i indatan. |
| Väntar på användarsvar | Ingen särskild händelse i hooklistan | Kan inte härledas från `Stop` eller tystnad. |
| Väntar på godkännande | `PermissionRequest` för Codex verktygsbehörighet | Täcker inte dokumenterat ChatGPT Work-frågor eller alla godkännanden. |
| Användaren avbryter | `Interrupt` för aktiv Codex-huvudtur | Inget visat stöd i sidopanelen; körs inte för alla avslut. |
| Fel eller timeout | Ingen allmän felhook i hooklistan | `PostToolUse` kan se vissa lokala verktygsfel men inte garanterat hela körningens felstatus. |

## 2. Reservspår: `blinka.signalera` som modellstyrt verktyg

**Stöd på produktnivå:** [Plugins](https://learn.chatgpt.com/docs/plugins) kan tillföra MCP-verktyg och skills till ChatGPT Chat och Work. [Chrome-tilläggets dokumentation](https://learn.chatgpt.com/docs/chrome-extension) säger att chatten i sidopanelen kan fortsätta uppgifter och att ChatGPT kan använda plugins i browserarbetsflöden. Dessa uppgifter gör ett verktyg i sidopanelen **plausibelt**, men dokumenterar inte uttryckligen att ett eget MCP-verktyg kan anropas från just sidopanelens `browser_side_chat`-yta. Detta måste provas där. Att samma plugin fungerar i ChatGPTs vanliga webbfönster eller Codex räcker inte.

**Användarprov i sidopanelen:** `@` öppnade en meny med bland annat webbläsarflikar, Gmail, Google Drive och Google Calendar. Det verifierar att sidopanelens kompositör visar verktyg och anslutna appar. Inget eget Blinka-verktyg var installerat eller synligt i provet; skärmbilden verifierar därför inte att ett användarskapat MCP-verktyg kan anropas där. Menyn blandar flera slags funktioner, så det vore fel att tolka varje post som en plugin.

**Föreslaget minsta protokoll för verkliga jobb, ännu inte byggt:**

1. Användaren startar ett Blinka-jobb på formulärfliken. Blinka binder ett slumpmässigt, tidsbegränsat parnings-ID till `tabId`, `windowId` och jobb-ID i sin egen lagring och registrerar det via en autentiserad anslutning till servern. Den då aktiva fliken är bara relevant **vid bindningen**.
2. Parnings-ID:t läggs i uppgiften i sidopanelen. Chatten anropar `blinka.signalera({parningsId, läge})`, där `läge` exempelvis är `väntar_på_svar`, `väntar_på_godkännande`, `klar`, `avbruten` eller `fel`. Verktyget får inte härleda flik från senare aktiv flik. Servern validerar parnings-ID, tillåtet läge, giltighetstid och upprepade anrop.
3. Ett MCP-verktyg körs i pluginens server, inte automatiskt i Blinkas service worker. För molnkörning behöver servern nås via HTTPS. [OpenAI Developers snabbstart](https://developers.openai.com/plugins/build/app-quickstart) använder en publikt nåbar HTTPS-adress även vid test från ChatGPT. Servern skulle kontrollera både pluginanropets användarbehörighet och det registrerade parnings-ID:t och lägga händelsen i en liten kö. Blinka hämtar händelserna med egen behörighet och slår upp det bundna jobbets flik; MV3-alarm ger en fördröjd men uthållig hämtning. Ingen konversationstext eller formulär-URL behöver skickas.

**Instruktioner utan globala användarinstruktioner:** Pluginen kan bära en [skill](https://developers.openai.com/plugins/build/skills) och serverövergripande instruktioner samt verktygsbeskrivning. De kan säga när modellen bör kalla `blinka.signalera`. De är vägledning för modellens val, **inte** en livscykelgaranti. Pluginen måste vara installerad och tillgänglig i den aktuella sidopanelschatten; en ny chatt och eventuellt explicit `@Blinka` kan behövas. Detta är inte verifierat i användarens sidopanel.

**Missade lägen:** Modellen kan glömma eller välja bort verktyget; pluginen kan saknas, vara frånkopplad eller kräva godkännande; nätverk eller server kan fallera. En plötslig krasch, avbruten körning, timeout eller ett godkännande som dyker upp utanför modellens kontroll ger modellen ingen säker chans att anropa verktyget. Ett missat anrop får inte tolkas som `klar`. Även ett `klar`-anrop är en modellrapport, inte en oberoende bekräftelse på att formuläret är korrekt ifyllt.

## 3. Verifieringsgrind och rekommendation

**Inget av spåren är ännu verifierat från Chrome-sidopanelen till Blinka.** Bygg därför ingen automatisk statuslogik eller större UI nu. Rekommenderat spår är ett mycket litet pluginprov med ett enda verktyg och ett test-ID. Först ska ett explicit verktygsanrop i en **ny, icke-privat sidopanelskonversation** nå pluginservern. Därefter ska en testhändelse nå Blinka och aktivera rätt flik efter att användaren bytt aktiv flik. Först efter dessa två transportprov är det meningsfullt att prova skillinstruktioner och hur ofta modellen själv anropar verktyget vid de olika lägena.

Ett minimalt lokalt MCP-transportprov finns nu i [signal-probe/README.md](signal-probe/README.md). Verktyget `signalera` tog emot ett påhittat ID och gav ett kvitto i ett lokalt klientprov. Det är **inte** ett end-to-end-bevis för sidopanelen och kopplar ännu inte signalen till Blinka eller någon flik. Miljön har varken en installerad tunnel (`ngrok`/`cloudflared`) eller ett registrerat Blinka-MCP-verktyg i ChatGPT. En temporär HTTPS-anslutning, registrering och ett verkligt anrop från sidopanelen återstår. Blinkas manuella färgprov fortsätter fungera oberoende av dessa frågor.
