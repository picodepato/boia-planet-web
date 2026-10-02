import { DIRECTIONS, type Direction } from '@boia/world';
import { wrapAngle } from '../math';

const SECTOR = Math.PI / 4;

/** Índice (0..7 sobre `DIRECTIONS`) de la vista más cercana al rumbo real del casco. */
export function directionIndexForHeading(heading: number): number {
  const i = Math.round(wrapAngle(heading - Math.PI / 2) / SECTOR);
  return ((i % 8) + 8) % 8;
}

export function directionForHeading(heading: number): Direction {
  return DIRECTIONS[directionIndexForHeading(heading)]!;
}

/**
 * Elige la vista con histéresis para que el sprite no parpadee cuando el
 * rumbo oscila en la frontera entre dos vistas. Nunca espeja: cada vista es
 * su propia imagen (§49.17).
 */
export class DirectionPicker {
  private index: number;

  constructor(
    heading: number,
    private readonly hysteresis = (3 * Math.PI) / 180,
  ) {
    this.index = directionIndexForHeading(heading);
  }

  pick(heading: number): Direction {
    const center = Math.PI / 2 + this.index * SECTOR;
    if (Math.abs(wrapAngle(heading - center)) > SECTOR / 2 + this.hysteresis) {
      this.index = directionIndexForHeading(heading);
    }
    return DIRECTIONS[this.index]!;
  }

  get current(): Direction {
    return DIRECTIONS[this.index]!;
  }
}
