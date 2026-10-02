'use client';

import { type Medal, type Medals, formatRaceTime, medalFor, nextMedal } from '@boia/engine/circuit';
import { t as msg } from '../../lib/i18n';

/**
 * El HUD de El Freu en /mar (T61): el cronómetro pequeño arriba, con la
 * vuelta y la boia que tocan (REQ-AVE-028), el récord al acercarse a la
 * salida y, en meta, una tarjeta pequeña con la medalla, el tiempo, el
 * récord y «Otra vez». Sin lógica de carrera: la lleva `mar-client`.
 */

export interface RaceHud {
  phase: string;
  countdown: number | null;
  ms: number | null;
  next: number;
  lap: number;
  laps: number;
  buoys: number;
  /** Corre contra el fantasma de su mejor carrera. */
  ghost: boolean;
}

export interface RaceResult {
  place: string;
  ms: number;
  laps: number[];
  medals: Medals;
  best: boolean;
  bestMs: number;
}

const MEDAL_TEXT: Record<Medal, string> = {
  gold: msg('mar.race.medal.gold'),
  silver: msg('mar.race.medal.silver'),
  bronze: msg('mar.race.medal.bronze'),
};

const MEDAL_NAME: Record<Medal, string> = {
  gold: msg('mar.race.medalName.gold'),
  silver: msg('mar.race.medalName.silver'),
  bronze: msg('mar.race.medalName.bronze'),
};

/** El cronómetro: tiempo, vuelta y boia (o «a la salida» para cerrar la vuelta). */
export function MarRaceChip({ race }: { race: RaceHud }) {
  const toFinish = race.next > race.buoys;
  return (
    <div
      className="mar-chip mar-chip--race"
      data-testid="mar-crono"
      data-fase={race.phase}
      data-vuelta={race.lap}
      data-boia={toFinish ? 0 : race.next}
      data-fantasma={race.ghost ? 'si' : 'no'}
      role="timer"
      aria-live="off"
    >
      ⏱ {race.ms !== null ? formatRaceTime(race.ms) : msg('mar.client.preparados')}
      {race.phase === 'racing' ? (
        <span className="mar-chip__sub">
          {msg('mar.race.chip.lap', { lap: race.lap, laps: race.laps })} ·{' '}
          {toFinish
            ? msg('mar.race.chip.finish')
            : msg('mar.race.chip.buoy', { next: race.next, buoys: race.buoys })}
        </span>
      ) : null}
      {race.ghost ? (
        <span
          className="mar-chip__sub"
          title={msg('mar.race.ghost')}
          aria-label={msg('mar.race.ghost')}
        >
          👻
        </span>
      ) : null}
    </div>
  );
}

/** El récord antes de correr, al acercarse a la salida (REQ-AVE-028). */
export function MarRaceIntro({ text }: { text: string }) {
  return (
    <div className="mar-chip mar-chip--race-intro" data-testid="mar-carrera-salida">
      🏁 {text}
    </div>
  );
}

/** La tarjeta de meta: medalla, tiempo, récord, vueltas y «Otra vez». */
export function MarRaceResult({
  result,
  onAgain,
  onClose,
}: {
  result: RaceResult;
  onAgain(): void;
  onClose(): void;
}) {
  const medal = medalFor(result.ms, result.medals);
  const next = nextMedal(result.ms, result.medals);
  return (
    <section
      className="mar-carrera"
      data-testid="mar-carrera-final"
      data-medalla={medal ?? 'ninguna'}
      aria-label={msg('mar.race.result.title', { place: result.place })}
    >
      <header className="mar-carrera__head">
        <strong className="mar-carrera__medal">
          {medal ? MEDAL_TEXT[medal] : msg('mar.race.medal.none')}
        </strong>
        <span className="mar-carrera__place">
          {msg('mar.race.result.title', { place: result.place })}
        </span>
        <button
          type="button"
          className="mar-chip__x"
          aria-label={msg('mar.race.close')}
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <p className="mar-carrera__time" data-testid="mar-carrera-tiempo">
        {msg('mar.race.result.time', { time: formatRaceTime(result.ms) })}
      </p>
      <p className="mar-carrera__best" data-testid="mar-carrera-record">
        {result.best
          ? msg('mar.race.result.newBest')
          : msg('mar.race.result.best', { time: formatRaceTime(result.bestMs) })}
      </p>
      <p className="mar-carrera__laps">
        {msg('mar.race.result.laps', { times: result.laps.map(formatRaceTime).join(' · ') })}
      </p>
      {next ? (
        <p className="mar-carrera__next">
          {msg('mar.race.result.next', {
            medal: MEDAL_NAME[next],
            time: formatRaceTime(result.medals[next]),
          })}
        </p>
      ) : null}
      <button
        type="button"
        className="mar-carrera__again"
        data-testid="mar-carrera-otra"
        onClick={onAgain}
      >
        {msg('mar.race.again')}
      </button>
    </section>
  );
}
