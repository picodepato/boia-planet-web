# Plan 009 — Manual exploration, BOIA identity and a livelier world

Status: absorbed into plans/010-canon-beta1.md on 2026-10-04 (T98–T104 merged by T120 → c5c6339; T105–T115 continue there)
Created: 2026-10-03
Base branch: codex/world-updates
Goal: Implement the world updates explicitly requested by Álvaro: coherent BOIA identity, manual exploration, durable progress, corrected encounters, visible Carnet questions, Blender Mediterranean landmarks, bounded wildlife, sample merchandise, the Alicante harbor boat-choice popup, race-only 22-knot handling, a clear main route and custom menu icons. The 2026-10-04 steering supersedes the earlier automatic Cala shop opening and all-island route.
Test command: Set PYTHONUTF8=1; node node_modules/vitest/vitest.mjs run --exclude '**/packages/db/**' --testTimeout=30000; pnpm typecheck; pnpm lint. Run commands separately and capture every exit code. Targeted Playwright specs use E2E_PORT=<free> and --workers=1. The orchestrator runs final build, Python validators and the relevant combined E2E suite.
Worktree setup: pnpm install --frozen-lockfile. Use explicit working directories; no secrets are required for local-mode tests. Never copy .env files. On this Windows host, process-spawning tools require the normal sandbox escalation mechanism; do not repeatedly run a denied command unchanged.

## Authorization and baseline
- The user's current message explicitly authorizes task design and execution with up to two parallel workers. The only unsettled behavior was the WhatsApp achievement trigger; the user answered: opening the invitation, once only. No further batch approval is required for this requested scope.
- Integration checkout: C:/Users/alvar/.codex/worktrees/0b17/boia-planet-hernan, initial SHA fde162f2d3a5f53e5186a81ba396c92949d72c88. Keep the original main checkout unchanged; never push or deploy.
- 127 Vitest files / 1108 tests passed, exit 0 with PYTHONUTF8=1. Typecheck exit 0. Initial sandbox EPERM was environmental; the authorized retry succeeded. Baseline logs live in ignored node_modules/.
- Existing T97 mobile-card expectation is stale and its WIP 79bb8fa is unmerged; T105 finishes the check against the final intended behavior.
- Maximum two implementation workers. Each task uses a verified separate worktree and branch. Integration is serial. Worker changes must not touch plans/ or the integration checkout.

## Tasks

## T98 — BOIA typography, welcome logo and objective affordance
- Status: done
- Depends on: none
- Goal: Make the game's heading, button and panel typography visibly coherent with the landing's installed Archivo title / Inter body fonts; replace the jumping welcome buoy with the original BOIA mascot/logo; replace the help question mark with a menu-sized exclamation mark that gently attracts attention.
- Context: apps/web/lib/fonts.ts; app/globals.css; app/mar/mar.css; app/mar/a-bordo.tsx; lib/mundo/menu/sections/welcome.tsx; app/(landing)/components/brand-logo.tsx; original assets art/marca/logo/; e2e/tipografia.spec.ts and mar-ayuda.spec.ts.
- Scope: may touch game/shared-menu CSS, Welcome markup and scoped UI strings/tests / must not touch ship physics, objectives navigation, engine scene, achievements, shop or account persistence.
- Done when:
  - Original logo appears in Welcome without the jumping CSS mascot; font selectors reuse existing variables and preserve mobile readability.
  - The ! matches the menu button size, has a descriptive accessible name, and stops blinking under prefers-reduced-motion without losing visibility.
  - Relevant unit/E2E tests, typecheck and lint exit 0; provide desktop/mobile screenshots outside tracked files.
- Outcome: Integrated f30366d; 1108 unit tests, typecheck/lint exit 0; worker E2E 26 passed / 8 expected skips; desktop/mobile screenshots reviewed.

## T99 — Fifteen-knot cruising and manual objective navigation
- Status: done
- Depends on: T98
- Goal: Set the default ship's unmodified maximum cruise speed to 15 displayed knots. Make the objectives' Rumbo button only mark the destination on the minimap/map with a flashing marker; navigation remains manual.
- Context: packages/engine/src/ship/config.ts and controller tests; app/mar/guia.tsx; mar-client.tsx courseTo; minimap.tsx; engine/framing and existing mar-ayuda/mar-3d tests.
- Scope: may touch ship configuration/tests, guide/client/minimap objective state, scoped game CSS/i18n and navigation tests / must not touch mar3d.ts, decor, shop, achievements or character content. Keep other explicitly chosen travel controls working.
- Done when:
  - Default unmodified ship caps at 15 knots; turbo and boat modifiers still work and displayed units remain honest.
  - Clicking objective Rumbo leaves position, heading, throttle and autopilot unchanged; selected target is visible on the minimap and large map, changes cleanly and clears when completed. Under reduced motion the marker is steady.
  - Relevant unit/E2E tests, typecheck and lint exit 0, including manual steering after marking.
