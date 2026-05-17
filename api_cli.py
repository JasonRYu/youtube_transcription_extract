#!/usr/bin/env python3
"""Next.js API에서 호출하는 JSON 브리지."""

from __future__ import annotations

import json
import sys

from extract import fetch_transcript, format_user_error, list_available_transcripts


def main() -> int:
    try:
        payload = json.load(sys.stdin)
        action = payload.get("action", "fetch")

        if action == "list":
            result = {"ok": True, "transcripts": list_available_transcripts(payload["url"])}
        elif action == "fetch":
            result = {
                "ok": True,
                "data": fetch_transcript(
                    payload["url"],
                    languages=payload.get("languages"),
                    fmt=payload.get("format", "txt"),
                    generated_only=bool(payload.get("generated_only")),
                ),
            }
        else:
            raise ValueError(f"알 수 없는 action: {action}")

        json.dump(result, sys.stdout, ensure_ascii=False)
        return 0
    except Exception as exc:
        json.dump({"ok": False, "error": format_user_error(exc)}, sys.stdout, ensure_ascii=False)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
