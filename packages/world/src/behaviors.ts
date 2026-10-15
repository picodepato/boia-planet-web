import { z } from 'zod';

/**
 * Catálogo de comportamientos del mundo, v1 (v14 §48.3, REQ-MUN-025 y
 * REQ-MUN-026, con el corte de D-02). Un objeto del mundo es asset +
 * geometría + comportamientos de este catálogo + parámetros: ningún
 * comportamiento sabe qué imagen lleva el objeto (§48.1).
 *
 * Los esquemas de parámetros son los mismos para el motor y para el editor
 * (T09): los rangos son los «rangos seguros» de §48.8 (REQ-ADM-013). Cada
 * parámetro tiene un valor por defecto razonable, así `{ type, params: {} }`
 * ya es un comportamiento válido. Todos los valores por defecto son `muestra`.
 *
 * Tiempos en segundos; intensidades como fracción 0..1 (0,6 = 60 %).
 */

const seconds = (max: number) => z.number().finite().min(0).max(max);
const fraction = z.number().finite().min(0).max(1);
const id = z.string().min(1).max(80);

/**
 * Qué dispara una acción (diálogo, contenido, recompensa…). Si falta: al
 * recoger si el objeto es recogible; si no, al entrar en proximidad si el
 * objeto tiene radio de proximidad; si no, al contacto.
 */
export const BEHAVIOR_TRIGGERS = [
  'proximity_enter',
  'proximity_exit',
  'contact',
  'collect',
] as const;
export const BehaviorTrigger = z.enum(BEHAVIOR_TRIGGERS);
export type BehaviorTrigger = z.infer<typeof BehaviorTrigger>;

// --- Respuesta: sonido y animación (REQ-PRO-011) ------------------------------

/**
 * Sonidos cortos de serie que un comportamiento puede declarar. La web los
 * sintetiza (no hay audio grabado todavía). Todos `muestra`.
 */
export const FEEDBACK_SOUNDS = ['ping', 'whoosh', 'bump', 'plop', 'chime', 'fanfare'] as const;
export const FeedbackSound = z.enum(FEEDBACK_SOUNDS);
export type FeedbackSound = z.infer<typeof FeedbackSound>;

/** Animaciones cortas de serie del objeto al dispararse el comportamiento. */
export const FEEDBACK_ANIMATIONS = ['pop', 'bounce', 'shake', 'spin', 'pulse'] as const;
export const FeedbackAnimation = z.enum(FEEDBACK_ANIMATIONS);
export type FeedbackAnimation = z.infer<typeof FeedbackAnimation>;

/**
 * Respuesta inmediata de un comportamiento con efecto visible: un sonido y
 * una animación de serie. Sin valor, la de por defecto del juego (o ninguna).
 */
const feedback = {
  sound: FeedbackSound.optional(),
  animation: FeedbackAnimation.optional(),
};

// --- COLISIÓN ---------------------------------------------------------------

export const COLLISION_MODES = ['block', 'bounce', 'brake', 'slow', 'boost'] as const;
export const CollisionMode = z.enum(COLLISION_MODES);
export type CollisionMode = z.infer<typeof CollisionMode>;

export const CollisionParams = z.object({
  /** bloquear, rebotar, frenar, ralentizar o impulsar. */
  mode: CollisionMode.default('block'),
  /**
   * Según el modo: rebote = restitución; frenar = fracción de velocidad que
   * se pierde al chocar; ralentizar = fracción que se quita a la velocidad
   * máxima; boost = fracción que se suma. Sin valor, `COLLISION_DEFAULTS`.
   */
  intensity: fraction.optional(),
  /** s que dura ralentizar o boost. */
  duration: seconds(10).default(2),
  /** Si el casco no puede atravesarlo. Sin valor: sí para block/bounce/brake. */
  solid: z.boolean().optional(),
  ...feedback,
});

/** Intensidad y solidez por defecto de cada modo. muestra */
export const COLLISION_DEFAULTS: Record<CollisionMode, { intensity: number; solid: boolean }> = {
  block: { intensity: 0, solid: true },
  bounce: { intensity: 0.45, solid: true },
  brake: { intensity: 0.5, solid: true },
  slow: { intensity: 0.6, solid: false },
  boost: { intensity: 0.6, solid: false },
};

// --- PROXIMIDAD -------------------------------------------------------------

export const ProximityParams = z.object({
  /** u. Sin valor, `geometry.proximityRadius`. */
  radius: z.number().finite().positive().max(2000).optional(),
  /** u extra para salir: evita entradas y salidas repetidas en el borde. */
  hysteresis: z.number().finite().min(0).max(200).default(12),
  ...feedback,
});

// --- DIÁLOGO ----------------------------------------------------------------

