import { type AudioChannel, LANGUAGES, type Language, type Settings } from '@boia/engine/ui';
import type { MenuSection } from '../types';
import { t } from '../../../i18n';

function ChannelControl({
  id,
  label,
  onLabel,
  value,
  onChange,
}: {
  id: 'music' | 'sfx';
  label: string;
  onLabel: string;
  value: AudioChannel;
  onChange: (c: AudioChannel) => void;
}) {
  return (
    <fieldset className="juego-field" data-testid={`ajuste-${id}`}>
      <legend>{label}</legend>
      <label className="juego-choice">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
        />
        <span>{onLabel}</span>
      </label>
      <label className="juego-range">
        <span>{t('juego.ajustes.volumen')}</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={Math.round(value.volume * 100)}
          disabled={!value.enabled}
          aria-label={t('juego.ajustes.volumenDe', { label: label.toLowerCase() })}
          onChange={(e) => onChange({ ...value, volume: Number(e.target.value) / 100 })}
        />
      </label>
    </fieldset>
  );
}

/**
 * Idioma, música y efectos por separado (§20, REQ-IDE-037): lo que comparten
 * el Menú de a bordo del 2D y los Ajustes del mar 3D (T55).
 */
export function SoundAndLanguage({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
}) {
  return (
    <>
      <label className="juego-field" data-testid="ajuste-idioma">
        <span>{t('juego.ajustes.idioma')}</span>
        <select
          value={settings.language}
          onChange={(e) => onChange({ language: e.target.value as Language })}
        >
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id} disabled={!l.available}>
              {l.label}
              {l.available ? '' : ' (próximamente)'}
            </option>
          ))}
        </select>
      </label>
      <ChannelControl
        id="music"
        label={t('juego.ajustes.musica')}
        onLabel={t('settings.on')}
        value={settings.music}
        onChange={(music) => onChange({ music })}
      />
      <ChannelControl
        id="sfx"
        label={t('settings.effects')}
        onLabel={t('juego.ajustes.activados')}
        value={settings.sfx}
        onChange={(sfx) => onChange({ sfx })}
      />
      <p className="juego-muted">{t('juego.ajustes.losEfectosSiguenSonando')}</p>
    </>
  );
}

/** ⚙ Ajustes (§20, REQ-IDE-037): idioma, música y efectos por separado; se guardan. */
export const ajustesSection: MenuSection = {
  id: 'ajustes',
  icon: '⚙️',
  label: t('juego.ajustes.ajustes'),
  group: 'tools',
  Component: function Ajustes({ ctx }) {
    return (
      <SoundAndLanguage
        settings={ctx.settings}
        onChange={(patch) => ctx.updateSettings((s) => ({ ...s, ...patch }))}
      />
    );
  },
};
