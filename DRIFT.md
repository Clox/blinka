# Vägen från testtunnel till fast adress

## Nuvarande läge

Blinkas ChatGPT-plugin anropar en lokalt körd MCP-server via en tillfällig
Cloudflare Quick Tunnel. Vid varje omstart får tunneln ett nytt värdnamn och
pluginen måste då registreras på nytt. Servern lagrar parningar i minnet;
serveromstart tar bort dem. Lösningen är därför ännu ett tekniskt prov.

Blinka 0.4.1 tillåter en valfri HTTPS-adress för testservern. Tillägget begär
bara åtkomst till den valda adressen vid parning. Det löser klientens
adressbegränsning, men skapar ingen bestående serveradress i sig.

## Fast lokal tunnel

Cloudflare beskriver en namngiven tunnel med ett publicerat värdnamn som väg
till en fast adress. Det kräver ett Cloudflare-konto, en domän ansluten till
Cloudflare och en tunnel som pekar på den lokala servern. Inget sådant konto
eller tunnelkonfiguration har hittats lokalt. Skapa inte konton, domäner,
DNS-poster eller tunneltoken utan användarens val av driftplats.

När en fast HTTPS-adress finns återstår att ansluta MCP-pluginen till
`https://<värdnamn>/mcp`, ange samma origin i Blinka och hålla servern igång.
För vardagsbruk behöver servern också behålla parningar över omstart och
begränsa åtkomsten. Ett modellstyrt `signalera`-anrop är fortfarande en
bästa möjliga signal, även med en fast adress.

## Underlag

- [Cloudflare: Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)
- [Cloudflare: Set up Cloudflare Tunnel](https://developers.cloudflare.com/tunnel/get-started/)
- [Chrome: permissions API](https://developer.chrome.com/docs/extensions/reference/api/permissions/)
