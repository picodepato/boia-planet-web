/** Tipos de `admin-password-lib.mjs` (plan 029 T283), para sus pruebas. */
import type { PasswordHash } from '../lib/admin/demo-auth';

export const SALT_BYTES: number;
export const HASH_BYTES: number;
export const MIN_LENGTH: number;
export function makeHash(password: string, iterations: number, salt?: Uint8Array): PasswordHash;
export function typeKeys(
  text: string,
  chunk: string,
): { text: string; end: 'enter' | 'cancel' | null };
export function currentIterations(source: string): number;
export function readHash(source: string): PasswordHash;
export function verifyHash(password: string, stored: PasswordHash): boolean;
export function replaceHash(source: string, hash: PasswordHash): string;
