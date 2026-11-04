// Compatibility entry point; Python owns application startup.
import { runPython } from "./python.mjs";
runPython(["-m", "backend", "dev", ...process.argv.slice(2)]);
