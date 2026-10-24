# Plan 048 — Real photos and videos, no sample media, and Admin control of portada/galería

Status: done
Created: 2026-10-24
Base branch: main
Goal: Álvaro's real media (`C:\Users\alvar\Desktop\boiafoto\`: 7 PNG photos and 3 videos) replaces every sample photo and clip on the site. The landing collage (#fotos, «portada») and `/galeria` («galería/imágenes») show real media only. From Admin, in production (accounts mode), Álvaro sees thumbnails of every photo and video, deletes the ones he does not want, chooses which ones appear on the portada (the rest only in the galería) and orders them.
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

Source media (ffprobe):
- `20260530_231216.mp4` 1920×1080 H.264, 15.6 s, 32 MB
- `IMG_0561.MOV` 3840×2160 HEVC (iPhone), 22.5 s, 68 MB
- `IMG_0564.MOV` 3840×2160 HEVC (iPhone), 19.5 s, 82 MB
- PNG: «DJ en cabina entre humo neón» 956×1645, «DJ entre neones y humo» 947×1661, «DJs cantando entre luces neón y palmeras» 1076×1462, «Fiesta nocturna entre luces y humo» 1536×1024, «Grafiti nocturno junto a la valla iluminada» 1451×1084, «Mezcla nocturna con Allen & Heath» 1699×926, «Pista de baile entre luces y humo» 1098×1433
ffmpeg: `C:\Users\alvar\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffmpeg.exe` (ffprobe next to it).

## Tasks

## T328 — Real media in, sample media out
- Status: done
- Depends on: none
- Goal: (1) Convert the 7 PNGs to WebP with the pipeline the gallery already uses (`tools/galeria/fotos.mjs` or the same settings: long side ≤ 1600 px, quality ~0.82) and the 3 videos to web clips the collage accepts (H.264 MP4, yuv420p, bt709, no audio, `+faststart`, 1280 px on the long side keeping aspect ratio, source fps, ≤ 60 s, aim ≤ 6 MB each; HEVC iPhone sources: check HDR/HLG and tone-map to SDR bt709 if needed) plus a WebP poster per clip (like `clips.mjs`). Put them under `apps/web/public/art/galeria/` (or `public/contenido/galeria/`, matching how real content is stored — follow `docs/contenido-real.md`). Spanish alt texts from the file names (they describe the scene). (2) Add them to the real album «Fotos de BOIA» (`REAL_ALBUM_ID`, `packages/store/src/sample/content.ts`), not sample. (3) Delete ALL sample media: albums `album-muestra` and `album-cala`, photos `foto-1..8`, `foto-cala-1..3`, sample clips `clip-boia-baila`, `clip-puerto-dia-noche`, `clip-barco-fiesta`, their files in `public/art/galeria/` and originals in `public/art/galeria-fuentes/` if only used for them, and stop the generators from recreating them (or retire them). Also delete the real-album photos `galeria-3` (person in a blue tracksuit with a ball) and `galeria-4` (Los Chunguitos album cover) and their files. Keep `galeria-1` and `galeria-2`. (4) Let clips appear in the landing collage too (today `resolve.ts` excludes videos from `block.photos`); they already play muted, looping, only on screen, never with reduced motion — keep that. Default portada selection (`selection: true`), in this order: the 7 new photos, then the `20260530_231216` and `IMG_0561` clips — 9 pieces (`HOME_PHOTOS_LIMIT` = 9 stays); `IMG_0564`, `galeria-1`, `galeria-2` only in the galería (Álvaro will change it from Admin in T329). (5) Islands/events that pointed at sample albums or a `coverPhotoId` of a deleted photo must point at a real one or none, without breaking the island galleries, `/galeria`, event pages and `/mar` sheets. Update tests and e2e specs that counted sample photos (e.g. `eventos.spec.ts` «Galería», `#fotos [data-pieza]` counts) to assert against the real content, never hand-written counts. Update `docs/contenido-real.md`.
- Context: `packages/store/src/sample/content.ts` (~307-458), `apps/web/lib/landing/resolve.ts` (~106-116, `HOME_PHOTOS_LIMIT`), `apps/web/app/(landing)/components/media-collage.tsx`, `collage-viewer.tsx`, `photo-galleries.tsx`, `blocks.tsx` (~385-425), `tools/galeria/fotos.mjs`, `clips.mjs`, `apps/web/lib/admin/photo-upload.ts` (formats), `docs/contenido-real.md`, landing budget (~0.5 kB margin; each collage item adds HTML: keep the portada at 9 and the markup per item unchanged; report the final number).
- Scope: may touch the media files, sample content, resolve.ts, the collage (to accept clips on the landing), tools/galeria, tests, e2e specs that count media, docs/contenido-real.md / must not touch Admin (T329), SQL, production. Never commit the original PNG/MOV/MP4 sources.
- Done when:
  - ffprobe on each new clip → h264, no audio, size and duration stated
  - `grep -rn "foto-cala\|album-muestra\|clip-boia-baila\|galeria-3\|galeria-4" apps/web packages --include=*.ts --include=*.tsx` → nothing in app code
  - unit tests for the landing selection (9 pieces, clips allowed, order) and the e2e specs touched, run alone → pass
  - the project Test command → pass (landing budget OK)
