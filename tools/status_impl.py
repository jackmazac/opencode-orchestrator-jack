#!/usr/bin/env python3
"""Status file manager for opencode executor agents.

Operations:
  write <slug> <content>   Create/overwrite .opencode/status/<slug>.md
  read  [slug]             Read one status file or list all
  done  [slug]             Remove one status file or all + directory
"""
import sys
import os
from pathlib import Path

DIR = Path(".opencode/status")


def write(slug: str, content: str) -> str:
    DIR.mkdir(parents=True, exist_ok=True)
    path = DIR / f"{slug}.md"
    path.write_text(content, encoding="utf-8")
    return f"wrote {path}"


def read(slug: str | None) -> str:
    if not DIR.exists():
        return "no status files"
    if slug:
        path = DIR / f"{slug}.md"
        if not path.exists():
            return f"no status file for {slug}"
        return path.read_text(encoding="utf-8")
    files = sorted(DIR.glob("*.md"))
    if not files:
        return "no status files"
    parts = []
    for f in files:
        name = f.stem
        parts.append(f"--- {name} ---\n{f.read_text(encoding='utf-8')}")
    return "\n\n".join(parts)


def done(slug: str | None) -> str:
    if not DIR.exists():
        return "no status files to clean"
    if slug:
        path = DIR / f"{slug}.md"
        if path.exists():
            path.unlink()
            return f"removed {path}"
        return f"no status file for {slug}"
    removed = []
    for f in DIR.glob("*.md"):
        f.unlink()
        removed.append(f.name)
    try:
        DIR.rmdir()
        DIR.parent.rmdir()
    except OSError:
        pass
    if not removed:
        return "no status files to clean"
    return f"removed {len(removed)} files: {', '.join(removed)}"


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        print("usage: status_impl.py <write|read|done> [slug] [content]", file=sys.stderr)
        sys.exit(1)
    op = args[0]
    if op == "write":
        if len(args) < 3:
            print("usage: status_impl.py write <slug> <content>", file=sys.stderr)
            sys.exit(1)
        print(write(args[1], args[2]))
    elif op == "read":
        print(read(args[1] if len(args) > 1 else None))
    elif op == "done":
        print(done(args[1] if len(args) > 1 else None))
    else:
        print(f"unknown operation: {op}", file=sys.stderr)
        sys.exit(1)
