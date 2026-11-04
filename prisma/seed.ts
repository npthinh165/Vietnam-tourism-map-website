// Compatibility entry point; Python owns idempotent destination seeding.
import { runPython } from "../tools/python.mjs";
runPython(["-m", "backend", "seed"]);