- Outcome: 7 photos + 3 clips (HLG→SDR, 1280 px, 2.9–5.4 MB) in public/contenido/galeria, album-boia; all sample media and galeria-3/4 removed (retiredIds in sample revision 4); clips allowed on the landing; default portada 7 photos + 2 clips — 848a44e

## T329 — Admin: thumbnails, delete, portada/galería and order, in production
- Status: done
- Depends on: T328
- Goal: In the Admin photos section, one list with a thumbnail of every piece (photos and clips) from both sources: the ones shipped in the code (real album) and the ones uploaded to Supabase (`event_photos`, buckets `event-photos` / `event-clips`). Per piece: a switch «En portada» (on = portada and galería; off = only galería), up/down arrows to order (the order applies to the portada and the galería), and «Borrar» with confirmation. It must work in production (accounts mode), not only on the browser's local copy as today. Design: a new Supabase table for per-piece settings keyed by piece id (e.g. `media_settings`: piece id, on_home, sort, hidden, updated_by, updated_at) with RLS, public read of what the site needs, writes only through admin RPCs (admin + 2FA, `public` INVOKER wrapper over `private` SECURITY DEFINER, empty search_path, audit row), like the plan 034/037 migrations. «Borrar» on an uploaded piece deletes its `event_photos` row and its storage object; on a piece shipped in the code it sets `hidden` (the file stays in the repo). The landing collage and `/galeria` (and island/event galleries) apply the settings: hidden pieces disappear, portada = pieces with on_home in sort order up to `HOME_PHOTOS_LIMIT`, galería in sort order; uploaded pieces can now be put on the portada too (remove the forced `selection: false` or let the setting override it). The landing is `force-static`: apply the settings in the browser the same way `homeWithSharedPhotos` already merges Supabase photos (no new code on the landing critical path; keep it in the lazy chunk). Demo mode (no Supabase): the same controls work on the local store. Migration applied to dev only; the orchestrator applies it to production.
- Context: `apps/web/app/admin/sections/photos.tsx`, `apps/web/lib/admin/photo-store.ts`, `island-photos.ts`, `shared-photos.ts`, `actions.ts` (~473 `selection: false`), `apps/web/lib/landing/resolve.ts`, `e2e/admin-fotos.spec.ts`, migrations `20261008100400_gallery_clips.sql`, `20261021200100_guest_lists.sql` (admin RPC pattern), `packages/db/src/supabase/schema.supabase.ts` (allowlists), `pnpm --filter @boia/db db:migrate:dev -- --no-seed`, `db:types:dev`, `node src/cli/test-supabase.ts <file>` in packages/db.
- Scope: may touch the Admin photos section, the photo/admin libs, resolve.ts, the collage data path (not its markup), a new migration, generated types, schema allowlists, SQL and unit tests, `admin-fotos.spec.ts` / must not touch the media files of T328, the landing markup, other Admin sections, production.
- Done when:
  - SQL tests against dev → pass: anon/member/editor cannot change settings; admin with 2FA can toggle portada, reorder, hide a code piece, delete an uploaded piece (row and storage object); public read returns only what the site needs
  - unit tests: settings applied to the portada (on_home + sort + limit) and the galería (hidden removed, sort) for code and uploaded pieces → pass
  - `E2E_PORT=<free> pnpm e2e admin-fotos.spec.ts` (demo mode: toggle, order and delete reflected on the landing) → pass
  - the project Test command → pass (landing budget OK)
