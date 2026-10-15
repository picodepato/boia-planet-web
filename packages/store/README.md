# @boia/store

La capa de datos de la versión de prueba (plan 002, T16). Sin React: la usan el
motor, la landing, `/juego` y el Admin. Hoy guarda todo en el navegador de quien
visita (D-20); con Supabase llegará otra implementación de la misma interfaz
(`BoiaRepository`) y quien la usa no cambia.

Todo el contenido, los números y los textos de la muestra son `muestra` hasta que
Álvaro los apruebe.

## Cómo se usa

```ts
import { browserRepository, isStoreError } from '@boia/store';

const repo = browserRepository(); // uno por pestaña; en el servidor, uno en memoria por llamada

const off = repo.subscribe(({ areas }) => {
  if (areas.includes('progress')) refrescarHud();
});

await repo.progress.grantWorldReward({ sourceRef: 'cofre-cala', coins: 5 }); // una vez para siempre
await repo.progress.completeAchievement('primera-boia'); // listo para reclamar: no da nada
await repo.progress.claimAchievement('primera-boia'); // ahora sí: el premio lo pone la definición, una vez
const { points, coins } = await repo.progress.balances(); // derivados del libro, sólo lectura

try {
  await repo.bottles.place({ message, x, y });
} catch (e) {
  if (isStoreError(e, 'conflict')) avisar('Ya tienes una botella en el mar');
}
```

Para usarlo desde `apps/web`: añadir `"@boia/store": "workspace:*"` a sus
dependencias y `'@boia/store'` a `transpilePackages` de `next.config.ts`. Si hace
falta validar posiciones contra el mar o el mapa, pasar las validaciones en la
primera llamada (una sola vez, al arrancar la app):

```ts
browserRepository({
  validate: {
    bottlePosition: (p) => (esMar(p) ? null : 'eso es tierra'),
    placePatch: (placeId, patch) => validarLugar(placeId, patch), // @boia/world
  },
  sample: { bottles: botellasDeMuestraEnCoordenadasDelMotor }, // opcional
});
```

Todas las llamadas son asíncronas (la de Supabase irá por red). Para React:
`useSyncExternalStore(repo.subscribe, repo.revision)` y volver a leer al cambiar
la revisión.

## Reglas que no se saltan

- **El libro manda.** Puntos, monedas, logros, sellos y cosméticos sólo cambian
  con transacciones del libro (`ledger`), como `ledger_transactions` de T06. No
  hay ningún método para fijar un saldo; los saldos se calculan al leer y nunca
  se guardan. Un saldo escrito a mano en `localStorage` se ignora, y al cargar se
  vuelve a pasar el libro por las reglas (ids repetidos, compensaciones
  inventadas o gastos sin saldo se descartan).
- **Ids estables los elige el repositorio**, a partir del origen de la
  concesión: `world_reward:<sourceRef>[@día|@season:<mundo>]`,
  `achievement:<id>`, `cosmetic:<id>`, `stamp:<purchaseId>`,
  `compensation:<txId>`. Repetir una concesión devuelve `{ granted: false,
reason: 'duplicate' }` sin tocar nada. Con Supabase, el servidor derivará el
  UUID de esa misma clave.
- **Puntos y monedas separados** (REQ-IDE-027): gastar monedas nunca toca los
  puntos ni deja las monedas en negativo (`insufficient_coins`).
- **Mapa compartido** (D-20): los datos del mundo van por id estable de lugar
  (los de `mundos/arcilla/mapa.json`: `puerto`, `allday`, `cala`…), nunca por
  coordenadas ni duplicados por mundo. Los cambios de posición, parámetros y
  activado de un lugar valen en todos los mundos; nombre, textos, arte y
  «oculto» van por (mundo, lugar).
- **Admin de la demo**: cada cambio queda en este navegador, va a la auditoría
  local (sólo de añadir) y se restablece a la muestra por áreas.

## API

`BoiaRepository` (en `src/repository.ts`, con comentarios de cada método):

