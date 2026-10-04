#!/usr/bin/env python3
"""Telegram helper for the orchestrator skill (stdlib only).

Subcommands:
  check                               verify config and bot access (never prints the token)
  send   (--text T | --file F) [--attach PATH]...
                                      plain notice, no reply expected
  ask    --id QID (--text T | --file F) [--attach PATH]...
                                      question; registers QID as pending. Attachments (images
                                      as photos, other files as documents) follow the message
                                      as replies to it; replying to them also answers QID.
  wait   --id QID [--timeout SECONDS] block until Hernán answers QID; run it in the background
  remind --id QID (--text T | --file F)
                                      reminder sent as a reply to the question message
  cancel --id QID                     drop a pending question (answered on screen)
  pending                             list pending questions

Hernán answers with Telegram's Reply on the question (or reminder) message. Waiting processes take
turns reading the bot, one at a time, through a lock directory, and route every reply to the inbox
of the question it answers. A loose message goes to the only pending question; with several pending,
the bot asks him to use Reply. Only messages from the configured chat are accepted.

Exit codes of `wait`: 0 reply received, 3 timeout, 4 question cancelled elsewhere.
Config: $TELEGRAM_CONFIG (default below), keys telegram.bot_token and telegram.chat_id.
State:  $ORCH_STATE_DIR (default ~/.claude/orchestrator/telegram).
"""
import argparse
import json
import mimetypes
import os
import re
import shutil
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

DEFAULT_CONFIG = "/Users/heralc/Desktop/HDDev/H-VOICE-CREEATOR/config.json"
POLL_SECONDS = 25


class ApiError(Exception):
    def __init__(self, code, description):
        super().__init__(f"Telegram API error {code}: {description}")
        self.code = code


class Api:
    """Thin Bot API client. Never include the token in messages or exceptions."""

    def __init__(self):
        path = os.environ.get("TELEGRAM_CONFIG", DEFAULT_CONFIG)
        with open(path, encoding="utf-8") as f:
            tg = json.load(f)["telegram"]
        self._token = str(tg["bot_token"])
        self.chat_id = str(tg["chat_id"])

    def call(self, method, params, timeout=40):
        data = urllib.parse.urlencode(
            {k: json.dumps(v) if isinstance(v, (list, dict)) else v for k, v in params.items()}
        ).encode()
        return self._post(method, data, {}, timeout)

    def _post(self, method, data, headers, timeout):
        url = f"https://api.telegram.org/bot{self._token}/{method}"
        try:
            req = urllib.request.Request(url, data=data, headers=headers)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                body = json.load(r)
        except urllib.error.HTTPError as e:
            try:
                body = json.load(e)
            except Exception:
                raise ApiError(e.code, "HTTP error") from None
        except urllib.error.URLError as e:
            raise ApiError("network", str(e.reason)) from None
        if not body.get("ok"):
            raise ApiError(body.get("error_code"), body.get("description"))
        return body["result"]

    def send(self, text, reply_to=None):
        params = {"chat_id": self.chat_id, "text": text, "disable_web_page_preview": "true"}
        if reply_to:
            params["reply_to_message_id"] = reply_to
            params["allow_sending_without_reply"] = "true"
        return self.call("sendMessage", params)["message_id"]

    def attach(self, path, reply_to=None):
        """Send a file: images as photos (up to 10 MB), anything else as a document."""
        is_photo = (os.path.splitext(path)[1].lower() in PHOTO_EXTENSIONS
                    and os.path.getsize(path) <= 10 * 1024 * 1024)
        method, field = ("sendPhoto", "photo") if is_photo else ("sendDocument", "document")
        fields = {"chat_id": self.chat_id}
        if reply_to:
            fields.update(reply_to_message_id=reply_to, allow_sending_without_reply="true")
        data, content_type = multipart(fields, field, path)
        return self._post(method, data, {"Content-Type": content_type}, 120)["message_id"]


PHOTO_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}


def multipart(fields, file_field, path):
    boundary = uuid.uuid4().hex
    name = re.sub(r'[^A-Za-z0-9._-]', "_", os.path.basename(path)) or "file"
    ctype = mimetypes.guess_type(path)[0] or "application/octet-stream"
    parts = [f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
             for k, v in fields.items()]
    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{file_field}"; '
                 f'filename="{name}"\r\nContent-Type: {ctype}\r\n\r\n'.encode())
    with open(path, "rb") as f:
        parts.append(f.read())
    parts.append(f"\r\n--{boundary}--\r\n".encode())
    return b"".join(parts), f"multipart/form-data; boundary={boundary}"


