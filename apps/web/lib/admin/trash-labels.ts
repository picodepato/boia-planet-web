import type { ChangeItem } from '@boia/store';
import { t } from '../i18n';
import { itemName } from './references';

/**
 * Cómo se nombra un cambio en la papelera del Admin. Un Carnet se nombra por
 * su apodo (sólo si no tiene, por su id de usuario); el resto, por su nombre.
 */
export type ChangeLabelInput = Pick<ChangeItem, 'area' | 'targetId' | 'kind' | 'before' | 'after'>;

/** Qué tocó un cambio, para la lista: el nombre del elemento, la clave o el área entera. */
export function changeTargetLabel(
  c: ChangeLabelInput,
  carnetNames: ReadonlyMap<string, string> = new Map(),
): string {
  if (c.kind === 'order') return t('admin.gestion.trash.order');
  if (c.kind === 'reset' || c.kind === 'discard' || c.targetId === null)
    return c.area === 'settings' ? '' : t('admin.gestion.trash.wholeArea');
  if (c.area === 'carnets') {
    // Moderación fina de un Carnet (plan 020 T229): «<persona> · respuesta <id>» o «· enlace a la música».
    const slash = c.targetId.indexOf('/');
    const userId = slash < 0 ? c.targetId : c.targetId.slice(0, slash);
    const who = carnetNames.get(userId) || userId;
    if (slash < 0) return who;
    const what = c.targetId.slice(slash + 1);
    return `${who} · ${
      what === 'music'
        ? t('admin.moderation.music.trashTarget')
        : `${t('admin.moderation.answers.trashTarget')} ${what}`
    }`;
  }
  const named = itemName(c.area, c.before ?? c.after);
  return named && named !== c.targetId ? named : c.targetId;
}
