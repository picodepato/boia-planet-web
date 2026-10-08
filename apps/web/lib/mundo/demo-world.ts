import { WORLD_REGISTRY, type WorldRegistry, resolveSkinTexts } from '@boia/world';
import { es, type MessageKey } from '../i18n/es';
import { t } from '../i18n';

/**
 * Mundos del juego (T17): un mapa compartido y una skin por mundo, de
 * `@boia/world`. Desde T20 el mapa es el de `mundos/arcilla/mapa.json` y el
 * mundo por defecto, Arcilla; desde T24, también Acuarela. El mar elige el
 * suyo con `world-choice.ts`.
 * Cuando exista el editor vendrán de la revisión publicada.
 *
 * Los textos de la skin de Arcilla son claves i18n (plan 017, T195): aquí se
 * resuelven al texto del catálogo. Un valor que no es clave (los textos de
 * Acuarela, o uno escrito desde el Admin) se queda como está.
 */
export const translateSkinText = (value: string): string =>
  value in es ? t(value as MessageKey) : value;

export const worlds: WorldRegistry = WORLD_REGISTRY.mapSkins((skin) =>
  resolveSkinTexts(skin, translateSkinText),
);

/**
 * Estilos de barco que sólo pertenecen a un mundo oculto (Acuarela): la tienda
 * del barco no los ofrece mientras nadie pueda llegar a ese mundo.
 */
export const hiddenShipStyles = (reg: WorldRegistry = worlds): ReadonlySet<string> => {
  const playable = new Set(reg.playableIds().map((id) => reg.skin(id).ship.style));
  return new Set(
    [...reg.hiddenIds].map((id) => reg.skin(id).ship.style).filter((s) => !playable.has(s)),
  );
};
