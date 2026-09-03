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
someone you trust.

**FR** — N'installe que des plugins dont tu as lu le code, ou qui viennent de
quelqu'un en qui tu as confiance.

## Capabilities are not a sandbox / Les capacités ne sont pas un bac à sable

**EN** — A plugin declares `capabilities` in its manifest, and the server hands
it only the `PluginContext` namespaces it declared: a plugin that did not
declare `voice` has no `ctx.voice` at all. This is least privilege over the
**SDK surface**, and it is worth having — it makes a plugin's reach reviewable
before you install it.

**It changes nothing about the list above.** A server plugin's code runs inside
the server process. It keeps filesystem access, network access, and environment
variables whatever it declared, because nothing stops it importing `node:fs`
directly. A plugin declaring only `messages` can still read your database file.

Read the declared capabilities as *a statement of intent you can check the code
against*, never as a boundary that will hold if the author lied.

**FR** — Un plugin déclare ses `capabilities` dans son manifest, et le serveur
ne lui remet que les espaces de noms du `PluginContext` qu'il a déclarés : un
plugin qui n'a pas déclaré `voice` n'a pas de `ctx.voice` du tout. C'est du
moindre privilège sur la **surface du SDK**, et ça vaut le coup — la portée
d'un plugin devient vérifiable avant installation.

**Ça ne change rien à la liste ci-dessus.** Le code serveur d'un plugin tourne
dans le processus du serveur. Il garde l'accès au système de fichiers, au
réseau et aux variables d'environnement quoi qu'il ait déclaré, parce que rien
ne l'empêche d'importer `node:fs` directement. Un plugin qui ne déclare que
`messages` peut toujours lire le fichier de ta base de données.

Lis les capacités déclarées comme *une intention que tu peux confronter au
code*, jamais comme une barrière qui tiendra si l'auteur a menti.

## Run the server in Docker / Fais tourner le serveur dans Docker

**EN** — We strongly recommend running Bullshark in a Docker container. It
won't stop a plugin from reading your server's own data, but it does limit
the blast radius to the container instead of your whole host.

**FR** — On recommande fortement de faire tourner Bullshark dans un
conteneur Docker. Ça n'empêchera pas un plugin de lire les données du
serveur, mais ça limite les dégâts au conteneur plutôt qu'à toute la
machine hôte.
