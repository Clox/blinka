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
och registrering som **custom MCP server** i ChatGPT Plugins. Den externa
anslutningen är inte skapad här. Vid ett sådant prov ska servern bara användas
med påhittade test-ID:n; den saknar användarautentisering och är inte byggd för
verkliga jobb eller bestående publicering.

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
