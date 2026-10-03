# Plan 007 — The landing as one continuous scroll

Status: active
Created: 2026-10-03
Base branch: main
Goal: Hernán and Álvaro's design of 2026-10-03 for the landing of BOIA.PLANET: a single continuous scroll that starts in the cinematic entry (planet, «BOIA», «Zarpar») and continues into the normal page (tickets, events, photos, artists) when the visitor scrolls. The hero is a three.js scene bound to the scroll — the camera dives from the planet to the sea by the port and then advances slowly over the water while the light goes from golden hour to night, with the blocks sliding over it on cards — not flat parallax layers. «Zarpar» still enters /mar (D-24); Tickets is visible from the first paint; a clear hint says the page scrolls. Codex's 2D parallax prototype is discarded: everything starts from zero. Mobile first, no jank, no layout shift; reduced motion or low power get a static version without 3D. Content stays `muestra`; the final art is Álvaro's call.
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

Notes for every task (this machine is Windows 10, Git Bash): the two `packages/db` suites need a local Postgres that this machine does not have, hence the exclude; `PYTHONUTF8=1` makes the Python checks read UTF-8; if a guard blocks the chained test command, run its steps one by one. E2E: `E2E_PORT=<free port> pnpm e2e <spec files> --workers=1` (first time in a worktree: `pnpm --filter @boia/web exec playwright install chromium`); the machine is slow under load, rerun only failing specs; the full e2e run is done once by the orchestrator at the end of the plan, never per task. Blender 5.2.2 LTS is at `C:/Users/alvar/Blender/blender-5.2.2-windows-x64/blender.exe` (not on PATH); `Blender -b -P tools/blender/<script>.py -- …` works with it. UI strings only by key in `apps/web/lib/i18n/`. When a REQ moves, update `docs/spec/estado.md` with its test (`python3 tools/spec/estado.py` must pass). Content (dates, tickets, photos, texts, links) stays `muestra`; the final hero art is approved by Álvaro: mark it `muestra`/blocked, never decide it. Never commit `apps/web/public/atlas/` or `.claude/launch.json` (untracked, local). Never push or deploy. Never edit `docs/DECISIONES.md`: draft the decision text and leave it for Hernán (T83). Skills: each task's block names the skills it may invoke with the Skill tool; invoke none other. Model per task is given in its block; the orchestrator passes it to the agent. From 2026-10-03 03:10 every task launched runs on Opus 5.5 (Hernán).

Landing budget: `apps/web/scripts/landing-budget.mjs` fails `pnpm build` over the cap. It counts the gzip of HTML + JS chunks + CSS + fonts of the critical path of `/`; lazy images and whatever three.js loads on demand do not count. Hernán raised the cap from 192 kB to **200 kB** on 2026-10-03 (T79 sets it); at the start of this plan the landing measures 189.6 kB.

Decisions of 2026-10-03 that every task follows (interview, Hernán):
1. `/` plays the appearance (planet, letters «BOIA») as today (D-21) and then **rests** with «Zarpar» + «Entradas» visible from the first paint and a scroll hint. **Scrolling is the hand-off** to the landing: no automatic advance, «Saltar animación» is removed (scrolling during the appearance fast-forwards it), «Solo quiero ver las entradas» becomes the «Entradas» button (opens the Tickets panel). Direct URLs (`/#tickets`, `?intro=0`, an event or gallery) and in-app returns from /mar open with the hero already at rest, no appearance.
2. Concept: the first screen of scroll scrubs the **dive from the planet to the sea surface by the port** (the same journey «Zarpar» makes, driven by scroll instead of time); from there the sea stays as a fixed background and the **camera advances slowly over the water** as the visitor scrolls, the light going from golden hour to night; the blocks (tickets, events, photos, artists, store, contact, footer) slide over it on cards. «Zarpar» completes the dive and enters /mar with the veil (D-24).
3. The blocks below the hero get a **surface restyle** only (backgrounds, cards, spacing, section transitions): same content, structure and Tickets panel.
4. Blender delivers **low-poly GLB props** for the sea scene plus a **still render** of the same scene for the static version (reduced motion, no WebGL, low power), so both look alike. Art is `muestra` until Álvaro approves.
5. Identity: titles Archivo Expanded + Inter (`apps/web/lib/fonts.ts`, T74), the BOIA brand, the Arcilla and Acuarela worlds. The approved identity wins over any skill default.

## Tasks

