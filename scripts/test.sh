#!/bin/sh
# Run the unit tests with Node, or with macOS's built-in JavaScriptCore when Node is missing.
set -e
cd "$(dirname "$0")/.."
if command -v node >/dev/null 2>&1; then
  exec node test/run.js
fi
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc
if [ -x "$JSC" ]; then
  exec "$JSC" test/run.js
fi
echo "Need Node.js (or macOS JavaScriptCore) to run the tests." >&2
exit 1
