# Design plan · The landing as one continuous scroll (v2)

Approved 2026-10-03 by Hernán (v2, with the ten open points of §13 resolved
as recommended).

- Date: 2026-10-03 (v2 the same day, after Hernán rejected v1; see §14)
- Plan: `plans/007-landing-scroll.md`, task T77
- Asks: Hernán (interview of 2026-10-03 with Álvaro)
- Status: approved by Hernán; everything visual is `muestra` until Álvaro
  approves the final art
- For: T78 (Blender props and stills), T79 (the scroll hero and the restyle),
  T80 (performance), T81 (accessibility), T82 (content), T83 (docs)
- References Hernán gave for the tone: <https://andyhardy.co/> and
  <https://observatoriofestival.com/> (read 2026-10-03, §1)
- Storyboard frames (SVG, system fallback fonts; not app code):
  `docs/informes/img/p007-t77-01-reposo-escritorio.svg` (hero at rest,
  1280×800), `-02-zambullida.svg` (mid-dive), `-03-mar-primer-bloque.svg`
  (sea by the port with the first band), `-04-noche-fotos.svg` (night with
  the photos), `-05-reposo-movil.svg` (hero at rest, 375×812),
  `-06-estatica.svg` (static version), `-07-composicion.svg` (375 / 768 /
  1280 in the sea phase), `-08-mapa-movimiento.svg` (motion map strip)

This document follows the five decisions in the plan header: the appearance
plays and rests with «Zarpar» + «Entradas» and a scroll hint, scrolling is
the hand-off (no automatic advance, no «Saltar animación»); the first screen
of scroll scrubs the dive to the sea by the port and the camera then advances
over the water from golden hour to night with the blocks over the scene; the
blocks get a surface restyle only; Blender delivers low-poly GLB props and a
still for the static version; the identity is Archivo Expanded + Inter, the
BOIA brand and the Arcilla / Acuarela worlds.

## 1. What the references do, and what we take

