import {
  ENTITY_AREAS,
  ENTITY_SCHEMAS,
  type AreaInput,
  type AreaItem,
  type EntityArea,
} from '../schema';
import {
  SAMPLE_ALBUMS,
  SAMPLE_ARTISTS,
  SAMPLE_CARNET_DISCOUNT,
  SAMPLE_DISCOUNTS,
  SAMPLE_EVENTS,
  SAMPLE_HOME_BLOCKS,
  SAMPLE_PHOTOS,
  SAMPLE_PROMOTIONS,
} from './content';
import { SAMPLE_BOTTLES, SAMPLE_CREW, type SampleBottle, type SampleCrewMember } from './crew';
import { SAMPLE_ACHIEVEMENTS, SAMPLE_COSMETICS, SAMPLE_RANKS } from './progress';

export * from './content';
export * from './crew';
export * from './progress';
export * from './real-content';

/** Muestra de entrada (sin validar): lo que se puede pasar a `createLocalRepository`. */
export type SampleInput = { [A in EntityArea]: AreaInput<A>[] } & {
  /** Textos de la web y del mundo por clave; los de la app siguen en su i18n. */
  texts: Record<string, string>;
  /** Mundo activo de la muestra; null: el que diga el registro de mundos (@boia/world). */
  activeWorldId: string | null;
  crew: SampleCrewMember[];
  bottles: SampleBottle[];
  /** El descuento de tener Carnet BOIA (T66), con la forma de un descuento. */
  carnetDiscount: AreaInput<'discounts'>;
};

/** Muestra validada. */
export type SampleData = { [A in EntityArea]: AreaItem<A>[] } & Omit<
  SampleInput,
  EntityArea | 'carnetDiscount'
> & { carnetDiscount: AreaItem<'discounts'> };

export const DEFAULT_SAMPLE_INPUT: SampleInput = {
  events: SAMPLE_EVENTS,
  homeBlocks: SAMPLE_HOME_BLOCKS,
  artists: SAMPLE_ARTISTS,
  albums: SAMPLE_ALBUMS,
  photos: SAMPLE_PHOTOS,
  promotions: SAMPLE_PROMOTIONS,
  discounts: SAMPLE_DISCOUNTS,
  achievements: SAMPLE_ACHIEVEMENTS,
  cosmetics: SAMPLE_COSMETICS,
  ranks: SAMPLE_RANKS,
  /** Sin pistas subidas: la música de cada mundo es el loop generado (O10). */
  music: [],
  /** Sin objetos ni plantillas propias: las de serie las pone la web (T190). */
  worldObjects: [],
  objectTemplates: [],
  texts: {},
  activeWorldId: null,
  crew: SAMPLE_CREW,
  bottles: SAMPLE_BOTTLES,
  carnetDiscount: SAMPLE_CARNET_DISCOUNT,
};

/** Valida la muestra (lanza si algo no cumple el esquema: es un error de código). */
export function parseSample(input: Partial<SampleInput> = {}): SampleData {
  const merged: SampleInput = { ...DEFAULT_SAMPLE_INPUT, ...input };
  const out: Partial<Record<EntityArea, unknown[]>> = {};
  for (const area of ENTITY_AREAS) {
    const schema = ENTITY_SCHEMAS[area];
    const items = merged[area] as unknown[];
    const seen = new Set<string>();
    out[area] = items.map((raw) => {
      const item = schema.parse(raw) as { id: string };
      if (seen.has(item.id)) throw new Error(`muestra: id repetido en ${area}: ${item.id}`);
      seen.add(item.id);
      return item;
    });
  }
  return {
    ...(out as { [A in EntityArea]: AreaItem<A>[] }),
    texts: { ...merged.texts },
    activeWorldId: merged.activeWorldId,
    crew: merged.crew,
    bottles: merged.bottles,
    carnetDiscount: ENTITY_SCHEMAS.discounts.parse(merged.carnetDiscount) as AreaItem<'discounts'>,
  };
}
