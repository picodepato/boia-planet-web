import type { WorldSummary } from '@boia/world';
import type { ShipCatalog } from '../../../barco/catalog';
import type { MenuSection } from '../types';
import { t } from '../../../i18n';

/**
 * 🌍 Mundos (T24, D-20): los mundos del mapa compartido, cada uno con su
 * línea de historia y su barco. Elegir uno cambia el mundo al momento, sin
 * recargar: el barco sigue donde está, y lo descubierto, los premios y los
 * descuentos se quedan (van por id de lugar). Si no has elegido barco en
 * «Barco», llevas el del mundo. Se recuerda en este navegador. Al elegir, el
 * menú se cierra y el cambio se ve: el mundo cae a un agujero negro centrado
 * en el barco y el nuevo se despliega desde él (T41).
 */

export function MundosPicker({
  worlds,
  current,
  pending = false,
  catalog,
  onChoose,
}: {
  worlds: readonly WorldSummary[];
  current: string;
  pending?: boolean;
  catalog: ShipCatalog | null;
  onChoose: (id: string) => void;
}) {
  return (
    <div className="mundos" data-testid="mundos" aria-busy={pending}>
      <p>{t('worlds.intro')}</p>
      <ul className="mundos-lista" role="radiogroup" aria-label={t('juego.mundos.mundos')}>
        {worlds.map((w) => {
          const checked = w.id === current;
          const ship = catalog?.styles.find((s) => s.id === w.shipStyle);
          const preview = ship?.skins[0]?.preview;
          return (
            <li key={w.id}>
              <button
                type="button"
                role="radio"
                aria-checked={checked}
                className={`mundo${checked ? ' is-active' : ''}`}
                data-testid={`mundo-${w.id}`}
                // Sin bloquear mientras carga: el último que se elige gana.
                onClick={() => (checked ? undefined : onChoose(w.id))}
              >
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element -- arte servido desde art/ (D-16)
                  <img src={preview} alt="" width={64} height={64} loading="lazy" />
                ) : (
                  <span className="mundo-sin-barco" aria-hidden="true">
                    ⛵
                  </span>
                )}
                <span className="mundo-texto">
                  <span className="mundo-nombre">
                    {w.name}
                    {checked ? (
                      <span className="mundo-actual"> {t('juego.mundos.navegando')}</span>
                    ) : null}
                  </span>
                  {w.tagline ? <span className="mundo-historia">{w.tagline}</span> : null}
                  <span className="mundo-barco" data-testid={`mundo-${w.id}-barco`}>
                    {t('worlds.ship', { ship: ship?.name ?? w.shipStyle })}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="juego-muted">{t('juego.mundos.siEligesUnBarco')}</p>
    </div>
  );
}

export const mundosSection: MenuSection = {
  id: 'mundos',
  icon: '🌍',
  label: t('juego.mundos.mundos'),
  group: 'progress',
  Component: function Mundos({ ctx }) {
    return (
      <MundosPicker
        worlds={ctx.world.worlds}
        current={ctx.world.current}
        pending={ctx.world.pending}
        catalog={ctx.ship.catalog}
        onChoose={(id) => {
          // El menú se cierra para ver el mundo caer al agujero negro (T41).
          ctx.world.choose(id);
          ctx.close();
        }}
      />
    );
  },
};
