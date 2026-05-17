"use client";

import { FormEvent, useMemo, useState } from "react";

import { extractVideoId, isValidYoutubeInput } from "@/lib/youtube";

type TranscriptItem = {
  language_code: string;
  language: string;
  is_generated: boolean;
};

type TranscriptResult = {
  video_id: string;
  language: string;
  language_code: string;
  is_generated: boolean;
  snippet_count: number;
  format: string;
  content: string;
  saved_path?: string;
};

const FORMAT_OPTIONS = [
  { value: "txt", label: "텍스트 (.txt)" },
  { value: "srt", label: "SRT (.srt)" },
  { value: "vtt", label: "WebVTT (.vtt)" },
  { value: "json", label: "JSON (.json)" },
] as const;

export default function TranscriptForm() {
  const [url, setUrl] = useState("");
  const [languages, setLanguages] = useState("ko,en");
  const [format, setFormat] = useState<(typeof FORMAT_OPTIONS)[number]["value"]>("txt");
  const [generatedOnly, setGeneratedOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [listing, setListing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptItem[] | null>(null);
  const [result, setResult] = useState<TranscriptResult | null>(null);

  const videoId = useMemo(() => extractVideoId(url), [url]);
  const urlValid = url.length === 0 || isValidYoutubeInput(url);

  async function handleList() {
    if (!isValidYoutubeInput(url)) {
      setError("올바른 YouTube URL 또는 영상 ID를 입력해 주세요.");
      return;
    }

    setListing(true);
    setError(null);
    setTranscripts(null);

    try {
      const res = await fetch("/api/transcript/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "목록 조회 실패");
      setTranscripts(data.transcripts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "목록 조회에 실패했습니다.");
    } finally {
      setListing(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!isValidYoutubeInput(url)) {
      setError("올바른 YouTube URL 또는 영상 ID를 입력해 주세요.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const langList = languages
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean);

      const res = await fetch("/api/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          languages: langList.length ? langList : ["ko", "en"],
          format,
          generatedOnly,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "자막 추출 실패");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "자막 추출에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function handleDownload() {
    if (!result) return;
    const blob = new Blob([result.content], { type: "text/plain;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${result.video_id}.${result.format}`;
    a.click();
    URL.revokeObjectURL(href);
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/40 backdrop-blur-md sm:p-8">
          <label htmlFor="youtube-url" className="mb-2 block text-sm font-medium text-zinc-300">
            YouTube 링크
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
              <LinkIcon />
            </span>
            <input
              id="youtube-url"
              type="url"
              inputMode="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError(null);
              }}
              className={`w-full rounded-xl border bg-zinc-950/80 py-4 pl-12 pr-4 text-base text-white outline-none transition placeholder:text-zinc-600 focus:ring-2 ${
                urlValid
                  ? "border-zinc-700 focus:border-red-500/50 focus:ring-red-500/30"
                  : "border-red-500/60 focus:ring-red-500/40"
              }`}
            />
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            watch, youtu.be, shorts URL 또는 11자리 영상 ID를 지원합니다.
          </p>
          {videoId && (
            <p className="mt-1 text-xs text-emerald-400/90">영상 ID: {videoId}</p>
          )}
          {!urlValid && url.length > 0 && (
            <p className="mt-1 text-xs text-red-400">유효하지 않은 링크입니다.</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="languages" className="mb-2 block text-sm font-medium text-zinc-300">
              언어 우선순위
            </label>
            <input
              id="languages"
              type="text"
              value={languages}
              onChange={(e) => setLanguages(e.target.value)}
              placeholder="ko,en"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-4 py-3 text-white outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-500/30"
            />
          </div>
          <div>
            <label htmlFor="format" className="mb-2 block text-sm font-medium text-zinc-300">
              출력 형식
            </label>
            <select
              id="format"
              value={format}
              onChange={(e) => setFormat(e.target.value as typeof format)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-4 py-3 text-white outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-500/30"
            >
              {FORMAT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-3 text-sm text-zinc-400">
          <input
            type="checkbox"
            checked={generatedOnly}
            onChange={(e) => setGeneratedOnly(e.target.checked)}
            className="size-4 rounded border-zinc-600 bg-zinc-900 text-red-600 focus:ring-red-500/40"
          />
          자동 생성 자막만 사용
        </label>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={loading || !urlValid}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Spinner /> : null}
            {loading ? "추출 중… (최대 2~3분)" : "자막 추출"}
          </button>
          <button
            type="button"
            onClick={handleList}
            disabled={listing || !urlValid}
            className="rounded-xl border border-zinc-600 px-6 py-3.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-400 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {listing ? "조회 중…" : "자막 목록 보기"}
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-6 rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          <p>{error}</p>
          {error.includes("제한") && (
            <p className="mt-2 text-xs text-red-300/80">
              같은 영상을 연속으로 시도하면 차단될 수 있습니다. 1~2분 간격을 두고 다시
              시도해 보세요.
            </p>
          )}
        </div>
      )}

      {transcripts && transcripts.length > 0 && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">사용 가능한 자막</h2>
          <ul className="space-y-2">
            {transcripts.map((t) => (
              <li
                key={t.language_code}
                className="flex items-center justify-between rounded-lg bg-zinc-900/60 px-3 py-2 text-sm"
              >
                <span className="text-white">
                  {t.language}{" "}
                  <span className="text-zinc-500">({t.language_code})</span>
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    t.is_generated
                      ? "bg-amber-500/15 text-amber-300"
                      : "bg-emerald-500/15 text-emerald-300"
                  }`}
                >
                  {t.is_generated ? "자동생성" : "수동"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
            <div>
              <p className="text-sm font-medium text-white">
                {result.language} ({result.language_code})
              </p>
              <p className="text-xs text-zinc-500">
                {result.snippet_count}개 구간 ·{" "}
                {result.is_generated ? "자동 생성" : "수동 입력"}
              </p>
              {result.saved_path && (
                <p className="mt-1 text-xs text-emerald-400/90">
                  저장됨: {result.saved_path}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleDownload}
              className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/5"
            >
              파일 다운로드
            </button>
          </div>
          <pre className="max-h-[420px] overflow-auto p-5 text-sm leading-relaxed whitespace-pre-wrap text-zinc-300">
            {result.content}
          </pre>
        </div>
      )}
    </div>
  );
}

function LinkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