- Outcome: Integrated b4a75b6; 1115 unit tests, typecheck/lint exit 0; worker E2E 12 passed / 8 expected skips. Handling scales proportionally and preserves strict turn assertions; medal thresholds unchanged, turbo required for the sample bot medal.

## T100 — Character states, community reward, one secret and Cala discovery
- Status: done
- Depends on: T99
- Goal: After its discount is obtained, the castaway says exactly: «¿Otra vez he acabado aquí? Cómo se puede ser tan manija...». Move the WhatsApp buoy toward reachable open water. Opening its invitation completes a well-paid one-time achievement. Keep exactly one hidden achievement, the one awarding the sketch boat. Cala Cantalar opens the ship cosmetics menu on first arrival if the player has never opened it.
- Context: world/worlds/arcilla/map.ts and skins; lib/mundo/place-panels.tsx; mar-client.tsx; achievements.ts/tests; packages/store/src/sample/progress.ts; store/member/ops.ts; economy SQL/RPC limits and seeds; existing discount/shop/community E2E.
- Scope: may touch world content/coordinates, client character/menu events, progress/achievement definitions and persistence, new SQL migration only, scoped i18n and tests / must not touch mar3d.ts, decorative scenery, landing merchandise or font/welcome work.
- Done when:
  - Castaway initial reward still works once; repeated visits show the exact supplied text.
  - WhatsApp CTA grants/completes the achievement once for a fresh or existing profile, in local and member implementations. Proposed sample reward: 300 points and 50 coins, compatible with server caps and achievement redemption. Never claim verified external membership.
  - Catalog has exactly one hidden achievement rewarding boceto-lapiz; other achievements remain available visibly, and existing entitlements/claimed rewards survive.
  - Cala discovery opens Mi Barco only if never previously opened, persists that awareness per player/profile, and never repeatedly interrupts sailing. Manual opening remains available.
  - Relevant unit/E2E tests, fake-member tests, typecheck and lint exit 0. Do not apply migrations or run mutating remote tests.
- Outcome: Integrated f9dec37; 1121 unit tests, typecheck/lint exit 0; worker E2E 14 passed including stopped manual WhatsApp approach, claim/reload, Cala and initial/repeat castaway. WhatsApp zone 3.2 improves access; no SQL migration needed.

## T101 — Blender Santa Bárbara and Postiguet landmark
- Status: done
- Depends on: none
- Goal: Replace the existing small castle decoration with recognizable stylized Santa Bárbara atop Benacantil, with Postiguet beach at its foot, made in Blender and consumed by the game. Keep the scene's BOIA style and existing navigable footprint.
- Context: app/mar/engine/decor.ts, compact.ts/tests, wrap.test.ts and mar3d.ts decoration hookup; tools/blender existing export helpers and GLB checker; installed Blender executable; official references https://www.turismoalicante.es/es/alicante/castillo/castillo-de-santa-barbara-en-alicante and https://www.turismoalicante.es/es/alicante/playa/playa-del-postiguet-en-alicante . Read applicable repository Blender workflow instructions, treating the user's implementation request as authorization.
- Scope: may touch new tools/blender/decor sources/exporter, art/decor resources/manifest and validation support, decor/compact loader/hookup and geometry tests / must not touch gameplay/client/menu/achievement/merchandise files or other landmarks.
- Done when:
  - Deliver reproducible procedural Blender source, editable .blend and GLB used by /mar, with a dedicated validated contract: <=15000 triangles and <=600 kB GLB, no remote runtime dependencies, explicit scale/orientation and materials.
  - Existing castle is replaced, not duplicated. Procedural fallback works if GLB fails. Position, coastline, collision and wrap remain compatible.
  - Render day/night views and inspect from the game's usual camera; provide previews outside tracked files. Check installed Blender compatibility rather than assuming repository version.
  - Relevant geometry/unit tests, asset validation, typecheck and lint exit 0.
