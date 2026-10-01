import {
  type ControlSensitivity,
  KEYBOARD_MODES,
  type KeyboardMode,
  type MinimapZone,
  SENSITIVITY_RANGE,
} from '@boia/engine/ui';
import type { MenuSection } from '../types';
import { t } from '../../../i18n';

const MODE_LABEL: Record<KeyboardMode, { title: string; help: string }> = {
  screen: {
    title: t('controls.keyboard.screen'),
    help: t('juego.controles.flechaArribaLlevaEl'),
  },
  tank: {
    title: t('controls.keyboard.tank'),
    help: t('juego.controles.arribaAceleraIzquierdaY'),
  },
};

const SENSITIVITY_LABEL: Record<keyof ControlSensitivity, string> = {
  keyboard: t('juego.controles.teclado'),
  touch: t('juego.controles.tactil'),
};

const ZONE_LABEL: Record<MinimapZone, string> = {
  'top-right': t('juego.controles.arribaALaDerecha'),
  'top-left': t('juego.controles.arribaALaIzquierda'),
  'middle-right': t('juego.controles.enMedioALa'),
  'middle-left': t('juego.controles.enMedioALa2'),
};

/** 🎮 Controles (REQ-IDE-036) y modo del teclado (D-14, REQ-MUN-008). */
export const controlesSection: MenuSection = {
  id: 'controles',
  icon: '🎮',
  label: t('controls.heading'),
  group: 'tools',
  Component: function Controles({ ctx }) {
    return (
      <>
        <h3>{t('juego.controles.navegar')}</h3>
        <ul>
          <li>{t('world.arcilla.boia.tutorial.2')}</li>
          <li>
            <strong>{t('juego.controles.drift')}</strong> {t('juego.controles.conUnSegundoDedo')}
          </li>
          <li>{t('controls.sail.keyboard')}</li>
        </ul>

        <fieldset className="juego-field" data-testid="modo-teclado">
          <legend>{t('juego.controles.teclado')}</legend>
          {KEYBOARD_MODES.map((m) => (
            <label key={m} className="juego-choice">
              <input
                type="radio"
                name="modo-teclado"
                value={m}
                checked={ctx.settings.keyboardMode === m}
                onChange={() => ctx.updateSettings((s) => ({ ...s, keyboardMode: m }))}
              />
              <span>
                <strong>{MODE_LABEL[m].title}</strong>
                <br />
                <small>{MODE_LABEL[m].help}</small>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="juego-field" data-testid="sensibilidad">
          <legend>{t('juego.controles.sensibilidadDelGiro')}</legend>
          {(Object.keys(SENSITIVITY_LABEL) as (keyof ControlSensitivity)[]).map((k) => (
            <label key={k} className="juego-range">
              <span>
                {SENSITIVITY_LABEL[k]} · {Math.round(ctx.settings.sensitivity[k] * 100)} %
              </span>
              <input
                type="range"
                min={Math.round(SENSITIVITY_RANGE.min * 100)}
                max={Math.round(SENSITIVITY_RANGE.max * 100)}
                step={Math.round(SENSITIVITY_RANGE.step * 100)}
                value={Math.round(ctx.settings.sensitivity[k] * 100)}
                aria-label={t('juego.controles.sensibilidadDelGiro2', {
                  v1: SENSITIVITY_LABEL[k].toLowerCase(),
                })}
                onChange={(e) =>
                  ctx.updateSettings((s) => ({
                    ...s,
                    sensitivity: { ...s.sensitivity, [k]: Number(e.target.value) / 100 },
                  }))
                }
              />
            </label>
          ))}
          <small>{t('juego.controles.masElBarcoGira')}</small>
        </fieldset>

        <h3>{t('controls.minimap.heading')}</h3>
        <ul>
          <li>{t('juego.controles.tocaElMinimapaPara')}</li>
          <li>{t('controls.minimap.hold')}</li>
          <li>{t('juego.controles.laBrujulaSenalaLo')}</li>
        </ul>
        <label className="juego-field">
          <span>{t('juego.controles.sitioDelMinimapa')}</span>
          <select
            value={ctx.minimapZone}
            onChange={(e) => ctx.setMinimapZone(e.target.value as MinimapZone)}
          >
            {ctx.minimapZones.map((z) => (
              <option key={z} value={z}>
                {ZONE_LABEL[z]}
              </option>
            ))}
          </select>
        </label>
      </>
    );
  },
};
