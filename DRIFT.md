# Vägen från testtunnel till fast adress

## Nuvarande läge

Blinkas ChatGPT-plugin anropar en lokalt körd MCP-server via en tillfällig
Cloudflare Quick Tunnel. Vid varje omstart får tunneln ett nytt värdnamn och
pluginen måste då registreras på nytt. Servern kan numera lagra parningar
över omstart via `BLINKA_STATE_FILE`, men den nuvarande tillfälliga tjänsten
har inte denna inställning. Lösningen är därför ännu ett tekniskt prov.

Blinka 0.4.1 tillåter en valfri HTTPS-adress för testservern. Tillägget begär
bara åtkomst till den valda adressen vid parning. Det löser klientens
adressbegränsning, men skapar ingen bestående serveradress i sig.

## Fast adress utan egen domän

Tailscale Funnel är förstahandsvalet för nästa praktiska steg. Det ger en
stabil offentlig HTTPS-adress under `*.ts.net` till den lokala servern på
`127.0.0.1:8787`. Det kräver ett Tailscale-konto, Tailscale-klienten och att
Funnel aktiveras i kontot, men ingen köpt eller ansluten domän. Ingen
Tailscale-klient finns installerad här ännu. Den lokala datorn och servern
måste vara igång för att adressen ska svara. Funnel gör den anslutna porten
publikt nåbar; serverns parnings-ID och lästoken måste därför fortsatt
behandlas som hemligheter, och tjänsten ska inte ges tillgång till privata
konversationer.

Ett gratis ngrok-konto ger också ett fast `*.ngrok-free.dev`-namn. Gratisplanen
har dock en webbläsarvarning framför HTTPS-tjänster. Vi har inte verifierat
att ChatGPT:s MCP-klient går förbi den, så ngrok är inte valt som driftväg.
Cloudflare Quick Tunnel har slumpmässig adress vid omstart. En namngiven
Cloudflare Tunnel skulle kräva en Cloudflare-ansluten domän som användaren
inte har uppgett sig ha.

Tailscale-klienten är nu ansluten på datorn. Den lokala servern körs som
`systemctl --user`-tjänsten `blinka-signal.service` med state-fil i
`/home/oscar/.local/state/blinka/pairs.json` och startar om vid fel.
Enhetsfilen finns i `signal-probe/blinka-signal.service` och en kopia är
installerad i `~/.config/systemd/user/`. Den tidigare tillfälliga servern och
Cloudflare-tunneln har stoppats. Tailscale-kontot har godkänt Funnel.

**Blockerande resultat 22 oktober 2026:** `laradock_nginx_1` från projektet
Spadrig använder redan värddatorns port 443 på alla adresser. Funnel på 443
kunde därför inte svara där. Funnel fungerar på 8443:
`https://lenovard.tailc13527.ts.net:8443/mcp`. Ett HTTPS-anrop med MCP:s
`initialize` gav HTTP 200 och serverns instruktioner. När samma URL angavs i
ChatGPTs dialog för anpassad MCP-server blev svaret däremot *Det gick inte att
nå MCP-servern*. Ingen ny plugin skapades. Att lokal `curl` fungerar bevisar
alltså inte att ChatGPTs serversida når Funnel på 8443. Båda Funnel-portarna
är avstängda efter provet. Ändra inte Laradocks portkoppling utan
att bedöma följderna för Spadrig.

Blinka 0.4.1 på disk accepterar en ny HTTPS-adress; användaren har 0.4.0
installerad och behöver ladda om tillägget när en fungerande adress finns.
För fortsatt utveckling är en server med standard-HTTPS på 443, helst en
senare gemensam server, lämpligare än att kräva en tunnel per användare.

När en fast HTTPS-adress finns återstår att ansluta MCP-pluginen till
`https://<värdnamn>/mcp`, ange samma origin i Blinka och hålla servern igång.
För vardagsbruk ska servern köras med `BLINKA_STATE_FILE` utanför projektet
och åtkomsten begränsas. Ett modellstyrt `signalera`-anrop är fortfarande en
bästa möjliga signal, även med en fast adress.

## Underlag

- [Cloudflare: Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)
- [Cloudflare: Set up Cloudflare Tunnel](https://developers.cloudflare.com/tunnel/get-started/)
- [Tailscale: Funnel](https://tailscale.com/docs/features/tailscale-funnel)
- [Tailscale: stabilt värdnamn](https://tailscale.com/docs/reference/examples/funnel)
- [ngrok: gratis utvecklingsdomän](https://ngrok.com/blog/free-static-domains-ngrok-users)
- [ngrok: webbläsarvarning](https://ngrok.com/abuse)
- [Chrome: permissions API](https://developer.chrome.com/docs/extensions/reference/api/permissions/)
