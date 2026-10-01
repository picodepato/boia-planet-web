#!/usr/bin/env python3
"""Integration helper for the orchestrator. Run it from the main checkout.

  integrate.py test  --test CMD [--label NAME]
      Run the project's test command on the main checkout.
  integrate.py merge --branch BRANCH --message "T04: title" [--test CMD] [--ignore PATH]...
                     [--status-file PATH [--status-dir DIR]]
      Squash-merge BRANCH into the current branch as one commit. With --test, run the test
      command afterwards and revert that commit if it fails, so main stays green. --ignore lets
      the plan file stay modified (unstaged) on disk; it never enters the squash commit.
      With --status-file, every fragment the branch adds under --status-dir (default
      .orchestrator/status) is moved into that shared file, on top of its first "## " section,
      inside the same squash commit; so tasks never edit the shared file and never conflict on it.

Prints exactly one JSON line. Full test output goes to a log file under
<git-common-dir>/orchestrator/logs/, so it never has to enter the orchestrator's context;
on failure the JSON carries only the last lines.

merge results: merged | tests_failed (already reverted) | conflict (main untouched) |
               dirty_main | no_branch | no_commits | empty | error
test results:  pass | fail
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import time

TAIL_LINES = 40

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def git(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True)


def out(**result):
    print(json.dumps(result, ensure_ascii=False))
    return 0


def log_dir():
    common = git("rev-parse", "--git-common-dir").stdout.strip()
    path = os.path.join(os.path.abspath(common), "orchestrator", "logs")
    os.makedirs(path, exist_ok=True)
    return path


def bash():
    """/bin/bash on macOS/Linux; Git Bash on Windows (WSL's System32 bash would run Linux tools)."""
    if os.path.exists("/bin/bash"):
        return "/bin/bash"
    for path in (os.path.join(os.environ.get("ProgramFiles", r"C:\Program Files"), "Git", "bin", "bash.exe"),
                 shutil.which("bash")):
        if path and os.path.exists(path) and "system32" not in path.lower():
            return path
    sys.exit("integrate.py: no bash found (install Git for Windows)")


def run_tests(command, label):
    log = os.path.join(log_dir(), f"{time.strftime('%Y%m%d-%H%M%S')}-{label}.log")
    start = time.time()
    with open(log, "w", encoding="utf-8") as f:
        rc = subprocess.run([bash(), "-c", command], stdout=f, stderr=subprocess.STDOUT).returncode
    with open(log, encoding="utf-8", errors="replace") as f:
        lines = [l.rstrip("\n")[:200] for l in f.readlines()]
    return {"exit": rc, "seconds": round(time.time() - start), "log": log,
            "last_line": next((l for l in reversed(lines) if l.strip()), ""),
            "tail": lines[-TAIL_LINES:] if rc != 0 else []}


def fold_status(status_file, status_dir):
    """Move staged status fragments into status_file (newest on top). Returns the list of
    fragments folded, or an error string."""
    names = git("diff", "--cached", "--name-only", "--diff-filter=AM", "--", status_dir).stdout.split()
    names = sorted(n for n in names if n.endswith(".md"))
    if not names:
        return []
    try:
        blocks = []
        for n in names:
            with open(n, encoding="utf-8") as f:
                blocks.append(f.read().strip("\n") + "\n")
        text = ""
        if os.path.exists(status_file):
            with open(status_file, encoding="utf-8") as f:
                text = f.read()
        lines = text.split("\n")
        at = next((i for i, l in enumerate(lines) if l.startswith("## ")), len(lines))
        head, tail = "\n".join(lines[:at]).rstrip("\n"), "\n".join(lines[at:])
        parts = ([head] if head else []) + [b.rstrip("\n") for b in reversed(blocks)] + ([tail.rstrip("\n")] if tail.strip() else [])
        with open(status_file, "w", encoding="utf-8") as f:
            f.write("\n\n".join(parts) + "\n")
        for n in names:
            os.remove(n)
        try:
            os.removedirs(status_dir)
        except OSError:
            pass
        git("add", "-A", "--", status_file, status_dir)
        return names
    except OSError as e:
        return f"{type(e).__name__}: {e}"


def cmd_test(args):
    t = run_tests(args.test, args.label or "main")
    return out(result="pass" if t["exit"] == 0 else "fail", **t)


def cmd_merge(args):
    lines = git("status", "--porcelain", "--untracked-files=no").stdout.split("\n")
    dirty = [l[3:] for l in lines if l.strip() and l[3:] not in args.ignore]
    staged = [l[3:] for l in lines if l.strip() and l[0] not in " ?"]
    if dirty or staged:
        return out(result="dirty_main", files=sorted(set(dirty + staged))[:20])
    if git("rev-parse", "--verify", "--quiet", args.branch + "^{commit}").returncode != 0:
        return out(result="no_branch", branch=args.branch)
    ahead = git("rev-list", "--count", f"HEAD..{args.branch}").stdout.strip()
    if ahead == "0":
        return out(result="no_commits", branch=args.branch)

    probe = git("merge-tree", "--write-tree", "--name-only", "HEAD", args.branch)
    if probe.returncode == 1:
        # --name-only output: tree oid, conflicted paths, blank line, informational messages
        files = []
        for line in probe.stdout.split("\n")[1:]:
            if not line.strip():
                break
            files.append(line)
        return out(result="conflict", branch=args.branch, files=sorted(set(files))[:30])
    if probe.returncode != 0:
        return out(result="error", step="merge-tree", detail=probe.stderr.strip()[-500:])

    squash = git("merge", "--squash", args.branch)
    if squash.returncode != 0:
        git("reset", "-q", "--hard", "HEAD")
        return out(result="error", step="merge --squash", detail=squash.stderr.strip()[-500:])
    if git("diff", "--cached", "--quiet").returncode == 0:
        return out(result="empty", branch=args.branch)
    if args.status_file:
        folded = fold_status(args.status_file, args.status_dir)
        if folded is not None and not isinstance(folded, list):
            git("reset", "-q", "--hard", "HEAD")
            return out(result="error", step="status fold", detail=str(folded)[-500:])
    commit = git("commit", "-q", "-m", args.message)
    if commit.returncode != 0:
        git("reset", "-q", "--hard", "HEAD")
        return out(result="error", step="commit", detail=(commit.stdout + commit.stderr).strip()[-800:])
    sha = git("rev-parse", "--short", "HEAD").stdout.strip()

    if not args.test:
        return out(result="merged", commit=sha)
    t = run_tests(args.test, args.message.split(":")[0].strip() or "merge")
    if t["exit"] == 0:
        return out(result="merged", commit=sha, **t)
    revert = git("revert", "--no-edit", "HEAD")
    reverted = git("rev-parse", "--short", "HEAD").stdout.strip() if revert.returncode == 0 else None
    return out(result="tests_failed", commit=sha, revert=reverted,
               revert_error=None if reverted else revert.stderr.strip()[-500:], **t)


def main():
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = p.add_subparsers(dest="cmd", required=True)
    t = sub.add_parser("test")
    t.add_argument("--test", required=True)
    t.add_argument("--label")
    m = sub.add_parser("merge")
    m.add_argument("--branch", required=True)
    m.add_argument("--message", required=True)
    m.add_argument("--test")
    m.add_argument("--ignore", action="append", default=[],
                   help="path whose unstaged changes do not count as a dirty main (the plan file)")
    m.add_argument("--status-file",
                   help="shared status file (e.g. ESTADO.md) that receives the task's status fragment")
    m.add_argument("--status-dir", default=".orchestrator/status",
                   help="where tasks write their status fragment (default .orchestrator/status)")
    args = p.parse_args()
    if git("rev-parse", "--is-inside-work-tree").stdout.strip() != "true":
        return out(result="error", step="start", detail="not inside a git work tree")
    return cmd_test(args) if args.cmd == "test" else cmd_merge(args)


if __name__ == "__main__":
    sys.exit(main())
