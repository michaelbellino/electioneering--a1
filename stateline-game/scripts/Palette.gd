extends Node
## VISUAL IDENTITY — bright, friendly, campaign-poster energy.
##
## Goal: a casual game you'd happily pick up, not a dark analytics dashboard and
## not a precious design object. Light warm ground, confident patriotic colour,
## punchy condensed headlines, chunky tactile controls. Character comes from the
## type and the colour, so the layout itself can stay plain and readable.
##
## Token names are unchanged from the previous theme so every screen inherits the
## new look automatically.

# ── Ground ───────────────────────────────────────────────────────────────
const BG        := Color("f5efe3")   # warm paper
const BG2       := Color("e8dfcd")   # recessed: wells, slider tracks, insets
const PANEL     := Color("fffaf0")   # a card sitting on the table
const PANEL2    := Color("efe6d4")   # a pressed / secondary control
const BORDER    := Color("d8cbb2")
const BORDER_HI := Color("b9a684")

# ── Text ─────────────────────────────────────────────────────────────────
const INK       := Color("1b2a41")   # headings and body
const MUTED     := Color("55637d")   # secondary
const FAINT     := Color("8b93a3")   # captions

# ── Colour ───────────────────────────────────────────────────────────────
const ACCENT    := Color("2f6fd0")   # the friendly campaign blue
const ACCENT2   := Color("2359ab")
const GOLD      := Color("e0a32e")   # sunny highlight — money, stars, AP
const GOLD2     := Color("b9821c")
const GOOD      := Color("2e9e6b")
const WARN      := Color("e08b28")
const BAD       := Color("d94141")

const DEM := Color("2f6fd0")
const GOP := Color("d94141")
const IND := Color("7b52c4")

# ── Type ─────────────────────────────────────────────────────────────────
## display = Oswald   — condensed poster caps for headings and big numbers
## ui      = Public Sans — the US government's open typeface; plain and legible
## mono    = Courier Prime — used only where digits need to line up (money, tallies)
var font_ui: Font
var font_ui_bold: Font
var font_display: Font
var font_mono: Font
var font_mono_bold: Font

var tex_halftone: Texture2D          # portrait shading only

func _ready() -> void:
	font_ui        = _font("res://assets/fonts/PublicSans-Regular.ttf")
	font_ui_bold   = _font("res://assets/fonts/PublicSans-SemiBold.ttf")
	font_display   = _font("res://assets/fonts/Oswald-Bold.ttf")
	font_mono      = _font("res://assets/fonts/CourierPrime-Regular.ttf")
	font_mono_bold = _font("res://assets/fonts/CourierPrime-Bold.ttf")
	tex_halftone   = _tex("res://assets/tex/halftone.png")

func _font(path: String) -> Font:
	if ResourceLoader.exists(path):
		return load(path)
	return ThemeDB.fallback_font

func _tex(path: String) -> Texture2D:
	if ResourceLoader.exists(path):
		return load(path)
	return null

# ── Helpers ──────────────────────────────────────────────────────────────
func party_color(p: String) -> Color:
	match p:
		"D": return DEM
		"R": return GOP
		_:   return IND

## Lean −1 (R) .. +1 (D) → red ▸ neutral ▸ blue.
func lean_color(lean: float) -> Color:
	var t: float = clampf((lean + 1.0) * 0.5, 0.0, 1.0)
	var neutral := Color("d9d2c2")
	if t < 0.5:
		return GOP.lerp(neutral, t * 2.0)
	return neutral.lerp(DEM, (t - 0.5) * 2.0)

## Tint a colour toward the page — used for soft fills on a light ground.
func wash(c: Color, amount: float) -> Color:
	return BG.lerp(c, clampf(amount, 0.0, 1.0))
