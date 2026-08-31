# Contributing to Bullshark / Contribuer à Bullshark

First off — thanks for being here. Bullshark exists because people like you believe their data belongs to them.  
Avant tout — merci d'être là. Bullshark existe parce que des gens comme toi pensent que leurs données leur appartiennent.

---

## Before anything else / Avant toute chose

Bullshark is a **community-driven fork** of [Sharkord](https://github.com/Sharkord/sharkord), focused on gaming communities and digital sovereignty. We are not trying to clone Discord feature-for-feature. We are building something focused, reliable, and genuinely free.

Bullshark est un **fork communautaire** de [Sharkord](https://github.com/Sharkord/sharkord), orienté communautés gaming et souveraineté numérique. On n'essaie pas de cloner Discord fonctionnalité par fonctionnalité. On construit quelque chose de ciblé, fiable et vraiment libre.

> 💙 Support the original Sharkord creator: [ko-fi.com/diogomartino](https://ko-fi.com/B0B71U3476)

---

## What we are building / Ce qu'on construit

### In scope / Dans le périmètre

- Bug fixes — especially anything impacting voice/audio stability
- Gaming features: Push-to-Talk, global hotkeys, noise suppression, soundboard, voice grid UI
- Performance improvements
- Security fixes
- Documentation (EN/FR)
- Deployment guides (VPS, Raspberry Pi, Docker, etc.)
- Translations

### Out of scope / Hors périmètre

- Enterprise or large-scale community features
- Features that require Bullshark to operate a central server
- Unnecessary dependencies or over-engineering
- Anything that compromises user sovereignty or adds telemetry

If you're unsure whether your idea fits — **open an issue and ask first**. We'd rather discuss it than close a PR after the work is done.

Si tu n'es pas sûr que ton idée rentre dans le périmètre — **ouvre une issue et demande d'abord**. On préfère en discuter plutôt que fermer une PR après le travail.

---

## How to contribute / Comment contribuer

### Step 1 — Open an issue first / Étape 1 — Ouvre d'abord une issue

**No issue = no PR.** Every contribution starts with a discussion.

**Pas d'issue = pas de PR.** Chaque contribution commence par une discussion.

Your issue should / Ton issue doit :
- Clearly describe the bug or feature / Décrire clairement le bug ou la feature
- Explain why it fits Bullshark's scope / Expliquer pourquoi ça rentre dans le périmètre
- Include context: logs, screenshots, reproduction steps if applicable / Inclure du contexte : logs, captures, étapes de reproduction si applicable

Vague or low-effort issues may be closed without response.  
Les issues vagues ou sans effort peuvent être fermées sans réponse.

### Step 2 — Fork & branch / Étape 2 — Fork & branche

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/bullshark.git
cd bullshark

# Add upstream
git remote add upstream https://github.com/Neckript/bullshark.git

# Always branch from development
git checkout development
git checkout -b feat/123-your-feature
# or
git checkout -b fix/123-your-bugfix
```

### Step 3 — Code / Étape 3 — Code

Follow the standards below. Read them once — they're short.  
Suis les standards ci-dessous. Lis-les une fois — ils sont courts.

### Step 4 — Test / Étape 4 — Teste

```bash
bun install
bun run test
```

Make sure the project builds and all tests pass before submitting.  
Assure-toi que le projet build et que tous les tests passent avant de soumettre.

### Step 5 — Pull Request / Étape 5 — Pull Request

- Target the `development` branch — never `main`  
- One feature or fix per PR — no bundling unrelated changes  
- Reference your issue in the PR description: `Closes #123`  
- All CI checks must pass

---

## PR & Commit format / Format PR & commits

### PR title
```
feat(123): short description
fix(123): short description
chore(123): short description
```

### Commit messages
```
feat: short description
fix: short description
chore: short description
```

Keep messages concise and in English.  
Messages courts et en anglais.

---

## Code standards / Standards de code

- ES6+ syntax only — `const`, `let`, no `var`
- No `any` in TypeScript — use explicit types
- Named exports only — no default exports
- No unnecessary dependencies
- Follow existing project structure
- Clarity over cleverness — write code others can read

---

## Use of AI / Utilisation de l'IA

AI tools are welcome to assist development — we use them ourselves.  
Les outils IA sont les bienvenus pour assister le développement — on les utilise nous-mêmes.

However / Cependant :
- You are responsible for the code you submit — understand it before opening a PR
- AI-generated code must meet the same standards as hand-written code
- Low-effort or blindly generated submissions will be closed

---

## Community / Communauté

Bullshark is built on respect. We don't care about your level, your background, or your setup. If you want to help build something genuinely free — you're welcome here.

Bullshark est construit sur le respect. On ne juge pas ton niveau, ton parcours, ou ta config. Si tu veux aider à construire quelque chose de vraiment libre — tu es le bienvenu ici.

Be direct. Be honest. Be constructive.  
Sois direct. Sois honnête. Sois constructif.

---

## Not sure where to start? / Pas sûr par où commencer ?

Check the issues tagged [`good first issue`](https://github.com/Neckript/bullshark/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) — these are small, well-defined tasks perfect for a first contribution.

Regarde les issues taguées [`good first issue`](https://github.com/Neckript/bullshark/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) — ce sont des tâches petites et bien définies, parfaites pour une première contribution.

---

## License / Licence

By contributing, you agree that your contributions will be licensed under the MIT License.  
En contribuant, tu acceptes que tes contributions soient sous licence MIT.

---

*Build something worth owning. / Construis quelque chose qui mérite d'être possédé.*
