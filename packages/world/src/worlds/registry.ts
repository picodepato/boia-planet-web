import {
  type ComposedWorld,
  type RenameScope,
  SkinError,
  type SkinIssue,
  composeWorld,
  movePlace,
  renamePlace,
  skinIssues,
} from './compose';
import { type SharedMap, type SharedMapInput, parseSharedMap } from './map';
import { type WorldSkin, type WorldSkinInput, WorldSkin as WorldSkinSchema } from './skin';

/**
 * Los mundos registrados sobre un único mapa compartido. Registrar valida
 * cada skin contra el mapa (lugares desconocidos, nombres de islas de evento)
 * y compone su `WorldConfig` una vez.
 */
export interface WorldSummary {
  id: string;
  name: string;
  tagline?: string;
  shipStyle: string;
  accent: string;
}

export class WorldRegistry {
  readonly map: SharedMap;
  readonly defaultId: string;
  /** Mundos que existen (datos, piel, pruebas) pero que nadie puede alcanzar todavía. */
  readonly hiddenIds: ReadonlySet<string>;
  private readonly skins = new Map<string, WorldSkin>();
  private readonly composed = new Map<string, ComposedWorld>();

  constructor(
    map: SharedMap | SharedMapInput,
    skins: (WorldSkin | WorldSkinInput)[],
    defaultId?: string,
    hidden: readonly string[] = [],
  ) {
    this.map = parseSharedMap(map);
    const issues: SkinIssue[] = [];
    for (const input of skins) {
      const skin = WorldSkinSchema.parse(input);
      if (this.skins.has(skin.id)) throw new Error(`mundo repetido: ${skin.id}`);
      issues.push(...skinIssues(this.map, skin));
      this.skins.set(skin.id, skin);
    }
    if (issues.length > 0) throw new SkinError(issues);
    const first = this.skins.keys().next().value;
    if (first === undefined) throw new Error('un registro de mundos necesita al menos un mundo');
    const d = defaultId ?? first;
    if (!this.skins.has(d)) throw new Error(`mundo por defecto desconocido: ${d}`);
    this.defaultId = d;
    for (const h of hidden) {
      if (!this.skins.has(h)) throw new Error(`mundo oculto desconocido: ${h}`);
    }
    if (hidden.includes(d)) throw new Error(`el mundo por defecto no puede estar oculto: ${d}`);
    this.hiddenIds = new Set(hidden);
  }

  /** Los mundos jugables: los registrados menos los ocultos. */
  playableIds(): string[] {
    return this.ids().filter((id) => !this.hiddenIds.has(id));
  }

  /** ¿Se puede jugar? (existe y no está oculto) */
  isPlayable(id: string): boolean {
    return this.skins.has(id) && !this.hiddenIds.has(id);
  }

  ids(): string[] {
    return [...this.skins.keys()];
  }

  has(id: string): boolean {
    return this.skins.has(id);
  }

  skin(id: string): WorldSkin {
    const s = this.skins.get(id);
    if (!s) throw new Error(`mundo desconocido: ${id}`);
    return s;
  }

  /** El mundo compuesto (se compone una vez y se reutiliza). */
  get(id: string): ComposedWorld {
    let w = this.composed.get(id);
    if (!w) {
      w = composeWorld(this.map, this.skin(id));
      this.composed.set(id, w);
    }
    return w;
  }

  /** El primer id válido de la lista (elección del visitante, del Admin…) o el por defecto. */
  resolve(...requested: (string | null | undefined)[]): ComposedWorld {
    const id = requested.find((r): r is string => !!r && this.isPlayable(r));
    return this.get(id ?? this.defaultId);
  }

  /**
   * Un registro nuevo con el lugar renombrado: en un mundo (`{ world }`) o en
   * todos (`'all'`: nombre común y fuera los nombres propios). Ver `renamePlace`.
   */
  renamePlace(placeId: string, name: string, scope: RenameScope): WorldRegistry {
    const next = renamePlace(this.map, [...this.skins.values()], placeId, name, scope);
    return new WorldRegistry(next.map, next.skins, this.defaultId, [...this.hiddenIds]);
  }

  /** Un registro nuevo con el mapa pasado por `fn` (p. ej. `translateMapTexts`). */
  mapTexts(fn: (map: SharedMap) => SharedMap): WorldRegistry {
    return new WorldRegistry(fn(this.map), [...this.skins.values()], this.defaultId, [
      ...this.hiddenIds,
    ]);
  }

  /** Un registro nuevo con cada skin pasada por `fn` (p. ej. `resolveSkinTexts`). */
  mapSkins(fn: (skin: WorldSkin) => WorldSkin): WorldRegistry {
    return new WorldRegistry(
      this.map,
      [...this.skins.values()].map(fn),
      this.defaultId,
      [...this.hiddenIds],
    );
  }

  /** Un registro nuevo con el lugar en otro sitio: en el mapa compartido, así en todos los mundos. */
  movePlace(placeId: string, x: number, y: number): WorldRegistry {
    return new WorldRegistry(
      movePlace(this.map, placeId, x, y),
      [...this.skins.values()],
      this.defaultId,
      [...this.hiddenIds],
    );
  }

  /** Para el selector de mundos del menú y del Admin: sólo los jugables, en orden de registro. */
  list(): WorldSummary[] {
    return [...this.skins.values()].filter((s) => !this.hiddenIds.has(s.id)).map((s) => ({
      id: s.id,
      name: s.name,
      ...(s.tagline ? { tagline: s.tagline } : {}),
      shipStyle: s.ship.style,
      accent: s.ui.accent,
    }));
  }
}