| Parte                         | Métodos                                                                                                                                                                                                                                                                                                                               | Notas                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `status()`                    | —                                                                                                                                                                                                                                                                                                                                     | `{ persistence: 'local' \| 'memory', issue, message, schemaVersion, droppedOnLoad }`. `message` es el texto para la interfaz cuando algo va mal.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `revision()`, `subscribe(fn)` | —                                                                                                                                                                                                                                                                                                                                     | `fn({ areas, revision, external })`; `areas` entre `identity`, `carnet`, `progress`, `purchases`, `bottles`, `content`, `audit`, `storage`. `external`: cambio de otra pestaña.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `identity`                    | `current`, `ensure`, `reset`                                                                                                                                                                                                                                                                                                          | Invitado sin email. Toda escritura crea la identidad si falta. `reset` olvida al invitado en este navegador.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `carnet`                      | `questions`, `mine`, `get(userId)`, `create`, `update`, `answer`                                                                                                                                                                                                                                                                      | Apodo 2–30, único sin distinguir mayúsculas (incluida la tripulación de muestra). «Miembro desde» lo fija `create`. Las 5 preguntas son las de su público (`carnetQuestionsFor(isArtist)` de `@boia/contracts`, T294: artista o no), textuales; `questions` da las del Carnet propio. `get` abre también el Carnet de los miembros de muestra. `CarnetView` trae puntos, rango, logros, sellos, cosméticos y equipados.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `progress`                    | `balances`, `ledger`, `grantWorldReward`, `completeAchievement`, `claimAchievement`, `achievements`, `badges`, `ships`, `buyCosmetic`, `cosmetics`, `equip`, `equipped`, `stamps`, `discover`, `discoveries`, `findDiscount`, `discounts`, `mission`, `setMission`, `record`, `submitTime`, `counter`, `increment`, `pref`, `setPref` | `grantWorldReward({ sourceRef, points, coins, policy: 'once' \| 'daily' \| 'season' })`: `daily` es por día natural en Europe/Madrid, `season` por mundo activo. Los logros se completan (`in_progress` → `ready`, sin tocar el libro) y se reclaman (`claimed`: su fila del libro y su premio, una vez por id). Un logro con `cosmeticKey` concede al reclamar el cosmético (en la ranura `ship`, un barco de estilo: `ships()` dice cuáles están bloqueados); con `badgeKey`, una insignia del Carnet (`badges()`, `CarnetView.badges`). Los ocultos se listan como «???» hasta completarlos. `discover` y `findDiscount` devuelven `first` sólo la primera vez; el descuento trae su estado (`active`, `upcoming`, `expired`). `setMission` guarda paso y datos (destino por id, nunca coordenadas). `submitTime` guarda el mejor tiempo local (D-09). `pref`: aspecto del barco y demás preferencias del invitado.                                                                                                                                                                                                                                                                                                                                                          |
| `purchases`                   | `confirmSandbox`, `list`                                                                                                                                                                                                                                                                                                              | Compra de prueba (D-20): exige evento a la venta y, si hay descuento, que esté encontrado, vigente y sea de ese evento. Concede el sello `stamp:<purchaseId>` una vez; otra compra del mismo evento no da segundo sello (`already_stamped`). No concede el logro de entrada: eso lo decide quien llama.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `bottles`                     | `list`, `mine`, `place`, `edit`, `retire`, `read`, `report`                                                                                                                                                                                                                                                                           | Hace falta Carnet para escribir y reportar (`no_carnet`). Una activa por identidad (`conflict`); 1–140 caracteres contados como Postgres (un emoji es uno). Leer no la quita y queda registrado. Nunca dan puntos ni monedas. Incluye las botellas de muestra de la tripulación ficticia.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `content`                     | `list(area)`, `get(area, id)`, `home`, `events`, `texts`, `places`, `skins`, `activeWorldId`                                                                                                                                                                                                                                          | Muestra + cambios del Admin, ya resueltos. `home()` tiene la forma `HomeContent` de `@boia/contracts`. `texts()` son sólo los cambiados: la app los pone sobre los suyos con `resolveTexts`. `places()` y `skins()` son los cambios; quien pinta el mundo los aplica sobre el mapa de `@boia/world` (`applyPlacePosition`, o a mano para `params`). `activeWorldId` null = el que diga el registro de mundos.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `admin`                       | `upsert`, `remove`, `restore`, `reorder`, `setPlace`, `setSkin`, `setText`, `setActiveWorld`, `reset(area \| 'all')`, `overridden(area)`, `audit`, `bottles`, `removeBottle`, `resolveReport`, `compensate`                                                                                                                           | Áreas de contenido con id (`ENTITY_AREAS`): `events`, `homeBlocks`, `artists`, `albums`, `photos`, `promotions`, `discounts`, `achievements`, `cosmetics`, `ranks`, `music`. Además `places`, `skins`, `texts`, `activeWorld` (`CONTENT_AREAS`). `upsert` valida con el esquema y rechaza con el motivo (`invalid`). `remove` va a la papelera; `restore` la saca. `setPlace`/`setSkin` mezclan con el cambio anterior; null lo quita. `removeBottle` retira por moderación (también las de muestra) y cierra sus reportes. `compensate` retira una recompensa con una compensación. Todo va a `audit()` con autor `admin-demo`, fecha, motivo, antes y después. Desde T48: `trash`, `purge`, `purgeExpired`, `settings`/`setSettings` (plazo de la papelera; lo caducado se purga solo en el siguiente cambio de la papelera; lo purgado no se recupera) y el borrador de `homeBlocks` y `events` (`DRAFT_AREAS`): `draftUpsert`, `draftReorder`, `draftText`, `draftList`, `draftHome`, `draftTexts`, `pendingDrafts`, `publish` (todo de una vez, sube `content.revision`) y `discardDrafts`; `content.*` sólo da lo publicado. Cambiar la condición de un logro sube su `version`. Las compras de prueba y sus sellos también van a `audit()`, con el visitante como autor. |

