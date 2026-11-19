#!/bin/sh
# Zip the extension for the Chrome Web Store: only the files the extension needs.
set -e
cd "$(dirname "$0")/.."
VERSION=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' manifest.json | head -1)
mkdir -p dist
OUT="dist/action-locker-$VERSION.zip"
rm -f "$OUT"
zip -qr "$OUT" manifest.json LICENSE src popup options icons
echo "$OUT"