- Outcome: Integrated 197e8cb; 1111 unit tests, typecheck/lint and 62-manifest validation exit 0; worker E2E 4 passed. Day/night and game views reviewed.

## T102 — Occasional jumping fish and distant gull flocks
- Status: done
- Depends on: T99, T101
- Goal: Add occasional fish jumping from the sea and a small flock of gulls crossing the camera when zoomed out into the cloud layer.
- Context: engine/effects.ts Clouds; mar3d.ts scene/update/destroy; framing.ts; existing effects tests and reduced-motion handling.
- Scope: may touch dedicated wildlife module/tests and minimal mar3d hook/settings plus test observability / must not touch mar-client.tsx, navigation, landmarks, content, rewards, fonts or stores.
- Done when:
  - Fish jumps are occasional and placed in water; gulls appear only at the distant/cloud view and cross naturally. Timers and counts are bounded and resources reused/disposed.
  - No wildlife animation under reduced motion; no newly introduced timers survive scene destruction. Keep callbacks/frame work bounded.
  - Deterministic lifecycle/eligibility tests and targeted zoom/reduced-motion E2E pass; typecheck and lint exit 0. Provide a short clip or screenshots outside tracked files.
- Outcome: Integrated 5f1987b; 1129 unit tests, typecheck/lint exit 0; worker E2E 6 passed. Gull flock and peak-jump screenshots reviewed. Fixed pools, wrapped water eligibility, reduced motion and dispose covered.

## T103 — Ibiza merchandise and the same sample shop on the landing
- Status: done
- Depends on: none
- Goal: Clicking the store at Ibiza opens an internal merchandise view. The landing exposes the same shop with sample product photos and an explicit «Solo se vende en mano en la fiesta» notice.
- Context: contracts HomeBlock.store; store sample/content.ts and real-content.ts; landing/components/blocks.tsx; landing.css; mar/sheet.tsx store action; landing/access.ts; sample labels and store tests.
- Scope: may touch merchandise contract/data, internal shop route/component, landing store block/styles, Ibiza store sheet action, scoped i18n/tests and sample product assets / must not touch mar-client.tsx, engine, achievements, account forms, global typography or unrelated landing blocks.
- Done when:
  - Ibiza CTA and landing shop entry reach the same internal merchandise content; no external sandbox shop or fake online checkout is offered.
  - Show sample photos for representative BOIA merchandise; identify them visibly as samples and explain purchase is in person at the party. Prefer ImageGen skill for original raster mock photographs, with no invented claim these are actual products.
  - Mobile layout and back navigation work; images load lazily and stay outside the critical landing budget. No new purchase/account gating.
  - Relevant component/E2E tests, typecheck and lint exit 0.
- Outcome: Integrated 773260a; 1115 unit tests, typecheck/lint exit 0; worker E2E 6 passed and landing budget 186.9/200 kB. Sample photos and mobile/desktop shop inspected.

## T104 — Carnet creation always presents its questions
- Status: done
- Depends on: T100
- Goal: Verify and repair the first-time Carnet flow so the existing questions are presented at creation, answers persist and remain editable, including guest-to-member continuation. Preserve optionality of questions unless existing requirements say otherwise.
- Context: lib/mundo/carnet/carnet-editor.tsx, use-carnet.ts, menu Carnet, /carnet routes, account/sign-in continuation; carnet.spec.ts and cuenta.spec.ts.
- Scope: may touch Carnet editor/entry flow and focused account continuation only if needed, scoped i18n/tests / must not touch economy, logo/fonts, navigation, merchandise or scene.
- Done when:
  - Fresh local player sees all current questions before saving from /mar and /carnet; responses survive reload/edit.
  - Member/guest continuation is covered by mocked/local tests; existing profiles are not forced through a new mandatory questionnaire.
  - Relevant unit/E2E tests, typecheck and lint exit 0. If already working, add missing behavior coverage and fix only demonstrated gaps.
- Outcome:

- Outcome: Integrated d55de31; 1137 unit tests, typecheck/lint exit 0. Worker questionnaire E2E 4 passed and existing-card regression 6 passed; architect approved continuation, retry, cancellation and account ownership guards.

