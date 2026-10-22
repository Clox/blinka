# Driftläge för Blinka-signalservern

## Gemensam testserver

Cloudflare Worker `blinka-signal` är publicerad på
`https://blinka-signal.blinka-signal-worker.workers.dev` med MCP-vägen `/mcp`.
D1-databasen `blinka-signal` har migrerats. Servern kräver ingen egen domän
eller lokal tunnel hos varje användare. Konfigurationen med databas-ID ligger
i Git-ignorerade `signal-worker/wrangler.jsonc`; mallen och migrationsfilerna
finns i Git. Wrangler är inloggat lokalt utan att autentiseringsuppgifter
läggs i projektet.

Ett externt HTTPS-prov verifierade `initialize`, `tools/list`, `signalera`,
`/events` och `/unpair` mot den publicerade servern. Testparningen raderades.
Lokala integrationstester verifierar dessutom att två parningar hålls
åtskilda. Den privata ChatGPT-pluginen **Blinka signal** har registrerats
mot `/mcp`, anslutits och visar `signalera` i sin verktygslista. Ett verkligt
anrop från sidopanelen mot denna adress återstår.

Den här servern är en pilot. Den lagrar endast slumpmässiga parnings-ID:n,
hashade lästoken, lägen och tidsstämplar, inte konversationer eller
formulärinnehåll. Parnings-ID:t ger skrivmöjlighet till just den parningen.
Ingen användarautentisering finns. Innan en allmän lansering behövs bättre
missbruksskydd, övervakning, kapacitetsbedömning och ett klarlagt ansvar för
drift och datalagring. Modellens verktygsanrop är fortfarande ingen
garanterad livscykelhändelse.

## Äldre lokala driftspår

Den gamla lokala Node-servern körs fortfarande som användartjänsten
`blinka-signal.service` på `127.0.0.1:8787` med tillståndsfilen
`/home/oscar/.local/state/blinka/pairs.json`. Den är inte den nya gemensamma
servern. Den tillfälliga Cloudflare Quick Tunnel är stoppad.

Tailscale Funnel på port 443 blockerades av Spadrigs Laradock-nginx, som
använder värddatorns port 443. Funnel på 8443 gav ett lyckat lokalt
MCP-`initialize`, men ChatGPTs formulär för anpassad MCP-server svarade att
den inte kunde nå adressen. Båda Funnel-portarna stängdes av efter provet.
Spadrigs portkoppling ändrades inte. Dessa spår behöver inte längre användas
för den nya testservern.

## Nästa steg

1. Ladda om Blinka 0.4.1 i Chrome. Para en ofarlig testflik mot
   `https://blinka-signal.blinka-signal-worker.workers.dev`
   utan `/mcp` och skicka ett parnings-ID i sidopanelen.
2. Kontrollera att signalen når rätt flikgrupp och förblir tills den kvitteras.
   Bedöm därefter om modellstyrd signal räcker för en första användbar pilot.

## Källor

- [Cloudflare: workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)
- [Cloudflare: D1](https://developers.cloudflare.com/d1/)
- [Cloudflare: Workers gränser](https://developers.cloudflare.com/workers/platform/limits/)
- [Tailscale: Funnel](https://tailscale.com/docs/features/tailscale-funnel)
