# Minimalt MCP-transportprov

Den här servern har ett enda verktyg: `signalera({probe_id})`. Det skriver ett
kort test-ID och mottagningstid till terminalen och returnerar ett kvitto.
Den läser ingen konversation, identifierar ingen flik och ändrar inte Blinka.

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
`plugin_asdk_app_6ada5a14fe948191964ba9784988e78a`. HTTPS-vägen och
verktygsregistreringen kontrollerades. Tunneladressen är tillfällig och ska
inte sparas här. Använd bara påhittade test-ID:n; servern saknar
användarautentisering och är inte byggd för verkliga jobb eller bestående drift.

I en **ny sidopanelschatt** valde användaren `@Blinka transportprov` och bad
om `signalera` med `probe_id` `panel-prov-1`. Sidopanelen visade serverns kvitto
och serverloggen innehöll samma ID. Det verifierar ett explicit MCP-anrop från
just Chrome-sidopanelen. Den tillfälliga tunneln har därefter stängts.

Det verifierar ännu inte att modellen automatiskt anropar verktyget
vid avslut, väntan eller fel, eller att Blinka kan koppla händelsen till rätt
formulärflik. De frågorna kräver separata prov.
