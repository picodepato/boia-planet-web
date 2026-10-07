# Presentación a los socios: cómo se escribe

`boia-planet.pptx` (y su copia `boia-planet.pdf`) recorre la web sección a
sección: qué es, qué tiene, qué falta para salir y las preguntas. Se genera
con un script desde los archivos de `partes/` y las capturas de `capturas/`;
nunca se edita a mano (plan 018).

## Los tres comandos

| Comando | Qué hace |
|---|---|
| `pnpm deck:capturas [NN]` | Construye la web en modo local y corre los specs de captura (todos, o los de la parte `NN`). Guarda JPEG en `capturas/NN-slug/`. Tarda lo que un build (~3–5 min). Detrás de `NN` van opciones de Playwright, p. ej. `-g hero`. |
| `pnpm deck` | Genera `boia-planet.pptx`. Si falta una captura, no escribe nada y dice cuál. Imprime qué diapositivas son de cada parte (también en `render/indice.txt`). |
| `pnpm deck:render` | LibreOffice pasa la `.pptx` a `boia-planet.pdf` y cada diapositiva a `render/diapositiva-NN.png` (carpeta ignorada por git) para mirarlas. |

La primera vez en un worktree: `pnpm --filter @boia/web exec playwright
install chromium`. LibreOffice se busca en `SOFFICE`, en el PATH y en
`C:\Program Files\LibreOffice\program\`.

## Una parte = dos archivos

- `partes/NN-slug.ts`: el contenido. Exporta `titulo` y una función que
  llama a las piezas de abajo, una por diapositiva. Las partes se descubren
  por el nombre (01…08) y no hay lista central que tocar.
- `apps/web/e2e/deck/NN-slug.deck.ts`: las capturas, en móvil (390×844 a
  escala 2). Un archivo `NN-slug.escritorio.deck.ts` sale en escritorio
  (1440×900, con la sesión del Admin puesta). Cada captura es
  `await shot(page, 'NN', 'nombre')` (de `./deck-helpers`): espera fuentes,
  pantalla de carga, imágenes y 3D, y falla si sale casi vacía. Para el mar
  sirven `openMar`, `steerTo` y `sheetIs` de `../mar-helpers` y los
  parámetros de `app/mar/deep-link.ts`; para el Admin en móvil, `comoAdmin`.

En el contenido, una captura se nombra sin extensión: `'hero'` es
`capturas/NN-slug/hero.jpg`; `'05-mar/puerto'`, una de otra parte.

```ts
import type { Deck } from '../../../tools/deck/src/deck.ts';
export const titulo = 'Landing';
export default function (d: Deck) {
  d.portadaParte({ subtitulo: '…', secciones: ['Hero', '…'], notas: ['…', '…'] });
  d.queEs({ seccion: 'Hero', titulo: '…', texto: '…', captura: 'hero', notas: ['…', '…'] });
}
```

## Las piezas

Todas llevan `notas`: 2–4 ideas cortas para quien presenta (decisión 6). Si
algo no cabe, `pnpm deck` falla diciendo dónde y cuánto sobra: se acorta o
se parte en dos diapositivas, no se achica la letra. Límites en
`tools/deck/src/deck.ts` (`LIMITE`).

| Pieza | Para qué | Cabe |
|---|---|---|
| `portada` | La del principio (parte 1) | — |
| `portadaParte` | Primera diapositiva de cada parte | subtítulo 90 car., ≤ 10 secciones |
| `queEs` | Texto a la izquierda, un teléfono a la derecha | 520 car. + un destacado de 110 |
| `queTiene` | Viñetas y un teléfono | ≤ 6 viñetas de 110 car. |
| `telefonos` | 1–3 capturas con su pie | pie 60 car. |
| `queFalta` | Lo que falta, cada cosa con su etiqueta y quién | ≤ 6, de 120 car. |
| `preguntas` | «Preguntas y propuestas», cierre de cada sección | ≤ 4 + ≤ 4, de 140 car. |
| `hojaDeRuta` | Una tabla | ≤ 10 filas × 5 columnas |
| `texto` | Texto sin captura (p. ej. paneles del Admin que piden cuentas); con `qr: 'https://…'`, el QR de esa dirección en vez de la mascota | 420 car. o ≤ 6 viñetas |

Títulos de 50 caracteres como mucho, sin punto final.

## Cómo se escribe

- **Para quién:** todos los socios de BOIA; Álvaro tiene que ver qué debe
  aprobar o entregar. Español de España, de «tú/vosotros», como la web.
  Palabras llanas, sin jerga: «cuentas de usuario», no «Supabase»; lo
  técnico, en una línea que se entienda.
- **Cada sección:** qué es → qué tiene (con capturas) → **qué falta** →
  **«Preguntas y propuestas»** al final de la sección: preguntas abiertas
  para Álvaro y los socios, y 2–4 mejoras propuestas desde el código y los
  documentos (son propuestas; Hernán las revisa).
- **Las dos etiquetas** de cada cosa que falta: `'necesario'` = «Necesario
  para salir» (naranja) y `'puede-esperar'` = «Puede esperar» (violeta).
  `quien`: Álvaro, Socios, Hernán o «Álvaro y socios». La parte 8 junta
  todos los «Necesario para salir».
- **Nada inventado:** lo que una diapositiva dice que hay, se ha visto en la
  web o en el código.
- **De dónde sale lo que falta:** `docs/TRASPASO.md`, `docs/DECISIONES.md`
  (preguntas abiertas P2…P27), `docs/spec/estado.md` (FALTA y PARCIAL),
  `docs/contenido-real.md`, `docs/propuestas/textos-zonas.md`,
  `docs/propuestas/2026-10-07-plan-017-guia-prueba.md` y los puntos de
  Hernán del plan 018 (decisión 9).

## Cuántas diapositivas (decisión 3, ±2)

| Parte | Archivo | Diapositivas |
|---|---|---|
| 1 Portada, resumen y estado | `01-portada.ts` | ~4 |
| 2 Landing | `02-landing.ts` | ~10 |
| 3 Páginas | `03-paginas.ts` | ~7 |
| 4 Carnet BOIA y Ranking | `04-carnet-ranking.ts` | ~6 |
| 5 El océano `/mar` | `05-mar.ts` | ~12 |
| 6 Minijuegos | `06-minijuegos.ts` | ~9 |
| 7 Admin | `07-admin.ts` | ~8 |
| 8 Hoja de ruta para salir | `08-cierre.ts` | ~4 |

## Revisar y subir

1. `pnpm deck:capturas NN && pnpm deck && pnpm deck:render`.
2. Mirar cada PNG de la parte en `render/` (qué números son, en
   `render/indice.txt`): nada cortado ni fuera de su caja, teléfonos sin
   deformar.
3. Subir la parte, sus capturas, la `.pptx` y el PDF.

**Conflictos en la `.pptx` o el PDF** (son binarios y cada parte los
regenera): da igual qué lado se quede; se regeneran desde los archivos de
texto, que no chocan porque cada parte tiene los suyos:

```sh
git checkout --theirs docs/presentacion/boia-planet.pptx docs/presentacion/boia-planet.pdf
pnpm deck && pnpm deck:render
git add docs/presentacion/boia-planet.pptx docs/presentacion/boia-planet.pdf
```