## T105 — Final regression coverage and world-update handoff
- Status: pending
- Depends on: T98, T99, T100, T101, T102, T103, T104, T106, T107, T108, T109, T110, T111, T112, T113, T114, T115
- Goal: Update the stale mobile-card test from T97 against the final intended UI; reconcile tests and document the requested changes, sample reward assumptions and remaining external setup.
- Context: mar-hud.spec.ts T97 and WIP 79bb8fa; relevant E2E files; docs/TRASPASO.md, spec/estado.md and user updates.
- Scope: may touch relevant tests and concise docs/change notes / must not introduce new product behavior, modify existing decision history, apply migrations or edit plans/.
- Done when:
  - Mobile-card assertions preserve compact height and intentional travel controls; fresh/existing player behavior for this batch is covered.
  - Test command exits 0. Orchestrator separately runs final build/budget, validators and combined relevant E2E, then obtains architect review before completion.
- Outcome:

## T106 — Durable stamps and achievement progress across sessions
- Status: running (attempt 1)
- Depends on: T104
- Goal: Diagnose and fix the user's demonstrated symptom: a stamp visible on the logged-in Carnet disappears when returning later; Carnet and castaway achievements also appear unsaved. Preserve every valid earned reward and separate persistence prevention from evidence-based recovery.
- Context: lib/repo-member.ts, account/session and sign-out lifecycle; store/member/member.ts, hydrate.ts, ops/server/snapshot; local purchase/stamp and Carnet APIs; ticketing sandbox; guest merge; member/fake-server tests. Read-only findings indicate cache removal with pending sync, snapshot-conflict server-wins, absent snapshot fields clearing progress, and sandbox stamps excluded from member snapshots; reproduce before choosing a repair.
- Scope: persistence/hydration/sync lifecycle, sample stamp storage and projection, relevant achievement reconciliation and focused UI refresh/tests. Do not change place names/catalog rewards/models/race/route/menu icons, wipe caches or queues, fabricate attendance, re-award currency by inference, apply migrations or mutate remote services.
- Done when:
  - Tests obtain sample-ticket stamp, Carnet reward and castaway progress, flush, sign out/reopen the same account from a fresh local cache and retain them. Cover local-only reload and guest-to-member continuation.
  - Offline/failed snapshot, early sign-out, retries and two-device conflicts recover without duplicating rewards; accounts A/B remain isolated. Missing server fields cannot silently erase valid unsynced evidence.
  - Sample purchase stamps remain explicitly samples, separate from verified QR attendance. Recovery uses persisted purchase/discount/ledger evidence only and is idempotent; report any historical data that lacks enough evidence.
  - Relevant local/fake-member lifecycle and browser tests pass; full safe suite, typecheck/lint exit 0. No remote writes required for validation.
- Outcome:

## T107 — Blender Alicante harbor asset and reusable place contract
- Status: running (attempt 1)
- Depends on: none
- Goal: Build a recognizable BOIA-styled Alicante marina/harbor to replace the Cala decoration at runtime later, with connected quays, moored boats, promenade, palms and harbor buildings. Establish the smallest reusable contract for the three new place assets.
- Context: .claude/skills/blender-modeling-workflow and blender-asset-validation, existing island/decor exporters and schemas, current cala bounds and scene coordinates. Blender executable: integration node_modules/.tools/blender-5.2.2-windows-x64/blender.exe. Primary references from Puerto de Alicante and Marina Alicante.
- Scope: new procedural source, editable blend, GLB, adjacent asset manifest/validator and evidence notes. Art-only: no runtime hookup, common live island manifest change, world IDs/content, client, physics or persistence.
- Done when:
  - Source reproduces blend/GLB from a clean latest Blender process; fresh import matches orientation/materials/bounds. Keep existing cala footprint and a navigable approach; polished geometry consistent with the existing clay world.
  - Explicit normalized placement contract, at most 12000 triangles and 600 kB GLB per place; use ceilings as limits, not proof of finish. Asset registry additions do not affect current runtime parsing before hookup.
  - Inspect reference images, graybox/proportions, multiview and day/night views at actual game distance; save requirement ledger and render/evidence paths. No redistributed reference images in public assets.
  - Relevant asset/unit validation, typecheck/lint pass. Deliver source, blend, GLB and metrics; no runtime completion claim yet.
- Outcome:

