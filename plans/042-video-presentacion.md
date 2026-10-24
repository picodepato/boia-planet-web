# Plan 042 — Real presentation video on the landing

Status: active
Created: 2026-10-24
Base branch: main
Goal: Álvaro supplied the final landing video (`C:\Users\alvar\.claude\uploads\fe3a4dfc-053c-4cc5-9f81-96cfaabe78dc\7dddc7d7-BOIAvidwebsite.mov`: 8.0 s, 3840×2160, HEVC, 24 fps, with a PCM audio track, 25 MB). It replaces the 8 s sample in the presentation reel (the small black window after the hero that opens to the full screen; `PRESENTATION_VIDEO` in `apps/web/lib/landing/hero-media.ts`). It ships together with plan 041 (more tolerant globe), already on main.
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

## Tasks

## T322 — Real presentation video
- Status: pending
- Depends on: none
- Goal: Convert the .mov with ffmpeg (installed: `C:\Users\alvar\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffmpeg.exe`) into the web format the code expects: muted (drop the audio track) H.264 MP4, 1280×720 (keep 16:9), 24 fps, `+faststart`, yuv420p, ≤ 2 MB (tune CRF/bitrate; if quality is clearly poor at 2 MB, go up to 3 MB and say so), plus a poster frame WebP 1280×720 taken from a representative frame (the first frame if it is not black; else ~1 s), ≤ 120 kB. Put them at `apps/web/public/contenido/portada/presentacion.mp4` and `presentacion.webp` (as the comment in `hero-media.ts` suggests), point `PRESENTATION_VIDEO` to them, and drop the «muestra» note for it. Keep the sample files in `public/art/landing/` only if something else still uses them; otherwise remove them and say so. Update `docs/contenido-real.md` («Qué ha llegado ya») and tests that assert the sample path (assert the new real paths; never loosen). Do not change the reel's behaviour, sizes or the landing layout.
- Context: `apps/web/lib/landing/hero-media.ts`, `apps/web/app/(landing)/components/presentation.tsx`, `presentation-motion.tsx`, `tools/landing/presentacion.mjs`, `docs/contenido-real.md`, tests mentioning `presentacion-muestra`, `apps/web/scripts/cf-assets.mjs` / Cloudflare asset limits (25 MiB per file; fine), the landing budget (the video is lazy and not in the critical path; the poster is `loading="lazy"`; check `pnpm build` stays OK).
- Scope: may touch the two new files, `hero-media.ts`, the sample files, docs/contenido-real.md, related tests / must not touch the hero stills/globe, other pages, SQL, production. Never commit the original .mov.
- Done when:
  - `ffprobe` on the new MP4 → h264, 1280×720, no audio stream, duration ≈ 8 s; file size stated
  - tests that reference the presentation video → pass
  - the project Test command → pass (landing budget OK)
- Outcome:

## Decisions
- 2026-10-24: The video goes in the presentation reel, not the hero (Álvaro)
- 2026-10-24: ffmpeg installed with winget (Gyan.FFmpeg 9.0.2) (Álvaro)
- 2026-10-24: Push together with plan 041 (Álvaro)

## Proposals (new scope)

## Log
