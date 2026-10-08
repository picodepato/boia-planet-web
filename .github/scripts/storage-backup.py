"""Baja los archivos de Storage de Supabase a la copia diaria (plan 020 T230).

Lo llama .github/workflows/supabase-backup.yml con la carpeta de la copia,
que ya tiene storage.json (la lista de storage.objects que sale de la base).
Cada archivo se baja de su URL pública a <carpeta>/storage/<cubo>/<ruta>.
Los cubos de la web (stamp-images, event-photos, event-clips) son públicos;
uno privado no tiene URL pública y para la copia con un error.

Entorno:
  SUPABASE_DB_URL  la cadena de la base; de su usuario (postgres.<ref>) o de
                   su servidor (db.<ref>.supabase.co) sale la URL del proyecto.
  SUPABASE_URL     (opcional) https://<ref>.supabase.co, si no sale de arriba.
"""

import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request


def project_url(env: dict) -> str:
    base = (env.get('SUPABASE_URL') or '').strip().rstrip('/')
    if base:
        return base
    parts = urllib.parse.urlsplit(env.get('SUPABASE_DB_URL', ''))
    user = parts.username or ''
    ref = user.split('.', 1)[1] if user.startswith('postgres.') else ''
    if not ref:
        m = re.match(r'^db\.([a-z0-9]+)\.supabase\.co$', parts.hostname or '')
        ref = m.group(1) if m else ''
    if not ref:
        sys.exit('::error::No sale la URL del proyecto de SUPABASE_DB_URL: pon la variable SUPABASE_URL')
    return f'https://{ref}.supabase.co'


def object_url(base: str, bucket: str, name: str) -> str:
    return (
        f'{base}/storage/v1/object/public/'
        f'{urllib.parse.quote(bucket, safe="")}/{urllib.parse.quote(name, safe="/")}'
    )


def main(root: str) -> None:
    base = project_url(os.environ)
    with open(os.path.join(root, 'storage.json'), encoding='utf-8') as f:
        objects = json.load(f)
    private = sorted({o['bucket'] for o in objects if not o['public']})
    if private:
        sys.exit(f'::error::Cubos privados sin copia: {", ".join(private)} (lo explica la guía de copias)')
    total = 0
    for o in objects:
        rel = [p for p in o['name'].split('/') if p not in ('', '.', '..')]
        dest = os.path.join(root, 'storage', o['bucket'], *rel)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        url = object_url(base, o['bucket'], o['name'])
        for attempt in range(4):
            try:
                with urllib.request.urlopen(url, timeout=120) as r, open(dest, 'wb') as out:
                    out.write(r.read())
                break
            except Exception as e:  # noqa: BLE001 (se reintenta y, al final, para la copia)
                if attempt == 3:
                    sys.exit(f"::error::No se pudo bajar {o['bucket']}/{o['name']}: {e}")
                time.sleep(5 * (attempt + 1))
        total += os.path.getsize(dest)
    print(f'Storage: {len(objects)} archivos, {total} bytes')


if __name__ == '__main__':
    main(sys.argv[1])
