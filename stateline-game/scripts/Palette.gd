extends Node
## Global visual language: colors, fonts, and a generated UI Theme.
## Autoloaded as `Palette`.

# --- Core palette (dark, cinematic newsroom) ---
const BG        := Color("070a11")
const BG2       := Color("0c1019")
const PANEL     := Color("121826")
const PANEL2    := Color("19202f")
const BORDER    := Color("243040")
const BORDER_HI := Color("3a465c")
const INK       := Color("eef3fa")
const MUTED     := Color("97a4b7")
const FAINT     := Color("64717f")

const ACCENT    := Color("4aa3ff")
const ACCENT2   := Color("2d7dd2")
const GOLD      := Color("f5c451")
const GOLD2     := Color("d99a2b")
const GOOD      := Color("3ecf94")
const WARN      := Color("f2b23e")
const BAD       := Color("ff7070")

# Party colors
const DEM := Color("4aa3ff")
const GOP := Color("ff6b6b")
const IND := Color("b388ff")

func party_color(p: String) -> Color:
	match p:
		"D": return DEM
		"R": return GOP
		_:   return IND

# Lean -1 (R) .. +1 (D) -> color ramp
func lean_color(lean: float) -> Color:
	var t: float = clampf((lean + 1.0) * 0.5, 0.0, 1.0)
	if t < 0.5:
		return GOP.lerp(Color("c9d3e0"), t * 2.0)
	return Color("c9d3e0").lerp(DEM, (t - 0.5) * 2.0)

# Fonts (uses bundled font if present, else engine default)
var font_ui: Font
var font_display: Font
var font_mono: Font

func _ready() -> void:
	font_ui = _load_font("res://assets/fonts/Inter.ttf")
	font_display = _load_font("res://assets/fonts/Domine.ttf")
	font_mono = _load_font("res://assets/fonts/JetBrainsMono.ttf")

func _load_font(path: String) -> Font:
	if ResourceLoader.exists(path):
		return load(path)
	return ThemeDB.fallback_font
