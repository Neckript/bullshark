# DNS and hosting providers / DNS et hébergeurs

Pointing your domain at a Bullshark server, provider by provider — without
Cloudflare, without any intermediary you don't control.

Faire pointer ton domaine vers un serveur Bullshark, hébergeur par hébergeur —
sans Cloudflare, sans aucun intermédiaire que tu ne contrôles pas.

**EN** — This page covers only the **DNS half**. The HTTPS half — Caddy, the
reverse proxy, the self-signed fallback — is in
[getting-started, section 3](./getting-started.md#3-https--mandatory--https--obligatoire).
Read that first; this page assumes you picked Option A (a real domain).

**FR** — Cette page ne couvre que la **partie DNS**. La partie HTTPS — Caddy, le
reverse proxy, le repli auto-signé — est dans
[getting-started, section 3](./getting-started.md#3-https--mandatory--https--obligatoire).
Lis-la d'abord ; cette page suppose que tu as choisi l'Option A (un vrai
domaine).

---

## 1. What you need / Ce qu'il te faut

**EN** — One DNS record and two open ports. That's the whole surface.

**FR** — Un enregistrement DNS et deux ports ouverts. C'est toute la surface.

| What / Quoi | Value / Valeur | Notes |
|---|---|---|
| DNS record / Enregistrement DNS | `A` → your server's public IPv4 / l'IPv4 publique de ton serveur | Add `AAAA` too if you have IPv6 / ajoute aussi `AAAA` si tu as de l'IPv6 |
| Port 443/tcp | Open to the internet / ouvert sur internet | Caddy — HTTPS, web app and API / Caddy — HTTPS, app web et API |
| Port 80/tcp | Open to the internet / ouvert sur internet | Required by Caddy for the ACME challenge and the HTTP→HTTPS redirect / requis par Caddy pour le challenge ACME et la redirection HTTP→HTTPS |
| Port 40000 **tcp and udp** / **tcp et udp** | Open to the internet / ouvert sur internet | WebRTC media — voice, video, screen share. **Never proxied.** / Média WebRTC — vocal, vidéo, partage d'écran. **Jamais proxifié.** |

**EN** — Note that **4991 is not in that list**. Behind Caddy the web port
should stay bound to loopback only, so nothing reaches it except the proxy:

**FR** — Remarque que **4991 n'y est pas**. Derrière Caddy, le port web doit
rester lié à la boucle locale uniquement, pour que rien ne l'atteigne à part le
proxy :

```yaml
# docker-compose.yml
ports:
  - "127.0.0.1:4991:4991"   # web/API — reachable by Caddy only / joignable par Caddy seul
  - "40000:40000/tcp"       # WebRTC — public / public
  - "40000:40000/udp"       # WebRTC — public / public
```

---

## 2. OVH

**EN** — Works for both OVHcloud VPS and dedicated servers (Kimsufi, So you
Start, Eco). The DNS zone lives in your OVH control panel under the domain,
not under the server.

**FR** — Vaut pour les VPS comme pour les serveurs dédiés OVHcloud (Kimsufi, So
you Start, Eco). La zone DNS se gère dans l'espace client OVH sous le domaine,
pas sous le serveur.

1. **EN** — Find your server's public IPv4: it's shown on the server's page in
   the panel, or run `curl -4 ifconfig.me` on the machine itself.
   **FR** — Récupère l'IPv4 publique du serveur : elle est affichée sur la page
   du serveur dans l'espace client, ou lance `curl -4 ifconfig.me` sur la
   machine.
2. **EN** — In the control panel, open your domain's **DNS zone** and add an
   `A` record: subdomain of your choice (e.g. `chat`), target = that IPv4.
   **FR** — Dans l'espace client, ouvre la **zone DNS** de ton domaine et
   ajoute un enregistrement `A` : sous-domaine de ton choix (ex. `chat`),
   cible = cette IPv4.
3. **EN** — Leave the TTL at its default. Propagation is usually minutes, but
   give it up to an hour before concluding something is wrong.
   **FR** — Laisse le TTL par défaut. La propagation prend généralement
   quelques minutes, mais laisse-lui jusqu'à une heure avant de conclure à un
   problème.
4. **EN** — Open the firewall. OVH's network firewall is off by default on
   most ranges; the one that actually blocks you is usually the host's own:
   **FR** — Ouvre le pare-feu. Le firewall réseau OVH est désactivé par défaut
   sur la plupart des gammes ; celui qui bloque vraiment est en général celui
   de la machine :

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 40000/tcp
sudo ufw allow 40000/udp
```

**EN** — OVH dedicated servers get a **public IP directly on the interface** —
no NAT. Cloud/VPS instances at some providers do sit behind NAT; see the
`announcedAddress` trap in [section 5](#5-common-traps--pièges-courants)
either way.

**FR** — Les serveurs dédiés OVH ont une **IP publique directement sur
l'interface** — pas de NAT. Les instances cloud/VPS de certains hébergeurs sont
bien derrière un NAT ; dans les deux cas, lis le piège `announcedAddress` en
[section 5](#5-common-traps--pièges-courants).

---

## 3. Hetzner

**EN** — Hetzner splits DNS and hosting across two consoles: the Cloud Console
for the server, the DNS Console for the zone. The domain must be delegated to
Hetzner's nameservers before the zone does anything.

**FR** — Hetzner sépare le DNS et l'hébergement en deux consoles : la Cloud
Console pour le serveur, la DNS Console pour la zone. Le domaine doit être
délégué aux serveurs de noms Hetzner avant que la zone ne serve à quoi que ce
soit.

1. **EN** — Get the server's public IPv4 from the Cloud Console. Hetzner Cloud
   assigns it directly to the interface — no NAT.
   **FR** — Récupère l'IPv4 publique du serveur dans la Cloud Console. Hetzner
   Cloud l'assigne directement à l'interface — pas de NAT.
2. **EN** — In the DNS Console, add an `A` record on your zone pointing at it.
   Add an `AAAA` too — Hetzner Cloud gives every server a /64 IPv6 block.
   **FR** — Dans la DNS Console, ajoute un enregistrement `A` sur ta zone qui
   pointe dessus. Ajoute aussi un `AAAA` — Hetzner Cloud fournit un bloc IPv6
   /64 à chaque serveur.
3. **EN** — Hetzner Cloud has a **network-level firewall** that is separate
   from the host's. If you attached one, open 80, 443 and 40000 (tcp **and**
   udp) there as well, or the host firewall rules will look correct while
   traffic never arrives.
   **FR** — Hetzner Cloud a un **pare-feu au niveau réseau**, distinct de celui
   de la machine. Si tu en as attaché un, ouvre-y aussi 80, 443 et 40000 (tcp
   **et** udp), sinon les règles du pare-feu local sembleront correctes alors
   que le trafic n'arrivera jamais.

---

## 4. Other EU providers / Autres hébergeurs UE

**EN** — Scaleway, Infomaniak, Netcup, Gandi, IONOS and the rest all follow the
same shape. There is nothing Bullshark-specific to configure per provider —
only two questions to answer:

**FR** — Scaleway, Infomaniak, Netcup, Gandi, IONOS et les autres suivent tous
le même schéma. Il n'y a rien de spécifique à Bullshark à configurer par
hébergeur — seulement deux questions auxquelles répondre :

1. **EN** — *Is there a firewall in front of the machine, separate from the
   host's own?* Security groups, network firewalls, edge ACLs. If yes, the
   four ports must be open in **both** places.
   **FR** — *Y a-t-il un pare-feu devant la machine, distinct de celui de
   l'hôte ?* Groupes de sécurité, pare-feu réseau, ACL de bordure. Si oui, les
   quatre ports doivent être ouverts aux **deux** endroits.
2. **EN** — *Is the public IP on the interface, or is the machine behind NAT?*
   Run `ip -4 addr` on the server and compare with `curl -4 ifconfig.me`.
   Different values mean NAT, and `BULLSHARK_WEBRTC_ANNOUNCED_ADDRESS` becomes
   mandatory, not merely recommended.
   **FR** — *L'IP publique est-elle sur l'interface, ou la machine est-elle
   derrière un NAT ?* Lance `ip -4 addr` sur le serveur et compare avec
   `curl -4 ifconfig.me`. Des valeurs différentes signifient du NAT, et
   `BULLSHARK_WEBRTC_ANNOUNCED_ADDRESS` devient obligatoire, pas seulement
   recommandé.

**EN** — Registrar and host do not have to be the same company. Keeping the
domain at one registrar and the DNS zone at another is fine — only the
nameserver delegation has to match where you edit the records.

**FR** — Le bureau d'enregistrement et l'hébergeur n'ont pas à être la même
société. Garder le domaine chez l'un et la zone DNS chez l'autre fonctionne
très bien — seule la délégation des serveurs de noms doit correspondre à
l'endroit où tu édites les enregistrements.

---

## 5. Common traps / Pièges courants

### The legacy `SHARKORD_` prefix is silently ignored / L'ancien préfixe `SHARKORD_` est ignoré en silence

**EN** — Bullshark was forked from Sharkord and every environment variable was
renamed. **Only `SHARKORD_DATA_PATH` kept a compatibility fallback.** Every
other `SHARKORD_*` variable is read by nothing at all — no error, no warning,
no log line. A server carried over from an old install can run for months with
a setting that has never applied. Check yours:

**FR** — Bullshark est un fork de Sharkord et toutes les variables
d'environnement ont été renommées. **Seule `SHARKORD_DATA_PATH` a conservé une
reprise de l'ancien nom.** Toute autre variable `SHARKORD_*` n'est lue par
rien — pas d'erreur, pas d'avertissement, pas de ligne de log. Un serveur
repris d'une ancienne installation peut tourner des mois avec un réglage qui
n'a jamais pris effet. Vérifie les tiennes :

```bash
grep -c '^SHARKORD_' .env   # anything but 0 (or a lone DATA_PATH) is dead config
```

### An unset `announcedAddress` calls a third party at every boot / Un `announcedAddress` vide appelle un tiers à chaque démarrage

**EN** — Leave `BULLSHARK_WEBRTC_ANNOUNCED_ADDRESS` empty and the server asks
the internet what its own IP is on **every single startup**. It tries
`ipv4.icanhazip.com` first, then `api.ipify.org`, then `ifconfig.me` — a
fallback chain, so one request when it succeeds, up to three when it doesn't.

Voice still works, because the guess is usually right. But for a project whose
whole point is not depending on intermediaries, a silent outbound call to a
third party on every restart is the wrong default to leave in place. Set it:

**FR** — Laisse `BULLSHARK_WEBRTC_ANNOUNCED_ADDRESS` vide et le serveur demande
à internet quelle est sa propre IP à **chaque démarrage**. Il essaie
`ipv4.icanhazip.com` d'abord, puis `api.ipify.org`, puis `ifconfig.me` — une
chaîne de repli, donc une requête quand ça marche, jusqu'à trois quand ça
échoue.

Le vocal fonctionne quand même, car la devinette est généralement juste. Mais
pour un projet dont l'objet même est de ne pas dépendre d'intermédiaires, un
appel sortant silencieux vers un tiers à chaque redémarrage est un mauvais
défaut à laisser en place. Définis-la :

```bash
echo "BULLSHARK_WEBRTC_ANNOUNCED_ADDRESS=<your.public.ip>" >> .env
docker compose up -d
docker compose exec bullshark env | grep WEBRTC   # verify it actually landed
```

**EN** — That last line matters: a changed `env_file` does not always recreate
the container. If the variable isn't there, force it with
`docker compose up -d --force-recreate`.

**FR** — Cette dernière ligne compte : un `env_file` modifié ne recrée pas
toujours le conteneur. Si la variable n'apparaît pas, force-le avec
`docker compose up -d --force-recreate`.

### Port 40000 must never be proxied / Le port 40000 ne doit jamais être proxifié

**EN** — It carries raw RTP, not HTTP. Caddy, nginx and every other reverse
proxy will either mangle it or drop it. It stays a direct, public port — and it
needs **both** tcp and udp. Opening only tcp is the single most common cause of
"text works, voice doesn't".

**FR** — Il transporte du RTP brut, pas du HTTP. Caddy, nginx et tous les
autres reverse proxies le déformeront ou le jetteront. Il reste un port direct
et public — et il lui faut **tcp et udp**. N'ouvrir que le tcp est de loin la
première cause de « le texte marche, le vocal non ».

### `BULLSHARK_TRUST_PROXY` cuts both ways / `BULLSHARK_TRUST_PROXY` coupe dans les deux sens

**EN** — With Caddy in front, set it to `true` or every client shares Caddy's
IP: rate limits become global instead of per-user, and a single visitor can
lock everyone out. Without a proxy in front, leave it `false` or any client can
forge `x-forwarded-for` and dodge those limits entirely.

**FR** — Avec Caddy devant, mets-la à `true` ou tous les clients partagent l'IP
de Caddy : les limites de débit deviennent globales au lieu d'être par
utilisateur, et un seul visiteur peut bloquer tout le monde. Sans proxy devant,
laisse-la à `false` ou n'importe quel client peut forger `x-forwarded-for` et
contourner ces limites entièrement.

---

## 6. Verify / Vérifier

**EN** — Four checks, in order. Each one tells you which layer is wrong.

**FR** — Quatre vérifications, dans l'ordre. Chacune dit quelle couche est en
cause.

```bash
# 1. DNS resolves to your server / le DNS résout vers ton serveur
dig +short chat.example.com

# 2. HTTPS is served and the certificate is trusted / HTTPS répond et le certificat est reconnu
curl -sSI https://chat.example.com | head -1

# 3. The media port is listening on both protocols / le port média écoute sur les deux protocoles
sudo ss -lntup | grep 40000

# 4. The media port is reachable from outside / le port média est joignable de l'extérieur
#    run from another machine / depuis une autre machine
nc -vz chat.example.com 40000
nc -vzu chat.example.com 40000
```

**EN** — 1 and 2 passing while voice fails almost always means 3 or 4 —
firewall, or udp left closed. Text chat only needs HTTPS, which is exactly why
it keeps working and hides the problem.

**FR** — 1 et 2 qui passent alors que le vocal échoue, c'est presque toujours 3
ou 4 — pare-feu, ou udp resté fermé. Le chat texte n'a besoin que de HTTPS,
ce qui est précisément pourquoi il continue de marcher et masque le problème.
