/*
 * Campaign Trail — Electron main process.
 *
 * Thin desktop shell around the EXACT same web assets the game runs from
 * file:// — no bundling, no transforms. The renderer stays a sandboxed,
 * context-isolated window with Node integration OFF (the game never needs
 * Node in the renderer); a tiny preload exposes only the app version.
 *
 * This file is the desktop entry point ("main" in package.json). It is wholly
 * separate from the renderer bootstrap (src/main.js), preserving the
 * engine/UI separation: nothing here knows the game rules.
 */
'use strict';
var electron = require('electron');
var app = electron.app;
var BrowserWindow = electron.BrowserWindow;
var Menu = electron.Menu;
var shell = electron.shell;
var path = require('path');

var mainWindow = null;
var isDev = process.argv.indexOf('--dev') !== -1;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0A0E27',          // midnight — no white flash on load
    title: 'Campaign Trail: Road to 270',
    autoHideMenuBar: true,                // immersive; Alt reveals the menu
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));

  // Avoid a flash of unstyled/empty window: show once painted.
  mainWindow.once('ready-to-show', function () { mainWindow.show(); });
  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });

  // Open any external links in the user's browser, never in-app.
  mainWindow.webContents.setWindowOpenHandler(function (details) {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // Defense-in-depth: the app never navigates away from its bundled index.html.
  // Block any top-level navigation to a different document (and open it in the
  // system browser if it's external) so a regression can't load remote content.
  mainWindow.webContents.on('will-navigate', function (event, url) {
    if (url !== mainWindow.webContents.getURL()) {
      event.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });
  mainWindow.webContents.on('will-attach-webview', function (event) { event.preventDefault(); });

  mainWindow.on('closed', function () { mainWindow = null; });
}

// Apply a Content-Security-Policy to every response the renderer receives.
// The game is fully self-contained (self-hosted fonts, local scripts), so the
// policy is strict: only same-origin scripts, no remote connections, no plugins.
// 'unsafe-inline' is needed for style ATTRIBUTES (the UI sets element.style and
// inline widths); scripts stay 'self' only, so HTML-injection can't execute JS.
function applyCsp() {
  var ses = electron.session.defaultSession;
  ses.webRequest.onHeadersReceived(function (details, callback) {
    var headers = details.responseHeaders || {};
    headers['Content-Security-Policy'] = [
      "default-src 'self'; " +
      "script-src 'self'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data:; " +
      "font-src 'self'; " +
      "connect-src 'self'; " +
      "object-src 'none'; base-uri 'none'; frame-src 'none'"
    ];
    callback({ responseHeaders: headers });
  });
}

function buildMenu() {
  var isMac = process.platform === 'darwin';
  var template = [];
  if (isMac) template.push({ role: 'appMenu' });
  template.push({
    label: 'Game',
    submenu: [
      { label: 'Reload (new session)', accelerator: 'CmdOrCtrl+R', click: function () { if (mainWindow) mainWindow.reload(); } },
      { type: 'separator' },
      isMac ? { role: 'close' } : { role: 'quit' }
    ]
  });
  template.push({
    label: 'View',
    submenu: [
      { role: 'togglefullscreen' },
      { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'toggleDevTools' }
    ]
  });
  template.push({
    role: 'help',
    submenu: [
      {
        label: 'About Campaign Trail',
        click: function () {
          var dialog = electron.dialog;
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Campaign Trail: Road to 270',
            message: 'Campaign Trail: Road to 270',
            detail: 'A turn-based election-campaign strategy game.\nVersion ' + app.getVersion() + '\nElectron ' + process.versions.electron + ' · Chromium ' + process.versions.chrome
          });
        }
      }
    ]
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Single-instance: focus the existing window instead of opening a second.
var gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', function () {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
  });

  app.whenReady().then(function () {
    applyCsp();
    buildMenu();
    createWindow();
    app.on('activate', function () { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });

  app.on('window-all-closed', function () { if (process.platform !== 'darwin') app.quit(); });
}
