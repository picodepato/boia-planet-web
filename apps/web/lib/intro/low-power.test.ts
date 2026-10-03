import { describe, expect, it } from 'vitest';
import { LOW_CORES, LOW_MEMORY_GB, isLowPower } from './low-power';

const chrome = { vendor: 'Google Inc.', deviceMemory: 8, hardwareConcurrency: 8 };

describe('isLowPower (plan 007 T80)', () => {
  it('a capable device keeps the scene', () => {
    expect(isLowPower(chrome)).toBe(false);
    expect(isLowPower({})).toBe(false);
  });

  it('saveData, little memory or few cores give the static version', () => {
    expect(isLowPower({ ...chrome, connection: { saveData: true } })).toBe(true);
    expect(isLowPower({ ...chrome, deviceMemory: LOW_MEMORY_GB })).toBe(true);
    expect(isLowPower({ ...chrome, deviceMemory: LOW_MEMORY_GB / 2 })).toBe(true);
    expect(isLowPower({ ...chrome, hardwareConcurrency: LOW_CORES })).toBe(true);
    expect(isLowPower({ ...chrome, hardwareConcurrency: 2 })).toBe(true);
  });

  it('just above the limits keeps the scene', () => {
    expect(isLowPower({ ...chrome, deviceMemory: LOW_MEMORY_GB * 2 })).toBe(false);
    expect(isLowPower({ ...chrome, hardwareConcurrency: LOW_CORES + 1 })).toBe(false);
    expect(isLowPower({ ...chrome, connection: { saveData: false } })).toBe(false);
  });

  it("Apple's WebKit reports a fixed core count: it is not a signal there", () => {
    const safari = { vendor: 'Apple Computer, Inc.', hardwareConcurrency: 4 };
    expect(isLowPower(safari)).toBe(false);
    expect(isLowPower({ ...safari, connection: { saveData: true } })).toBe(true);
  });
});