## T108 — Puerto de Alicante identity and explicit boat-choice popup
- Status: pending
- Depends on: T106, T107, T115
- Goal: Rename Cala Cantalar to Puerto de Alicante and show its normal place popup on approach: this is the harbor where the player can change their boat. Clicking its CTA opens Mi Barco; approaching must not automatically open the shop or show upcoming events.
- Context: cala persistent ID, source mapa.json, map.ts/content, place sheet/client, T100 ship-menu-discovery, optional island model loader and T107 asset contract.
- Scope: harbor labels/content/popup and explicit shop action, remove superseded auto-open hookup, minimal harbor loader/fallback hookup and tests. Preserve persistent cala ID and earned discoveries; no race, other-island art, persistence implementation or route topology.
- Done when:
  - Fresh and existing profiles (including old menu-seen preference) see the harbor popup, never an automatic shop; CTA opens boat selection and its purchase/equip UI. No next-events section for this place.
  - Harbor Blender asset replaces its previous decoration, with functional fallback, existing collision/approach compatibility, labels in both worlds and source/runtime parity.
  - Relevant unit/E2E, full safe suite, typecheck/lint and asset checks pass; mobile/desktop evidence reviewed.
- Outcome:

## T109 — Twenty-two knots only during the active race
- Status: pending
- Depends on: T106, T108
- Goal: Restore 22-knot base handling during actual racing, returning to 15-knots for exploration on completion, cancellation or abandonment.
- Context: steering historical config and T99 tests, race lifecycle/client, Mar3D ship-config application, boost/penalty/boat modifiers, circuit manual bot.
- Scope: race configuration selection/application, minimal engine config API if needed, lifecycle/physics tests and E2E. No medal-threshold/economy changes, art, place content, route topology or persisted record deletion.
- Done when:
  - Countdown/offering/result/exploration use 15 base; active race uses the complete historical 22-kn handling proportions. Turbo and boat modifiers compose consistently.
  - Finish/cancel/invalidate/leave/reset cannot retain race speed; clamp excess speed appropriately on return and preserve strict steering/collision behavior. Existing record version stays unless a demonstrated comparability issue is reviewed.
  - Meaningful lifecycle/physics and targeted race E2E pass; full safe suite, typecheck/lint exit 0.
- Outcome:

## T110 — Blender Benidorm skyline and club asset
- Status: pending
- Depends on: T107
- Goal: Create a recognizable Benidorm island with characteristic skyscraper silhouette, screens, a club, decorative photo cameras and the BOIA buoy mascot dressed for an adult nightclub, pole-dancing with a connected up/down loop.
- Context: Benidorm place ID from current map, T107 reusable contract, original BOIA references, primary VisitBenidorm/Intempo skyline images, Blender modeling/validation and animation guidance when available.
- Scope: Benidorm source/blend/GLB/asset manifest and named motion nodes or exported clips; no runtime/client/map geometry/persistence/race/route changes yet.
- Done when:
  - Skyline, club, cameras/screens and dressed mascot are visible in reviewed game-distance views; pole has support and mascot stays connected through sampled animation phases. Preserve BOIA clay identity and finished silhouettes.
  - Motion is reproducible in authored blend and fresh GLB import. Specify named nodes/clip, pivots, duration and reduced-motion static pose for T112. No dynamic camera access or new external media.
  - Propose modest island enlargement only if needed for legibility, recording normalized bounds for T112; same 12000-triangle/600-kB per-place ceiling.
  - Asset/animation validation, relevant unit checks/types/lint pass; source, blend/GLB and multiview/motion evidence delivered. No runtime completion claim yet.
- Outcome:

## T111 — Blender Ibiza white village and cove asset
- Status: pending
- Depends on: T110
- Goal: Remodel Ibiza with white Mediterranean houses and a readable sheltered cove, preserving its store role and BOIA style.
- Context: current tienda persistent ID, T107 place contract, primary Ibiza tourism references for white architecture/coastal coves.
- Scope: Ibiza source/blend/GLB/asset manifest and evidence only; no merchandise logic, gameplay/client/map geometry/route/persistence changes.
- Done when:
  - White houses, roofs/doors, shore and cove are clear at game distance and from complementary views; intended approach remains readable within current footprint.
  - Clean rerun, fresh import, normalized orientation/material/bounds validation and 12000-triangle/600-kB ceiling pass; final day/night multiview evidence inspected.
  - Source/editable blend/GLB, metrics and source reference notes delivered; relevant unit/types/lint checks pass.
- Outcome:

