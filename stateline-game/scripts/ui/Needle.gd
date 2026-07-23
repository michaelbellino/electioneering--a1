class_name Needle
extends Control
## Election-night win-probability needle (a la a broadcast desk). Sweeps from
## GOP-red (left) to Dem-blue (right); jitters, then settles as returns come in.

var prob := 0.5           # player win probability 0..1
var _shown := 0.5
var jitter := 0.10        # shrinks as it "settles"
var _t := 0.0
var label_left := "OPP"
var label_right := "YOU"
var reduced := false

func _ready() -> void:
	reduced = Game.settings.get("reduced_motion", false)

func set_prob(p: float, settle := 0.10) -> void:
	prob = clampf(p, 0.01, 0.99)
	jitter = settle
	queue_redraw()

func _process(delta: float) -> void:
	_t += delta
	_shown = lerpf(_shown, prob, clampf(delta * 3.0, 0, 1))
	queue_redraw()

func _draw() -> void:
	var cx := size.x * 0.5
	var cy := size.y - 12
	var radius := minf(size.x * 0.42, size.y - 24)
	# arc segments colored
	var steps := 60
	for i in steps:
		var a0 := PI + PI * (float(i) / steps)
		var a1 := PI + PI * (float(i + 1) / steps)
		var frac := float(i) / steps
		var c := Palette.GOP.lerp(Palette.DEM, frac)
		var p0 := Vector2(cx + cos(a0) * radius, cy + sin(a0) * radius)
		var p1 := Vector2(cx + cos(a1) * radius, cy + sin(a1) * radius)
		draw_line(p0, p1, c, 10.0)
	# tick at 50
	var mid := Vector2(cx, cy - radius)
	draw_line(Vector2(cx, cy - radius + 6), Vector2(cx, cy - radius - 8), Palette.INK, 2.0)
	# needle
	var wob := 0.0 if reduced else sin(_t * 9.0) * jitter
	var val: float = clampf(_shown + wob, 0.02, 0.98)
	var ang := PI + PI * val
	var tip := Vector2(cx + cos(ang) * (radius - 6), cy + sin(ang) * (radius - 6))
	draw_line(Vector2(cx, cy), tip, Palette.INK, 3.0)
	draw_circle(Vector2(cx, cy), 8, Palette.PANEL2)
	draw_circle(Vector2(cx, cy), 8, Palette.INK, false, 2.0)
	# labels
	if Palette.font_ui:
		draw_string(Palette.font_ui, Vector2(cx - radius, cy + 4), label_left, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Palette.GOP)
		draw_string(Palette.font_ui, Vector2(cx + radius - 40, cy + 4), label_right, HORIZONTAL_ALIGNMENT_RIGHT, 40, 12, Palette.DEM)
	if Palette.font_display:
		var pct := "%d%%" % int(round(_shown * 100))
		draw_string(Palette.font_display, Vector2(cx - 40, cy - radius * 0.45), pct, HORIZONTAL_ALIGNMENT_CENTER, 80, 30, Palette.INK)
