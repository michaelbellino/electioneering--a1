class_name Portrait
extends Control
## Procedural candidate portrait. Vector-drawn in layers (back hair → head → face →
## front hair) so hair reads as a real hairline rather than a blob. Deterministic
## from a feature dictionary; fully customizable in the creator.

var features: Dictionary = {}
var party := "I"
var _t := 0.0

const SKINS := ["f6d5bd", "f2c9a0", "e0a878", "c68642", "9c6644", "6f4322"]
const HAIRS := ["1a1a1a", "2b2b2b", "4a3728", "6b4a2f", "8a6a3a", "c9a227", "d9c3a0", "b0b0b0", "e8e8e8", "8c3b2a"]
const SUITS := ["1b2a3f", "23303f", "34304a", "2f2f36", "2c3f36", "3d2f2f"]
const TIES  := ["4aa3ff", "ff6b6b", "f5c451", "3ecf94", "b388ff", "e8edf4"]

const HAIR_STYLES := 7
const HAIR_NAMES := ["Short crop", "Side part", "Curls", "Long", "Receding", "Bun", "Buzz"]
const FACIAL_STYLES := 4
const FACIAL_NAMES := ["Clean-shaven", "Stubble", "Mustache", "Beard"]

static func make_features(rng: RandomNumberGenerator) -> Dictionary:
	return {
		"skin": SKINS[rng.randi() % SKINS.size()],
		"hairStyle": rng.randi() % HAIR_STYLES,
		"hairColor": HAIRS[rng.randi() % HAIRS.size()],
		"brow": rng.randi() % 3,
		"eyeColor": ["3b2b1d", "2f4f6f", "3f6b4f", "5a4632"][rng.randi() % 4],
		"suit": SUITS[rng.randi() % SUITS.size()],
		"tie": TIES[rng.randi() % TIES.size()],
		"glasses": rng.randi() % 4 == 0,
		"facial": (rng.randi() % FACIAL_STYLES) if rng.randf() < 0.4 else 0,
		"smile": rng.randf_range(0.35, 1.0),
		"jaw": rng.randf_range(0.9, 1.1),
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
	return Color(str(features.get(key, fallback)))

# --- geometry helpers -------------------------------------------------------

## Point on the head outline at angle a (egg shape: narrower, softly pointed jaw).
func _head_pt(c: Vector2, hw: float, hh: float, a: float, scale := 1.0) -> Vector2:
	var s := sin(a)                      # +1 = down (screen coords)
	var taper: float = 1.0 - 0.16 * maxf(s, 0.0)   # narrow the jaw
	var chin: float = 1.0 + 0.05 * maxf(s, 0.0)    # slightly longer chin
	return c + Vector2(cos(a) * hw * taper * scale, s * hh * chin * scale)

func _head_poly(c: Vector2, hw: float, hh: float, scale := 1.0) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for i in 44:
		pts.append(_head_pt(c, hw, hh, TAU * i / 44.0, scale))
	return pts

## Fill an arbitrary (possibly CONCAVE) polygon. draw_colored_polygon only handles
## convex shapes reliably, so triangulate first — hair caps and beards are crescents.
func _fill(pts: PackedVector2Array, col: Color) -> void:
	if pts.size() < 3:
		return
	var idx := Geometry2D.triangulate_polygon(pts)
	if idx.is_empty():
		draw_colored_polygon(pts, col)
		return
	var i := 0
	while i + 2 < idx.size():
		draw_colored_polygon(PackedVector2Array([pts[idx[i]], pts[idx[i + 1]], pts[idx[i + 2]]]), col)
		i += 3

## Fill the region between two matched curves as a strip of quads. Robust for the
## crescent shapes (hair caps, beards) that ear-clipping triangulation chokes on.
func _band(outer: PackedVector2Array, inner: PackedVector2Array, col: Color) -> void:
	var n: int = mini(outer.size(), inner.size())
	for i in range(n - 1):
		draw_colored_polygon(PackedVector2Array([outer[i], outer[i + 1], inner[i + 1]]), col)
		draw_colored_polygon(PackedVector2Array([outer[i], inner[i + 1], inner[i]]), col)

func _ellipse(center: Vector2, rx: float, ry: float) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for i in 30:
		var a := TAU * i / 30.0
		pts.append(center + Vector2(cos(a) * rx, sin(a) * ry))
	return pts

# --- draw -------------------------------------------------------------------

func _draw() -> void:
	if features.is_empty():
		return
	var s: float = minf(size.x, size.y)
	var c := size * 0.5
	if not Game.settings.get("reduced_motion", false):
		c.y += sin(_t * 1.5) * s * 0.005     # gentle breathing
	c.y -= s * 0.04

	var skin := _c("skin", "f2c9a0")
	var hair := _c("hairColor", "2b2b2b")
	var jaw: float = float(features.get("jaw", 1.0))
	var hw: float = s * 0.185 * jaw
	var hh: float = s * 0.225

	# backdrop: party-tinted vignette
	var halo := Palette.party_color(party)
	var hc := halo; hc.a = 0.10
	draw_circle(c + Vector2(0, s * 0.02), s * 0.42, Color("ffffff"))
	draw_circle(c + Vector2(0, s * 0.02), s * 0.42, hc)
	var ring := halo.lerp(Palette.BORDER, 0.30); ring.a = 0.75
	draw_arc(c + Vector2(0, s * 0.02), s * 0.42, 0, TAU, 64, ring, 2.0, true)

	var style: int = int(features.get("hairStyle", 0))

	# 1) back hair (behind everything)
	_draw_back_hair(c, hw, hh, s, style, hair)

	# 2) shoulders / suit
	_draw_body(c, s, hw)

	# 3) neck (jaw → collar), slightly shaded
	_fill(PackedVector2Array([
		c + Vector2(-hw * 0.40, hh * 0.50),
		c + Vector2(hw * 0.40, hh * 0.50),
		c + Vector2(hw * 0.46, s * 0.28),
		c + Vector2(-hw * 0.46, s * 0.28)]), skin.darkened(0.13))

	# 4) head
	draw_colored_polygon(_head_poly(c, hw, hh), skin)
	# ears
	_fill(_ellipse(c + Vector2(-hw * 0.99, hh * 0.05), s * 0.028, s * 0.042), skin.darkened(0.05))
	_fill(_ellipse(c + Vector2(hw * 0.99, hh * 0.05), s * 0.028, s * 0.042), skin.darkened(0.05))
	# soft cheek warmth
	var blush := Color("d98b7a"); blush.a = 0.16
	_fill(_ellipse(c + Vector2(-hw * 0.52, hh * 0.28), s * 0.045, s * 0.028), blush)
	_fill(_ellipse(c + Vector2(hw * 0.52, hh * 0.28), s * 0.045, s * 0.028), blush)
	# jaw shading
	var shade := skin.darkened(0.10); shade.a = 0.55
	_fill(_ellipse(c + Vector2(0, hh * 0.62), hw * 0.55, hh * 0.16), shade)

	# 5) face
	_draw_face(c, hw, hh, s, skin, hair)

	# 6) facial hair (over skin, under front hair)
	_draw_facial(c, hw, hh, s, hair)

	# 7) front hair (the hairline)
	_draw_hair(c, hw, hh, s, style, hair)

	# 8) glasses last
	if bool(features.get("glasses", false)):
		_draw_glasses(c, hw, hh, s)

func _draw_body(c: Vector2, s: float, hw: float) -> void:
	var suit := _c("suit", "23303f")
	var top := c.y + s * 0.24
	# shoulders as a wide rounded trapezoid
	var pts := PackedVector2Array()
	var half := s * 0.36
	pts.append(Vector2(c.x - half, size.y))
	pts.append(Vector2(c.x - half * 0.92, top + s * 0.06))
	pts.append(Vector2(c.x - hw * 0.75, top))
	pts.append(Vector2(c.x + hw * 0.75, top))
	pts.append(Vector2(c.x + half * 0.92, top + s * 0.06))
	pts.append(Vector2(c.x + half, size.y))
	draw_colored_polygon(pts, suit)
	# lapels
	var shirt := Color("eef2f7")
	_fill(PackedVector2Array([
		c + Vector2(-hw * 0.72, s * 0.24), c + Vector2(0, s * 0.40),
		c + Vector2(hw * 0.72, s * 0.24), c + Vector2(0, s * 0.30)]), shirt)
	# lapels
	_fill(PackedVector2Array([
		c + Vector2(-hw * 0.78, s * 0.245), c + Vector2(-hw * 0.14, s * 0.345),
		c + Vector2(-hw * 0.34, s * 0.56), c + Vector2(-s * 0.30, s * 0.60),
		c + Vector2(-hw * 1.05, s * 0.30)]), suit.lightened(0.07))
	_fill(PackedVector2Array([
		c + Vector2(hw * 0.78, s * 0.245), c + Vector2(hw * 0.14, s * 0.345),
		c + Vector2(hw * 0.34, s * 0.56), c + Vector2(s * 0.30, s * 0.60),
		c + Vector2(hw * 1.05, s * 0.30)]), suit.lightened(0.07))
	# tie: knot + blade
	var tie := _c("tie", "4aa3ff")
	_fill(PackedVector2Array([
		c + Vector2(-hw * 0.14, s * 0.305), c + Vector2(hw * 0.14, s * 0.305),
		c + Vector2(hw * 0.10, s * 0.365), c + Vector2(-hw * 0.10, s * 0.365)]), tie.darkened(0.18))
	_fill(PackedVector2Array([
		c + Vector2(-hw * 0.10, s * 0.365), c + Vector2(hw * 0.10, s * 0.365),
		c + Vector2(hw * 0.20, s * 0.60), c + Vector2(0, s * 0.66),
		c + Vector2(-hw * 0.20, s * 0.60)]), tie)

func _draw_face(c: Vector2, hw: float, hh: float, s: float, skin: Color, hair: Color) -> void:
	var eye_y := c.y - hh * 0.02
	var ex := hw * 0.44
	var eye_rx := s * 0.040
	var eye_ry := s * 0.024
	var iris := _c("eyeColor", "3b2b1d")

	for sgn in [-1.0, 1.0]:
		var ec := Vector2(c.x + sgn * ex, eye_y)
		# eye white
		_fill(_ellipse(ec, eye_rx, eye_ry), Color("fbfdff"))
		# iris + pupil + highlight
		_fill(_ellipse(ec + Vector2(sgn * s * 0.003, 0), s * 0.019, s * 0.019), iris)
		draw_circle(ec + Vector2(sgn * s * 0.003, 0), s * 0.009, Color("14100c"))
		draw_circle(ec + Vector2(sgn * s * 0.003 - s * 0.006, -s * 0.006), s * 0.005, Color(1, 1, 1, 0.9))
		# upper lid line
		var lid := PackedVector2Array()
		for i in 11:
			var t := float(i) / 10.0
			lid.append(ec + Vector2(lerpf(-eye_rx, eye_rx, t), -eye_ry * sin(t * PI) - eye_ry * 0.15))
		draw_polyline(lid, skin.darkened(0.45), maxf(1.5, s * 0.006), true)

	# brows
	var brow_t: int = int(features.get("brow", 1))
	var brow_y := eye_y - s * 0.055
	for sgn in [-1.0, 1.0]:
		var bx: float = c.x + sgn * ex
		var tilt: float = [0.0, -s * 0.008, s * 0.010][brow_t]
		var inner := Vector2(bx - sgn * s * 0.036, brow_y + tilt)
		var outer := Vector2(bx + sgn * s * 0.038, brow_y - tilt * 0.4 - s * 0.004)
		var mid := (inner + outer) * 0.5 + Vector2(0, -s * 0.010)
		var brow := PackedVector2Array()
		for i in 9:
			var t := float(i) / 8.0
			brow.append(inner.lerp(mid, t).lerp(mid.lerp(outer, t), t))
		draw_polyline(brow, hair.darkened(0.1), maxf(2.0, s * 0.014), true)

	# nose: soft shadow + nostril hint
	var nose_tip := c.y + hh * 0.22
	var nsh := skin.darkened(0.16); nsh.a = 0.75
	_fill(PackedVector2Array([
		Vector2(c.x - s * 0.018, nose_tip), Vector2(c.x + s * 0.018, nose_tip),
		Vector2(c.x + s * 0.010, nose_tip - s * 0.055), Vector2(c.x - s * 0.010, nose_tip - s * 0.055)]), nsh)
	_fill(_ellipse(Vector2(c.x, nose_tip), s * 0.022, s * 0.012), skin.lightened(0.06))

	# mouth
	var smile: float = float(features.get("smile", 0.6))
	var my := c.y + hh * 0.46
	var mw := hw * 0.42
	var lip := Color("a85c52")
	var mouth := PackedVector2Array()
	for i in 15:
		var t := float(i) / 14.0
		mouth.append(Vector2(c.x + lerpf(-mw, mw, t), my + sin(t * PI) * s * 0.026 * smile))
	draw_polyline(mouth, lip, maxf(2.0, s * 0.011), true)
	# lower lip highlight
	var lower := PackedVector2Array()
	for i in 11:
		var t := float(i) / 10.0
		lower.append(Vector2(c.x + lerpf(-mw * 0.8, mw * 0.8, t), my + s * 0.018 + sin(t * PI) * s * 0.020 * smile))
	draw_polyline(lower, lip.lightened(0.35), maxf(1.5, s * 0.007), true)

func _draw_glasses(c: Vector2, hw: float, hh: float, s: float) -> void:
	var eye_y := c.y - hh * 0.02
	var ex := hw * 0.44
	var frame := Color("20252e")
	var w := maxf(2.0, s * 0.009)
	for sgn in [-1.0, 1.0]:
		var ec := Vector2(c.x + sgn * ex, eye_y)
		var lens := _ellipse(ec, s * 0.058, s * 0.046)
		var glint := Color(0.75, 0.86, 1.0, 0.10)
		draw_colored_polygon(lens, glint)
		draw_polyline(lens + PackedVector2Array([lens[0]]), frame, w, true)
	draw_line(Vector2(c.x - ex + s * 0.058, eye_y), Vector2(c.x + ex - s * 0.058, eye_y), frame, w)
	draw_line(Vector2(c.x - ex - s * 0.058, eye_y), Vector2(c.x - hw * 1.0, eye_y - s * 0.01), frame, w)
	draw_line(Vector2(c.x + ex + s * 0.058, eye_y), Vector2(c.x + hw * 1.0, eye_y - s * 0.01), frame, w)

func _draw_facial(c: Vector2, hw: float, hh: float, s: float, hair: Color) -> void:
	var f: int = int(features.get("facial", 0))
	if f == 0:
		return
	var my := c.y + hh * 0.46
	if f == 1: # stubble — soft shadow over jaw
		var st := hair; st.a = 0.22
		_fill(_ellipse(c + Vector2(0, hh * 0.52), hw * 0.80, hh * 0.34), st)
	elif f == 2: # mustache
		_fill(_ellipse(c + Vector2(0, my - s * 0.026), hw * 0.34, s * 0.020), hair)
	else: # full beard — a band from the jawline up to the cheek line
		var outer := PackedVector2Array()
		var inner := PackedVector2Array()
		var n := 26
		for i in n + 1:
			var t := float(i) / n
			var a := lerpf(0.0, PI, t)                  # right ear → under chin → left ear
			var p := _head_pt(c, hw, hh, a, 1.0)
			outer.append(_head_pt(c, hw, hh, a, 1.03))
			var u := cos(a)                              # +1 right … -1 left
			var top_y := c.y + hh * (0.02 + 0.30 * (1.0 - u * u))
			inner.append(Vector2(p.x, minf(p.y, top_y)))
		_band(outer, inner, hair)
		_fill(_ellipse(c + Vector2(0, my - s * 0.028), hw * 0.32, s * 0.018), hair)

# --- hair -------------------------------------------------------------------

func _draw_back_hair(c: Vector2, hw: float, hh: float, s: float, style: int, hair: Color) -> void:
	match style:
		3: # long — falls behind the shoulders
			var back := hair.darkened(0.12)
			_fill(PackedVector2Array([
				c + Vector2(-hw * 1.16, -hh * 0.35), c + Vector2(hw * 1.16, -hh * 0.35),
				c + Vector2(hw * 1.28, hh * 1.35), c + Vector2(hw * 0.55, hh * 1.15),
				c + Vector2(-hw * 0.55, hh * 1.15), c + Vector2(-hw * 1.28, hh * 1.35)]), back)
		5: # bun
			_fill(_ellipse(c + Vector2(0, -hh * 1.12), s * 0.058, s * 0.052), hair.darkened(0.08))
		2: # curls have volume behind too
			_fill(_ellipse(c + Vector2(0, -hh * 0.18), hw * 1.24, hh * 1.06), hair.darkened(0.10))

## The front hair: an outer skull-following arc closed by a real HAIRLINE.
func _draw_hair(c: Vector2, hw: float, hh: float, s: float, style: int, hair: Color) -> void:
	var puff := 1.05
	var hairline := 0.42      # fraction of head height above centre
	var arch := 0.030          # + = dips low in the middle (widow's peak)
	var tilt := 0.0            # asymmetric sweep (side part)
	var recess := 0.0          # temples pulled up (receding)
	match style:
		0: puff = 1.05; hairline = 0.46; arch = 0.030
		1: puff = 1.09; hairline = 0.44; arch = 0.022; tilt = 0.10
		2: puff = 1.22; hairline = 0.44; arch = 0.030
		3: puff = 1.08; hairline = 0.46; arch = 0.026
		4: puff = 1.04; hairline = 0.30; arch = 0.040; recess = 0.16
		5: puff = 1.06; hairline = 0.46; arch = 0.020; tilt = 0.05
		6: puff = 1.02; hairline = 0.50; arch = 0.020

	# Build the cap as a BAND between the puffed scalp (outer) and the hairline
	# (inner). Matched sampling → always well-formed quads, unlike a crescent
	# polygon, which ear-clipping triangulation refuses to fill.
	var outer := PackedVector2Array()
	var inner := PackedVector2Array()
	var steps := 34
	for i in steps + 1:
		var t := float(i) / steps
		var a := PI + PI * t                             # left → over the top → right
		var bump := 1.0
		if style == 2:
			bump = 1.0 + 0.055 * sin(t * TAU * 3.5)      # curl silhouette
		outer.append(_head_pt(c, hw, hh, a, puff * bump))
		var p := _head_pt(c, hw, hh, a, 1.0)
		var u := cos(a)                                   # −1 left … +1 right
		var hy := c.y - hh * hairline
		hy += arch * hh * (1.0 - u * u)                   # arch / widow's peak
		hy -= recess * hh * pow(absf(u), 2.2)             # receding temples
		hy += tilt * hh * u                               # side sweep
		inner.append(Vector2(p.x, maxf(p.y, hy)))         # clamp to the hairline
	_band(outer, inner, hair)

	# sideburns
	if style != 4 and style != 6:
		for sgn in [-1.0, 1.0]:
			_fill(PackedVector2Array([
				c + Vector2(sgn * hw * 0.99, -hh * 0.10),
				c + Vector2(sgn * hw * 1.02, hh * 0.16),
				c + Vector2(sgn * hw * 0.86, hh * 0.14),
				c + Vector2(sgn * hw * 0.88, -hh * 0.10)]), hair.darkened(0.05))

	# a soft sheen so it doesn't read flat
	var sheen := hair.lightened(0.30); sheen.a = 0.35
	_fill(_ellipse(c + Vector2(-hw * 0.34, -hh * 0.74), hw * 0.30, hh * 0.12), sheen)

	# side part gets a visible parting line
	if style == 1:
		draw_line(c + Vector2(-hw * 0.30, -hh * 0.92), c + Vector2(-hw * 0.62, -hh * 0.34),
			hair.darkened(0.35), maxf(1.5, s * 0.007))