## T112 — Benidorm and Ibiza runtime integration with bounded club animation
- Status: pending
- Depends on: T106, T108, T109, T110, T111
- Goal: Use the new Benidorm/Ibiza Blender assets in the actual game, replacing old decoration and playing the requested club mascot loop.
- Context: T107/108 place loader, T110/111 models, mar3d scene/update/destroy, current island bounds/collisions/proximity/wrap.
- Scope: scene place loaders/hooks/animation/tests and required Benidorm geometry/proximity source parity adjustment. No UI/account/economy/route/icon changes.
- Done when:
  - Both models load with fallback and no duplicated island decoration. Any modest Benidorm enlargement updates visual/collision/proximity dimensions together and leaves safe separation/approach; Ibiza shop behavior remains.
  - Dance/screens motion runs from existing frame clock, bounded resources, with reduced-motion static pose and proper stop/dispose on scene destruction. Named exported clips/nodes actually used; review multiple in-game motion phases.
  - Geometry/wrap/lifecycle/asset tests and mobile/desktop loading/fallback/reduced-motion E2E pass; full safe suite/types/lint exit 0.
- Outcome:

## T113 — Transparent main route with optional exploration islands
- Status: pending
- Depends on: T108, T109, T112
- Goal: Make route lines more transparent and connect only Inicio → Puerto de Alicante → Isla de Halloween → Isla del Sonido → Isla de Nochevieja, reducing confusing crossings. Other islands stay optional destinations found through exploration/minimap.
- Context: canonical route/world source, compact scene route line/materials, route and reachability tests, guide/mission/event pins.
- Scope: route topology/opacity and necessary route tests/source parity. No reward/catalog changes, art remodeling, race handling or menu icons.
- Done when:
  - Exact main sequence is the only main connector path in both worlds; labels are correct and opacity is visibly reduced without losing useful legibility.
  - Benidorm, Ibiza and other optional islands stay reachable/visible as appropriate, with missions/events still usable and no stale all-islands path requirement.
  - Route geometry/reachability and relevant map E2E pass; full safe suite/types/lint exit 0. Capture overview evidence.
- Outcome:

## T114 — Custom BOIA menu icons
- Status: pending
- Depends on: T113
- Goal: Replace the game's generic emoji menu icons with a coherent small custom icon family matching BOIA's mascot, rounded shapes and orange/navy palette.
- Context: mar/menu.tsx and menu section metadata/shared menu components, original logo assets, existing scoped game CSS.
- Scope: code-native SVG/components, menu icon mapping and focused style/a11y tests only. Do not redraw the original logo, change feature behavior or replace unrelated world/map emoji.
- Done when:
  - All main game-menu entries have consistent distinct icons, clear text labels and accessible names; icons don't shrink touch targets or impair contrast/mobile layout.
  - Existing original mascot/logo is reused where fitting; custom SVGs remain lightweight. Relevant render/a11y and mobile/desktop menu tests/types/lint pass.
  - Provide reviewed menu screenshot; if an icon has no safe clear substitute, document the narrow limitation rather than blocking functional work.
- Outcome:

## T115 — Castaway achievement completes on rescue
- Status: pending
- Depends on: T106
- Goal: Honor the user's clarified behavior: rescuing the castaway and receiving its discount completes the castaway achievement; no unimplemented delivery-to-party mission is required.
- Context: current naufrago-fiesta achievement, discount encounter and signal hooks; durable discount/achievement state and ledger after T106.
- Scope: castaway achievement wording and rescue trigger, evidence-based readiness recovery, focused tests. Preserve stable achievement ID, reward amount, claimed history, earned discount and repeated phrase; no persistence infrastructure, world art or other catalog changes.
- Done when:
  - First rescue/discount completes the visible achievement; returning later retains completion and uses the supplied repeat phrase. Existing persisted rescue discount legitimately proves this newly defined rescue objective.
  - Recovery only completes readiness, never automatically reclaims points/coins; claimed ledger remains authoritative and reward cannot repeat across sessions/accounts.
  - Relevant local/fake-member and encounter E2E tests, full safe suite/types/lint pass.
- Outcome:

