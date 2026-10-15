"""Envía el correo de prueba que mantiene viva la clave SMTP de Brevo (plan 033 T306).

Lo llama .github/workflows/smtp-ping.yml los días 1 y 15 de cada mes. Gmail
«Enviar como» usa esa clave para `hola@boiaplanet.net`, y Brevo la caduca tras
90 días sin enviar: este correo, de `hola@` a `hola@`, la usa dos veces al mes.
Cualquier fallo (secretos que faltan, login, TLS, envío) sale con código
distinto de 0, el flujo queda en rojo y GitHub avisa por correo.

Nunca escribe los secretos: ni el login ni la clave salen en el registro.

Entorno:
  BREVO_SMTP_LOGIN  el login SMTP que enseña Brevo (SMTP & API → SMTP).
  BREVO_SMTP_KEY    la clave SMTP (la misma que tiene Gmail «Enviar como»).
"""

import datetime
import os
import smtplib
import ssl
import sys
from email.message import EmailMessage

HOST = 'smtp-relay.brevo.com'
PORT = 587
ADDRESS = 'hola@boiaplanet.net'
SECRETS = ('BREVO_SMTP_LOGIN', 'BREVO_SMTP_KEY')


def build_message(today: datetime.date) -> EmailMessage:
    """El correo de prueba, sin enviar: texto plano, corto, con la fecha."""
    msg = EmailMessage()
    msg['From'] = f'BOIA <{ADDRESS}>'
    msg['To'] = ADDRESS
    msg['Subject'] = f'Prueba automática del correo de hola@ ({today.isoformat()})'
    msg.set_content(
        f'Prueba automática del {today.isoformat()}.\n'
        '\n'
        'Este correo lo manda el flujo smtp-ping.yml de GitHub los días 1 y 15\n'
        'de cada mes, con la clave SMTP de Brevo que usa Gmail «Enviar como»\n'
        'para hola@boiaplanet.net. Así la clave no caduca por falta de uso.\n'
        '\n'
        'Se puede ignorar.\n'
    )
    return msg


def missing_secrets(env: dict) -> list:
    return [name for name in SECRETS if not (env.get(name) or '').strip()]


def send(msg: EmailMessage, login: str, key: str) -> None:
    context = ssl.create_default_context()
    with smtplib.SMTP(HOST, PORT, timeout=60) as smtp:
        smtp.ehlo()
        smtp.starttls(context=context)
        smtp.ehlo()
        smtp.login(login, key)
        refused = smtp.send_message(msg)
        if refused:
            raise smtplib.SMTPRecipientsRefused(refused)


def main(env: dict) -> int:
    missing = missing_secrets(env)
    for name in missing:
        print(f'::error::Falta el secreto {name}')
    if missing:
        return 1
    today = datetime.datetime.now(datetime.timezone.utc).date()
    msg = build_message(today)
    try:
        send(msg, env['BREVO_SMTP_LOGIN'].strip(), env['BREVO_SMTP_KEY'].strip())
    except (smtplib.SMTPException, OSError) as e:
        # Sólo el tipo y la respuesta del servidor: nunca el login ni la clave.
        print(f'::error::No se pudo enviar por {HOST}:{PORT}: {type(e).__name__}: {e}')
        return 1
    print(f'Enviado: {msg["Subject"]}')
    return 0


if __name__ == '__main__':
    sys.exit(main(dict(os.environ)))