- Outcome: media_settings table + admin RPCs (admin+2FA, audited), Admin list with thumbnails, «En portada», arrows, «Borrar» (uploaded: row + storage; code: hidden), settings applied in the lazy resolve chunk; REQ-ADM-044 — 283a713

## T330 — Presentation video must not download on load
- Status: done
- Depends on: none
- Goal: e2e «REQ-COM-032: /?intro=0 carga sin descargar vídeos» (in `apps/web/e2e/videos-perezosos.spec.ts`) fails on mobile and desktop since plan 042/043/046: loading the landing downloads `presentacion.mp4` (and the reel has an empty `<video>`) before the user scrolls to the reel. Make the reel video load only when the reel is about to be shown (as the original sample did), keeping plans 043 (720p/1080p choice) and 046 (Range) intact, and keep the poster lazy. Run that spec and the reel e2e spec alone.
- Context: `apps/web/app/(landing)/components/presentation.tsx`, `presentation-motion.tsx`, `apps/web/lib/landing/hero-media.ts`, `apps/web/e2e/videos-perezosos.spec.ts`, plans 042/043/046.
- Scope: may touch the reel components and their tests / must not touch the gallery/collage (T329 runs in parallel), video files, SQL, production. Landing budget ~0.3 kB margin.
- Done when:
  - `E2E_PORT=<free> pnpm e2e videos-perezosos.spec.ts` → pass (mobile and desktop)
  - the reel e2e spec alone → pass (or the same failures as on main, stated)
  - the project Test command → pass
- Outcome: no server <video>; created only after 500 ms inside the reel; idle preload removed; cause was T235 (9544a34), not plans 042/043/046 — 205f0cb

## Decisions
- 2026-10-24: All sample photos and clips go; galeria-3 (blue tracksuit) and galeria-4 (Los Chunguitos) go too; galeria-1/2 stay (Álvaro)
- 2026-10-24: Álvaro chooses the portada from Admin; Admin needs thumbnails + delete + portada/galería switch + order, working in production (Álvaro)
- 2026-10-24: Default portada until he changes it: 7 new photos + 2 clips (9 pieces); videos allowed on the landing collage (orchestrator)
- 2026-10-24: .MOV upload in Admin not included (Álvaro did not pick it) (orchestrator)
- 2026-10-24: Push everything together at the end, including T327 and the production migration (Álvaro: «al acabar súbelo todo junto»)

- 2026-10-24 T328: media under public/contenido/galeria (art/galeria and galeria-fuentes deleted); tools/galeria scripts now convert Álvaro's sources; clip-480 kept as e2e fixture; /mar photos island → album-boia; one-line fallback album change in admin photos.tsx (agent)
- 2026-10-24: T330 added: plan 042 presentation video downloads on load (REQ-COM-032 e2e failing) (orchestrator)

- 2026-10-24 T329: arrows save the whole order via admin_media_order(ids[]); storage files deleted by the Admin's session after admin_media_delete returns URLs; demo settings in localStorage boia-media-settings; per-photo text/album edit moved to «Editar texto y álbum» (agent)
- 2026-10-24 T330: video loads ~1.3 screens before the window opens (LOAD_DWELL_MS 500) (agent)

## Proposals (new scope)
- 2026-10-24 T329: demo: open landing tab does not refresh until reload; «Restablecer» does not clear demo media settings
- 2026-10-24 T330: check on a real phone that the reel video is ready in time
- 2026-10-24 landing-scroll.spec.ts: 3 tests (accessibility :449, keyboard :525, slow scene :615) fail on main on this machine

## Log
- 2026-10-24 T328 launched · attempt 1 · agent a08726efa11cefb8f
- 2026-10-24 T328 done · branch worktree-agent-a08726efa11cefb8f → 848a44e
- 2026-10-24 T329 launched · agent ad7dfe8b809e6b00b; done → 283a713
- 2026-10-24 T330 launched · agent a94a24fb7c7f0491a; done → 205f0cb; plan done
