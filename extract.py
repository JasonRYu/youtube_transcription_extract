#!/usr/bin/env python3
"""유튜브 영상 자막 추출 (Webshare 프록시 경유)."""

from __future__ import annotations

import argparse
import os
import re
import sys
import time
from pathlib import Path
from typing import Callable, TypeVar
from urllib.parse import parse_qs, urlparse

from dotenv import load_dotenv
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import IpBlocked, RequestBlocked
from youtube_transcript_api.formatters import JSONFormatter, SRTFormatter, TextFormatter, WebVTTFormatter
from youtube_transcript_api.proxies import WebshareProxyConfig

T = TypeVar("T")

VIDEO_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{11}$")
PROJECT_ROOT = Path(__file__).resolve().parent
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "결과자막"


def get_default_output_dir() -> Path:
    return DEFAULT_OUTPUT_DIR


def extract_video_id(url_or_id: str) -> str:
    candidate = url_or_id.strip()
    if VIDEO_ID_PATTERN.match(candidate):
        return candidate

    parsed = urlparse(candidate)
    if parsed.hostname in {"youtu.be", "www.youtu.be"}:
        video_id = parsed.path.lstrip("/").split("/")[0]
    elif parsed.hostname in {"youtube.com", "www.youtube.com", "m.youtube.com"}:
        if parsed.path == "/watch":
            video_id = parse_qs(parsed.query).get("v", [""])[0]
        elif parsed.path.startswith(("/embed/", "/v/", "/shorts/")):
            video_id = parsed.path.split("/")[2]
        else:
            video_id = ""
    else:
        video_id = ""

    if not VIDEO_ID_PATTERN.match(video_id):
        raise ValueError(f"유효한 YouTube URL 또는 영상 ID가 아닙니다: {url_or_id}")
    return video_id


def load_proxy_credentials() -> tuple[str, str]:
    load_dotenv(PROJECT_ROOT / ".env")
    username = os.getenv("PROXY_USERNAME") or os.getenv("Proxy_Username")
    password = os.getenv("PROXY_PASSWORD") or os.getenv("Proxy_Password")
    if not username or not password:
        raise RuntimeError(
            ".env에 PROXY_USERNAME, PROXY_PASSWORD (또는 Proxy_Username, Proxy_Password)를 설정하세요."
        )
    return username, password


def _parse_ip_locations() -> list[str] | None:
    raw = os.getenv("PROXY_IP_LOCATIONS", "").strip()
    if not raw:
        return None
    return [code.strip().lower() for code in raw.split(",") if code.strip()]


def create_api() -> YouTubeTranscriptApi:
    username, password = load_proxy_credentials()
    kwargs: dict = {
        "proxy_username": username,
        "proxy_password": password,
        "retries_when_blocked": int(os.getenv("PROXY_RETRIES", "15")),
    }
    locations = _parse_ip_locations()
    if locations:
        kwargs["filter_ip_locations"] = locations
    return YouTubeTranscriptApi(proxy_config=WebshareProxyConfig(**kwargs))


def is_rate_limit_error(exc: BaseException) -> bool:
    if isinstance(exc, (IpBlocked, RequestBlocked)):
        return True
    msg = str(exc).lower()
    return any(
        token in msg
        for token in ("429", "too many", "blocked", "sorry/index", "ipblocked", "requestblocked")
    )


def format_user_error(exc: BaseException) -> str:
    if is_rate_limit_error(exc):
        return (
            "YouTube이 요청을 일시적으로 제한했습니다. "
            "1~2분 후 다시 시도하거나, .env에 PROXY_IP_LOCATIONS=kr 처럼 "
            "다른 프록시 지역을 설정해 보세요."
        )
    return str(exc)


def with_proxy_retry(operation: Callable[[], T], label: str = "요청") -> T:
    max_attempts = int(os.getenv("PROXY_MAX_ATTEMPTS", "5"))
    base_delay = float(os.getenv("PROXY_RETRY_DELAY", "2"))
    last_error: BaseException | None = None

    for attempt in range(max_attempts):
        try:
            return operation()
        except Exception as exc:
            last_error = exc
            if not is_rate_limit_error(exc) or attempt >= max_attempts - 1:
                raise
            delay = base_delay * (2**attempt)
            print(
                f"{label} 제한 감지, {delay:.0f}초 후 재시도 ({attempt + 1}/{max_attempts - 1})…",
                file=sys.stderr,
            )
            time.sleep(delay)

    assert last_error is not None
    raise last_error