## T77 — Design plan for the scroll hero and the hand-off to the blocks
- Status: done
- Model: fable
- Skills: frontend-design (invoke first with the Skill tool)
- Depends on: none
- Goal: Write the design plan Hernán approves before anything is built: palette (hex tokens for day → golden hour → night), type scale on Archivo Expanded + Inter, composition at 375, 768 and 1280 px, the layer list (what is three.js, what is CSS, what is an image), the motion map (scroll position → camera path from the planet to the sea by the port and then along the water, light, title and buttons fade, scroll hint, when each block enters), the surface restyle of the blocks, the static version (reduced motion / no WebGL / low power), accessibility notes (contrast of text over the scene, focus on dark backgrounds, aria of the canvas and hint), the i18n keys the new copy needs (`muestra` texts), and the list of 3D props for T78 with a triangle and kB budget per prop and in total. Follow the five decisions in the plan header; no automatic advance, no «Saltar animación». Mockups are storyboard frames (SVG or PNG), not app code.
- Context: this plan's header; `docs/DECISIONES.md` D-19, D-21, D-24, D-25, P19, P20; `plans/005-solo-planeta-3d.md` Decisions; T74 Outcome in `plans/006-islas-y-ajustes.md`; the landing today: `apps/web/app/(landing)/page.tsx`, `components/intro-stage.tsx`, `components/blocks.tsx`, `components/live-landing.tsx`, `landing.css`; the intro scene: `apps/web/lib/intro/run.ts`, `apps/web/lib/planeta/intro-scene.ts`, `packages/engine/src/intro/controller.ts` and `planet.ts` (phases, load budget, reduced-motion `decideEntry`); `apps/web/lib/fonts.ts`; the /mar islands and ships that can be reused (`apps/web/app/mar/engine/`, `art/islas/3d/manifest.json`, `art/barco`); existing art styles in `tools/blender/styles/` and `art/mundos`.
- Scope: may touch `docs/propuestas/2026-10-03-landing-scroll.md` (the plan), `docs/informes/img/p007-t77-*.{svg,png}` (storyboard frames) / must not touch app code, CSS, i18n files, `docs/DECISIONES.md`, `docs/spec/`.
- Done when:
  - `docs/propuestas/2026-10-03-landing-scroll.md` exists with these sections: Palette, Typography, Composition (375/768/1280), Layers, Motion map (a table scroll position → camera, light, UI, blocks), Blocks restyle, Static version, Accessibility, i18n keys, Props for Blender (name, purpose, triangle budget, kB budget, total), Open questions; at least 6 storyboard frames in `docs/informes/img/p007-t77-*` (hero at rest, mid-dive, sea with first block, night with photos, mobile hero, static version)
  - Hernán approves the plan: stop with STATUS: blocked and a QUESTION that summarises the proposal in ≤ 15 lines with ATTACH lines for the frames; when the answer arrives, apply his changes, add a line "Approved <date> by Hernán" at the top of the document, commit, and finish
  - Test command → exit 0
- Outcome: v2 design plan approved by Hernán: night-black editorial page, scrubbed dive to a deck camera between two beacons, golden → night keyed to Fotos, dark bands with sea windows, realistic props for T78 (costa, puerto, barco, boya: 8 900 tris / ≈205 kB, caps 12 000 / 220 kB) and a post pass; docs/propuestas/2026-10-03-landing-scroll.md → 8dc402c