/** Señales que una línea puede mandar a la interfaz (REQ-AVE-004). */
export const DIALOGUE_CUES = ['pulse_menu', 'pulse_minimap'] as const;
export const DialogueCue = z.enum(DIALOGUE_CUES);
export type DialogueCue = z.infer<typeof DialogueCue>;

const lineText = z.string().min(1).max(140);
export const DialogueLine = z
  .union([lineText, z.object({ text: lineText, cue: DialogueCue.optional() })])
  .transform((l) => (typeof l === 'string' ? { text: l } : l));
export type DialogueLine = z.output<typeof DialogueLine>;

/**
 * 1,5 s por bocadillo (D-07). Con el tiempo de lectura de D-22 (la opción
 * `readableDialogue` del motor, que encienden `/mar` y `/juego`) cada línea
 * dura al menos 3 s y hasta 8 s; por eso el intervalo admite hasta 8 s.
 */
export const DIALOGUE_INTERVAL = 1.5;

export const DialogueParams = z.object({
  lines: z.array(DialogueLine).max(30).default([]),
  /** s entre bocadillos. */
  interval: z.number().finite().min(0.5).max(8).default(DIALOGUE_INTERVAL),
  /** Reacción juguetona si el barco se aleja con el diálogo a medias (§7). */
  leaveReaction: lineText.default('world.dialogue.leaveReaction'),
  /** Si, terminado o saltado, no vuelve a sonar al volver a acercarse. */
  once: z.boolean().default(false),
  on: BehaviorTrigger.optional(),
});

// --- RECOGIBLE y RECOMPENSA -------------------------------------------------

export const CollectibleParams = z.object({
  /** u de recogida. Sin valor, activación o colisión del objeto. */
  radius: z.number().finite().positive().max(500).optional(),
  /** s hasta que reaparece en la misma sesión. Sin valor, no reaparece. */
  respawn: seconds(3600).optional(),
  ...feedback,
});

export const REWARD_KINDS = ['coins', 'points', 'discount', 'item', 'achievement'] as const;
export const REWARD_FREQUENCIES = ['once', 'session', 'season', 'repeatable'] as const;
export const RewardFrequency = z.enum(REWARD_FREQUENCIES);
export type RewardFrequency = z.infer<typeof RewardFrequency>;

export const RewardParams = z.object({
  kind: z.enum(REWARD_KINDS).default('coins'),
  amount: z.number().int().min(0).max(10000).default(1),
  /** Código de descuento, id de objeto o de logro, según `kind`. */
  ref: id.optional(),
  /** Una vez por cuenta, por sesión, por temporada o siempre. */
  frequency: RewardFrequency.default('once'),
  on: BehaviorTrigger.optional(),
  ...feedback,
});

// --- EVENTO/CONTENIDO y TICKET ----------------------------------------------

export const CONTENT_TARGETS = ['event', 'photos', 'store', 'artist', 'info'] as const;

export const ContentParams = z.object({
  target: z.enum(CONTENT_TARGETS).default('info'),
  /** Id del evento, álbum, artista… según `target`. */
  ref: id.optional(),
  /** Cierra el panel al salir del radio de proximidad. */
  closeOnExit: z.boolean().default(true),
  on: BehaviorTrigger.optional(),
  ...feedback,
});

export const TicketParams = z.object({
  eventId: id,
  on: BehaviorTrigger.optional(),
  ...feedback,
});

// --- CHECKPOINT/BOOST, TELETRANSPORTE, SPAWN --------------------------------

export const CheckpointParams = z.object({
  circuitId: id.optional(),
  order: z.number().int().min(0).max(100).default(0),
  /** Fracción de velocidad máxima que se suma (0 = sin boost). */
  boost: fraction.default(0.6),
  /** 2 s (D-07). */
  duration: seconds(10).default(2),
  on: BehaviorTrigger.optional(),
  ...feedback,
});

export const TeleportParams = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  /** Rumbo al llegar, en rad; sin valor, conserva el suyo. */
  heading: z.number().finite().optional(),
  on: BehaviorTrigger.optional(),
  ...feedback,
});

export const SpawnParams = z.object({
  /** Probabilidad de aparecer en cada tirada. */
  probability: fraction.default(1),
  /** Posiciones permitidas; vacío = la del objeto. */
  positions: z
    .array(z.object({ x: z.number().finite(), y: z.number().finite() }))
    .max(50)
    .default([]),
  /** s visible antes de desaparecer (cofres fugaces). Sin valor, se queda. */
  lifetime: seconds(600).optional(),
  /** s entre tiradas después de desaparecer. Sin valor, una sola tirada. */
  every: seconds(3600).optional(),
});

// --- LOGRO, DECORATIVO, INICIAR_MINIJUEGO -----------------------------------