class State:
    def __init__(self, root=None):
        self.root = os.path.expanduser(
            root or os.environ.get("ORCH_STATE_DIR", "~/.claude/orchestrator/telegram")
        )
        for sub in ("pending", "inbox"):
            os.makedirs(os.path.join(self.root, sub), exist_ok=True)
        self.lock_dir = os.path.join(self.root, "lock")

    # -- files ---------------------------------------------------------------
    def _write(self, path, text):
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            f.write(text)
        os.replace(tmp, path)

    def pending_path(self, qid):
        return os.path.join(self.root, "pending", qid + ".json")

    def inbox_path(self, qid):
        return os.path.join(self.root, "inbox", qid + ".txt")

    def add_pending(self, qid, message_id):
        self._write(self.pending_path(qid), json.dumps(
            {"qid": qid, "message_ids": [message_id], "asked_at": time.time()}))

    def add_alias(self, qid, message_id):
        info = self.get_pending(qid)
        if info:
            info["message_ids"].append(message_id)
            self._write(self.pending_path(qid), json.dumps(info))

    def get_pending(self, qid):
        try:
            with open(self.pending_path(qid), encoding="utf-8") as f:
                return json.load(f)
        except (OSError, ValueError):
            return None

    def all_pending(self):
        out = {}
        for name in sorted(os.listdir(os.path.join(self.root, "pending"))):
            if name.endswith(".json"):
                info = self.get_pending(name[:-5])
                if info:
                    out[info["qid"]] = info
        return out

    def deliver(self, qid, text):
        self._write(self.inbox_path(qid), text)

    def take_reply(self, qid):
        try:
            with open(self.inbox_path(qid), encoding="utf-8") as f:
                text = f.read()
        except OSError:
            return None
        self.drop(qid)
        return text

    def drop(self, qid):
        for p in (self.inbox_path(qid), self.pending_path(qid)):
            try:
                os.remove(p)
            except OSError:
                pass

    def offset(self):
        try:
            with open(os.path.join(self.root, "offset")) as f:
                return int(f.read().strip() or 0)
        except (OSError, ValueError):
            return 0

    def set_offset(self, value):
        self._write(os.path.join(self.root, "offset"), str(value))

    # -- reader lock (one getUpdates reader at a time) -----------------------
    def acquire(self):
        for _ in range(2):
            try:
                os.mkdir(self.lock_dir)
                self._write(os.path.join(self.lock_dir, "pid"), str(os.getpid()))
                return True
            except FileExistsError:
                if not self._lock_is_stale():
                    return False
                shutil.rmtree(self.lock_dir, ignore_errors=True)
        return False

    def _lock_is_stale(self):
        try:
            with open(os.path.join(self.lock_dir, "pid")) as f:
                pid = int(f.read().strip())
        except (OSError, ValueError):
            try:
                return time.time() - os.path.getmtime(self.lock_dir) > 60
            except OSError:
                return True
        try:
            os.kill(pid, 0)
            return False
        except ProcessLookupError:
            return True
        except PermissionError:
            return False

    def release(self):
        try:
            with open(os.path.join(self.lock_dir, "pid")) as f:
                if int(f.read().strip()) != os.getpid():
                    return
        except (OSError, ValueError):
            return
        shutil.rmtree(self.lock_dir, ignore_errors=True)


# -- routing ----------------------------------------------------------------
def route(api, state, msg):
    """Deliver one incoming message to the right pending question."""
    if str(msg.get("chat", {}).get("id")) != api.chat_id:
        return None
    text = (msg.get("text") or msg.get("caption") or "").strip()
    if not text:
        api.send("Por ahora sólo entiendo texto. Respondé escribiendo.", reply_to=msg["message_id"])
        return None
    pending = state.all_pending()
    reply_to = (msg.get("reply_to_message") or {}).get("message_id")
    if reply_to:
        for qid, info in pending.items():
            if reply_to in info["message_ids"]:
                return _deliver(api, state, qid, text, msg)
        api.send("Esa pregunta ya no está pendiente.", reply_to=msg["message_id"])
        return None
    if len(pending) == 1:
        return _deliver(api, state, next(iter(pending)), text, msg)
    if not pending:
        api.send("No tengo preguntas pendientes.", reply_to=msg["message_id"])
        return None
    api.send(f"Tengo {len(pending)} preguntas pendientes. Respondé con «Responder» sobre la que "
             "quieras contestar.", reply_to=msg["message_id"])
    return None


def _deliver(api, state, qid, text, msg):
    state.deliver(qid, text)
    api.send("Recibido ✓", reply_to=msg["message_id"])
    return qid


