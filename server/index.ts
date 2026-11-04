// Compatibility entry point for older launch configurations.
import { runPython } from "../tools/python.mjs";
runPython(["-m", "backend", "serve"]);
