/*
 * Campaign Trail — Electron preload.
 *
 * Runs in an isolated context before the renderer loads. It exposes only a
 * tiny, read-only surface (app/runtime versions) over the context bridge —
 * no Node, no fs, no IPC the game doesn't need. The game itself is unchanged
 * and works identically from file://; this is purely informational.
 */
'use strict';
var bridge = require('electron').contextBridge;
var versions = process.versions;

try {
  bridge.exposeInMainWorld('campaignDesktop', {
    isDesktop: true,
    platform: process.platform,
    versions: {
      electron: versions.electron,
      chrome: versions.chrome,
      node: versions.node
    }
  });
} catch (e) {
  // contextBridge unavailable (e.g. non-isolated context) — the game runs fine without it.
}
