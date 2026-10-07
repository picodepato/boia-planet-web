# Plan 018 — Partners deck: every feature of the site, what is missing to go live

Status: active
Created: 2026-10-07
Base branch: main
Goal: Hernán presents BOIA.PLANET to all BOIA partners. Build a PowerPoint (.pptx, ~60 slides, 8 parts) that walks every section of the site with mobile screenshots taken automatically: what each section is and has, what is missing before it can go live (each item tagged «Necesario para salir» or «Puede esperar»), and a closing «Preguntas y propuestas» slide per section. It mixes Álvaro's sign-off (what he must approve or provide) with an internal inventory, so the partners know what stands between today and publishing the site as soon as possible. No app code changes.
Test command: export PYTHONUTF8=1 && sh tools/spec/checks.sh && pnpm lint && pnpm typecheck && pnpm deck && git checkout -- docs/presentacion/boia-planet.pptx
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

Notes for every task (this machine is Windows 10, Git Bash): `PYTHONUTF8=1` makes the Python checks read UTF-8; if a guard blocks the chained test command, run its steps one by one. `pnpm deck` exists from T204 on (before that, run the Test command without it). Playwright, first time in a worktree: `pnpm --filter @boia/web exec playwright install chromium`; the machine is slow under load, rerun only what fails. LibreOffice is installed on this machine (winget, 2026-10-07; `soffice` lives in `C:\Program Files\LibreOffice\program\`): it renders the .pptx to PDF and PNG for the visual check. **Do not change the app**: no edits under `apps/web` or `packages/` except the deck capture files T204 creates (`apps/web/playwright.deck.config.ts`, `apps/web/e2e/deck/`); if a screen cannot be reached for a capture, use the existing deep-link query params, the admin demo session or test helpers, and if that is impossible, report it instead of changing the app. Never invent features: everything a slide says the site has must be checked in the running site or the code. Gaps come from `docs/TRASPASO.md`, `docs/DECISIONES.md` (open questions P2…P27, from ~line 739), `docs/spec/estado.md` (FALTA/PARCIAL), `docs/contenido-real.md`, `docs/propuestas/textos-zonas.md` and Hernán's points below. Never edit `docs/DECISIONES.md`. Never commit `apps/web/public/atlas/`, `.claude/launch.json`, `e*.log` or any `.env*` file other than `.env.example`. Never push or deploy. Plan 017 is done and integrated (2026-10-07): the deck shows the site as it is on main now, including everything plan 017 added (rankings menu, Admin photos/objects/moderation/links, Carnet 000 sign-in, data export, Halloween/Sonido door tickets, store rotating images, logout); read `docs/propuestas/2026-10-07-plan-017-guia-prueba.md` for what changed, the migrations still to apply and its open questions, which belong in the «qué falta» and «Preguntas y propuestas» slides of the matching part. Do not edit `plans/017-*.md`. Model: each task's `Model:` line says which agent runs it; never Fable. Skills: each task's block names the skills it may invoke with the Skill tool; invoke none other.

Decisions of 2026-10-07 that every task follows (Hernán's answers):
1. **Format.** A real, editable `.pptx`, 16:9, built by a script from content files so it can be regenerated when the site changes. Also a PDF copy rendered with LibreOffice. Everything lives in `docs/presentacion/` and is committed: the .pptx, the PDF, the screenshots (compressed JPEG) and the content files; the script lives in `tools/deck/`.
2. **Audience and language.** All BOIA partners: they must understand what exists and what is missing to go live as soon as possible; Álvaro must see what he has to approve or provide. Slides in **Spanish from Spain, «tú/vosotros»** (like the site), plain words, no jargon (say «cuentas de usuario» not «Supabase», explain technical items in one plain line).
3. **Structure: 8 parts, ~60 slides** (budget per part, ±2): 1 Portada, resumen y estado (~4) · 2 Landing: hero, próximo evento, filosofía, artistas, fotos, tienda, contacto, footer (~10) · 3 Páginas: eventos, artistas, fotos, tienda, legales (~7) · 4 Carnet BOIA y Ranking (~6) · 5 El océano `/mar`: islas, Boia Fiestera, personajes, secretos, descuentos escondidos, menú/HUD, barcos (~12) · 6 Minijuegos: Los Rápidos, Cañón, Castillo (~9) · 7 Admin (~8) · 8 Cierre: hoja de ruta para salir y decisiones pendientes (~4).
4. **Per section**: what it is → what it has (with screenshots) → **qué falta**, each item tagged **«Necesario para salir»** or **«Puede esperar»** → **«Preguntas y propuestas»** slide at the end of the section: open questions for Álvaro/partners and 2–4 improvement proposals written by the agent from the code and docs (marked as proposals; Hernán reviews them).
5. **Screenshots: mobile first** (most users are on phones): portrait 390×844 at device scale 2, local mode, sample content as it is today, shown inside a simple phone frame, 1–3 phones per slide. A desktop capture only where it adds something (e.g. Admin, which is used on a computer, may be desktop).
6. **Speaker notes**: only key points, 2–4 short bullets per slide.
7. **Style: BOIA brand.** Night-blue background, BOIA orange accents, wordmark and mascot, each part with its own cover. Colors from the site: `--boia-orange #ec4f24`, `--boia-orange-bright #ff5219`, `--boia-navy #12233f`, `--boia-blue #36278a`, `--violet #b9a6ff`, `--black #05080f`, `--band #07101f`, `--sea-deep #0b1830`, `--card #1a3052`, `--line #2f4a72`, `--ink-soft #c9d4e6`. Logos: `art/marca/boia-wordmark.svg|.jpg`, `art/marca/boia-mascota.svg|.jpg`, `art/marca/logo/`. **Fonts: safe fonts present on Windows and Mac** (a wide, heavy one for titles such as Arial Black; a plain sans for body), editable text, never text as images.
8. **Admin panels that need accounts** (Fiestas y QR, Socios, Rankings, Seguridad) cannot be captured on this machine: one text slide explains what they do and that they switch on when user accounts are connected (which is also a «Necesario para salir» item).
9. **Hernán's points that must appear**: Landing → every artist still needs their real link (Spotify etc.); Filosofía → Álvaro approves the text as it is or changes it; Tienda → photos of the real products; the world (`/mar`) is more or less finished, so its part mostly shows, piece by piece, what there is.

## Tasks

## T204 — Deck toolchain: generator, BOIA theme, capture harness, render check
- Status: done
- Depends on: none
- Model: opus
- Skills: anthropic-skills:pptx, frontend-design
- Goal: Everything the part tasks need so each one only writes its content file and its capture spec: a generator that turns content files plus screenshots into the BOIA-branded .pptx, a Playwright harness that takes mobile screenshots of any screen, and a render step that turns the .pptx into PDF and per-slide PNGs for the visual check. Plus a writing guide so all parts read the same.
- Context: decisions 1–8 above; the pptx skill (read it first: library choice, layout and QA advice); `apps/web/playwright.config.ts`, `apps/web/scripts/e2e-server.mjs`, `apps/web/e2e/admin-session.ts` (admin demo session through localStorage `boia.admin.demo`), `apps/web/e2e/mar-helpers.ts` (`openMar`, `steerTo`, `sheetIs`), `apps/web/app/mar/deep-link.ts` (`?cerca=`, `?ir=`, `?evento=`, `?menu=`, `?minijuego=canon|castillo&…`, `?delfin=1`, `?mascota=1`); brand files listed in decision 7; `pnpm-workspace.yaml`.
- Scope: may touch `tools/deck/` (new workspace package, e.g. `@boia/deck`, with pptxgenjs or what the pptx skill recommends), root `package.json` scripts, `pnpm-lock.yaml`, `apps/web/playwright.deck.config.ts`, `apps/web/e2e/deck/` (helpers only; it must not be picked up by the normal `pnpm e2e` run), `docs/presentacion/`, `.gitignore` (render output folder), `ESTADO.md` fragment / must not touch app code, the normal e2e config and specs, `docs/DECISIONES.md`.
- Deliverables:
  - `pnpm deck` → builds `docs/presentacion/boia-planet.pptx` from `docs/presentacion/partes/NN-<slug>.*` (one content file per part, in order 01…08) and `docs/presentacion/capturas/<NN-slug>/*.jpg`. Content files describe slides through a small set of layout helpers: portada, portada de parte, «qué es» (text + phone), teléfonos (1–3 phones with captions), «qué tiene» (bullets + phone), «qué falta» (items with the two tags, visually distinct), «preguntas y propuestas», hoja de ruta (table), texto (no image), plus speaker notes on every slide. Missing screenshots fail loudly with the file name.
  - `pnpm deck:capturas [NN]` → runs the deck Playwright specs (all, or one part's `apps/web/e2e/deck/NN-*.deck.ts`) on a built local-mode server (390×844, scale 2; a desktop project available for Admin), helper `shot(page, part, name)` saves compressed JPEG into `docs/presentacion/capturas/<NN-slug>/`; waits for fonts, 3D canvas and splash so captures are not blank.
  - `pnpm deck:render` → LibreOffice converts the .pptx to `docs/presentacion/boia-planet.pdf` (committed) and per-slide PNGs into a git-ignored folder for the visual check.
  - `docs/presentacion/GUIA.md` → how to add or edit a part, the slide budget per part (decision 3), tone (decision 2), the two tags, the «Preguntas y propuestas» rule, the gap sources (Notes), how to run the three commands. Short.
  - Placeholder content files for all 8 parts (part cover + one «pendiente» slide each) so the order is fixed; part 1 has the real cover (BOIA wordmark, «BOIA.PLANET — qué hay y qué falta para salir», date) and part 2 has one real example section done end to end (the hero: capture, «qué es», «qué falta», «preguntas y propuestas») to prove the pipeline; T205 will extend it.
- Done when:
  - `pnpm deck:capturas 02` → exit 0 and the hero JPEGs exist (not blank: check one by reading it)
  - `pnpm deck` → exit 0; `pnpm deck:render` → exit 0, PDF and PNGs exist; you looked at every rendered slide: no text overflows or is cut, phones not distorted, fonts render as safe fonts
  - `pnpm e2e --list` (normal config) does not list any deck spec
  - 3–4 rendered slide PNGs (cover, a part cover, the hero «qué falta») copied to /tmp/orchestrator-attach/boia-planet-hernan-T204/
  - Test command → exit 0
- Outcome: tools/deck generator (TS run by Node 24, parts found by file name, layout text limits fail the build), deck:capturas with blank-shot guard, deck:render via LibreOffice + pdf.js; 19 placeholder slides, hero example done · e7551f1

## T205 — Part 2: Landing
- Status: done
- Depends on: T204
- Model: opus
- Skills: anthropic-skills:pptx
- Goal: The landing part (~10 slides): hero/planet and «Zarpar», «Consigue descuentos», Entradas panel, Próximo evento, Filosofía, Artistas, Fotos, Tienda, Contacto, footer and header (Carnet, Ranking, Sonido, Cerrar sesión), reduced-motion still. Per decision 4, ending with its «Preguntas y propuestas».
- Context: `docs/presentacion/GUIA.md`; decisions 2–6 and 9 (artists' links, philosophy approval, real store photos); `apps/web/app/page.tsx` and the landing components; `packages/store/src/sample/real-content.ts` and `content.ts` (what is `muestra`: links to example.com, philosophy text); `docs/contenido-real.md`, `docs/propuestas/textos-zonas.md`; open questions P15, P17, P19, P20, P22 in `docs/DECISIONES.md`; REQ-ENT-* in `docs/spec/estado.md`.
- Scope: may touch `docs/presentacion/partes/02-*`, `docs/presentacion/capturas/02-*/`, `apps/web/e2e/deck/02-*.deck.ts`, rebuilt `docs/presentacion/boia-planet.pptx|.pdf`, `ESTADO.md` fragment / must not touch other parts' files, `tools/deck/` (report generator bugs instead, or fix only a clear bug in one small commit and say so), app code.
- Done when:
  - `pnpm deck:capturas 02` → exit 0; `pnpm deck` → exit 0; `pnpm deck:render` → exit 0
  - part 2 has 8–12 slides; every «qué falta» item has one of the two tags; Hernán's three landing points appear; the part ends with «Preguntas y propuestas»; every slide has speaker notes
  - you looked at every rendered slide of part 2: nothing overflows or is cut
  - 3 rendered slide PNGs copied to /tmp/orchestrator-attach/boia-planet-hernan-T205/
  - Test command → exit 0
- Outcome: 11 slides in two sections («Hero y Entradas», «Secciones de la landing»), each with «qué falta» and «preguntas y propuestas»; Hernán's three points in; 12 captures · 32dc555

## T206 — Part 3: Pages (events, artists, photos, store, legal)
- Status: done
- Depends on: T204
- Model: opus
- Skills: anthropic-skills:pptx
- Goal: The pages part (~7 slides): `/eventos/[slug]` (poster, price, activities, memories, «ir a la isla», Halloween/Sonido door-only tickets with 2 € off), `/artistas` and the artist invite `/artista/[code]`, `/fotos`, `/tienda` (rotating images, «sólo a la venta en la fiesta»), legal pages (invented data with a warning). Ending with «Preguntas y propuestas».
- Context: `docs/presentacion/GUIA.md`; decisions 2–6 and 9; `apps/web/app/eventos/`, `artistas/`, `artista/`, `fotos/`, `tienda/`, `legal/`; open questions P2 (ticketing platform), P3 (All Day date), P17, P19, P21 (legal owner data and review); `docs/contenido-real.md`.
- Scope: may touch `docs/presentacion/partes/03-*`, `docs/presentacion/capturas/03-*/`, `apps/web/e2e/deck/03-*.deck.ts`, rebuilt pptx/pdf, `ESTADO.md` fragment / must not touch other parts' files, `tools/deck/` (as T205), app code.
- Done when:
  - `pnpm deck:capturas 03` → exit 0; `pnpm deck` → exit 0; `pnpm deck:render` → exit 0
  - part 3 has 5–9 slides; tags, «Preguntas y propuestas» and speaker notes as in T205
  - you looked at every rendered slide of part 3: nothing overflows or is cut
  - 3 rendered slide PNGs copied to /tmp/orchestrator-attach/boia-planet-hernan-T206/
  - Test command → exit 0
- Outcome: 9 slides (events, artists + invite, photos/store, legal; 2 «qué falta», 1 «preguntas y propuestas»), 10 captures · 8d1f8c7

## T207 — Part 4: Carnet BOIA and Ranking
- Status: done
- Depends on: T204
- Model: opus
- Skills: anthropic-skills:pptx
- Goal: The Carnet and Ranking part (~6 slides): the Carnet (front with QR, back with passport-like stamps), public Carnet `/carnet/[id]`, `/sello` party QR stamp, artist Carnet, what accounts add (scan stamp, export, delete), points; `/ranking` with its four tabs (Carrera, Cañón Fantasma/Kraken, Castillo 9 boards, Puntos). Ending with «Preguntas y propuestas».
- Context: `docs/presentacion/GUIA.md`; decisions 2–6; `apps/web/app/carnet/`, `sello/`, `ranking/`, `apps/web/lib/mundo/menu/sections/ranking.tsx`; open questions P23, P24, P25, P26; D-20 (today everything lives in the visitor's browser: what changes when accounts are connected).
- Scope: may touch `docs/presentacion/partes/04-*`, `docs/presentacion/capturas/04-*/`, `apps/web/e2e/deck/04-*.deck.ts`, rebuilt pptx/pdf, `ESTADO.md` fragment / must not touch other parts' files, `tools/deck/` (as T205), app code.
- Done when:
  - `pnpm deck:capturas 04` → exit 0; `pnpm deck` → exit 0; `pnpm deck:render` → exit 0
  - part 4 has 4–8 slides; tags, «Preguntas y propuestas» and speaker notes as in T205
  - you looked at every rendered slide of part 4: nothing overflows or is cut
  - 3 rendered slide PNGs copied to /tmp/orchestrator-attach/boia-planet-hernan-T207/
  - Test command → exit 0
- Outcome: 8 slides (Carnet front/back seeded for the photo, public Carnet, sello, what accounts add, 4 ranking tabs); emoji cause found (Windows 10 lacks Unicode 14 emoji such as 🪪) · 6100627

## T208 — Part 5: The ocean `/mar`
- Status: done
- Depends on: T204
- Model: opus
- Skills: anthropic-skills:pptx
- Goal: The world part (~12 slides), piece by piece (decision 9: it is more or less finished, so mostly show what there is): arrival and controls, the boat and the boat shop, the 9 islands (Puerto de Alicante, Halloween, Sonido, Nochevieja, Benidorm, Ibiza, Tabarca and the «Tablón del faro», L'Illeta, Castillo de Santa Bárbara) and what each one does, Boia Fiestera rescue mission, characters and pickups (náufrago, talking boias, WhatsApp boia, dolphin, whirlpool, debris, chests, bottles), secrets (cueva, ánfora, campana, círculo), hidden discounts, HUD (minimap, menu sections, «?» help, Tickets in the world). Minigames are only mentioned here (part 6 covers them). Ending with «Preguntas y propuestas».
- Context: `docs/presentacion/GUIA.md`; decisions 2–6 and 9; `apps/web/app/mar/` (`deep-link.ts` for `?cerca=`, `?ir=`, `?evento=`, `?menu=`, `?delfin=1`, `?mascota=1`), `apps/web/e2e/mar-helpers.ts`, `packages/world/src/worlds/arcilla/map.ts` and `skin.ts`; open questions P14, P16, P18; TRASPASO items for `/mar` (Puerto arrival text «Isla descubierta», dev shortcuts to remove at launch, Blender places art). The world is called «Mundo principal» to users, never «Arcilla»; Acuarela is hidden and not shown.
- Scope: may touch `docs/presentacion/partes/05-*`, `docs/presentacion/capturas/05-*/`, `apps/web/e2e/deck/05-*.deck.ts`, rebuilt pptx/pdf, `ESTADO.md` fragment / must not touch other parts' files, `tools/deck/` (as T205), app code.
- Done when:
  - `pnpm deck:capturas 05` → exit 0 (3D captures are not blank or mid-splash: check them by reading the images); `pnpm deck` → exit 0; `pnpm deck:render` → exit 0
  - part 5 has 10–14 slides; tags, «Preguntas y propuestas» and speaker notes as in T205
  - you looked at every rendered slide of part 5: nothing overflows or is cut
  - 4 rendered slide PNGs copied to /tmp/orchestrator-attach/boia-planet-hernan-T208/
  - Test command → exit 0
- Outcome: 14 slides piece by piece (arrival, boat and shop, islands, Fiestera, characters, secrets, discounts, HUD), one «qué falta» + «preguntas y propuestas» («Todo el mar»), 22 captures · f54bcff

## T209 — Part 6: Minigames
- Status: running (attempt 1)
- Depends on: T204
- Model: opus
- Skills: anthropic-skills:pptx
- Goal: The minigames part (~9 slides, about 3 per game): race «Los Rápidos» (9 buoys, ramps, ghost, ranking), Cañón «Que no pare la música» (survivors-style, 2 acts, bosses, cards, weapons, loot, Fantasma/Kraken boards), «Defensa del Castillo» tower defense (3 difficulties × 5/7/10 min, mascots, Ibiza cards, 9 boards); how each is reached in the world, what it rewards. Ending with «Preguntas y propuestas».
- Context: `docs/presentacion/GUIA.md`; decisions 2–6; `apps/web/app/mar/deep-link.ts` (`?minijuego=canon&seed=&t=&dificultad=&carta=…&armas=1&botin=1&acto=&vencer=1&oferta=1`, `?minijuego=castillo&duracion=&dificultad=&islas=…&monedas=&t=&oferta=1`), `apps/web/app/mar/survivors.ts`, the race code under `apps/web/app/mar/`, e2e `mar-circuito`, `mar-canon`, `mar-castillo` specs; `plans/013`–`016` for what each game became; TRASPASO items (Castillo v3 open test questions, REQ-AVE-037, dev shortcuts that must go at launch).
- Extra (Hernán, 2026-10-07): first, in its own small commit, make deck captures draw newer emoji (Windows 10 lacks Unicode 14 ones such as 🪪): the capture harness downloads Noto Color Emoji (Google, OFL; from github.com/googlefonts/noto-emoji or Google Fonts) once into a git-ignored folder and injects it as a fallback font into every captured page (e.g. an `@font-face` + `font-family` fallback via `page.addStyleTag` or `addInitScript`), with no app change; verify on the «🪪 Mi Carnet» screen.
- Scope: may touch the deck capture harness (`apps/web/playwright.deck.config.ts`, `apps/web/e2e/deck/` helpers, `.gitignore`) for the emoji font only, `docs/presentacion/partes/06-*`, `docs/presentacion/capturas/06-*/`, `apps/web/e2e/deck/06-*.deck.ts`, rebuilt pptx/pdf, `ESTADO.md` fragment / must not touch other parts' files, `tools/deck/` (as T205), app code.
- Done when:
  - `pnpm deck:capturas 06` → exit 0 (gameplay captures show action, not menus only); `pnpm deck` → exit 0; `pnpm deck:render` → exit 0
  - part 6 has 7–11 slides; tags, «Preguntas y propuestas» and speaker notes as in T205
  - you looked at every rendered slide of part 6: nothing overflows or is cut
  - 3 rendered slide PNGs copied to /tmp/orchestrator-attach/boia-planet-hernan-T209/
  - Test command → exit 0
- Outcome:

## T210 — Part 7: Admin
- Status: running (attempt 1)
- Depends on: T204
- Model: opus
- Skills: anthropic-skills:pptx
- Goal: The Admin part (~8 slides): sign-in with Carnet 000; panels grouped by job (contenido: Página principal, Enlaces, Textos y música, Artistas, Fotos y vídeos with upload and «evento pasado»; eventos y mundo: Eventos, Descuentos, Mundo, Objetos 10-step wizard, Destino de la Fiestera, Logros y cosméticos, Temporadas; control: Moderación, Usuarios, Integraciones, Papelera, Auditoría / «Volver a la muestra», vista previa). One text slide for the account-only panels (decision 8). Ending with «Preguntas y propuestas». Admin captures may be desktop (decision 5).
- Context: `docs/presentacion/GUIA.md`; decisions 2–8; `apps/web/app/admin/`, `apps/web/e2e/admin-session.ts`, admin e2e specs; `plans/017-admin-rankings-calidad.md` (read only) for what T189–T193 added; REQ-ADM-* in `docs/spec/estado.md`.
- Scope: may touch `docs/presentacion/partes/07-*`, `docs/presentacion/capturas/07-*/`, `apps/web/e2e/deck/07-*.deck.ts`, rebuilt pptx/pdf, `ESTADO.md` fragment / must not touch other parts' files, `tools/deck/` (as T205), app code, `plans/017-*.md`.
- Done when:
  - `pnpm deck:capturas 07` → exit 0; `pnpm deck` → exit 0; `pnpm deck:render` → exit 0
  - part 7 has 6–10 slides; tags, «Preguntas y propuestas» and speaker notes as in T205; the account-only panels slide exists
  - you looked at every rendered slide of part 7: nothing overflows or is cut
  - 3 rendered slide PNGs copied to /tmp/orchestrator-attach/boia-planet-hernan-T210/
  - Test command → exit 0
- Outcome:

## T211 — Parts 1 and 8: summary, launch roadmap and pending decisions
- Status: pending
- Depends on: T205, T206, T207, T208, T209, T210
- Model: opus
- Skills: anthropic-skills:pptx
- Goal: Part 1 (~4 slides): cover, what BOIA.PLANET is (two ways to convert: tickets and the 3D world), map of the deck, where it stands today (test version at https://boia-planet-roan.vercel.app with a QR, everything in the visitor's browser, sample content). Part 8 (~4 slides): **hoja de ruta para salir**, gathering every «Necesario para salir» item from parts 2–7 plus the global ones (user accounts/production database, final domain, analytics, backups, legal data and review, Álvaro's sign-off), grouped by who must act (Álvaro / socios / Hernán) and in order; then the decisions pending for the partners; then a closing slide.
- Context: `docs/presentacion/GUIA.md`; decisions 2–7; all part files 02–07 (read their «qué falta» items); `docs/TRASPASO.md`, `docs/DECISIONES.md` open questions, `docs/entrega.md`, D-20.
- Scope: may touch `docs/presentacion/partes/01-*`, `docs/presentacion/partes/08-*`, their captures, rebuilt pptx/pdf, `ESTADO.md` fragment / must not touch parts 02–07 (list inconsistencies you find in them in the final message instead), `tools/deck/`, app code.
- Done when:
  - `pnpm deck` → exit 0; `pnpm deck:render` → exit 0
  - parts 1 and 8 have 3–6 slides each; the roadmap contains every «Necesario para salir» item of parts 2–7 (none dropped; count them in the final message); speaker notes on every slide; the QR opens the test URL
  - you looked at every rendered slide of parts 1 and 8: nothing overflows or is cut
  - 3 rendered slide PNGs copied to /tmp/orchestrator-attach/boia-planet-hernan-T211/
  - Test command → exit 0
- Outcome:

## T212 — Whole-deck review and polish
- Status: pending
- Depends on: T211
- Model: opus
- Skills: anthropic-skills:pptx
- Goal: Read the whole deck as a partner would and make it one consistent piece: same tone (Spain Spanish, «tú/vosotros», no jargon), same tag wording, no contradictions between parts and the roadmap, nothing invented, slide total 52–66, consistent visuals, file sizes reasonable; fix what is wrong in any part.
- Extra: recapture every part captured before T209's emoji font landed (parts 2, 3, 4 and 5 at least) so no emoji shows as an empty box; fix the T205 note: `portadaParte` can leave a «·» at the start of a wrapped second line.
- Context: `docs/presentacion/GUIA.md`; decisions 1–9; the rendered PDF and PNGs; the final messages' inconsistency lists from T211.
- Scope: may touch everything under `docs/presentacion/`, `apps/web/e2e/deck/`, `tools/deck/` (small fixes), `ESTADO.md` fragment, `docs/TRASPASO.md` (one line pointing to the deck) / must not touch app code, `docs/DECISIONES.md`.
- Done when:
  - `pnpm deck` → exit 0; `pnpm deck:render` → exit 0; you looked at every rendered slide: nothing overflows or is cut, no placeholder «pendiente» slide is left
  - total slides 52–66; every section ends with «Preguntas y propuestas»; every slide has speaker notes
  - `docs/presentacion/boia-planet.pptx` ≤ 30 MB and the PDF exists; both paths given in the final message
  - the PDF copied to /tmp/orchestrator-attach/boia-planet-hernan-T212/
  - Test command → exit 0
- Outcome:

## Decisions
- 2026-10-07 approval: plan 017 is integrated; the deck covers what it added and its open questions (Hernán)
- 2026-10-07 setup: fresh-worktree probe skipped, same setup as plan 017 earlier today (orchestrator)

- 2026-10-07 T204: tools/deck added to pnpm-workspace.yaml; parts export `titulo` + default (d: Deck) => void; captures named without extension, `NN-slug/name` for another part's; desktop captures in `NN-*.escritorio.deck.ts`; logos converted from SVG at build; PDF→PNG with pdf.js (no pdftoppm); fixed hex colors; .pptx/.pdf conflicts: keep either side and rebuild (agent)
- 2026-10-07 run: part tasks rebuild the binary .pptx/.pdf; on integration conflicts in those two files only, the orchestrator keeps main's side and the next task (or T212) rebuilds (orchestrator)

- 2026-10-07 T206: one «qué falta» + one «preguntas y propuestas» for the whole part to fit the budget; store captures with reduced motion; port 3226 because EA Desktop holds 3216 (agent)
- 2026-10-07 run: Test command now ends with `git checkout -- docs/presentacion/boia-planet.pptx`: `pnpm deck` rebuilds the binary on main and left it dirty, blocking the next merge (orchestrator)

- 2026-10-07 T205: two sections in part 2; contact shown on the Filosofía capture; «Cerrar sesión» only in notes (never shows in local mode); «probar admin» at launch asked as a question; port 3241 (EA Desktop holds 3215) (agent)
- 2026-10-07 run: binary-only conflicts go back to the agent to merge main and rebuild (orchestrator)

- 2026-10-07 T207: 8 slides; Carnet captures seeded with test stamps, 180 points and scores (notes say so); ranking dropdowns opened for the shot (agent)
- 2026-10-07 run: Noto Color Emoji downloaded for deck captures only, done first in T209; T212 recaptures earlier parts (Hernán)
- 2026-10-07 run: `.gitattributes` `merge=ours` + local `merge.ours.driver true` for the deck .pptx/.pdf so binary conflicts stop; stale binaries are refreshed by the next build and T212 (orchestrator, commit 23aa0fc)

- 2026-10-07 T208: one «qué falta»/«preguntas» for the whole world; help button is «!» in the app so slides say «!»; L'Illeta only as a bullet (budget); boat-shop capture scrolled past the «Acuarela ilustrada» row (agent)

## Proposals (new scope)
- 2026-10-07 T208: the boat shop shows a boat «Acuarela ilustrada · De serie» although Acuarela is hidden (app text)
- 2026-10-07 T208: `island.secretHint` («Por aquí cerca huele a secreto») is defined but never shown in /mar
- 2026-10-07 T205: the Admin cannot edit the Filosofía text
- 2026-10-07 T205: `portadaParte` can leave a «·» at the start of a wrapped second line (tools/deck) → T212
- 2026-10-07 T206: deck capture browser has no emoji font, so emoji in the site draw as empty boxes in captures (e.g. before «Mi Carnet»)
- 2026-10-07 T204: deck:capturas passes extra Playwright args through the shell on Windows; args with spaces may split

## Log
- 2026-10-07 20:55 T204 launched · attempt 1 · agent afe0ac150546d92a4 · opus
- 2026-10-07 21:05 T204 done · branch worktree-agent-afe0ac150546d92a4 → e7551f1
- 2026-10-07 21:10 T205 launched · attempt 1 · agent a24b381821604ec59 · opus · DECK_PORT 3215
- 2026-10-07 21:10 T206 launched · attempt 1 · agent a7fe0565a25277bf6 · opus · DECK_PORT 3216
- 2026-10-07 21:15 T206 done · branch worktree-agent-a7fe0565a25277bf6 → 8d1f8c7
- 2026-10-07 21:18 T207 launched · attempt 1 · agent a4413a0b26814587c · opus · DECK_PORT 3235 · also fixes emoji in captures
- 2026-10-07 21:30 T205 conflict on pptx/pdf only → sent back to agent to merge main and rebuild
- 2026-10-07 21:35 T205 done · branch worktree-agent-a24b381821604ec59 → 32dc555
- 2026-10-07 21:37 T208 launched · attempt 1 · agent a15d4a39f1e9e9d1d · opus · DECK_PORT 3255
- 2026-10-07 21:55 T207 conflict on pptx/pdf only → sent back to agent to merge main and rebuild
- 2026-10-07 22:05 T207 done · branch worktree-agent-a4413a0b26814587c → 6100627
- 2026-10-07 22:08 T209 launched · attempt 1 · agent ac5c3a5bb0c50520c · opus · DECK_PORT 3265 · emoji font first
- 2026-10-07 22:40 T208 done · branch worktree-agent-a15d4a39f1e9e9d1d → f54bcff (binaries kept main's side via merge=ours)
