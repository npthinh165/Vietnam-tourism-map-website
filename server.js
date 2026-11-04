// Compatibility entry point; runtime routes now run in Python.
import { runPython } from './tools/python.mjs';
runPython(['-m', 'backend', 'serve']);
