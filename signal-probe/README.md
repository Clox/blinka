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

## Sidopanelprov som återstår

För att ChatGPT ska nå servern krävs en separat, tillfällig HTTPS-anslutning
och registrering som **custom MCP server** i ChatGPT Plugins. Vid provet den
22 oktober 2026 startades en Cloudflare Quick Tunnel och pluginen
**Blinka transportprov** skapades med ID
`plugin_asdk_app_6ada5a14fe948191964ba9784988e78a`. HTTPS-vägen och
verktygsregistreringen kontrollerades. Tunneladressen är tillfällig och ska
inte sparas här. Använd bara påhittade test-ID:n; servern saknar
användarautentisering och är inte byggd för verkliga jobb eller bestående drift.

När servern är nåbar, registrera `https://<testadress>/mcp` via ChatGPT Plugins,
installera den skapade pluginen och öppna en **ny sidopanelschatt**. Välj pluginen
med `@` om den syns och skriv: ”Anropa Blinka-verktyget `signalera` med
`probe_id` `panel-prov-1`. Detta är bara ett transportprov.” Kontrollera att
serverns terminal visar samma ID. Prova sedan samma sak efter byte till en
annan vanlig Chrome-flik, utan att ändra vilken formulärflik som jobbet avser.

Ett lyckat test verifierar att ett explicit MCP-anrop från sidopanelen når
servern. Det verifierar ännu inte att modellen automatiskt anropar verktyget
vid avslut, väntan eller fel, eller att Blinka kan koppla händelsen till rätt
formulärflik. De frågorna kräver separata prov.
