import { rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { encode } from 'uqr';
import { PRIVACY_POLICY_VERSION } from '../lib/account/config';
import { t } from '../lib/i18n';
import {
  E2E_SUPABASE,
  createMember,
  deleteMembers,
  serviceClient,
  signInPage,
  signInSession,
  type TestMember,
} from './supabase';
import { supabaseTestEnv } from './supabase-env';

/**
 * «Escanear sello» de verdad (plan 008, T91): Chromium con una cámara falsa
 * que enseña el QR impreso de una fiesta (un vídeo .y4m hecho aquí). El
 * Carnet abre la cámara, lee el QR (BarcodeDetector o el decodificador que se
 * carga entonces), reclama el sello y lo deja caer en el reverso con el aviso
 * de los puntos. Sólo con E2E_SUPABASE=1.
 */
test.skip(!E2E_SUPABASE, 'sólo con E2E_SUPABASE=1');
test.describe.configure({ timeout: 240_000 });

const run = `${process.pid}-${Math.random().toString(36).slice(2, 6)}`;
const VIDEO = path.join(tmpdir(), `boia-t91-qr-${run}.y4m`);

test.use({
  permissions: ['camera'],
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${VIDEO}`,
    ],
  },
});

/** Un vídeo Y4M (4:2:0) de unos fotogramas con el QR de `text` en el centro. */
function qrVideo(text: string, file: string) {
  const W = 640;
  const H = 480;
  const qr = encode(text, { ecc: 'M', border: 4 });
  const scale = Math.floor(Math.min(W, H) / qr.size / 1.2);
  const side = qr.size * scale;
  const ox = Math.floor((W - side) / 2);
  const oy = Math.floor((H - side) / 2);
  const y = Buffer.alloc(W * H, 235);
  for (let py = 0; py < side; py++)
    for (let px = 0; px < side; px++)
      if (qr.data[Math.floor(py / scale)]![Math.floor(px / scale)]) y[(oy + py) * W + ox + px] = 16;
  const uv = Buffer.alloc((W / 2) * (H / 2) * 2, 128);
  const frame = Buffer.concat([Buffer.from('FRAME\n'), y, uv]);
  const head = Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`);
  writeFileSync(file, Buffer.concat([head, ...Array.from({ length: 10 }, () => frame)]));
}

const created: TestMember[] = [];
let eventId = '';
const slug = `e2e-t91-cam-${run.replace(/[^a-z0-9]/g, '')}`;
const title = `Fiesta cámara ${run}`;

test.beforeAll(async () => {
  const now = Date.now();
  const service = serviceClient();
  const { data, error } = await service
    .from('events')
    .insert({
      slug,
      title,
      state: 'on_sale',
      published_at: new Date().toISOString(),
      starts_at: new Date(now - 3600_000).toISOString(),
      ends_at: new Date(now + 3 * 3600_000).toISOString(),
      is_sample: true,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`evento: ${error?.message}`);
  eventId = data.id;
  const code = `CAM${run.replace(/[^a-z0-9]/gi, '').toUpperCase()}`.slice(0, 20);
  await service.from('event_stamp_codes').insert({
    event_id: eventId,
    code,
    valid_from: new Date(now - 3600_000).toISOString(),
    valid_until: new Date(now + 3 * 3600_000).toISOString(),
  });
  qrVideo(`https://boia-planet-roan.vercel.app/sello?e=${slug}&c=${code}`, VIDEO);
});

test.afterAll(async () => {
  await deleteMembers(created);
  if (eventId) await serviceClient().from('events').delete().eq('id', eventId);
  rmSync(VIDEO, { force: true });
});

test('el Carnet escanea el QR de la fiesta con la cámara y el sello cae en el reverso', async ({
  page,
}, info) => {
  const m = await createMember(`cam ${info.project.name}`);
  created.push(m);
  const env = supabaseTestEnv()!;
  const session = await signInSession(m);
  const client = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });
  const { error } = await client.rpc('save_profile', {
    p_nickname: `Cámara ${m.id.slice(0, 8)}`,
    p_privacy_version: PRIVACY_POLICY_VERSION,
  });
  if (error) throw new Error(`save_profile: ${error.message}`);
  await signInPage(page, m);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/carnet');
  await page.getByTestId('carnet-escanear').click();
  const layer = page.getByTestId('escaner');
  await expect(layer).toBeVisible();
  await expect(layer).toHaveAttribute('role', 'dialog');

  const { data: action } = await serviceClient()
    .from('point_actions')
    .select('max_points')
    .eq('action', 'stamp')
    .single();
  const notice = page.getByTestId('carnet-sello-aviso');
  const points = Number(action!.max_points);
  await expect(notice).toHaveText(t('stamp.received', { event: title, points }), {
    timeout: 60_000,
  });
  await expect(layer).toHaveCount(0);
  const card = page.getByTestId('carnet-tarjeta');
  await expect(card).toHaveAttribute('data-cara', 'back');
  await expect(card.getByTestId(`carnet-sello-${slug}`)).toBeVisible();
  await expect(card.getByTestId('carnet-puntos-cambio')).toBeVisible();
  const { data: stamps } = await serviceClient()
    .from('stamps')
    .select('event_id')
    .eq('user_id', m.id);
  expect(stamps).toEqual([{ event_id: eventId }]);
  expect(errors).toEqual([]);
});
