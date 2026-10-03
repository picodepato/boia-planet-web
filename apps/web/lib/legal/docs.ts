import type { MessageKey } from '../i18n';

/**
 * Las páginas legales (`/legal/<id>`) y sus párrafos, con los textos de
 * docs/propuestas/textos-zonas.md (zona 32). Los datos del titular son
 * **inventados** (D-23, O14): cada página lo dice arriba
 * (`legal.sampleBanner`) y antes de publicar de verdad se sustituyen por los
 * de BOIA con revisión profesional (P21, REQ-PRO-020). «Condiciones» pasó a
 * ser el aviso legal: `/legal/condiciones` redirige (lib/security-headers.ts).
 */
export const LEGAL_DOCS = {
  'aviso-legal': {
    title: 'legal.aviso.title',
    body: [
      'legal.aviso.owner',
      'legal.aviso.contact',
      'legal.aviso.purpose',
      'legal.aviso.use',
      'legal.aviso.moderation',
      'legal.aviso.purchases',
      'legal.aviso.ip',
      'legal.aviso.links',
      'legal.aviso.liability',
      'legal.aviso.law',
    ],
  },
  privacidad: {
    title: 'legal.privacy.title',
    body: [
      'legal.privacy.intro',
      'legal.privacy.controller',
      'legal.privacy.what',
      'legal.privacy.notAsked',
      'legal.privacy.where',
      'legal.privacy.why',
      'legal.privacy.basis',
      'legal.privacy.sharing',
      'legal.privacy.analytics',
      'legal.privacy.retention',
      'legal.privacy.rights',
      'legal.privacy.future',
    ],
  },
  cookies: {
    title: 'legal.cookies.title',
    body: [
      'legal.cookies.body',
      'legal.cookies.storage',
      'legal.cookies.thirdParty',
      'legal.cookies.manage',
      'legal.cookies.prefs',
    ],
  },
} satisfies Record<string, { title: MessageKey; body: MessageKey[] }>;

/**
 * La política de privacidad con cuentas por email (plan 008, T89, decisión
 * 3): qué se recoge y para qué. La página la usa cuando hay Supabase; sin
 * él (la versión de prueba, D-20) sigue la de arriba. Su versión es
 * `PRIVACY_POLICY_VERSION` (lib/account/config.ts). `muestra` hasta P21.
 */
export const PRIVACY_WITH_ACCOUNTS = {
  title: 'legal.privacy.title',
  body: [
    'legal.privacy.account.intro',
    'legal.privacy.controller',
    'legal.privacy.account.what',
    'legal.privacy.account.public',
    'legal.privacy.account.notAsked',
    'legal.privacy.account.where',
    'legal.privacy.account.why',
    'legal.privacy.account.basis',
    'legal.privacy.account.sharing',
    'legal.privacy.analytics',
    'legal.privacy.account.retention',
    'legal.privacy.account.rights',
  ],
  updated: 'legal.privacy.account.updated',
} satisfies { title: MessageKey; body: MessageKey[]; updated: MessageKey };
