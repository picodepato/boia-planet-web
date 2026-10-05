import type { DefenseEnemyView } from './towers';
import type { DefenseInput, DefenseSnapshot } from './sim';

/**
 * Bots de prueba (sin torres): el avión solo. `idlePlaneBot` se queda donde
 * empieza; `chasePlaneBot` vuela hacia el enemigo más adelantado del camino
 * (el que antes llegaría al castillo), se queda a medio alcance y compra los
 * niveles del avión en cuanto llega el dinero. Sirven para ver que el avión
 * solo no basta (hacen falta las islas) y de base para el bot de T159.
 */

export type DefenseBot = (s: DefenseSnapshot) => DefenseInput;

export const idlePlaneBot: DefenseBot = () => ({});

export const chasePlaneBot: DefenseBot = (s) => {
  const input: DefenseInput = {};
  if (s.plane.nextUpgradeCost !== null && s.coins >= s.plane.nextUpgradeCost)
    input.upgradePlane = true;
  let target: DefenseEnemyView | null = null;
  for (const e of s.enemies) if (!e.dead && (!target || e.distance > target.distance)) target = e;
  if (!target) return input;
  const dx = target.x - s.plane.x;
  const dy = target.y - s.plane.y;
  const d = Math.hypot(dx, dy);
  if (d > s.plane.range * 0.5) input.move = { x: dx / d, y: dy / d };
  return input;
};
