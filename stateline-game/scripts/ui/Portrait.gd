class_name Portrait
extends Control
## A procedural candidate portrait built from a small feature dictionary, drawn with
## vector shapes. Deterministic from a seed; customizable in the creator.

var features: Dictionary = {}
var party := "I"
var _t := 0.0

const SKINS := ["f2c9a0", "e0a878", "c68642", "8d5524", "f7d7b8", "a86b3c"]
const HAIRS := ["2b2b2b", "5a3825", "8a6a3a", "c9c9c9", "d9b382", "1a1a1a", "6b3f2a"]
const SUITS := ["1b2a3f", "23303f", "3a2b3f", "2f2f36", "334a3a"]

static func make_features(rng: RandomNumberGenerator) -> Dictionary:
	return {
		"skin": SKINS[rng.randi() % SKINS.size()],
		"hairStyle": rng.randi() % 6,
		"hairColor": HAIRS[rng.randi() % HAIRS.size()],
		"brow": rng.randi() % 3,
		"eyes": rng.randi() % 3,
		"suit": SUITS[rng.randi() % SUITS.size()],
		"tie": ["4aa3ff", "ff6b6b", "f5c451", "3ecf94", "b388ff"][rng.randi() % 5],
		"glasses": rng.randi() % 3 == 0,
		"smile": rng.randf_range(0.2, 1.0),
		"jaw": rng.randf_range(0.85, 1.12),
	}

func set_features(f: Dictionary) -> void:
	features = f
	queue_redraw()

func set_party(p: String) -> void:
	party = p
	queue_redraw()

func _process(delta: float) -> void:
	if not Game.settings.get("reduced_motion", false):
		_t += delta
		queue_redraw()

func _c(key: String, fallback: String) -> Color:
	return Color(features.get(key, fallback))

func _draw() -> void:
	if features.is_empty():
		return
	var c := size * 0.5
	var s: float = minf(size.x, size.y)
	var bob := 0.0 if Game.settings.get("reduced_motion", false) else sin(_t * 1.6) * s * 0.006
	c.y += bob
	# background halo (party tint)
	var halo := Palette.party_color(party); halo.a = 0.15
	draw_circle(c, s * 0.46, halo)
	draw_arc(c, s * 0.46, 0, TAU, 48, Palette.party_color(party).lerp(Palette.BORDER, 0.4), 2.0, true)
	# shoulders / suit
	var suit := _c("suit", "23303f")
	var sh := Rect2(c.x - s * 0.34, c.y + s * 0.22, s * 0.68, s * 0.30)
	draw_rect(sh, suit)
	# collar + tie
	draw_colored_polygon(PackedVector2Array([
		c + Vector2(-s*0.10, s*0.20), c + Vector2(0, s*0.30), c + Vector2(s*0.10, s*0.20),
		c + Vector2(0, s*0.24)]), Color("e8edf4"))
	draw_colored_polygon(PackedVector2Array([
		c + Vector2(-s*0.03, s*0.24), c + Vector2(s*0.03, s*0.24),
		c + Vector2(s*0.05, s*0.46), c + Vector2(0, s*0.50), c + Vector2(-s*0.05, s*0.46)]), _c("tie", "4aa3ff"))
	# neck
	draw_rect(Rect2(c.x - s*0.07, c.y + s*0.10, s*0.14, s*0.16), _c("skin","f2c9a0").darkened(0.08))
	# head
	var jaw: float = features.get("jaw", 1.0)
	var hw := s * 0.20 * jaw
	var hh := s * 0.24
	_draw_ellipse(c + Vector2(0, -s*0.02), hw, hh, _c("skin", "f2c9a0"))
	# ears
	draw_circle(c + Vector2(-hw, -s*0.01), s*0.03, _c("skin","f2c9a0"))
	draw_circle(c + Vector2(hw, -s*0.01), s*0.03, _c("skin","f2c9a0"))
	# hair
	_draw_hair(c, hw, hh, s)
	# eyes
	var ey := c.y - s*0.03
	var ex := s*0.085
	var eye_open := 0.028 * s
	for sgn in [-1, 1]:
		var ec := Vector2(c.x + sgn*ex, ey)
		_draw_ellipse(ec, s*0.035, eye_open, Color("ffffff"))
		draw_circle(ec, s*0.016, Color("2a2f3a"))
	# brows
	var brow_y := ey - s*0.055
	var brow_t: int = features.get("brow", 1)
	for sgn in [-1, 1]:
		var bx: float = c.x + sgn*ex
		var lift: float = [0.0, -s*0.006, s*0.006][brow_t]
		draw_line(Vector2(bx - s*0.03, brow_y + lift), Vector2(bx + s*0.03, brow_y - lift*0.5), _c("hairColor","2b2b2b"), 3.0)
	# nose
	draw_line(c + Vector2(0, -s*0.01), c + Vector2(-s*0.02, s*0.045), _c("skin","f2c9a0").darkened(0.2), 2.0)
	# mouth (smile amount)
	var smile: float = features.get("smile", 0.6)
	var my := c.y + s*0.10
	var mouth: PackedVector2Array = []
	for i in 11:
		var tt := float(i)/10.0
		var x := c.x + lerpf(-s*0.06, s*0.06, tt)
		var y := my + sin(tt*PI) * s*0.03 * smile
		mouth.append(Vector2(x, y))
	draw_polyline(mouth, Color("9c5a4f"), 2.5, true)
	# glasses
	if features.get("glasses", false):
		for sgn in [-1, 1]:
			var ec := Vector2(c.x + sgn*ex, ey)
			draw_arc(ec, s*0.045, 0, TAU, 24, Palette.INK, 2.0, true)
		draw_line(Vector2(c.x - ex + s*0.045, ey), Vector2(c.x + ex - s*0.045, ey), Palette.INK, 2.0)

func _draw_hair(c: Vector2, hw: float, hh: float, s: float) -> void:
	var col := _c("hairColor", "2b2b2b")
	var style: int = features.get("hairStyle", 0)
	var top := c + Vector2(0, -s*0.02 - hh)
	match style:
		0: # short
			_draw_ellipse(c + Vector2(0, -s*0.11), hw*1.06, hh*0.62, col)
		1: # side part
			_draw_ellipse(c + Vector2(0, -s*0.11), hw*1.08, hh*0.66, col)
			draw_rect(Rect2(c.x - hw*1.05, c.y - s*0.11, hw*0.5, hh*0.5), col)
		2: # curly (dots)
			for i in 14:
				var a := TAU * i / 14.0
				draw_circle(c + Vector2(cos(a)*hw*1.0, -s*0.06 + sin(a)*hh*0.5), s*0.03, col)
		3: # long
			draw_rect(Rect2(c.x - hw*1.05, c.y - s*0.10, hw*2.1, hh*1.3), col)
			_draw_ellipse(c + Vector2(0, -s*0.02), hw*1.02, hh*1.0, _c("skin","f2c9a0"))
			_draw_ellipse(c + Vector2(0, -s*0.12), hw*1.08, hh*0.6, col)
		4: # bald-ish
			_draw_ellipse(c + Vector2(0, -s*0.13), hw*1.0, hh*0.32, col)
		_:
			_draw_ellipse(c + Vector2(0, -s*0.11), hw*1.04, hh*0.6, col)

func _draw_ellipse(center: Vector2, rx: float, ry: float, color: Color) -> void:
	var pts: PackedVector2Array = []
	for i in 28:
		var a := TAU * i / 28.0
		pts.append(center + Vector2(cos(a) * rx, sin(a) * ry))
	draw_colored_polygon(pts, color)
