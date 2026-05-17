import { NextRequest, NextResponse } from "next/server";

import { runPythonApi } from "@/lib/python";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = typeof body.url === "string" ? body.url.trim() : "";

    if (!url) {
      return NextResponse.json({ error: "YouTube URL을 입력해 주세요." }, { status: 400 });
    }

    const result = await runPythonApi({
      action: "list",
      url,
    });

    return NextResponse.json({ transcripts: result.transcripts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "자막 목록 조회에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