def poll_once(api, state, timeout):
    try:
        updates = api.call("getUpdates", {"offset": state.offset(), "timeout": int(timeout),
                                          "allowed_updates": ["message"]}, timeout=timeout + 15)
    except ApiError as e:
        print(f"warning: {e}", file=sys.stderr)
        time.sleep(10 if e.code == 409 else 5)
        return
    for u in updates:
        msg = u.get("message")
        if msg:
            route(api, state, msg)
        state.set_offset(u["update_id"] + 1)


def wait(api, state, qid, timeout=None, sleep=time.sleep):
    deadline = time.time() + timeout if timeout else None
    while True:
        text = state.take_reply(qid)
        if text is not None:
            return 0, text
        if state.get_pending(qid) is None:
            return 4, None
        if deadline and time.time() >= deadline:
            return 3, None
        if state.acquire():
            try:
                while (not os.path.exists(state.inbox_path(qid))
                       and state.get_pending(qid) is not None
                       and not (deadline and time.time() >= deadline)):
                    left = POLL_SECONDS if not deadline else max(1, min(POLL_SECONDS, deadline - time.time()))
                    poll_once(api, state, left)
            finally:
                state.release()
        else:
            sleep(3)


# -- CLI --------------------------------------------------------------------
def _text(args):
    if getattr(args, "file", None):
        with open(args.file, encoding="utf-8") as f:
            return f.read().strip()
    return (args.text or "").strip()


def _qid(value):
    if not re.fullmatch(r"[A-Za-z0-9._-]{1,80}", value):
        raise argparse.ArgumentTypeError("QID may only contain letters, digits, '.', '_' and '-'")
    return value


def main(argv=None):
    p = argparse.ArgumentParser(description="Telegram helper for the orchestrator skill")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("check")
    sub.add_parser("pending")
    for name in ("send", "ask", "remind"):
        sp = sub.add_parser(name)
        if name != "send":
            sp.add_argument("--id", type=_qid, required=True)
        g = sp.add_mutually_exclusive_group(required=True)
        g.add_argument("--text")
        g.add_argument("--file")
        if name != "remind":
            sp.add_argument("--attach", action="append", default=[],
                            help="file sent right after the message, as a reply to it (repeatable)")
    sp = sub.add_parser("wait")
    sp.add_argument("--id", type=_qid, required=True)
    sp.add_argument("--timeout", type=float, default=None)
    sp = sub.add_parser("cancel")
    sp.add_argument("--id", type=_qid, required=True)
    args = p.parse_args(argv)

    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8")
    state = State()
    if args.cmd == "pending":
        for qid, info in state.all_pending().items():
            print(f"{qid} asked {time.strftime('%Y-%m-%d %H:%M', time.localtime(info['asked_at']))}")
        return 0
    if args.cmd == "cancel":
        state.drop(args.id)
        print(f"CANCELLED {args.id}")
        return 0

    api = Api()
    if args.cmd == "check":
        me = api.call("getMe", {})
        print(f"OK bot=@{me.get('username')} chat configured")
        return 0
    for path in getattr(args, "attach", []):
        if not os.path.isfile(path):
            print(f"ERROR attachment not found: {path}", file=sys.stderr)
            return 2
    if args.cmd == "send":
        mid = api.send(_text(args))
        for path in args.attach:
            api.attach(path, reply_to=mid)
        print(f"SENT message_id={mid} attachments={len(args.attach)}")
        return 0
    if args.cmd == "ask":
        mid = api.send(_text(args))
        state.add_pending(args.id, mid)
        for path in args.attach:
            state.add_alias(args.id, api.attach(path, reply_to=mid))
        print(f"ASKED {args.id} message_id={mid} attachments={len(args.attach)}")
        return 0
    if args.cmd == "remind":
        info = state.get_pending(args.id)
        if not info:
            print(f"NOT PENDING {args.id}")
            return 4
        mid = api.send(_text(args), reply_to=info["message_ids"][0])
        state.add_alias(args.id, mid)
        print(f"REMINDED {args.id} message_id={mid}")
        return 0
    if args.cmd == "wait":
        code, text = wait(api, state, args.id, args.timeout)
        if code == 0:
            print(f"REPLY {args.id}")
            print(text)
        elif code == 3:
            print(f"TIMEOUT {args.id}")
        else:
            print(f"CANCELLED {args.id}")
        return code
    return 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except ApiError as e:
        print(f"ERROR {e}", file=sys.stderr)
        sys.exit(2)
    except (OSError, KeyError, ValueError) as e:
        print(f"ERROR {type(e).__name__}: {e}", file=sys.stderr)
        sys.exit(2)