## T78 — Hero 3D art from Blender: GLB props and the still render
- Status: done
- Model: fable
- Skills: blender-art-direction-intake (brief from T77's document; ask Hernán only if something blocks), blender-modeling-workflow, blender-procedural-workflow (only for scattering or repeated geometry), blender-rendering-workflow, blender-asset-validation (always, before finishing); blender-iterative-refinement only if validation fails
- Depends on: T77
- Goal: Build the props T77's approved document lists in §12 for the sea scene (costa, puerto with its beacons and lamps, a realistic barco, a navigation boya, emissive light meshes: realistic set dressing, nothing cartoon; no mascot, no clouds or gulls, no clay ships — T77 v2, approved by Hernán; the planet and the horizon islands come from code) as reproducible Python scripts under `tools/blender/landing/`, exported to GLB under `art/landing/3d/` with a `manifest.json` (same conventions as `art/islas/3d/manifest.json`: id, file, height, scale, triangles, materials), within T77's budget (≤ 12 000 triangles and ≤ 220 kB in total including the 512² atlas, ≤ 4 materials per prop, no Draco because /mar has no decoder, textures baked or vertex colours). Render the still of the hero scene for the static version from Blender with the same props, palette and camera as T77 §12 says (camera as frame 03 without the band; real water, volumetric haze, DOF, film grain): `art/landing/hero-still-1600.webp` and `hero-still-800.webp` (≤ 120 kB and ≤ 50 kB), plus the night still T77's static version needs. Validate every GLB with the asset-validation skill (evaluated triangles, materials, hierarchy, fresh reimport, multiview renders) and write the report. Everything is `muestra`: Álvaro approves the final art later (note it in the report, do not block on it).
- Context: T77's document and frames; `tools/blender/README` section of the root `README.md` ("Islas de Blender en el mar 3D"), `tools/blender/export_islas_glb.py`, `tools/blender/islas/*.py` (the island modules are the model to follow), `tools/blender/render.py`, `tools/blender/style.py` and `styles/`, `tools/blender/mascota.py` (the Boia mascot), `tools/blender/check.py` and the schemas (`isla3d.schema.json`, `manifest.schema.json`); T69–T71 Outcomes and Decisions in `plans/006-islas-y-ajustes.md`; `tools/spec/checks.sh` (the art check must keep passing).
- Scope: may touch `tools/blender/landing/**`, `art/landing/**`, `tools/blender/check.py` and schemas if the new manifest needs them, `docs/informes/p007-t78-arte-hero.md` and `docs/informes/img/p007-t78-*` / must not touch `apps/web/**` (T79 integrates the GLBs), the island or ship scripts, `art/islas`, `art/barco`.
- Done when:
  - `"C:/Users/alvar/Blender/blender-5.2.2-windows-x64/blender.exe" -b -P tools/blender/landing/export_landing_glb.py` → exit 0 and writes every GLB listed in `art/landing/3d/manifest.json`
  - `"…/blender.exe" -b -P tools/blender/landing/render_hero_still.py` → exit 0 and writes the webp stills within their kB limits
  - the validation report `docs/informes/p007-t78-arte-hero.md` lists, per prop, evaluated triangles, materials, kB and the fresh-reimport result, all within budget, with the multiview renders in `docs/informes/img/p007-t78-*.png`
  - `python3 tools/blender/check.py` (or the check that `tools/spec/checks.sh` runs over `art/`) → exit 0
  - Test command → exit 0
- Outcome: costa, puerto, barco, boya GLBs (6 222/12 000 tris, 203/220 kB, all pass fresh-import validation) with manifest + `escena` block (camera, poses, sun/moon) for T79; golden and night stills 1600/800 webp within limits; check.py gains a landing-glb check → 6e2002a

## T79 — Scroll-bound three.js hero and the hand-off to the landing
- Status: done
- Model: opus (Opus 5.5)
- Skills: frontend-design (for the integration of the hero and the blocks' surface restyle; T77's approved document wins over the skill's defaults)
- Depends on: T77, T78
- Goal: Build T77's approved design on the existing intro: `/` plays the appearance (controller phases up to the pause) and rests with «Zarpar», «Entradas» and the scroll hint; from there the page scrolls and the scroll position drives the scene — the dive from the planet to the sea by the port (reuse the Zarpar camera path, scrubbed instead of timed), then the slow advance over the water with the light change — with the canvas fixed under the blocks, which scroll over it on cards with the surface restyle; scrolling during the appearance fast-forwards it; no automatic advance; «Saltar animación» removed; «Solo quiero ver las entradas» becomes the «Entradas» button that opens the Tickets panel; «Zarpar» completes the dive and enters /mar as today (veil, `router.push(ZARPAR_HREF)`, `explore_start` source `intro`); direct URLs (`/#tickets`, `?intro=0`, events, galleries) and in-app returns from /mar open at rest without the appearance (D-21 rules for which URLs replay the entry stay). The scene stays loaded on demand (dynamic import) and the GLB props of T78 load after the first frame; reduced motion, no WebGL, a scene that misses its budget, or low power show the static version (T78's still, same layout, normal page scroll, no camera motion). No layout shift: reserve the hero's height and size the canvas from CSS; Tickets CTA visible in the first paint without scrolling. `landing_view` fires once when the visitor scrolls past the hero (first hand-off). Set the landing budget cap to 200 kB in `apps/web/scripts/landing-budget.mjs` (Hernán, 2026-10-03). Adapt `intro.spec.ts`, `landing.spec.ts` and `tipografia.spec.ts` to the new flow (document each changed assertion and why in ESTADO) and keep the Admin draft preview working. All texts by key in `apps/web/lib/i18n/` (`hero.*`, `intro.*`), marked `muestra`. Two additions from Hernán (2026-10-03), fitted into T77's editorial style and noted as an addendum at the end of T77's document: (a) the BOIA logo (the wordmark in `art/marca`, already used by `components/brand-logo.tsx`) appears on the page, at least large in the footer on the night sea; (b) Spotify links, as observatoriofestival.com does: a «Escúchalo en Spotify» link to the BOIA playlist in the artists band (and the footer), and a small Spotify link on each artist that has one — plain links opening in a new tab, no embedded player and nothing loaded from Spotify (no third-party requests, no cookies); URLs come from content (T82 makes them editable) and are `muestra` until P15.
- Context: T77's document (`docs/propuestas/2026-10-03-landing-scroll.md`), T78's `art/landing/3d/manifest.json` and stills; `apps/web/app/(landing)/page.tsx` (boot script, `data-entry`/`data-intro`), `components/intro-stage.tsx`, `components/landing-client.tsx` (analytics, Tickets panel), `components/live-landing.tsx`, `components/blocks.tsx`, `landing.css`, `layout.tsx`; `apps/web/lib/intro/run.ts` (IntroRun singleton, rAF loop, IntersectionObserver, MAX_DPR), `load.ts` (`stillCss`, `introCss`), `zarpar.ts`, `bridge.ts`; `apps/web/lib/planeta/intro-scene.ts`, `mini-planet.ts`; `packages/engine/src/intro/controller.ts`, `planet.ts` (`loadBudgetMs`, `bootCapMs`, `decideEntry`); the /mar GLB loader `apps/web/app/mar/engine/models.ts` (reuse its loading approach); `apps/web/e2e/intro.spec.ts`, `landing.spec.ts`, `tipografia.spec.ts`; `apps/web/app/admin/vista-previa/`; D-21, D-24 in `docs/DECISIONES.md`.
- Scope: may touch `apps/web/app/(landing)/**`, `apps/web/lib/intro/**`, `apps/web/lib/planeta/**`, `apps/web/lib/landing/**` (new), `packages/engine/src/intro/**`, `apps/web/lib/i18n/`, `apps/web/scripts/landing-budget.mjs` (cap only), `apps/web/app/admin/vista-previa/` (only to keep the preview working), the three e2e specs above, `apps/web/app/globals.css`, an addendum at the end of `docs/propuestas/2026-10-03-landing-scroll.md`, the artist and links content types and sample fixtures only as far as the Spotify links need / must not touch `apps/web/app/mar/**` (read only), the Tickets panel logic and checkout, content data and the Admin, `art/`, `tools/`.
- Done when:
  - Test command → exit 0, with the budget line of `pnpm build` ≤ 200 kB (record the value in ESTADO)
  - `E2E_PORT=<free> pnpm e2e intro.spec.ts landing.spec.ts tipografia.spec.ts --workers=1` → exit 0 in both projects (desktop and mobile)
  - a new `apps/web/e2e/landing-scroll.spec.ts` → exit 0 at 375×812 and 1280×800: Tickets CTA and «Zarpar» visible without scrolling at first paint; after the appearance the scene reports the rest phase; scrolling one viewport puts it in the sea phase and scrolling back returns it (read from `window.__boiaIntro` or a `data-` attribute the page exposes); the first block is on screen after the dive; «Zarpar» has `href` `/mar?menu=bienvenida` and lands on /mar; with `prefers-reduced-motion: reduce` there is no WebGL canvas and the still is shown; cumulative layout shift during load and a scripted scroll < 0.05 (PerformanceObserver `layout-shift`); `/#tickets` and `/?intro=0` open at rest with no appearance
  - the same spec checks that the footer shows the BOIA logo (an `img`/`svg` with accessible name «BOIA») and that the artists band has a Spotify link (`a[href*="spotify"]`, `target=_blank`, `rel` including `noopener`) and no request to a Spotify domain is made on load
  - screenshots `docs/informes/img/p007-t79-{reposo,zambullida,mar,noche,estatica}-{mobile,desktop}.png`
- Outcome: appearance → rest with «Zarpar» + «Entradas» from first paint; scroll scrubs the dive and the sea advance with T78's props; dark editorial bands; static still for reduced motion/no WebGL/saveData; BOIA logo in the footer, Spotify links (playlist + optional per artist); cap 200 kB, landing 192.4 kB; landing-scroll.spec 10/10, 74 e2e pass → fbb310b

## T80 — Performance and budget
- Status: done
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T79
- Goal: Keep the landing within 200 kB gzip and as low as possible, and the scroll free of jank on phones, without changing the visual result: defer whatever the first view does not need (Tickets panel code, analytics, scroll code after the hero rests, CSS of the lower sections) to lazy chunks; render only when the scroll position or a time-based animation changes; cap DPR at 1.5; pause while the tab is hidden or the hero is idle; cap the three.js frame cost on mobile (T57 did 30 fps and ¼ frame time for the hero: measure whether it still fits); load the GLB props and the stills lazily and sized per viewport; low-power detection (`navigator.deviceMemory ≤ 4`, `hardwareConcurrency ≤ 4`, `saveData`, or a first-frames probe under 30 fps) switches to the static version. Measure in Chromium with 4× CPU throttling at 375×812 and report the numbers in ESTADO. Measuring on a real phone is Hernán's by hand: list what to look at in ESTADO.
- Context: T79's Outcome and ESTADO section; `apps/web/scripts/landing-budget.mjs` (what counts); `apps/web/lib/intro/run.ts` (MAX_DPR, IntersectionObserver, rAF loop), `apps/web/lib/landing/**`, `apps/web/lib/planeta/**`; T57 Decisions in `plans/005-solo-planeta-3d.md`; `apps/web/next.config.*`; `apps/web/e2e/landing-scroll.spec.ts`.
- Scope: may touch loading, chunking and rendering code in `apps/web/lib/intro/**`, `apps/web/lib/landing/**`, `apps/web/lib/planeta/**`, `apps/web/app/(landing)/**` (dynamic imports, image sizes), `apps/web/next.config.*`, a new `apps/web/e2e/landing-perf.spec.ts` or `apps/web/scripts/landing-perf.mjs` / must not touch the design (pixel output identical at rest and in the sea phase), `apps/web/app/mar/**`, content, `art/`, `tools/`.
- Done when:
  - Test command → exit 0; budget line ≤ 200 kB and not above T79's value (record it)
  - `E2E_PORT=<free> pnpm e2e landing-perf.spec.ts --workers=1` → exit 0: with CDP CPU throttling 4× at 375×812, during a scripted 6 s scroll from the hero to the footer the 95th percentile frame time ≤ 50 ms and no long task > 200 ms after the scene is ready; the reduced-motion and low-power paths create no WebGL context
  - `E2E_PORT=<free> pnpm e2e landing-scroll.spec.ts intro.spec.ts --workers=1` → exit 0 (nothing visible changed)
- Outcome: hero runtime and LandingClient lazy, three.js after load, quality levels in motion with a first-frames probe, shaders precompiled, GLBs on idle; landing 192.4 → 184.8 kB; 4× CPU at 375×812: p95 33.4 ms, longest task 133 ms (SwiftShader) → b4808c1

## T81 — Accessibility, reduced motion and the e2e of the whole flow
- Status: done
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T79
- Goal: The scroll landing is usable without a mouse, by screen readers and with reduced motion: axe reports 0 violations at rest, after the dive and at the footer, with and without the Tickets panel; «Zarpar», «Entradas», the scroll hint and the skip-to-content link are reachable by keyboard in a sensible order with a visible focus on the dark scene; the fixed canvas is `aria-hidden` and the hint has text; text over the scene keeps ≥ 4.5:1 contrast at the design's tokens (check T77's palette against the still and the night phase); `prefers-reduced-motion: reduce` gives the static version with no camera motion and nothing autoplaying; Escape and Back keep working on the panel. Extend `landing-scroll.spec.ts` (or add `landing-a11y.spec.ts`) to cover the whole flow on desktop and mobile: appearance → rest → scroll → blocks → back to top; «Zarpar» → /mar; `/#tickets`; `?intro=0`; Back from /mar; reduced motion; no WebGL; slow scene; with screenshots.
- Context: T79's Outcome; `apps/web/e2e/landing.spec.ts` (existing axe checks), `landing-scroll.spec.ts`, `intro.spec.ts`; `apps/web/app/(landing)/components/intro-stage.tsx`, `landing-client.tsx`, `landing.css`; T77's Accessibility section; `apps/web/lib/i18n/es-web.ts`.
- Scope: may touch e2e specs, aria attributes, focus order and focus CSS in `apps/web/app/(landing)/**`, i18n keys for labels, `docs/informes/img/p007-t81-*` / must not touch the scene's rendering or loading code (`lib/intro`, `lib/planeta`, `lib/landing` — T80), content, `apps/web/app/mar/**`.
- Done when:
  - `E2E_PORT=<free> pnpm e2e landing-scroll.spec.ts landing.spec.ts intro.spec.ts --workers=1` → exit 0 in both projects, with axe 0 violations at the three scroll positions
  - screenshots `docs/informes/img/p007-t81-{reposo,bloques,pie,reducido}-{mobile,desktop}.png`
  - Test command → exit 0
