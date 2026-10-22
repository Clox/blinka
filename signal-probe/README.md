# Minimalt MCP-parningsprov

Den här servern har ett enda MCP-verktyg: `signalera({probe_id})`. Blinka
registrerar först ett slumpmässigt parnings-ID via `/pair` och hämtar en
händelse via `/events` med ett separat lästoken. Verktyget köar en händelse
för rätt parnings-ID, skriver ID och tid till terminalen och returnerar ett
kvitto. Servern läser ingen konversation och vet inte vilken Chrome-flik ID:t
hör till; den kopplingen finns endast i Blinkas lokala lagring.

## Lokalt prov

```sh
cd /home/oscar/projects/blinka/signal-probe
npm install
npm start
```

MCP-adressen blir `http://127.0.0.1:8787/mcp`. Servern lyssnar endast lokalt.
Ett lokalt anrop har verifierat att `signalera` finns och ger ett kvitto.

## Sidopanelprovet den 22 oktober 2026

För att ChatGPT ska nå servern krävs en separat, tillfällig HTTPS-anslutning
och registrering som **custom MCP server** i ChatGPT Plugins. Vid provet den
22 oktober 2026 startades en Cloudflare Quick Tunnel och pluginen
**Blinka transportprov** skapades med ID
`plugin_asdk_app_6ada5a14fe948191964ba9784988e78a`. Det första explicita
transportprovet från sidopanelen lyckades. Därefter byggdes ett parningsprov
och den nya pluginen **Blinka parningsprov** registrerades med ID
`plugin_asdk_app_6ada5ead1b24819194b1ee6e14d0f76a`. Tunneladresserna är
tillfälliga och ska inte sparas här. Använd bara påhittade test-ID:n; servern
saknar kontoautentisering och är inte byggd för verkliga jobb eller bestående drift.

I en **ny sidopanelschatt** valde användaren `@Blinka transportprov` och bad
om `signalera` med `probe_id` `panel-prov-1`. Sidopanelen visade serverns kvitto
och serverloggen innehöll samma ID. Det verifierar ett explicit MCP-anrop från
just Chrome-sidopanelen. Den tillfälliga tunneln har därefter stängts.

Det första provet verifierade inte att modellen automatiskt anropar verktyget
vid avslut, väntan eller fel. I det nya parningsprovet verifierades vägen från
ett **direkt lokalt** MCP-anrop via servern till ett väntande jobb på rätt
parad Chrome-flik. Den privata parningspluginen syntes ännu inte i användarens
`@`-val i sidopanelen, så den sammanhängande vägen från just den pluginen i
sidopanelen är inte verifierad. Efter Blinkas korrigering i version 0.2.1
bekräftade användaren att det väntande MCP-jobbet växlade gruppfärg och att
färgen återställdes när jobbet kvitterades.

Efter att sidopanelen öppnats på nytt blev **Blinka parningsprov** valbar där.
Ett uttryckligt anrop med `probe_id`
`8b3c95a7-9ab0-4f27-99a3-ee20c92e24e0` kvitterades i sidopanelen och
loggades av servern `2026-10-22T19:27:01.922Z`. Användaren såg den parade
gruppen bli röd. Detta verifierar den sammanhängande transportvägen, men
inte att modellen skulle anropa verktyget automatiskt vid ett arbetsläge.
