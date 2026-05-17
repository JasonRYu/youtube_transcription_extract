const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

export function extractVideoId(input: string): string | null {
  const value = input.trim();
  if (VIDEO_ID_RE.test(value)) return value;

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0];
      return VIDEO_ID_RE.test(id) ? id : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname === "/watch") {
        const id = url.searchParams.get("v") ?? "";
        return VIDEO_ID_RE.test(id) ? id : null;
      }
      const parts = url.pathname.split("/").filter(Boolean);
      if (["embed", "v", "shorts"].includes(parts[0] ?? "")) {
        const id = parts[1] ?? "";
        return VIDEO_ID_RE.test(id) ? id : null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function isValidYoutubeInput(input: string): boolean {
  return extractVideoId(input) !== null;
}