def parse_languages(raw: str | None) -> list[str]:
    if not raw:
        return ["ko", "en"]
    return [lang.strip() for lang in raw.split(",") if lang.strip()]


def save_transcript(content: str, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(content, encoding="utf-8")


def build_output_path(output_dir: Path, video_id: str, ext: str) -> Path:
    return output_dir / f"{video_id}.{ext}"


FORMATTERS = {
    "txt": TextFormatter(),
    "json": JSONFormatter(),
    "srt": SRTFormatter(),
    "vtt": WebVTTFormatter(),
}


def list_available_transcripts(url_or_id: str) -> list[dict]:
    video_id = extract_video_id(url_or_id)

    def _list() -> list[dict]:
        api = create_api()
        transcript_list = api.list(video_id)
        return [
            {
                "language_code": t.language_code,
                "language": t.language,
                "is_generated": t.is_generated,
            }
            for t in transcript_list
        ]

    return with_proxy_retry(_list, label="자막 목록")


def fetch_transcript(
    url_or_id: str,
    languages: list[str] | None = None,
    fmt: str = "txt",
    generated_only: bool = False,
    output_dir: Path | None = None,
    save: bool = True,
) -> dict:
    if fmt not in FORMATTERS:
        raise ValueError(f"지원하지 않는 형식입니다: {fmt}")

    video_id = extract_video_id(url_or_id)
    langs = languages or ["ko", "en"]

    def _fetch() -> dict:
        api = create_api()
        transcript_list = api.list(video_id)
        if generated_only:
            transcript = transcript_list.find_generated_transcript(langs)
        else:
            transcript = transcript_list.find_transcript(langs)
        fetched = transcript.fetch()
        formatter = FORMATTERS[fmt]
        if fmt == "json":
            content = formatter.format_transcript(fetched, indent=2, ensure_ascii=False)
        else:
            content = formatter.format_transcript(fetched)
        result = {
            "video_id": video_id,
            "language": fetched.language,
            "language_code": fetched.language_code,
            "is_generated": fetched.is_generated,
            "snippet_count": len(fetched),
            "format": fmt,
            "content": content,
        }
        if save:
            target_dir = output_dir or get_default_output_dir()
            output_path = build_output_path(target_dir, video_id, fmt)
            save_transcript(content, output_path)
            result["saved_path"] = str(output_path)
        return result

    return with_proxy_retry(_fetch, label="자막 추출")


def main() -> int:
    parser = argparse.ArgumentParser(description="유튜브 자막을 Webshare 프록시로 추출합니다.")
    parser.add_argument("url", help="YouTube URL 또는 영상 ID")
    parser.add_argument(
        "-l",
        "--languages",
        help="우선순위 언어 코드 (쉼표 구분, 기본: ko,en)",
    )
    parser.add_argument(
        "-f",
        "--format",
        choices=["txt", "json", "srt", "vtt"],
        default="txt",
        help="출력 형식 (기본: txt)",
    )
    parser.add_argument(
        "-o",
        "--output-dir",
        type=Path,
        default=get_default_output_dir(),
        help="저장 폴더 (기본: 결과자막)",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="사용 가능한 자막 목록만 출력",
    )
    parser.add_argument(
        "--generated-only",
        action="store_true",
        help="자동 생성 자막만 사용",
    )
    args = parser.parse_args()

    try:
        video_id = extract_video_id(args.url)
        languages = parse_languages(args.languages)
        api = create_api()

        if args.list:
            transcript_list = api.list(video_id)
            for t in transcript_list:
                kind = "자동생성" if t.is_generated else "수동"
                print(f"- {t.language_code} ({t.language}) [{kind}]")
            return 0

        result = fetch_transcript(
            args.url,
            languages=languages,
            fmt=args.format,
            generated_only=args.generated_only,
            output_dir=args.output_dir,
        )

        print(f"저장 완료: {result['saved_path']}")
        print(f"언어: {result['language']} ({result['language_code']})")
        print(f"자동생성: {'예' if result['is_generated'] else '아니오'}")
        print(f"구간 수: {result['snippet_count']}")
        return 0

    except Exception as exc:
        print(f"오류: {format_user_error(exc)}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
