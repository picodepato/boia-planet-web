import { type HomeContent, effectiveEvents } from '@boia/contracts';
import type { BoiaRepository } from '@boia/store';
import { homeWithSharedPhotos } from '../admin/shared-photos';
import { SAMPLE_CONTENT } from './sample-content';

/**
 * Lo último que se leyó del contenido del repositorio, para quien lo necesita
 * sin esperar (el mar del 2D y /mar: qué evento abre una isla, si se
 * vende). Hasta que `refreshLiveContent` lee el repositorio, la muestra;
 * después, la muestra con los cambios del Admin de la demo (T26).
 *
 * Los eventos salen con su estado de ahora (REQ-COM-004, T42): un evento
 * cuya fecha pasó ya no se vende en ninguna isla aunque nadie lo toque.
 */
let current: HomeContent = SAMPLE_CONTENT;
/** Lo calculado para `current` en este minuto: no se recalcula en cada lectura. */
let cached: { source: HomeContent; minute: number; content: HomeContent } | null = null;

export function liveContent(now: Date = new Date()): HomeContent {
  const minute = Math.floor(now.getTime() / 60_000);
  if (cached?.source === current && cached.minute === minute) return cached.content;
  const content = { ...current, events: effectiveEvents(current.events, now) };
  cached = { source: current, minute, content };
  return content;
}

/**
 * Lee el contenido del repositorio y lo deja a mano. Con cuentas, encima, las
 * fotos de las islas que subió el Admin y sus eventos pasados (T189).
 */
export async function refreshLiveContent(repo: BoiaRepository): Promise<HomeContent> {
  current = await homeWithSharedPhotos(repo);
  return liveContent();
}

/** Sólo pruebas: vuelve a la muestra. */
export function resetLiveContentForTests(): void {
  current = SAMPLE_CONTENT;
  cached = null;
}
