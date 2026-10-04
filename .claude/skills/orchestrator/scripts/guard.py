#!/usr/bin/env python3
"""PreToolUse guard registered by the orchestrator skill (active for the rest of that session,
including its agents). It blocks the Bash commands that decision 16 reserves for Hernán:
git push, deploys and publishes, git reset --hard, git clean, and recursive rm outside the
current checkout (the agent's worktree, or the main checkout for the orchestrator).
One push is allowed: exactly `git push origin main` from the main checkout (not from an agent
worktree), which deploys the test version on Vercel. The orchestrator runs it only after Hernán
says yes, on Telegram or in the session (Hernán, 2026-10-04).

Reads the hook JSON on stdin. Exit 2 with a reason on stderr blocks the call; exit 0 allows it.
Run `guard.py --explain '<command>' [cwd]` to test a command by hand.
"""
import json
import os
import re
import shlex
import subprocess
import sys

SEPARATORS = re.compile(r"\|\||&&|;|\||\n|&")
WRAPPERS = {"sudo", "env", "command", "exec", "time", "nohup", "nice", "caffeinate"}
SHELLS = {"bash", "sh", "zsh"}
RUNNERS = {"npx", "bunx"}
GIT_OPTS_WITH_ARG = {"-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path"}

VERCEL_OK = {"link", "whoami", "logs", "ls", "list", "inspect", "pull", "dev", "build", "help",
             "login", "logout", "switch", "--version", "-v", "--help", "-h"}
SIMPLE_DEPLOYS = {
    "netlify": {"deploy"},
    "fly": {"deploy", "destroy"},
    "flyctl": {"deploy", "destroy"},
    "firebase": {"deploy"},
    "wrangler": {"deploy", "publish"},
    "railway": {"up", "deploy"},
    "terraform": {"apply", "destroy"},
    "npm": {"publish", "unpublish"},
    "pnpm": {"publish"},
    "yarn": {"publish"},
    "bun": {"publish"},
    "eas": {"submit", "update"},
}
GH_BLOCKED = {("pr", "merge"), ("release", "create"), ("repo", "delete")}
SUPABASE_BLOCKED = {("db", "push"), ("functions", "deploy"), ("secrets", "set"),
                    ("secrets", "unset"), ("projects", "delete"), ("migration", "repair")}


def temp_roots():
    roots = ["/tmp", "/private/tmp", "/var/folders", "/private/var/folders"]
    if os.environ.get("TMPDIR"):
        roots.append(os.environ["TMPDIR"])
    return {os.path.realpath(r) for r in roots}


def toplevel(cwd):
    try:
        out = subprocess.run(["git", "-C", cwd, "rev-parse", "--show-toplevel"],
                             capture_output=True, text=True, timeout=5)
    except (OSError, subprocess.SubprocessError):
        return None
    return os.path.realpath(out.stdout.strip()) if out.returncode == 0 and out.stdout.strip() else None


def inside(path, root):
    return path == root or path.startswith(root.rstrip("/") + "/")


def words(segment):
    try:
        return shlex.split(segment, comments=False)
    except ValueError:
        return segment.split()


def positional(args):
    return [a for a in args if not a.startswith("-")]


