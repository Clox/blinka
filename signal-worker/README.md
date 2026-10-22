# Gemensam Blinka-signalserver (prototyp)

Den här Cloudflare Worker-varianten ger ett fast HTTPS-värdnamn under
`workers.dev` utan egen domän. D1 lagrar endast slumpmässiga parnings-ID:n,
hashade lästoken, tidsstämplar och modellrapporterade lägen. Den lagrar inga
formulärdata eller ChatGPT-konversationer. Servern är ett prototypsteg för
flera användare, inte en färdig offentlig tjänst.

## Protokoll

- Blinka skapar ett parnings-ID och ett separat lästoken. `POST /pair` sparar
  endast SHA-256-hash av lästokenet. Parningen gäller fyra timmar.
- ChatGPT får parnings-ID:t i den aktuella chatten och kan anropa MCP-verktyget
  `signalera` på `/mcp`. Servern lägger högst 100 numrerade signaler i kön.
- Blinka hämtar `POST /events` med både ID, lästoken och senaste läsposition.
  Bara en klient med rätt lästoken kan läsa händelserna. `POST /unpair`
  avslutar parningen.
- Varje ID är slumpmässigt och kopplas till rätt `tabId` endast i Blinkas
  lokala lagring. Två separata parningar delar inte händelser, vilket provas
  i integrationstestet. Ingen användarinloggning finns i detta protokoll;
  ID:t är en skrivbehörighet och lästokenet en läsbehörighet. Läcka inte ID:t
  till en annan chatt eller person.

`/pair` begränsas till ungefär fem försök per minut per IP via Cloudflares
Rate Limiting API. Gränsen är ungefärlig och servern har ännu ingen fullständig
missbrukshantering. Med högst 1 000 samtidiga parningar och Workers gratisgräns
för anrop är detta avsett för en liten pilot.

## Lokalt

```sh
cd /home/oscar/projects/blinka/signal-worker
npm install
npm test
npm run migrate:local
npm run dev
```

Testet startar en isolerad lokal Worker och D1, provar två parningar, MCP:s
`initialize`/`tools/list`/`signalera`, separata händelseköer, lästoken,
läsposition och avslutning. Det läser inga användardata.

## Publicera efter Cloudflare-inloggning

Cloudflare-konto krävs, men ingen egen domän. Kopiera
`wrangler.example.jsonc` till den Git-ignorerade `wrangler.jsonc`.

```sh
npx wrangler login
npx wrangler d1 create blinka-signal --jurisdiction eu
```

Sätt det returnerade `database_id` i `wrangler.jsonc`. Kör sedan:

```sh
npm run migrate:remote
npm run deploy
```

`deploy` ger en fast URL av typen
`https://blinka-signal.<kontots-subdomän>.workers.dev`. Registrera därefter
`<den URL:en>/mcp` som en privat anpassad MCP-plugin i ChatGPT. Ange samma
origin, utan `/mcp`, i Blinka-popupen. Ladda om Blinka 0.4.1 i Chrome före
parning. Gör ett enda ofarligt sidopanelsprov för att verifiera att ChatGPT
når den nya servern; ett lokalt HTTP-prov bevisar inte det.

## Nuvarande provdrift

Servern är publicerad på
`https://blinka-signal.blinka-signal-worker.workers.dev/mcp`. Ett externt
HTTPS-prov har verifierat MCP `initialize`, verktygslistan, `signalera`, D1:s
händelsehämtning och borttagning av testparningen. ChatGPT har dessutom
registrerat den privata pluginen **Blinka signal** mot `/mcp` och visat
verktyget `signalera`. Den 23 oktober 2026 rapporterade användaren att ett
enkelt `7 + 5`-prov från ChatGPTs sidopanel gav svar och gjorde den parade
flikgruppen röd. Det verifierar en lyckad signaltransport för detta prov,
inte en garanterad signal vid varje körning.

Ange `https://blinka-signal.blinka-signal-worker.workers.dev` i Blinkas
popup. Den privata ChatGPT-pluginen måste använda adressen ovan med `/mcp`.

Publicera inte som en allmän tjänst innan autentisering, missbruksskydd,
övervakning och kapacitetsgränser har granskats. Ett MCP-anrop förblir
modellstyrt: det garanterar inte signal vid varje avslut, väntan eller fel.

## Källor

- [Cloudflare: workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)
- [Cloudflare: D1 och migrationskommandon](https://developers.cloudflare.com/d1/wrangler-commands/)
- [Cloudflare: Rate Limiting API](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Cloudflare: Workers gränser](https://developers.cloudflare.com/workers/platform/limits/)