**andyhardy.co** (film director's portfolio). Black page. A full-bleed
photographic hero (a mountain landscape in three parallax layers:
background, ridge, figure) with the logotype centred and nothing else but
three tiny tracked labels in the corners (the name, the coordinates
«37.8136° S, 144.9631° E», «Creating films in Melbourne / Australia») and
one pill button top right. Every section after it is photography that fades
into black at its edges (`linear-gradient(to top, #000, transparent)`),
portrait photo cards with a small tracked «VIEW WORK ↗», text in white at
50–80 %, a huge monospaced email as the footer. Silka + Silka Mono. No
colour except what the pictures bring. Motion: slow parallax on scroll and
fade-ins; nothing bounces.

**observatoriofestival.com** (independent music festival). A video hero on
black with the hand-drawn logo. Then flat colour fields (lavender
`#ca9aee`, light grey `#e6e6e6`, dark grey `#444`) carrying one enormous
statement sentence (Inter Tight 96 px / Inter 64 px). An editorial
two-column grid: a small uppercase label on the left (CARTEL, PLAYLIST,
FAQS, GALERÍA) and the content on the right; the poster shown as a
photographed object; the line-up as one giant running text; hairline
accordions; photos edge to edge; a dark footer with the logo.

What both share, and what v2 takes: confident type at a very large size
with a lot of empty space around it; photography (or here, a rendered
scene) carrying the atmosphere; tiny tracked labels as the only chrome;
flat dark fields that pictures fade into; hairlines instead of boxes;
nothing illustrated, rounded or toy-like. What we do not take: the lavender
field (the brief says start from the current dark landing and do not go
lighter) and the monospace (we have no mono face; Inter tracked uppercase
plays that part, as it does on Observatorio).

## 2. Concept in one paragraph

The page is night-black. The visitor lands in deep space: the planet of
`/mar` turns in the middle of the screen, lit from one side, a thin blue
limb, grain and a soft vignette on everything, the «BOIA» letters above it,
«Zarpar» and «Entradas» below, three tiny labels in the corners (BOIA ·
Alicante, the port's coordinates, «Underground music festival») and a hint
line at the bottom. Scrolling is diving: the first viewport of scroll takes
the camera from the planet through the blue limb and a golden haze to the
deck of a boat moored by the port at golden hour, the sun low and against
the camera, the coast and the breakwaters as silhouettes, the sun's path on
the water. From there every further scroll sails slowly out between the two
beacons into open water while the day ends; the content comes up out of the
sea as dark bands that fade in from the water, laid out like a magazine (a
small label on the left, big type on the right); between bands the sea shows
through for half a screen. By the time the photos arrive it is night: the
moon's path on the water, the event islands as dark shapes with warm lights
on the horizon. «Zarpar» at rest makes the same dive in 1.5 s and enters
`/mar` (D-24). The bold element is the light on the water; everything else
is restrained.

## 3. Palette

### 3.1 Scene grades

The live scene is lit by moods like `/mar`'s (`palette.ts`), but the hero
uses its own cinematic grade of them: darker water, desaturated skies, a
warm key light, haze. Hex values are the targets for the three.js sky dome,
fog, water and lights and for T78's still; `/mar` keeps its own moods (a
later pass may adopt these, §13). The space grade is the current one of the
landing, kept.

| Phase | Where in the scroll | Zenith | Sky | Horizon / haze | Water deep | Water near horizon | Sun path / glint | Key light |
|---|---|---|---|---|---|---|---|---|
| Space (`--scene-space-*`) | rest, s = 0 → 0.55 | `#020309` | `#070a1c` | `#101538` | — | — | — | sun `#fff1d6` (today), limb `#9fd0ff` |
| Dive (`--scene-dive-*`) | the atmosphere, s ≈ 0.55 → 0.85 | `#070a1c` | `#1b2a5a` | `#6b84b8` → haze `#d8a08a` | — | — | — | sun `#ffe2b0`, exposure +0.6 EV at the limb |
| Golden hour (`--scene-golden-*`) | the port, s = 1 | `#1e2250` | `#6a4a78` | `#e49a6a`, haze `#d8a08a` | `#0a1a33` | `#2a3f66` | `#ffc98a` | sun `#ffd9a0`, 4° above the horizon |
| Dusk (`--scene-dusk-*`) | halfway to the photos | `#0b0e2c` | `#2c2650` | `#8a5a62`, haze `#6a4a5c` | `#07122a` | `#1b2a4d` | `#d8a07a` | sun gone, afterglow |
| Night (`--scene-night-*`) | from the photos to the footer | `#02030a` | `#070b22` | `#141a3a`, haze `#11183a` | `#040a18` | `#0d1a36` | `#9fb0e8` | moon `#c8d4ff` |

Lights in the scene (beacons green `#3cff8a` and red `#ff3b2a`, quay
bulbs `#ffd9a0`, the boat's lanterns, the buoy's light `#ffe8b0`, the
islands' lights `#ffb070` / `#ff7a4a` / `#ff5ad0`) follow `glow`: 0.5 at
golden hour, 1 at night, each with its reflection on the water. Stars:
0.8 in space (fine, not a cartoon field), 0 by day, 0.25 at golden hour,
1 at night. Film grain 6–8 % and a vignette (0.45) on every frame.

### 3.2 Interface

| Token | Hex | Use |
|---|---|---|
| `--black` | `#05080f` | the page under everything; the fades of the bands end here |
| `--band` | `#07101f` | the content bands (the current footer black) |
| `--ink-deep` | `#0b1830` | the header, scrims (today's `--sea-deep`) |
| `--on-dark` | `#ffffff` | headings, body text |
| `--on-dark-70` | `rgba(255 255 255 / .7)` → `#b3b9c6` on the band | secondary text (9.7:1) |
| `--on-dark-50` | `rgba(255 255 255 / .5)` → `#838a99` on the band | the tracked labels (5.4:1) |
| `--hairline` | `rgba(255 255 255 / .12)` | dividers, outlines of ghost pills, the header's rule |
| `--orange` | `#ec4f24` | «Zarpar», «Comprar entradas», the wordmark; the only colour on the page (5.2:1 on the band as text, black text on it 5.7:1) |
| `--on-orange` | `#000000` | text on orange |
| `--focus` | `#ffffff` ring with a 2 px `#05080f` halo | focus everywhere (white reads on every mood and on the bands) |

What goes away from today's `landing.css`: `--card`, `--line`, `--violet`
(as a colour; the sail links go white underlined), the navy section
alternation (`--sea` / `--sea-light`), every box background behind cards
and chips. What stays: the brand tokens of `globals.css`, the header's
dark glass, the footer's black.

## 4. Typography

Titles in Archivo Expanded 700 (wdth 125, `--font-title`, later Druk Wide
Medium by changing `apps/web/lib/fonts.ts`, P20); text in Inter
(`--font-body`). Two families, clearly distinct. v2 pushes the display size
up (the references' one lesson everybody notices) and adds one role, the
tracked label, which Inter 600 at 11–12 px, uppercase, 0.14em, in white at
50 % plays.

| Role | 375 | 768 | 1280 | Face, weight, tracking |
|---|---|---|---|---|
| «BOIA» title (3D letters; flat fallback) | 64 / 1 | 88 / 1 | 104 / 1 | Archivo Expanded 700, 0.04em, orange, soft drop shadow |
| Event date (the first band's display) | 56 / 1 | 80 / 1 | 96 / 1 | Archivo Expanded 700, −0.01em, white |
| Section display (h2) | 28 / 1.1 | 36 / 1.1 | 44 / 1.08 | Archivo Expanded 700, 0, white |
| Row title (h3: event name, artist) | 22 / 1.15 | 26 / 1.15 | 30 / 1.15 | Archivo Expanded 700 |
| Lead | 17 / 1.5 | 18 / 1.5 | 19 / 1.5 | Inter 400, white 70 %, max 58ch |
| Body | 16 / 1.5 | 16 / 1.5 | 17 / 1.5 | Inter 400, white 70 %, max 62ch |
| Tracked label (section label, corners, hint, meta) | 11 / 1 | 11 / 1 | 12 / 1 | Inter 600, uppercase, 0.14em, white 50 % (70 % for the hint) |
| «Zarpar» | 17 | 18 | 18 | Archivo Expanded 700, 0.04em |
| Other pills («Entradas», «Comprar entradas», ghost) | 15 | 15 | 15 | Inter 600, 0.01em |

Rules: sentence case for everything that is a sentence; the tracked label
is the one uppercase role and it is structural (it names the section in
the label column, the corner facts, the hint); no eyebrow above a heading
other than that label column; the `hero.brand` eyebrow of today
(«BOIA.PLANET» above the h1) goes, its job is done by the top-left corner
label. Line lengths under 65 characters.

## 5. Composition

Fractions of the viewport; the planet's size is `fit` × the short side
(`packages/engine/src/intro/planet.ts`). Framings exist at `minWidth 0`
and `900`; v2 adds one at `600` (tablet portrait) and moves the desktop
planet up so the two pills fit under it. Frames 01, 05 (rest) and 03, 04,
07 (sea).

### 5.1 Hero at rest (s = 0)

| | 375×812 (and 375×667) | 768×1024 (new framing `minWidth 600`) | 1280×800 (`minWidth 900`) |
|---|---|---|---|
| Planet `fit`, anchor, tilt | 0.78, (0.5, 0.47), 22° — spans 29–65 % | 0.62, (0.5, 0.47), 22° | 0.62, (0.5, 0.47), 22° — spans 16–78 % |
| «BOIA» letters (`titleY`) | 0.14 | 0.13 | 0.12 |
| Pills row (`buttonY`) | 0.74: «Zarpar» 195×56 + «Entradas» 136×56, 12 px gap, 16 px gutters | 0.80: 220×56 + 160×56 centred | 0.84: 220×56 + 160×56 centred |
| Hint (label + a 24 px vertical hairline) | 0.90 | 0.93 | 0.925 |
| Corner labels (24 px from the edges, 16 on phones) | top left «BOIA · Alicante»; bottom left, two lines: the positioning line over «38.3452° N, 0.4815° O» | top left «BOIA · Alicante», bottom left the coordinates, bottom right the positioning line | idem |
| Header | hidden (visibility) until s ≥ 1 | hidden | hidden |

«Entradas» and the corner labels are in the DOM and visible from the first
paint; «Zarpar», the title and the hint fade in at the pause (400 ms) as
today. The positioning line (`block.positioning`, content) is the corner
label, not a centred sentence under the title: the hero says BOIA and
nothing argues with it. At 375×667: letters 61–125 px, planet 167–459,
pills 466–522, hint 600; nothing overlaps.

### 5.2 Sea phase (s ≥ 1)

| | 375 | 768 | 1280 |
|---|---|---|---|
| Horizon | 38 % | 40 % | 42 % |
| Camera | deck: 1.2 boat lengths above the water, 3 behind the boat, pitch −6°, vertical FOV 55° | pitch −5°, FOV 48° | pitch −4°, FOV 40° (as `/mar`) |
| Boat on screen | x 50 %, y ≈ 52 %, ≈ 110 px, silhouette | x 50 %, y ≈ 54 % | x 50 %, y ≈ 56 %, ≈ 140 px |
| Sun / moon | x 66 %, 4° above the horizon; its path straight down the water | idem | idem |
| First band: solid from, with a 14 vh fade above it | 56 % | 58 % | 62 % |
| Content column inside a band | 100 % − 32 px, stacked: label, then content | 100 % − 64 px; label 28 % + content 72 % from 900 px | 1200 px max, centred; label 28 % (left) + content 72 % |
| Band padding (top / bottom) | 48 / 64 px | 64 / 80 | 96 / 112 |
| Sea window between bands (with fades on both edges) | 50 vh | 50 vh | 50 vh |
| Header | 60 px, from s ≥ 1 (slides down 200 ms) | idem | idem, with the tracked links |

What the scene needs on a phone: the band from the header to the first band
(top 56 %) carries sky, horizon, the boat and whatever passes; nothing of
importance is placed in the bottom 40 %.

### 5.3 Hero track and band flow (DOM sketch for T79)

```
<canvas fixed, inset 0, 100lvh, z 0, aria-hidden>      ← the scene (or the still)
<header sticky, z 20, hidden until s ≥ 1>
<main>
  <section .hero .hero--track  height: 200svh>          ← rest (100) + dive (100)
    <div .hero__ui sticky top 0, height 100svh>          ← title, pills, hint, corner labels
  <section .band  margin-top: -44vh (−38vh ≥ 900)>       ← Próximo evento: fade (14vh) + solid
  <div .sea-window  height: 50vh>                        ← the sea shows (fade out above, fade in below)
  <section .band>  …                                     ← Próximos eventos
  <div .sea-window> <section .band> …                    ← Artistas, Fotos, Tienda, Contacto
<footer .site-footer  (solid --black)>
<tickets panel fixed, unchanged>
```

A band is `background: linear-gradient(to bottom, transparent, var(--band)
14vh) ` on top of `var(--band)`; its bottom edge fades the same way into the
next sea window. The static version uses the same DOM with the track at
100svh and the first band's negative margin at −14vh.

## 6. Layers

| # | Layer | What | Tech | Notes |
|---|---|---|---|---|
| L0 | Sky placeholder | the space gradient | CSS | before the scene; the scene paints its own sky after |
| L1 | Planet placeholder | the CSS disc (`.hero__planet`, `stillCss`), darkened to the v2 grade (one radial gradient, lit from the left, a thin limb) | CSS | same size and place as the scene's planet at rest, no layout shift (REQ-ENT-038); 3D path only |
| L2 | Scene canvas | fixed, `100lvh` | three.js | one renderer, two rigs: the orthographic mini-planet (existing `mini-planet.ts`, regraded) and a perspective sea rig |
| L2a | Sea rig: water | the `/mar` water shader extended: sky reflection by fresnel, a specular sun/moon path (Blinn-Phong on a procedural normal, two octaves of Gerstner-like displacement in the vertex shader), height fog | three.js | this is the hero's picture; it is where the shader time goes |
| L2b | Sea rig: atmosphere | sky dome by mood, horizon haze (a second fog band), the sun or moon as a bloomed sprite, star points, 3–4 haze planes (soft alpha quads) for the dive-through | three.js | no cloud geometry |
| L2c | Sea rig: set dressing | T78's `costa`, `puerto`, `barco`, `boya` (GLB); the islands on the horizon from the procedural islands as dark silhouettes in fog with their `effects.ts` glows | three.js | GLBs load after the first frame; `MeshStandardMaterial`, env map generated from the mood (a 64×32 gradient), lights as emissive + sprite halos |
| L2d | Post | one full-screen pass: colour grade (lift/gamma per mood), vignette, film grain (hash noise, 6–8 %), soft bloom from a 1/4-size blurred bright pass; optional cheap DOF (far blur by depth) at ≥ 900 px | three.js | T80 can drop bloom/DOF on low power; grain and vignette are nearly free |
| L3 | Still | `art/landing/hero-still-{1600,800}.webp` (golden) and `hero-still-noche-{1600,800}.webp` | image | static version only; `object-fit: cover; object-position: 50% 42%`; served from `/api/art`, not in the landing budget |
| L4 | Fades | the bands' top and bottom gradients into `--band` | CSS | they replace scrims: text never sits on the live picture |
| L5 | Hero UI | «BOIA» (text + the 3D title canvas of T27), pills, hint, corner labels | HTML/CSS + 2D canvas | sticky inside the hero track; opacity and `visibility` by s |
| L6 | Header | sticky, `rgb(7 16 31 / .82)` + blur, hairline under it | CSS | hidden until s ≥ 1 |
| L7 | Bands | the blocks | HTML/CSS | normal flow; they slide over L2 by scrolling; nothing animates them |
| L8 | Tickets panel, veil | unchanged | CSS | the veil (`.intro-cover`) stays for «Zarpar» |

The scene's state is a pure function of the scroll position (`s = scrollY /
viewportHeight`, with 80–120 ms of smoothing) plus the light timing of
§7.3: no stored state, so `/#fotos`, Back from `/mar` and a reload open at
the right frame. The page exposes `data-scroll-phase="rest|dive|sea"` on
the hero and `window.__boiaIntro.scroll = { s, phase, light }` for T79's
e2e.

## 7. Motion map

s = scroll position in viewport heights. "UI" = the hero's title, pills,
hint and corner labels. The engine's `landing` act (the dive of «Zarpar»)
is reused with its time replaced by `ease(s) × landing.durationMs`, cover
kept at 0. Frame 08 is the strip.

### 7.1 Load and appearance (time-based, as today)

| Moment | Camera / scene | Light | UI | Blocks |
|---|---|---|---|---|
| First paint | CSS sky + CSS planet at the rest pose | space | «Entradas» and the corner labels visible; title, «Zarpar», hint hidden | bands in the DOM below the track, hidden by `data-intro` as today |
| Scene loading > 250 ms | the drawn Boia + «Cargando» | space | idem | — |
| Appearance, 1.4 s | the planet rises and grows into the rest pose; scrolling during it calls `interrupt()` (jump to rest) and the scroll applies | space | at the pause: title + «Zarpar» + hint fade in 400 ms; «Zarpar» gets focus | — |
| Direct URL, `?intro=0`, return from `/mar` | born at rest, no appearance, s from the URL | — | all visible | — |
| Scene late (9 s), no WebGL, low power | static version (§9) | — | — | — |

### 7.2 Scroll-driven

| s | Camera | Light | UI | Header | Blocks |
|---|---|---|---|---|---|
| 0 | planet at the rest pose, spinning (50 s per turn), thin cloud streaks drifting | space; stars 0.8; grain, vignette | all visible; the hint's hairline breathes (1.6 s) | hidden | — |
| 0 → 0.15 | the planet starts to grow and spins towards the port (`focusSpin`) | space | opacity 1 → 0 (`landing.uiOut`); `pointer-events: none` from 0.08; `visibility: hidden` at 0.15 | hidden | — |
| 0.15 → 0.55 | grows with `easeInOutCubic`; the port comes to face the camera | space; stars fade from 0.5 | hidden | hidden | — |
| 0.55 → 0.85 | the limb leaves the top of the view; the blue atmosphere band thickens; exposure rises +0.6 EV | space → dive grade; stars 0 at 0.8 | hidden | hidden | — |
| 0.78 → 0.95 | three haze planes cross the view (soft, low alpha, no shapes); the sun's bloom grows on the right | dive → golden haze (`#d8a08a` fills the gaps) | hidden | hidden | — |
| 0.85 → 1 | crossfade orthographic planet (alpha 1 → 0) → perspective sea rig (alpha 0 → 1); the perspective camera drops from 20 boat lengths high, pitch −60°, to the deck pose; DOF settles | golden hour reached at 1 | hidden | slides down at 0.95 (200 ms) | the first band's fade enters at 0.9 |
| 1 | deck pose behind the moored boat, looking out between the breakwaters into the sun | golden hour | `landing_view` fires once | visible | first band (Próximo evento) solid from 56 / 62 %; «Comprar entradas» inside it |
| 1 → 2.6 | the boat casts off and the camera follows at 2 boat lengths per vh; the beacons pass at s ≈ 1.25 (green left, red right, their reflections sliding by); the buoy at s ≈ 1.6, right, 2 lengths off the track; the coast recedes on the left until s ≈ 2.5 | golden → dusk (`light` 0 → 0.5); the sun sets at 1.8; afterglow | — | visible | Próximos eventos, Artistas, with sea windows between them |
| 2.6 → photos | open water; the horizon islands appear at 60–120 lengths as dark shapes in the haze with warm lights | dusk → night (`light` 0.5 → 1); glows 0.5 → 1; stars 0.25 → 1; moon rises top left, its path on the water | — | visible | Fotos enters when `light` reaches 1 |
| photos → footer | still advancing; the boat's lanterns, the buoy's light (blinks every 3 s, not under reduced motion) | night | — | visible | Tienda, Contacto, footer (solid `--black`) |
| back to 0 | everything reverses | | | hidden again at s < 0.95 | |

«Zarpar» at rest: the time-based dive of today (1.5 s, UI out, veil from
72 %, `router.push(ZARPAR_HREF)`, `explore_start` source `intro`) with
scrolling disabled while it plays. The header's «Zarpar» pill (if approved,
§13) goes to `/mar` with the veil only, no dive.

### 7.3 Light timing

`light = clamp((scrollY − H) / (photosTop − H/2 − H), 0, 1)` with H the
viewport height and `photosTop` the document position of the Fotos band, so
the night always arrives with the photos whatever the Admin's block order;
without a Fotos band, `light` runs over 3 viewports after the dive. Mood =
mix(golden, dusk, night) along `light` (dusk at 0.5).

## 8. Blocks restyle (surface only)

Same content, structure, ids, components and the Tickets panel; what
changes is backgrounds, the grid inside each section, spacing and the
transitions (frames 03, 04, 07).

- `.section` becomes a band: full width, `--band`, no radius, no border, no
  shadow; a 14 vh fade from transparent at the top and into the next sea
  window at the bottom; padding of §5.2. `.section--alt` goes away: the
  alternation is the sea between bands.
- Inside a band, `.section__inner` becomes the editorial grid: the section
  title is the tracked label in the left column (`.section__label`, 28 %)
  and the content sits in the right column (72 %); the h2 keeps its text
  and id for `aria-labelledby` but is styled as the label (so the
  structure does not change). Where the content needs a display line it
  gets one (§4): Fotos «Lo que pasó la última vez» (`muestra`), Artistas
  the list itself.
- Section transitions: a 50 vh sea window between bands with fades on
  both edges; nothing fades or slides on its own; the only motion is the
  scene.
- Próximo evento: the date as the display (`31 OCT`, Archivo 96/80/56),
  the name under it (Archivo 40/26/24), venue · doors · age as a 16 px line
  in white 70 %, a hairline, the note, then «Comprar entradas» (orange pill)
  and «Ir a su isla» (ghost pill); the poster slot (T82) is a 3:4 portrait
  at the right edge of the content column on ≥ 900 px (220×300 at 1280;
  `#1b1430` → `#3a1a1a` gradient with «cartel próximamente» as a label
  until the poster exists), above the text on phones.
- Próximos eventos: rows divided by hairlines (date label · name in
  Archivo 30/22 · venue in white 70 % · «Comprar entradas» at the right);
  no cards. The featured state is the orange pill, nothing else.
- Artistas: the rotator stays (fade-in on rotation only); each artist is a
  hairline row (name in Archivo 30/22, genres right-aligned in white 50 %),
  the avatar a 48 px grey-scale circle at the left of the name when there is
  a photo (T82), nothing when there is not.
- Fotos: photos edge to edge (the band's full width, 6 px gaps, no radius),
  4 columns at ≥ 900, 2 on phones; placeholders as dark gradients with a
  stage-light glow (frame 04) until the photos exist.
- Tienda: products as a running text line in Archivo 22 separated by
  hairline dots, «Ir a la tienda» ghost pill; the sail links («⛵ Ir en
  barco») stay as tracked labels in white 70 % underlined.
- Contacto (with Filosofía inside): the paragraphs in the lead size, max
  58ch; the verbs as a hairline list.
- Footer: solid `--black`, the logo as today, the invite box without a
  background (orange hairline at the left), links as tracked labels.
- Pills: `.cta-explore` keeps its class, pulse (≤ 4 % every 3 s, off under
  reduced motion) and Admin label but is «Zarpar» (Archivo 18, orange,
  black text, 56 px, full pill); `.button--tickets` is «Entradas» (white
  outline at 75 % on 35 % black); `.button--buy` orange; `.button--ghost`
  white outline. No gradients, no shadows.
- Header: `rgb(7 16 31 / .82)` + blur, hairline under it; the wordmark
  left; links as tracked labels in white 70 %; «Entradas» outlined and, if
  approved, the «Zarpar» pill at the right.
- Tickets panel: untouched in this plan (its sheet stays navy); matching it
  to the bands is a later pass (§13).

## 9. Static version (reduced motion, no WebGL, scene late, low power)

Frame 06. The same page without 3D: the hero is T78's still of the sea by
the port at golden hour (a Blender render with real water, haze, depth of
field and grain — it is the look the live scene approximates), fixed behind
the bands; the hero track is 100svh; from the Fotos band on, the night still
replaces the golden one (opacity 600 ms, instant under reduced motion,
switched by an IntersectionObserver).

- Triggers: `prefers-reduced-motion: reduce` (`decideEntry` → `reduced`,
  before the first paint), no WebGL or the scene throwing, the scene not
  ready within `loadBudgetMs` (9 s), a scene that misses its frame budget,
  T80's low-power heuristics (`deviceMemory ≤ 4`, `hardwareConcurrency ≤ 4`,
  `saveData`, a first-frames probe under 30 fps). `?intro=0` is not static.
- Hero UI: «BOIA» flat (the reduced fade of today), pills, hint and corner
  labels over the still's bottom fade to `--black` (from 45 % down), white
  text (worst case over the golden haze at the fade's start: 9.7:1 for
  white; the labels sit lower, on near-black).
- «Zarpar»: fade to the veil (`reduced.fadeMs` 400 ms) and enter `/mar`
  (D-24 point 4); without WebGL, `/mar` shows its notice (D-25).
- The still: 1600×1000 for ≥ 900 px, 800×500 below; `object-fit: cover;
  object-position: 50% 42%`; eager only when `reduced` is decided at boot,
  lazy otherwise.
- No camera motion, no scroll-bound light; the hint still says the page
  goes on; nothing autoplays.

## 10. Accessibility

- Canvas: `aria-hidden="true"`, `role="presentation"`, not focusable; the
  still `<img>` has `alt=""`.
- Heading: the h1 is «BOIA» (text, with the 3D letters canvas
  `aria-hidden` inside it); the corner labels are `<p>`s (the positioning
  one carries `block.positioning`); the hero keeps
  `aria-labelledby="hero-title"`.
- Hint: a `<button>` with the visible text «Desliza para bajar al mar» and
  the hairline `aria-hidden`; activating it scrolls one viewport (smooth,
  instant under reduced motion); in the tab order after «Entradas».
- Focus order at rest: skip link → «Zarpar» (focused at the pause, as
  today) → «Entradas» → hint → the bands; the header is `visibility:
  hidden` until s ≥ 1; faded hero UI gets `visibility: hidden`.
- Focus ring: `outline: 3px solid #ffffff; outline-offset: 2px; box-shadow:
  0 0 0 2px #05080f` everywhere (one ring, readable on every mood and on
  the bands); the violet ring of today goes.
- Contrast: white on space 18:1; white on `--band` 19:1; white 70 %
  (`#b3b9c6`) on `--band` 9.7:1; white 50 % (`#838a99`) 5.4:1 (labels are
  ≥ 11 px bold-ish uppercase; still ≥ 4.5:1); orange text on `--band`
  5.2:1; black on orange 5.7:1; white on the header over the golden sky
  (`rgb(7 16 31 / .82)` over `#e49a6a` → `#30241f`) 12:1. Text never sits
  on the live picture: the bands' fades put every line on ≥ 85 % `--band`
  (white 70 % on the fade's lightest text position is ≥ 7:1 over the
  darkest water). T81 checks the title's 3D letters over the still.
- Motion: the dive and the sail are scroll-driven; `prefers-reduced-motion`
  removes all of it (static version), the hint's breathing, the CTA pulse,
  the buoy's blink; no parallax on the bands.
- Keyboard scrolling drives the scene exactly like the wheel; plain
  document height, no scroll hijacking, no snap points.
- Live regions: none; the Tickets panel keeps its focus trap, Escape and
  Back. Targets ≥ 44 px (pills 56, hint 44, header pills 36 + padding to 44).

## 11. i18n keys (`apps/web/lib/i18n/es-web.ts`, all `muestra`)

| Key | Value | Change |
|---|---|---|
| `hero.tickets` | `Entradas` | value change (was `Tickets`); the «Entradas» pill at rest and in the header |
| `hero.scrollHint` | `Desliza para bajar al mar` | new; the hint button's text |
| `hero.place` | `BOIA · Alicante` | new; top-left corner label |
| `hero.coords` | `38.3452° N, 0.4815° O` | new; bottom-left corner label (the port of Alicante) |
| `photos.display` | `Lo que pasó la última vez` | new; the Fotos band's display line |
| `nav.zarpar` | `Zarpar` | new, only if the header pill is approved (§13) |
| `hero.brand` | as today | stays in the catalog (Admin text list) but is not rendered |
| `hero.explore`, `hero.explore.withPromotions`, `hero.explore.withoutPromotions`, `hero.explore3d`, `hero.explore3d.sub` | — | no longer rendered (the sub-line of v1 is gone: the corner labels say it); T79 may delete `explore3d*` if nothing else reads them |
| `intro.skip` | — | deleted with «Saltar animación» |
| engine `DEFAULT_INTRO_COPY.ticketsOnly` | — | deleted (the link becomes the «Entradas» pill, text from `hero.tickets`); `copy.enter` «Zarpar» and `copy.loading` stay; the validator drops `ticketsOnly` |

The positioning corner label is content (`block.positioning`), not a key.

## 12. Props for Blender (T78)

The props are set dressing seen against the light, mostly as silhouettes
with a few emissive points, reflected in the water: what makes them read is
material, lighting and the post pass, not polygons. Conventions as
`art/islas/3d/manifest.json`, scripts under `tools/blender/landing/`,
output `art/landing/3d/` + `manifest.json`. Per prop: ≤ 4 materials
(`MeshStandardMaterial`-compatible: base colour, roughness, metalness;
one emissive material for lights), vertex colours or one baked 512² atlas
(colour + AO, ≤ 60 kB) where noted, smooth normals, no Draco. Nothing
cartoon: real proportions, no faces, no rounded "toy" edges.

| Prop | Purpose | Triangles | kB (GLB) | Materials / notes |
|---|---|---|---|---|
| `costa` | the coast: a long low ridge (Serra Grossa / Cabo de las Huertas feel) in two depths, rock face, scrub | 3 000 | 45 | 2 materials (rock, scrub), vertex colour, rough; reads as a silhouette with a lit edge at golden hour |
| `puerto` | the two breakwaters with their beacon towers (green/red emissive heads), the quay with a row of lamp posts, a few mooring posts | 3 500 | 55 | 3 materials + emissive; a 512² baked atlas for the stone (≤ 60 kB extra) |
| `barco` | the boat ahead: real proportions (a 10 m motor-sailer: hull, cabin, mast, boom), two lanterns, a masthead light | 2 000 | 35 | 2 materials + emissive; dark hull, rough deck; seen from behind at 3 lengths, mostly silhouette |
| `boya` | a navigation buoy: orange body, dark cage and light | 400 | 10 | 2 materials + emissive |
| `luces` | lamp heads, lantern glass and beacon lenses as separate tiny meshes so three.js can attach sprite halos | (in the above) | — | one emissive material shared |
| haze planes, sun, moon, stars, sea, islands | code (§6) | 0 | 0 | the horizon islands come from the procedural islands as silhouettes in fog |
| **Total new** | | **8 900** (cap 12 000) | **145 + 60 atlas** (cap 220) | |

What v1 had and v2 drops: the cloud prop (haze planes and bloom do it), the
gull, the mascot buoy (the mascot stays in `/mar`; the hero's buoy is a real
one). The Arcilla and Acuarela ship GLBs are not used in the hero (their
clay look is the game's, not this page's); `/mar` keeps them.

Stills (same scene, camera as frame 03 without the band, same palette,
Cycles or EEVEE with the Ocean modifier for the water, volumetric haze,
depth of field f/2.8 focused on the boat, film grain in the compositor):
`art/landing/hero-still-1600.webp` (1600×1000, ≤ 120 kB),
`hero-still-800.webp` (800×500, ≤ 50 kB), and the night variant
`hero-still-noche-1600.webp` / `hero-still-noche-800.webp` with the same
limits. Framing: horizon at 42 %, the sun (or moon) at x 66 % and 4° up,
the boat at x 50 %, y 56 %, the breakwaters left and right of it, the coast
on the left, the buoy at x ≈ 84 %; the top 12 % and the bottom 45 % carry
nothing important (title, pills and bands cover them); the phone crop is
the central band (`object-position: 50% 42%`). The still is the reference
look: the live scene is graded to match it.

## 13. Open questions — resolved 2026-10-03 by Hernán

All ten resolved as recommended; the rest of this document is written with
these choices in force.

1. v2 is the direction: night-black page, cinematic sea (silhouettes,
   light, haze, grain), dark bands with the editorial label column, Archivo
   at display size (frames 01–08). **Yes.**
2. The corner labels of the hero (BOIA · Alicante / the port's coordinates
   / the positioning line). **A: keep them.**
3. «Zarpar» after the hero. **A: a «Zarpar» pill in the sticky header from
   s ≥ 1** (`nav.zarpar`, §11); the sail links stay as they are.
4. `nav.tickets` «Tickets» → «Entradas». **Yes**, so the word is the same in
   the hero, the header and `/mar`.
5. The hero's buoy. **A: a real navigation buoy**; the mascot stays in
   `/mar`.
6. The boat. **A: a new realistic silhouette boat** (`barco`, §12); the
   Arcilla and Acuarela ship GLBs are not used in the hero.
7. The hero's cinematic grade is the hero's; `/mar` keeps its moods for now.
   **Yes.**
8. The tablet framing at `minWidth 600` and the desktop planet at anchor y
   0.47 with the pills at 0.84 go into `DEFAULT_PLANET_INTRO` (version 6).
   **Yes.**
9. The Tickets panel stays as it is in this plan. **Yes.**
10. The post pass (grade, vignette, grain, soft bloom, optional DOF) is part
    of the design; T80 may drop bloom and DOF on low power but keeps grain
    and vignette. **Yes.**

## 14. v1 rejected: why

v1 (2026-10-03, same day) put the content on cream paper sheets, drew the
sea with low-poly cartoon props (a clay boat, the mascot buoy with a face,
puffy clouds, gulls) and used the `/mar` game moods as they are. Hernán:
«no me convence nada, estaba mejor antes, esto es muy low poly, muy
básico; quiero que parezca una página de un festival profesional, no de un
juego infantil», with andyhardy.co and observatoriofestival.com as the
tone. v2 keeps every decision of the plan header and the motion map, and
changes the look: it starts from the current dark landing, treats the sea
as photography (light, haze, reflections, grain, silhouettes), lays the
content out editorially on dark bands and sizes the type up. The v1 frames
and document were replaced in place (commit ed2e424 holds v1).

## 15. Addendum (T79, 2026-10-03): the BOIA logo and Spotify

Two additions from Hernán on 2026-10-03, built in T79 inside this
document's editorial style (no new colours, no boxes, tracked labels and
hairlines only):

- **The BOIA logo on the page.** The wordmark of `art/marca` (the
  `components/brand-logo.tsx` copy) is the footer's display: alone, in
  orange, at `min(26vw, 280px)`, on the night sea where the footer's fade
  from transparent to `--black` starts (the last sea window), with the
  accessible name «BOIA» (`intro.logoAlt`). The header uses the same
  wordmark alone at 30 px (the mascot stays in `/mar` and the favicon).
- **Spotify, as observatoriofestival.com does.** In the Artistas band, next
  to «Ver todos los artistas», a plain link «Escúchalo en Spotify ↗» to the
  BOIA playlist; the same link heads the footer under the wordmark; each
  artist with a Spotify page gets a small tracked «Spotify» link at the end
  of their hairline row. All are ordinary links that open in a new tab
  (`target="_blank" rel="noopener noreferrer"`), with an `aria-label` that
  says so: no embedded player, nothing loaded from Spotify (no third-party
  requests, no cookies). The playlist is the footer link labelled
  «Spotify» (content, `officialLinks`); each artist's URL is the optional
  `spotifyUrl` of the artist (content). Both are `muestra` sandbox URLs
  until Álvaro sends the real ones (P15); T82 makes them editable.

Notes from building v2 in T79 (for Hernán's review, all reversible):
«Zarpar» and «Entradas» are visible from the first paint (plan header,
decision 1; §7.1 had «Zarpar» fade in at the pause); the h1 keeps the
Admin's hero title for screen readers while «BOIA» on screen is the
wordmark (`aria-hidden`); the poster slot of the Próximo evento band is
left to T82; the post pass has grade, haze, vignette and grain, with the
sun's bloom and the lights' halos as sprites (no full-screen bloom or DOF).
