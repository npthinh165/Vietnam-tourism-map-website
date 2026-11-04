// Compatibility entry point; preview uses an isolated database in RAM.
import { runPython } from "./python.mjs";
runPython(["-m", "backend", "preview", ...process.argv.slice(2)]);
