import type { StoreDoc } from './schema';

/** T167: keep historical ledger debits, but ignore retired flag ownership. */
export function isRemovedFlag(id: string | null | undefined, doc?: StoreDoc): boolean {
  if (!id) return false;
  if (['bandera-boia', 'bandera-fiestera', 'bandera-cuadros', 'bandera-fantasma'].includes(id))
    return true;
  const value = doc?.content.items.cosmetics?.[id]?.value;
  return !!value && typeof value === 'object' && 'slot' in value && value.slot === 'flag';
}

/** Applied on local load and every Supabase hydration, without touching other slots. */
export function withoutFlag(equipped: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(equipped).filter(([slot]) => slot !== 'flag'));
}
