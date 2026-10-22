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

Nästa användarsteg är att skapa/logga in på ett Tailscale-konto och aktivera
klienten på denna dator. Därefter kan vi starta servern med
`BLINKA_STATE_FILE`, slå på Funnel för port 8787, verifiera MCP från
sidopanelen på den fasta adressen och registrera pluginen en sista gång.
Blinka 0.4.1 på disk accepterar redan den nya adressen; användaren har 0.4.0
installerad och behöver ladda om tillägget när adressen är klar.

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
