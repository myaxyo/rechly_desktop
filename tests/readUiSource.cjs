"use strict";

const fs = require("node:fs");
const path = require("node:path");

const uiDir = path.join(__dirname, "../ui");

/**
 * Source of the shipped renderer: ui/index.html plus every local script it loads.
 * Feature hooks live in those scripts (app.js and the feature modules). Scanning
 * only index.html misses them after the UI was split out of the HTML file.
 */
function readLoadedUiSource() {
  const html = fs.readFileSync(path.join(uiDir, "index.html"), "utf8");
  const sources = [html];
  const seen = new Set();
  const scriptRe = /<script\b[^>]*\bsrc="([^"]+)"[^>]*>/gi;
  for (const match of html.matchAll(scriptRe)) {
    const src = match[1];
    if (/^(?:[a-z]+:)?\/\//i.test(src)) continue;
    const file = path.resolve(uiDir, src);
    const relative = path.relative(uiDir, file);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`ui/index.html script escapes the ui directory: ${src}`);
    }
    if (seen.has(file)) continue;
    seen.add(file);
    sources.push(fs.readFileSync(file, "utf8"));
  }
  if (!seen.has(path.resolve(uiDir, "app.js"))) {
    throw new Error("ui/index.html must load app.js");
  }
  return sources.join("\n");
}

module.exports = { readLoadedUiSource };
