class_name BGField
extends Control
## Subtle animated backdrop: a drifting star-field with a faint vignette and a large
## translucent star motif. Cheap; respects reduced motion.

var _t := 0.0
var _stars: Array = []
var reduced := false
var accent := Palette.ACCENT

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	reduced = Game.settings.get("reduced_motion", false)
	var rng := RandomNumberGenerator.new()
	rng.seed = 99
	for i in 70:
		_stars.append({
			"uv": Vector2(rng.randf(), rng.randf()),
			"r": rng.randf_range(0.6, 2.0),
			"spd": rng.randf_range(0.005, 0.03),
			"ph": rng.randf() * TAU,
		})

func _process(delta: float) -> void:
	if reduced: return
	_t += delta
	queue_redraw()

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Palette.BG)
	# top glow
	var glow := accent; glow.a = 0.06
	draw_circle(Vector2(size.x * 0.5, -120), 520, glow)
	# stars
	for s in _stars:
		var y: float = fmod(s["uv"].y + (_t * s["spd"] if not reduced else 0.0), 1.0)
		var p := Vector2(s["uv"].x * size.x, y * size.y)
		var tw := 0.6 + 0.4 * sin(_t * 2.0 + s["ph"]) if not reduced else 0.8
		var c := Palette.INK; c.a = 0.10 * tw
		draw_circle(p, s["r"], c)
	# big faint star motif bottom-right
	_draw_star(Vector2(size.x * 0.86, size.y * 0.82), 220, Color(Palette.ACCENT.r, Palette.ACCENT.g, Palette.ACCENT.b, 0.03))

func _draw_star(center: Vector2, radius: float, color: Color) -> void:
	var pts: PackedVector2Array = []
	for i in 10:
		var a := -PI/2 + TAU * i / 10.0
		var r := radius if i % 2 == 0 else radius * 0.42
		pts.append(center + Vector2(cos(a) * r, sin(a) * r))
	draw_colored_polygon(pts, color)