export const AchievementParams = z.object({
  /** Clave del catálogo de triggers de logros (REQ-ADM-021), p. ej. `visit_island`. */
  trigger: id,
  amount: z.number().int().min(1).max(1000).default(1),
  on: BehaviorTrigger.optional(),
  ...feedback,
});

export const DecorativeParams = z.object({
  /** Animación del manifiesto del asset; si no existe, imagen fija. */
  animation: id.default('idle'),
  loop: z.boolean().default(true),
});

/** Punto de extensión vacío en L1 (D-08): ningún minijuego está registrado. */
export const StartMinigameParams = z.object({
  gameId: id.optional(),
  on: BehaviorTrigger.optional(),
  ...feedback,
});

// --- Catálogo ---------------------------------------------------------------

export const BEHAVIOR_CATALOG = {
  collision: {
    label: 'COLISIÓN',
    summary: 'Bloquear, rebotar, frenar, ralentizar o impulsar al chocar',
    params: CollisionParams,
  },
  proximity: {
    label: 'PROXIMIDAD',
    summary: 'Activa al entrar o salir de un radio',
    params: ProximityParams,
  },
  dialogue: {
    label: 'DIÁLOGO',
    summary: 'Bocadillos cada 1,5 s; tocar avanza o salta; reacciona si el barco se aleja',
    params: DialogueParams,
  },
  collectible: {
    label: 'RECOGIBLE',
    summary: 'Desaparece al pasar por encima y dispara sus recompensas',
    params: CollectibleParams,
  },
  reward: {
    label: 'RECOMPENSA',
    summary: 'Concede un premio una vez, por sesión, por temporada o siempre',
    params: RewardParams,
  },
  content: {
    label: 'EVENTO/CONTENIDO',
    summary: 'Abre el panel de un evento, fotos, tienda, artista o información',
    params: ContentParams,
  },
  ticket: {
    label: 'TICKET',
    summary: 'Lleva a la compra si el evento está a la venta',
    params: TicketParams,
  },
  checkpoint: {
    label: 'CHECKPOINT/BOOST',
    summary: 'Valida el paso por un circuito y aplica un boost',
    params: CheckpointParams,
  },
  teleport: {
    label: 'TELETRANSPORTE/DESTINO',
    summary: 'Lleva el barco a otro punto, nunca dentro de tierra',
    params: TeleportParams,
  },
  spawn: {
    label: 'SPAWN/RESPAWN',
    summary: 'Probabilidad, posiciones, duración y frecuencia de aparición',
    params: SpawnParams,
  },
  achievement: {
    label: 'LOGRO/TRIGGER',
    summary: 'Dispara o avanza una condición de logros',
    params: AchievementParams,
  },
  decorative: {
    label: 'DECORATIVO',
    summary: 'Sin interacción; puede tener animación en bucle',
    params: DecorativeParams,
  },
  start_minigame: {
    label: 'INICIAR_MINIJUEGO',
    summary: 'Punto de extensión: en L1 no hay minijuegos (D-08)',
    params: StartMinigameParams,
  },
} as const;

export type BehaviorType = keyof typeof BEHAVIOR_CATALOG;
export const BEHAVIOR_TYPES = Object.keys(BEHAVIOR_CATALOG) as BehaviorType[];

// `prefault` pasa `{}` por el esquema: `params` ausente rellena los valores por
// defecto. TICKET, TELETRANSPORTE y LOGRO tienen parámetros obligatorios.
export const Behavior = z.discriminatedUnion('type', [
  z.object({ type: z.literal('collision'), params: CollisionParams.prefault({}) }),
  z.object({ type: z.literal('proximity'), params: ProximityParams.prefault({}) }),
  z.object({ type: z.literal('dialogue'), params: DialogueParams.prefault({}) }),
  z.object({ type: z.literal('collectible'), params: CollectibleParams.prefault({}) }),
  z.object({ type: z.literal('reward'), params: RewardParams.prefault({}) }),
  z.object({ type: z.literal('content'), params: ContentParams.prefault({}) }),
  z.object({ type: z.literal('ticket'), params: TicketParams }),
  z.object({ type: z.literal('checkpoint'), params: CheckpointParams.prefault({}) }),
  z.object({ type: z.literal('teleport'), params: TeleportParams }),
  z.object({ type: z.literal('spawn'), params: SpawnParams.prefault({}) }),
  z.object({ type: z.literal('achievement'), params: AchievementParams }),
  z.object({ type: z.literal('decorative'), params: DecorativeParams.prefault({}) }),
  z.object({ type: z.literal('start_minigame'), params: StartMinigameParams.prefault({}) }),
]);
export type Behavior = z.output<typeof Behavior>;
export type BehaviorInput = z.input<typeof Behavior>;
export type BehaviorOf<T extends BehaviorType> = Extract<Behavior, { type: T }>;
export type BehaviorParams<T extends BehaviorType> = BehaviorOf<T>['params'];
