import { describe, expect, it } from 'vitest';
import { changeTargetLabel } from './trash-labels';

const carnetChange = (targetId: string) =>
  ({
    area: 'carnets',
    targetId,
    kind: 'edit',
    before: null,
    after: null,
  }) as const;

describe('papelera: un Carnet se nombra por su apodo', () => {
  const names = new Map([['user-zeta', 'Zeta']]);

  it('la moderación de un Carnet muestra el apodo, no el id', () => {
    expect(changeTargetLabel(carnetChange('user-zeta'), names)).toBe('Zeta');
  });

  it('la moderación de una respuesta o de la música también usa el apodo', () => {
    expect(changeTargetLabel(carnetChange('user-zeta/music'), names).startsWith('Zeta · ')).toBe(
      true,
    );
    expect(changeTargetLabel(carnetChange('user-zeta/q1'), names)).not.toContain('user-zeta');
  });

  it('sólo cae al id si el Carnet no tiene apodo o no se conoce', () => {
    expect(changeTargetLabel(carnetChange('user-sin'), names)).toBe('user-sin');
    expect(
      changeTargetLabel(carnetChange('user-vacio'), new Map([['user-vacio', '']])),
    ).toBe('user-vacio');
  });
});