def check(command, cwd):
    """Return a reason string if the command must be blocked, else None."""
    cwd = os.path.realpath(os.path.expanduser(cwd or os.getcwd()))
    for segment in SEPARATORS.split(command):
        toks = words(segment.strip())
        # strip env assignments and harmless wrappers
        while toks and (re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*=.*", toks[0]) or toks[0] in WRAPPERS):
            toks = toks[1:]
        if not toks:
            continue
        name = os.path.basename(toks[0])
        args = toks[1:]
        if name == "cd":
            target = os.path.expandvars(os.path.expanduser(args[0])) if args else os.path.expanduser("~")
            cwd = os.path.realpath(os.path.join(cwd, target))
            continue
        if name in SHELLS and "-c" in args:
            i = args.index("-c")
            if i + 1 < len(args):
                reason = check(args[i + 1], cwd)
                if reason:
                    return reason
            continue
        if name in RUNNERS or (name in {"pnpm", "yarn"} and args[:1] == ["dlx"]):
            rest = args[1:] if name in {"pnpm", "yarn"} else args
            rest = [a for a in rest if a not in {"-y", "--yes"}]
            if rest:
                name, args = os.path.basename(rest[0]), rest[1:]
        reason = (check_git(name, args, cwd) or check_deploy(name, args)
                  or check_rm(name, args, cwd))
        if reason:
            return reason
    return None


def check_git(name, args, cwd=None):
    if name != "git":
        return None
    i = 0
    while i < len(args) and args[i].startswith("-"):
        i += 2 if args[i] in GIT_OPTS_WITH_ARG else 1
    if i >= len(args):
        return None
    sub, rest = args[i], args[i + 1:]
    if sub == "push":
        if rest == ["origin", "main"] and cwd and "/.claude/worktrees/" not in cwd.replace("\\", "/") + "/":
            return None
        return "`git push` is Hernán's decision."
    if sub == "reset" and "--hard" in rest:
        return "`git reset --hard` discards work."
    if sub == "clean" and not ({"-n", "--dry-run"} & set(rest)):
        return "`git clean` deletes untracked files."
    return None


def check_deploy(name, args):
    pos = positional(args)
    sub = pos[0] if pos else None
    if name == "vercel":
        if "--prod" in args or "--production" in args:
            return "`vercel --prod` deploys to production."
        first = args[0] if args else None
        if first in VERCEL_OK:
            return None
        if sub == "env" and len(pos) > 1 and pos[1] in {"pull", "ls", "list"}:
            return None
        return "`vercel` deploys or changes the remote project."
    if name in SIMPLE_DEPLOYS and sub in SIMPLE_DEPLOYS[name]:
        return f"`{name} {sub}` deploys or publishes."
    if name == "gh" and tuple(pos[:2]) in GH_BLOCKED:
        return f"`gh {' '.join(pos[:2])}` acts on GitHub for Hernán."
    if name == "supabase":
        if tuple(pos[:2]) in SUPABASE_BLOCKED:
            return f"`supabase {' '.join(pos[:2])}` changes the remote project."
        if tuple(pos[:2]) == ("db", "reset") and ({"--linked", "--db-url"} & set(args)):
            return "`supabase db reset` on a remote database deletes data."
    return None


def check_rm(name, args, cwd):
    if name == "xargs" and "rm" in args:
        return "`xargs rm` deletes paths that cannot be checked."
    if name != "rm":
        return None
    flags, paths, end = set(), [], False
    for a in args:
        if not end and a == "--":
            end = True
        elif not end and a.startswith("--"):
            flags.add(a)
        elif not end and a.startswith("-") and len(a) > 1:
            flags.update(a[1:])
        else:
            paths.append(a)
    if not ({"r", "R", "--recursive"} & flags):
        return None
    root = toplevel(cwd)
    temps = temp_roots()
    for p in paths:
        expanded = os.path.expandvars(os.path.expanduser(p))
        if "$" in expanded or "`" in expanded:
            return f"`rm -r {p}`: the path cannot be checked."
        base = re.split(r"[*?\[]", expanded, maxsplit=1)[0] or "."
        target = os.path.realpath(os.path.join(cwd, base))
        if root and inside(root, target):
            return f"`rm -r {p}` deletes the checkout itself ({root})."
        if root and inside(target, root):
            continue
        if any(inside(target, t) and target != t for t in temps):
            continue
        return f"`rm -r {p}` deletes outside this checkout ({root or cwd})."
    return None


def main():
    if len(sys.argv) >= 3 and sys.argv[1] == "--explain":
        reason = check(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else os.getcwd())
        print(f"BLOCK: {reason}" if reason else "ALLOW")
        return 0
    try:
        data = json.load(sys.stdin)
    except ValueError:
        return 0
    if data.get("tool_name") != "Bash":
        return 0
    reason = check((data.get("tool_input") or {}).get("command") or "", data.get("cwd"))
    if reason:
        print(f"Blocked by the orchestrator guard: {reason} Do not work around it: stop and report "
              "it as STATUS: blocked (agents) or ask Hernán (orchestrator).", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
