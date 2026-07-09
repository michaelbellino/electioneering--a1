/*
 * Dependency-free icon generator. Renders the Campaign Trail brand star
 * (amber on midnight) to build/icon.png at 512x512 using only Node's zlib —
 * no native modules, ImageMagick, or canvas required. electron-builder uses
 * this PNG for Linux directly and derives the Windows .ico / macOS .icns.
 *
 *   node tools/gen-icon.js
 */
'use strict';
var fs = require('fs');
var path = require('path');
var zlib = require('zlib');

var SIZE = 512;
var BG = [10, 14, 39];        // --bg-midnight #0A0E27
var STAR = [245, 158, 11];    // --color-accent #F59E0B
var RING = [217, 119, 6];     // --color-accent-deep #D97706

// Brand star polygon (matches the CSS clip-path), coords in a 0..100 space.
var STAR_PTS = [[50, 0], [61, 35], [98, 35], [68, 57], [79, 91], [50, 70], [21, 91], [32, 57], [2, 35], [39, 35]];
var SCALE = (SIZE * 0.74) / 100;
var OX = SIZE / 2 - 50 * SCALE;
var OY = SIZE / 2 - 45.5 * SCALE;
var POLY = STAR_PTS.map(function (p) { return [OX + p[0] * SCALE, OY + p[1] * SCALE]; });

function inPoly(x, y) {
  var inside = false, n = POLY.length, j = n - 1;
  for (var i = 0; i < n; i++) {
    var xi = POLY[i][0], yi = POLY[i][1], xj = POLY[j][0], yj = POLY[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    j = i;
  }
  return inside;
}

function blend(dst, src, a) { for (var k = 0; k < 3; k++) dst[k] = Math.round(dst[k] * (1 - a) + src[k] * a); }

// raw RGBA scanlines, each prefixed with a 0 (no filter) byte
var raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
var cx = SIZE / 2, cy = SIZE / 2;
var ringInner = SIZE * 0.455, ringOuter = SIZE * 0.475;
for (var y = 0; y < SIZE; y++) {
  var rowOff = y * (SIZE * 4 + 1);
  raw[rowOff] = 0;
  for (var x = 0; x < SIZE; x++) {
    var px = [BG[0], BG[1], BG[2]];
    // anti-aliased star coverage via 4x4 supersampling
    var hits = 0;
    for (var sy = 0; sy < 4; sy++) for (var sx = 0; sx < 4; sx++) {
      if (inPoly(x + (sx + 0.5) / 4, y + (sy + 0.5) / 4)) hits++;
    }
    if (hits) blend(px, STAR, hits / 16);
    // subtle accent ring
    var d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
    if (d >= ringInner && d <= ringOuter) {
      var edge = 1 - Math.min(Math.abs(d - (ringInner + ringOuter) / 2) / ((ringOuter - ringInner) / 2), 1);
      blend(px, RING, 0.5 * edge);
    }
    var o = rowOff + 1 + x * 4;
    raw[o] = px[0]; raw[o + 1] = px[1]; raw[o + 2] = px[2]; raw[o + 3] = 255;
  }
}

// ---- PNG container ----
var CRC_TABLE = (function () {
  var t = new Array(256);
  for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) {
  var c = 0xFFFFFFFF;
  for (var i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  var len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  var typeBuf = Buffer.from(type, 'ascii');
  var body = Buffer.concat([typeBuf, data]);
  var crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
var ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
var png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
]);

var outDir = path.join(__dirname, '..', 'build');
fs.mkdirSync(outDir, { recursive: true });
var out = path.join(outDir, 'icon.png');
fs.writeFileSync(out, png);
console.log('wrote ' + out + ' (' + SIZE + 'x' + SIZE + ', ' + png.length + ' bytes)');
