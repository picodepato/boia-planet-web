'use client';

import type { WorldConfig } from '@boia/world';
import type { GuideSpot, HelpNow } from '../../lib/mundo/guide';
import { t as msg } from '../../lib/i18n';

/**
 * El «!» de ayuda (T68, decisión de Hernán y Álvaro del 2026-10-02): el mar
 * ya no pone chips de rumbo solo (ni las boies informativas ni la misión);
 * quien quiera, toca el «!» bajo el menú y ve el objetivo de ahora y una
 * pista (un código escondido o un minijuego), cada uno con un «Rumbo a…»
 * opcional que marca el destino para navegar manualmente. Un código escondido no dice dónde está: sólo
 * «un código escondido». El delfín sigue guiando como antes. muestra
 */
export function guideLabel(spot: GuideSpot, world: WorldConfig | null): string {
  if (spot.kind === 'discount') return msg('mar.guide.discount');
  if (spot.kind === 'minigame') return msg('mar.guide.minigame', { place: placeName(spot, world) });
  // Un lugar marcado desde el tablón del faro (T157).
  if (spot.kind === 'place') return msg('mar.guide.place', { place: placeName(spot, world) });
  // La misión: a ella mientras espera; a su destino, a bordo.
  return spot.placeId === spot.objectId
    ? msg('mar.guide.fiestera')
    : msg('mar.guide.mission', { place: placeName(spot, world) });
}

const placeName = (spot: GuideSpot, world: WorldConfig | null) =>
  world?.objects.find((o) => o.identity.id === spot.placeId)?.identity.name ?? spot.placeId;

function objectiveText(help: HelpNow): string {
  if (help.objective === 'done') return msg('mar.ayuda.objetivo.hecho');
  if (help.objective === 'deliver') return msg('mar.ayuda.objetivo.aBordo');
  return msg('mar.bienvenida.objetivo');
}

function hintText(spot: GuideSpot | null, world: WorldConfig | null): string {
  if (!spot) return msg('mar.ayuda.pista.nada');
  if (spot.kind === 'discount') return msg('mar.ayuda.pista.discount');
  if (spot.kind === 'minigame')
    return msg('mar.ayuda.pista.minigame', { place: placeName(spot, world) });
  return spot.placeId === spot.objectId
    ? msg('mar.ayuda.pista.fiestera')
    : msg('mar.ayuda.pista.mission', { place: placeName(spot, world) });
}

function CourseButton({
  spot,
  world,
  testId,
  onCourse,
}: {
  spot: GuideSpot;
  world: WorldConfig | null;
  testId: string;
  onCourse: (placeId: string) => void;
}) {
  return (
    <button
      type="button"
      className="mar-ayuda__rumbo"
      data-testid={testId}
      data-destino={spot.placeId}
      onClick={() => onCourse(spot.placeId)}
    >
      {guideLabel(spot, world)}
    </button>
  );
}

/** La tarjetita del «!»: el objetivo y una pista, con su «Rumbo a…». */
export function MarAyuda({
  help,
  world,
  onCourse,
  onClose,
}: {
  help: HelpNow;
  world: WorldConfig | null;
  onCourse: (placeId: string) => void;
  onClose: () => void;
}) {
  return (
    <section
      className="mar-ayuda"
      data-testid="mar-ayuda"
      aria-label={msg('mar.ayuda.titulo')}
      data-objetivo={help.objective}
      data-pista={help.hint?.kind ?? 'nada'}
    >
      <header className="mar-ayuda__head">
        <strong>{msg('mar.ayuda.titulo')}</strong>
        <button
          type="button"
          className="mar-chip__x"
          data-testid="mar-ayuda-cerrar"
          aria-label={msg('mar.ayuda.cerrar')}
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <p data-testid="mar-ayuda-objetivo">{objectiveText(help)}</p>
      {help.objectiveSpot ? (
        <CourseButton
          spot={help.objectiveSpot}
          world={world}
          testId="mar-ayuda-rumbo-objetivo"
          onCourse={onCourse}
        />
      ) : null}
      <p data-testid="mar-ayuda-pista">
        <strong>{msg('mar.ayuda.pista')}</strong> {hintText(help.hint, world)}
      </p>
      {help.hint ? (
        <CourseButton
          spot={help.hint}
          world={world}
          testId="mar-ayuda-rumbo-pista"
          onCourse={onCourse}
        />
      ) : null}
    </section>
  );
}
