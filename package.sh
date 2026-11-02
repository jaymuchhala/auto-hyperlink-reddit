#!/bin/sh
# Builds the Chrome Web Store upload: only the files the extension runs on.
cd "$(dirname "$0")" || exit 1
version=$(sed -n 's/.*"version": "\(.*\)".*/\1/p' manifest.json)
mkdir -p dist
rm -f "dist/auto-hyperlink-reddit-$version.zip"
zip -q -X "dist/auto-hyperlink-reddit-$version.zip" manifest.json bridge.js link.js popup.html popup.js icons/16.png icons/48.png icons/128.png
echo "dist/auto-hyperlink-reddit-$version.zip"