Errores: `StoreError` con `code` entre `invalid`, `not_found`, `forbidden`,
`conflict`, `insufficient_coins` y `no_carnet` (`isStoreError(e, code)`).

## Almacenamiento

- Un documento JSON en `localStorage['boia.store']` con `schemaVersion`
  (`SCHEMA_VERSION`, hoy 5; la v2 trae los logros que se reclaman, T36; la v3,
  los eventos por fechas, T42; la v4, los descuentos con destino, T43; la v5,
  el borrador y la publicación de la home y los eventos, la papelera con plazo
  y purga, la música con licencia y las compras y sellos en la auditoría, T48).
  Se eligió localStorage y no IndexedDB: el documento
  es pequeño, la lectura síncrona evita esperas al arrancar y es lo que ya usa el
  resto de la demo. La foto del Carnet (data URL) está limitada a
  `AVATAR_IMAGE_MAX` caracteres; quien la sube la reduce antes.
- Cambiar la forma del documento: subir `SCHEMA_VERSION`, añadir el paso en
  `MIGRATIONS` (`src/migrations.ts`) y su prueba. Los pasos reciben el documento
  guardado sin validar y nunca borran progreso.
- Si no se puede guardar, todo sigue funcionando en memoria y `status()` lo
  dice: `unavailable` (servidor, sin localStorage), `blocked` (modo privado,
  cookies bloqueadas), `quota` (lleno a mitad de visita). Si lo guardado no se
  puede leer (`corrupt`) o falta un paso de migración (`migration_failed`), se
  guarda una copia en `boia.store.backup` y se empieza de cero. Si lo guardó una
  versión más nueva (`newer_schema`), no se toca y la visita va en memoria.
- Otra pestaña que cambia o borra los datos: se recarga y se avisa con
  `external: true`.

## Muestra

`src/sample/`: eventos, bloques de la home, los 26 artistas de v14 §18.1,
álbum y fotos (copiados de `apps/web/lib/landing/sample-content.ts`, con el
evento de primavera ligado a la isla `allday` del mapa compartido), descuentos
(uno vigente por evento a la venta y uno caducado), el catálogo de logros aprobado
(`docs/propuestas/logros-catalogo.md`), cosméticos y barcos de estilo, rangos y tres
miembros ficticios con Carnet y botella.
`createLocalRepository({ sample: { … } })` sustituye cualquier parte.