- Outcome: axe 0 violations (any impact) at rest, after the dive and at the footer, with and without the panel; pixel contrast check e2e/contrast.ts, all texts pass with the design tokens; reduced motion pauses the artist rotation; 70 e2e pass; landing 192.5 kB → 37759ce

## T82 — The landing ready for real content
- Status: running (attempt 1)
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T79
- Goal: Without touching the scroll scene, make Álvaro's real content drop in without code: the BOIA Club · Halloween poster (P19) as an image slot of the priority event (content field with the `muestra` "cartel próximamente" placeholder today), the artists' photos (P17) through the existing avatar field with a documented folder, naming and fallback, and the real links (P15: tickets, store, WhatsApp, Instagram, email, the BOIA Spotify playlist and each artist's Spotify) in one content place with `muestra` flags that mark them visibly until they are real. Write `docs/contenido-real.md`: what to deliver, format (size, ratio, file type, max kB), and the exact file or Admin field where each goes. Content stays `muestra`.
- Context: `apps/web/app/(landing)/components/blocks.tsx`, `event-*`, `artist-*`, `site-header`, footer blocks; the content and sample data (`resolveHome`, `useLiveHome`, the local repository in `packages/store`, sample content files, `packages/contracts` types); the Admin (`apps/web/app/admin/`), `docs/DECISIONES.md` P15, P17, P19; `docs/entrega.md`.
- Scope: may touch content types and sample fixtures, the block components' slots, Admin fields, `docs/contenido-real.md`, `docs/entrega.md` / must not touch `apps/web/lib/intro/**`, `lib/planeta/**`, `lib/landing/**`, the hero section of `landing.css`, `apps/web/app/mar/**`.
- Done when:
  - a vitest proves that a fixture with a poster, artist photos and real links renders them in the blocks and that the sample content renders the `muestra` placeholders → pass
  - `docs/contenido-real.md` exists with one row per item (P15, P17, P19 and the Carnet photos) naming format and destination
  - Test command → exit 0; the budget line moves by ≤ 0.5 kB from T80's value
- Outcome:

## T83 — Docs: spec, ESTADO, TRASPASO and the decision draft
- Status: pending
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T80, T81, T82, T84
- Goal: Bring the documents in line with the scroll landing: `docs/spec/estado.md` for every REQ-ENT the new flow changes (at least REQ-ENT-001, 002, 003, 006, 007, 008, 009, 010, 014, 017, 019, 038 and the performance and accessibility REQs that T80 and T81 now prove) with their proof linked; `docs/spec/09-requisitos.md` where the requirement text itself changed (cite "plan 007" and the decision draft); the top section of ESTADO.md for the plan; `docs/TRASPASO.md` (state, final landing weight, what Hernán measures by hand, what Álvaro must approve: hero art, Druk licence, content); README (how the scroll hero works, the static version, the Blender landing scripts, the 200 kB cap). Draft the decision text for Hernán as `docs/propuestas/2026-10-03-D-26-borrador.md` (the scroll landing: what changes in D-19, D-21 and D-24 point 4; «Saltar animación» removed; the 200 kB cap) — do not edit `docs/DECISIONES.md`. Report the final landing weight in the final message.
- Context: T79–T82 Outcomes and ESTADO sections; `docs/spec/estado.md`, `docs/spec/09-requisitos.md`, `tools/spec/estado.py`; `docs/TRASPASO.md`; `README.md`; `docs/DECISIONES.md` (read only).
- Scope: may touch `docs/**` except `docs/DECISIONES.md`, `README.md`, ESTADO.md fragment / must not touch code.
- Done when:
  - `python3 tools/spec/estado.py` → exit 0 with no REQ marked HECHO without a proof
  - `docs/propuestas/2026-10-03-D-26-borrador.md` exists; `docs/TRASPASO.md` states the final landing weight and the hand checks
  - Test command → exit 0
- Outcome:

## T84 — Update the e2e specs the new hero changed
- Status: done
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T79
- Goal: T79 renamed the hero links («Tickets» → «Entradas», `hero.explore` → «Zarpar» with href `/mar?menu=bienvenida`) and changed the landing flow; these e2e specs still expect the old ones and will fail the plan's full e2e run: accesos, carnet-descuento, ciclo-evento, demo, despliegue, mar-a-bordo, tickets, mar-3d. Update their selectors and expectations to the new flow without weakening what each one proves (same assertions, new names/hrefs; if a flow changed, assert the new equivalent and say why in ESTADO). Also add the key `circuit.void.offroad` to `docs/propuestas/textos-zonas.md` so regenerating the i18n files no longer drops it (T79 restored it by hand), and check that regenerating gives no diff.
- Context: T79's ESTADO section and Decisions in this plan; `apps/web/e2e/landing-scroll.spec.ts` (the new flow), the eight specs above, `apps/web/e2e/mar-helpers.ts`; `docs/propuestas/textos-zonas.md` and the script that generates `apps/web/lib/i18n/` from it (find it in package.json or tools/).
- Scope: may touch the eight e2e specs above and their helpers, `docs/propuestas/textos-zonas.md`, the generated i18n files only as the generator writes them / must not touch app code, the landing specs T81 owns (`landing-scroll.spec.ts`, `landing.spec.ts`, `intro.spec.ts`), `apps/web/app/mar/**`.
- Done when:
  - `E2E_PORT=<free> pnpm e2e accesos.spec.ts carnet-descuento.spec.ts ciclo-evento.spec.ts demo.spec.ts despliegue.spec.ts mar-a-bordo.spec.ts tickets.spec.ts mar-3d.spec.ts --workers=1` → exit 0 in both projects
  - regenerating the i18n files from textos-zonas.md → no diff (`git status --porcelain apps/web/lib/i18n` empty)
  - Test command → exit 0
- Outcome: eight specs updated through a shared e2e/hero-helpers.ts (pills by i18n name, real-pointer tap, pastHero); 67 passed, 3 deliberate project skips; circuit.void.offroad in textos-zonas.md, regeneration gives no diff → 138c030

## Decisions
- 2026-10-03 T80: hero runtime and LandingClient are lazy chunks (lib/intro/lazy.ts, landing-client-lazy.tsx); frames at rest are full quality, frames in motion drop MSAA/resolution per a first-frames probe, under 30 fps → still; hardwareConcurrency ignored on Apple WebKit (iOS reports 4); lower-section CSS stays critical (deferring it shifts layout) (agent)
- 2026-10-03 orchestrator: added T84 (fix task) for the eight e2e specs T79's renames broke and the textos-zonas.md key it dropped
- 2026-10-03 T79: controller `paused` is the rest for every mode, `landed` only means Zarpar finished, `fallback` is the static version; «Zarpar» + «Entradas» from the first paint (plan header wins over T77 §7.1); h1 = Admin hero title visually hidden, «BOIA» on screen is the wordmark; hero.explore → «Zarpar», hero.tickets → «Entradas» via textos-zonas.md; REQ-ENT-028 (subtitle by promotions) → PARCIAL since the design removes that line; no full-screen bloom/DOF (sprite halos); low power = saveData only; Spotify playlist = footer link «Spotify», optional `spotifyUrl` per artist (agent)
- 2026-10-03 T78: seaward = Blender +Y / glTF −z; no baked atlas (vertex colours only); costa without normals (loader computes them); camera 10 m up, boat 105 m ahead to match §12's framing; f/1.0 DOF; grain 5.5 %; the manifest's `escena` block carries camera, poses and sun/moon for T79; stills reproducible in look but not bit-exact (EEVEE GPU) (agent)
- 2026-10-03 Hernán: from now on every task runs on Opus 5.5 (T78, already running on fable, continues); Spotify links like observatoriofestival.com (BOIA playlist in the artists band and footer, one per artist; plain links, no embedded player) and the BOIA logo visible on the page, at least in the footer — added to T79, URLs editable in T82
- 2026-10-03 orchestrator: T78's Goal updated to T77 v2's prop list and caps (the plan's original guess listed the mascot and clouds, which v2 dropped)
- 2026-10-03 T77: T78 caps 12 000 tris / 220 kB (512² atlas allowed for puerto); stills with real water, DOF and grain; frames are generated SVG; T79 must regrade the mini-planet's procedural clouds (mini-planet.ts) to match frame 01 (agent)
- 2026-10-03 T77: design v1 (cream sheets, low-poly props) rejected by Hernán; v2 approved: night-black editorial page in the tone of andyhardy.co and observatoriofestival.com, realistic set dressing (costa, puerto, barco realista, boya real; no mascot or clouds in the hero), hero grade separate from /mar moods, corner labels, «Zarpar» pill in the header, post pass that T80 may trim on low power (Hernán)
- 2026-10-03 interview: Codex's 2D parallax prototype (worktree 459e, 4 WebP layers in the critical path, global restyle, intro trimmed) is discarded; the scroll landing starts from zero with the improved idea (Hernán)
- 2026-10-03 interview: `/` plays the appearance (D-21) and rests with «Zarpar» + «Entradas» visible from the first paint and a scroll hint; scrolling is the hand-off; no automatic advance; «Saltar animación» removed; «Solo quiero ver las entradas» becomes the «Entradas» button; direct URLs and in-app returns open at rest (Hernán)
- 2026-10-03 interview: concept: the scroll scrubs the dive from the planet to the sea by the port (Zarpar's path), then the camera advances slowly over the water with the light from golden hour to night; blocks on cards over the fixed scene; «Zarpar» completes the dive into /mar (Hernán)
- 2026-10-03 interview: blocks below the hero get a surface restyle only; content, structure and the Tickets panel stay (Hernán)
- 2026-10-03 interview: Blender delivers low-poly GLB props plus a still render for the static version; the art is `muestra` until Álvaro approves (Hernán)
- 2026-10-03 interview: landing budget cap raised from 192 to 200 kB gzip; T79 sets it, T80 keeps it as low as possible (Hernán)
- 2026-10-03 interview: at most 2 agents in parallel (Hernán)
- 2026-10-03 interview: models: T77, T78, T79 on fable; T80–T83 on sonnet (Hernán)
- 2026-10-03 orchestrator: Telegram is not configured on this machine (config path of another computer); every question is asked in the session
- 2026-10-03 orchestrator: T76 (race road) was committed by Hernán as 2a60044 before the plan; the Blender skills and the skills README row were committed as 7009254; Codex worktrees c0e3, 2da6 and 4992 removed, 459e unregistered but its folder could not be deleted (not empty) — Hernán deletes it by hand
- 2026-10-03 orchestrator: main test command passes (69 s, landing 189.6 kB); fresh-worktree probe passes at 2a60044

## Proposals (new scope)
- 2026-10-03 T84: record.spec.ts and record-titulo.spec.ts (only with RECORD_*=1) still click the old «Zarpar»
- 2026-10-03 T80: `deviceMemory ≤ 4` sends many mid-range Android phones to the still (Hernán decides); portrait phones with DPR ≤ 2 get the soft 800 px still, `sizes="max(100vw,160vh)"` would fix it (+80 kB); in low power the still appears after hydration, not at first paint
- 2026-10-03 T81: the scroll hint sits ~7 px under the pills at 1280×800; the rest of intro.spec clicks «Zarpar» with Playwright click() and may flake under load
- 2026-10-03 T79: the resting planet is still /mar's colourful low-poly world under a darker grade (Álvaro decides the art); the Admin artist editor drops `spotifyUrl` on save (T82)
- 2026-10-03 T78: KHR_mesh_quantization would give ~40 % more geometry headroom; README section for tools/blender/landing (T83); the 8 quay lamps are mostly outside the still's frame but in the GLB for the scroll
- 2026-10-03 T77: /mar could adopt the hero's cinematic grade in a later plan
- 2026-10-03 T77: `hero.explore3d*` i18n keys look unused; the Tickets panel surface could match the blocks' new surface later; island GLBs (800–950 kB each) are too heavy for the hero, the horizon uses procedural islands

## Log
- 2026-10-03 01:05 T77 launched · attempt 1 · agent ad894fbe35db9dba4
- 2026-10-03 01:30 T77 blocked · branch worktree-agent-ad894fbe35db9dba4 · ed2e424 T77: WIP · question: approve the design plan (9 open points, cream sheets, hint copy, header pill, night keyed to Fotos, props costa/puerto/nube/gaviota)
- 2026-10-03 01:40 T77 answer sent: v1 rejected by Hernán (too low poly, childish; wants a professional festival site, refs andyhardy.co and observatoriofestival.com) · agent redoing as v2
- 2026-10-03 02:00 T77 blocked again · d4cf86c T77: WIP (v2) · question: approve v2 (night-black editorial page, realistic set dressing, 10 open points)
- 2026-10-03 02:10 T77 answer sent: v2 approved by Hernán with all 10 recommendations · agent finishing
- 2026-10-03 02:58 T77 done · branch worktree-agent-ad894fbe35db9dba4 → 8dc402c
- 2026-10-03 03:00 T78 launched · attempt 1 · agent a5e39e7ceb157d5b2
- 2026-10-03 03:47 T78 done · branch worktree-agent-a5e39e7ceb157d5b2 → 6e2002a
- 2026-10-03 03:50 T79 launched · attempt 1 · agent ae29bc95893bec4a2
- 2026-10-03 05:00 T79 done · branch worktree-agent-ae29bc95893bec4a2 → fbb310b
- 2026-10-03 05:05 T80 launched · attempt 1 · agent a27a66847508007c7
- 2026-10-03 05:05 T81 launched · attempt 1 · agent a1f05cdf5227633de
- 2026-10-03 06:00 usage limit reached; T80 and T81 still running in their worktrees (resume: section 7, orphans)
- 2026-10-03 06:10 T81 done · branch worktree-agent-a1f05cdf5227633de → 37759ce
- 2026-10-03 06:15 T80 done · branch worktree-agent-a27a66847508007c7 → b4808c1
- 2026-10-03 06:16 T82 launched · attempt 1 · agent ac871bf55b1920cb5
- 2026-10-03 06:16 T84 launched · attempt 1 · agent aa4acf4468e37ac44
- 2026-10-03 06:45 T84 done · branch worktree-agent-aa4acf4468e37ac44 → 138c030
