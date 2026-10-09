import { SAMPLE_CONTENT_REVISION, type EntityArea, type StoreDoc } from './schema';

/**
 * Renovar la muestra en un navegador con datos viejos (plan 023 T248).
 *
 * En modo local (D-20) el contenido es la muestra del código con los cambios
 * del Admin encima, guardados en el navegador. Un cambio guarda el elemento
 * entero, así que congela la muestra tal como era el día del cambio: si
 * después la muestra cambia (otro evento prioritario, eventos que se van,
 * nombres reales), ese navegador sigue viendo la copia vieja y otro navegador
 * sin cambios ve la nueva. Así un ordenador enseñaba «ALL DAY BOIA» como
 * próximo evento y un móvil «HALLOWEEN IN THE CLUB».
 *
 * Cada paso dice qué áreas se renuevan al llegar a su revisión: en ellas se
 * quitan los cambios guardados (publicados y en borrador) de los elementos de
 * la muestra, los de hoy y los que la muestra ya retiró (`retiredIds`), y
 * vuelve a verse la muestra actual. Lo creado en el Admin (ids que nunca
 * fueron de la muestra), el orden, los textos y lo purgado para siempre (la
 * marca `purged`) se quedan como estaban.
 */
export interface SampleReseed {
  revision: number;
  /** Para el registro. */
  reason: string;
  areas: readonly EntityArea[];
  /** ids que fueron de la muestra y ya no están (copia fija: no se lee el código vivo). */
  retiredIds?: Partial<Record<EntityArea, readonly string[]>>;
}

export const SAMPLE_RESEEDS: readonly SampleReseed[] = [
  {
    revision: 1,
    reason:
      'eventos y home de la muestra de hoy: Halloween fijado, los tres eventos con entradas (plan 023 T248)',
    areas: ['events', 'homeBlocks'],
    // Los eventos de muestra de antes del T67 (2026-10-02).
    retiredIds: { events: ['ev-all-day-primavera', 'ev-noche-mayo', 'ev-all-day-verano'] },
  },
];

/** ids de la muestra actual por área, para saber qué es de la muestra. */
export type SampleIds = Partial<Record<EntityArea, readonly { id: string }[]>>;

/**
 * Lleva los cambios guardados hasta `SAMPLE_CONTENT_REVISION`. Cambia `doc` en
 * su sitio y devuelve si hubo que tocar algo (para guardarlo).
 */
export function reseedSample(
  doc: StoreDoc,
  sample: SampleIds,
  target: number = SAMPLE_CONTENT_REVISION,
  steps: readonly SampleReseed[] = SAMPLE_RESEEDS,
): boolean {
  const from = doc.content.sampleRevision ?? 0;
  if (from >= target) return false;
  for (const step of steps) {
    if (step.revision <= from || step.revision > target) continue;
    for (const area of step.areas) {
      const ids = new Set([
        ...(sample[area] ?? []).map((x) => x.id),
        ...(step.retiredIds?.[area] ?? []),
      ]);
      const published = doc.content.items[area];
      if (published) {
        for (const id of ids) if (published[id] && !published[id].purged) delete published[id];
      }
      const drafts = doc.content.drafts.items[area];
      if (drafts) {
        for (const id of ids) if (drafts[id] && !drafts[id].purged) delete drafts[id];
      }
    }
  }
  doc.content.sampleRevision = target;
  return true;
}
