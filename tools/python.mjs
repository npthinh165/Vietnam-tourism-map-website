// Cross-platform launcher: prefer the project virtual environment, then PYTHON/PATH.
import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

export function pythonCommand() {
  const local = path.resolve(".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  return process.env.PYTHON || (existsSync(local) ? local : process.platform === "win32" ? "python" : "python3");
}
export function runPython(args) {
  const child = spawn(pythonCommand(), ["-X", "utf8", ...args], { stdio: "inherit", windowsHide: true });
  child.on("error", () => {
    console.error("Không tìm thấy Python. Cài Python 3.11+, tạo .venv và cài requirements-dev.txt.");
    process.exitCode = 1;
  });
  child.on("exit", (code) => { process.exitCode = code ?? 1; });
  return child;
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  runPython(process.argv.slice(2));
}
