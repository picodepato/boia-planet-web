/**
 * Parámetros del barco. Todos son `muestra`: valores iniciales razonables a
 * ajustar navegando en móvil (§49.7 pide medir el recorrido con el barco
 * base). Unidades de mundo: 1 u = 1 px de pantalla en horizontal a zoom 1.
 */
export interface ShipConfig {
  /** u/s. muestra */
  maxSpeed: number;
  /** u/s² con acelerador a fondo. muestra */
  acceleration: number;
  /** u/s² al soltar el control o al pedir menos velocidad. muestra */
  brakeDeceleration: number;
  /** rad/s a velocidad de crucero. muestra */
  turnRate: number;
  /** Fracción de `turnRate` con el barco parado (puede girar sobre sí). muestra */
  minTurnFactor: number;
  /** 1/s: rapidez con que la quilla anula el deslizamiento lateral. muestra */
  lateralGrip: number;
  /** Fracción del deslizamiento lateral anulado que pasa a avance. muestra */
  gripToForward: number;
  drift: {
    /** Multiplica `turnRate` mientras hay drift. muestra */
    turnMultiplier: number;
    /** Agarre lateral durante el drift (menos = más derrape). muestra */
    lateralGrip: number;
    gripToForward: number;
  };
  /** Radio de colisión en u; sigue a la eslora de 48 u (D-15). muestra */
  radius: number;
  /** Restitución contra las costas: casi desliza. muestra */
  wallRestitution: number;
  /** Restitución contra obstáculos: rebote suave. muestra */
  obstacleRestitution: number;
  /**
   * u/s de la corriente que devuelve el barco al pasar el borde superior.
   * Mayor que `maxSpeed`, para que no se pueda escapar. muestra
   */
  openEdgeCurrent: number;
  /** u más allá del borde superior en las que la corriente llega a su máximo. muestra */
  openEdgeSoftZone: number;
  /**
   * Fracción del giro que se tiene con el acelerador casi a cero (0..1). Sin
   * valor, el giro sigue al acelerador entero (un toque corto apenas gira).
   * Con valor, el giro es `steerFloor + (1 − steerFloor) · acelerador`: un
   * arrastre pequeño ya gira rápido hacia donde se apunta. muestra
   */
  steerFloor?: number;
  /**
   * u: radio de giro que no se pasa por ir más rápido que el crucero (turbo,
   * viaje, boost). Por encima de `turnRadius · turnRate` u/s el giro, el
   * agarre y el freno en las curvas crecen con la velocidad. Sin valor, el
   * giro máximo no crece y el círculo se abre al acelerar. muestra
   */
  turnRadius?: number;
  /**
   * Pedir rumbo de espaldas yendo hacia delante: vuelta corta. Escala con lo
   * de espaldas que quede el rumbo pedido (nada a 90°, todo a 180°). Sin
   * valor, el barco hace el arco de siempre. muestra
   */
  reverseTurn?: {
    /** Multiplica el giro máximo con el rumbo pedido justo detrás. muestra */
    turnBoost: number;
    /** u/s² de freno extra con el rumbo pedido justo detrás. muestra */
    brake: number;
  };
}

export const DEFAULT_SHIP_CONFIG: ShipConfig = {
  maxSpeed: 150,
  acceleration: 240,
  brakeDeceleration: 170,
  turnRate: 2.4,
  minTurnFactor: 0.4,
  lateralGrip: 6,
  gripToForward: 0.8,
  drift: { turnMultiplier: 1.8, lateralGrip: 1.1, gripToForward: 0.35 },
  radius: 13.5,
  wallRestitution: 0.15,
  obstacleRestitution: 0.45,
  openEdgeCurrent: 260,
  openEdgeSoftZone: 200,
};
