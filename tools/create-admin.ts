// Compatibility entry point; admin creation runs in Python.
import { runPython } from "./python.mjs";
runPython(["-m", "backend", "create-admin", ...process.argv.slice(2)]);
