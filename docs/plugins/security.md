# Plugin security / Sécurité des plugins

**EN** — Plugins run with the same privileges as the server itself. There is
no sandbox.

**FR** — Les plugins tournent avec les mêmes privilèges que le serveur
lui-même. Il n'y a pas de bac à sable.

Concretely, a plugin can: / Concrètement, un plugin peut :

- **EN** Read, modify, or delete **all server data** — every message, file,
  and user record, not just what it's supposed to touch.  
  **FR** Lire, modifier ou supprimer **toutes les données du serveur** —
  chaque message, fichier et compte utilisateur, pas seulement ce qu'il est
  censé toucher.
- **EN** Execute **arbitrary code** on the machine running the server, with
  the same access as the server process (filesystem, network, environment
  variables, …).  
  **FR** Exécuter du **code arbitraire** sur la machine qui fait tourner le
  serveur, avec le même accès que le processus serveur (système de fichiers,
  réseau, variables d'environnement, …).
- **EN** A malicious or compromised plugin can therefore compromise user
  accounts, exfiltrate data, or damage the server outright.  
  **FR** Un plugin malveillant ou compromis peut donc compromettre des
  comptes utilisateurs, exfiltrer des données, ou endommager le serveur
  purement et simplement.

## Only install what you trust / N'installe que ce en quoi tu as confiance

**EN** — Only install plugins whose source you've read, or that come from
someone you trust. There is currently no capability system restricting what
a plugin can access (see the SDK's `PluginContext`) — that is future work,
not something to rely on today.

**FR** — N'installe que des plugins dont tu as lu le code, ou qui viennent de
quelqu'un en qui tu as confiance. Il n'existe pour l'instant aucun système de
capacités limitant ce à quoi un plugin peut accéder (voir le `PluginContext`
du SDK) — c'est un chantier à venir, pas quelque chose sur quoi compter
aujourd'hui.

## Run the server in Docker / Fais tourner le serveur dans Docker

**EN** — We strongly recommend running Bullshark in a Docker container. It
won't stop a plugin from reading your server's own data, but it does limit
the blast radius to the container instead of your whole host.

**FR** — On recommande fortement de faire tourner Bullshark dans un
conteneur Docker. Ça n'empêchera pas un plugin de lire les données du
serveur, mais ça limite les dégâts au conteneur plutôt qu'à toute la
machine hôte.
