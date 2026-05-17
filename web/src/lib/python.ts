import { spawn } from "node:child_process";
import path from "node:path";

const PROJECT_ROOT = path.resolve(process.cwd(), "..");

type PythonResult =
  | ({ ok: true } & Record<string, unknown>)
  | { ok: false; error: string };

export async function runPythonApi(
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const pythonBin = path.join(PROJECT_ROOT, ".venv", "bin", "python");
  const scriptPath = path.join(PROJECT_ROOT, "api_cli.py");

  const stdout = await new Promise<string>((resolve, reject) => {
    const child = spawn(pythonBin, [scriptPath], {
      cwd: PROJECT_ROOT,
      env: process.env,
    });

    let out = "";
    let err = "";

    child.stdout.on("data", (chunk: Buffer) => {
      out += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      err += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0 && !out) {
        reject(new Error(err || `Python 프로세스 종료 코드: ${code}`));
        return;
      }
      resolve(out);
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });

  const parsed = JSON.parse(stdout) as PythonResult;
  if (!parsed.ok) {
    throw new Error("error" in parsed ? parsed.error : "자막 처리에 실패했습니다.");
  }

  return parsed;
}
