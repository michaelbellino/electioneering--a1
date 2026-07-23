class_name Gauge
extends Control
## A labeled horizontal meter that eases toward its target. Optional bipolar mode
## (center = 0) for things like net favorability.

var label_text := ""
var value := 0.5          # 0..1 (or -1..1 if bipolar)
var _shown := 0.5
var color := Palette.ACCENT
var value_text := ""
var bipolar := false
var reduced := false

func _ready() -> void:
	reduced = Game.settings.get("reduced_motion", false)
	custom_minimum_size.y = maxf(custom_minimum_size.y, 40)
	if reduced:
		_shown = value

func setup(l: String, v: float, c: Color, vt := "", bip := false) -> void:
	label_text = l
	color = c
	value_text = vt
	bipolar = bip
	set_value(v)

func set_value(v: float) -> void:
	value = v
	if reduced:
		_shown = v
	queue_redraw()

func _process(delta: float) -> void:
	if absf(_shown - value) > 0.001:
		_shown = lerpf(_shown, value, clampf(delta * 6.0, 0, 1))
		queue_redraw()

func _draw() -> void:
	var track_h := 10.0
	var top := size.y - track_h - 2
	# labels row
	if Palette.font_ui and label_text != "":
		draw_string(Palette.font_ui, Vector2(0, 14), label_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Palette.MUTED)
	if Palette.font_mono and value_text != "":
		draw_string(Palette.font_mono, Vector2(size.x - 90, 14), value_text, HORIZONTAL_ALIGNMENT_RIGHT, 90, 13, Palette.INK)
	# track
	var track := Rect2(0, top, size.x, track_h)
	_rr(track, Palette.BG2)
	_rr(Rect2(track.position, track.size), Palette.BORDER, false)
	if bipolar:
		var mid := size.x * 0.5
		var mag: float = clampf(_shown, -1, 1)
		var fill_w: float = absf(mag) * size.x * 0.5
		var fx := mid if mag >= 0 else mid - fill_w
		var c := Palette.DEM if mag >= 0 else Palette.GOP
		_rr(Rect2(fx, top, fill_w, track_h), c)
		draw_line(Vector2(mid, top - 2), Vector2(mid, top + track_h + 2), Palette.FAINT, 1.0)
	else:
		var w: float = clampf(_shown, 0, 1) * size.x
		_rr(Rect2(0, top, w, track_h), color)

func _rr(rect: Rect2, c: Color, filled := true) -> void:
	if filled:
		draw_rect(rect, c, true)
	else:
		draw_rect(rect, c, false, 1.0)