## Decisions
- 2026-10-03 user: WhatsApp achievement triggers when opening the invitation, once only.
- 2026-10-03 orchestrator: preserve manual travel controls outside the objective Rumbo action; persist Cala menu awareness per player; preserve earned boats and claims; honor reduced motion for new attention cues and fauna.
- 2026-10-03 orchestrator: rewards and merchandise remain samples; no remote migrations, messages, push or deployment are authorized by this local implementation batch.
- 2026-10-04 user: return to the same logged-in Carnet later loses its visible stamp; prioritize persistence rather than assuming a guest-session limitation.
- 2026-10-04 user: replace Cala with Puerto de Alicante and an explicit boat-choice popup; race-only base speed is 22 knots, exploration remains 15; main route has the five named stops; Blender Benidorm/Ibiza and custom menu icons requested.
- 2026-10-04 orchestrator: preserve cala/other persistent place IDs; art-only asset tasks can proceed in parallel while gameplay/catalog integration waits for durability T106. Preserve historical progress and economic ledger; sample purchase stamps must not masquerade as verified attendance.
- 2026-10-04 user: castaway achievement completes on rescue/discount, replacing the unimplemented delivery-to-party condition (T115).

## Proposals (new scope)

## Log
- 2026-10-03 planning: architect reviewed scope and ownership; two read-only surveys located implementation and test hooks; baseline 1108 tests and typecheck passed.

- 2026-10-03 T98 launched: agent /root/world_ui; branch codex/p009-t98; worktree .claude/worktrees/p009-t98; base ac6efa0; setup verified.
- 2026-10-03 T101 launched: agent /root/world_scene; branch codex/p009-t101; worktree .claude/worktrees/p009-t101; base ac6efa0; setup verified. User requests latest stable Blender installation if needed.

- 2026-10-03 T98 done: worker 71dfdbb squashed as f30366d; integration checks pass.

- 2026-10-03 T99 launched: agent /root/world_ui; branch codex/p009-t99; worktree .claude/worktrees/p009-t99; base f30366d, fast-forward to d89a50d required; setup verified.

- 2026-10-03 T98 cleanup: Git worktree registration removed, but Windows left part of .claude/worktrees/p009-t98 after a directory-not-empty error. Preserve residue for inspection; task branch retained, all source changes are integrated.

- 2026-10-03 T101 done: b5c806f squashed as 197e8cb; all integration checks pass. Latest stable Blender verified from official release and SHA256; old installed 4.0 preserved.
- 2026-10-03 T103 launched: agent /root/world_scene; branch codex/p009-t103; worktree .claude/worktrees/p009-t103; base 197e8cb; setup verified.

- 2026-10-03 T99 done: 04380e7 squashed as b4a75b6; integration checks pass. Architect reviewed proportional handling change.
- 2026-10-03 T100 launched: agent /root/world_ui; branch codex/p009-t100; worktree .claude/worktrees/p009-t100; base b4a75b6; setup verified.

- 2026-10-04 resumed: account usage interruption preserved partial T100/T103 work; same agents resumed in verified task checkouts. Architect interim review approves T98/T99/T101; final review remains pending.

- 2026-10-04 T103 done: d11a8ff squashed as 773260a; integration checks pass.
- 2026-10-04 T102 launched: agent /root/world_scene; branch codex/p009-t102; worktree .claude/worktrees/p009-t102; base 773260a; setup verified.

- 2026-10-04 T100 done: 3600829 squashed as f9dec37; integration checks pass. Architect reviewed repeated map-source parity/editing issue and buoy approach; original line endings restored, source/runtime agree.
- 2026-10-04 T104 launched: agent /root/world_ui; branch codex/p009-t104; worktree .claude/worktrees/p009-t104; base f9dec37; setup verified.

- 2026-10-04 T102 done: e546582 squashed as 5f1987b; integration checks pass. Additional peak-jump visual capture confirms subtle fish visibility; no behavior changes.
- 2026-10-04 T104 finding: online first creation skipped questions; architect reviewed shared editor continuation, preserving untouched existing member data and guarding cancellation/account changes.
- 2026-10-04 T104 done: 4f18501 squashed as d55de31; all integration checks pass. Architect reviewed expanded T106–T114 scope; durability precedes gameplay integration, asset-only work may proceed independently.
- 2026-10-04 T106 launched: /root/world_ui; codex/p009-t106; .claude/worktrees/p009-t106; base ab21e43; clean branch/SHA and frozen setup verified.
- 2026-10-04 T107 launched: /root/world_scene; codex/p009-t107; .claude/worktrees/p009-t107; base ab21e43; clean branch/SHA and frozen setup verified. Survey inspected primary image references; assets stay outside live runtime until T108/T112.
