class_name Compass
extends Control
## A two-axis ideology compass (fiscal × social) with your platform plotted on it,
## plus an optional marker for where the district's electorate sits.

var fiscal := 0.0        # −1 conservative … +1 progressive
var social := 0.0
var district_fiscal := 0.0
var district_social := 0.0
var show_district := false
var _shown := Vector2.ZERO

func set_values(f: float, s: float) -> void:
	fiscal = clampf(f, -1, 1)
	social = clampf(s, -1, 1)
	queue_redraw()

func set_district(f: float, s: float) -> void:
	district_fiscal = clampf(f, -1, 1)
	district_social = clampf(s, -1, 1)
	show_district = true
	queue_redraw()

func _process(delta: float) -> void:
	var target := Vector2(fiscal, social)
	if _shown.distance_to(target) > 0.001:
		_shown = _shown.lerp(target, clampf(delta * 7.0, 0, 1))
		queue_redraw()

func _to_px(v: Vector2, r: Rect2) -> Vector2:
	# x = fiscal (right = progressive), y = social (up = progressive)
	return Rect2(r).position + Vector2(
		(v.x * 0.5 + 0.5) * r.size.x,
		(1.0 - (v.y * 0.5 + 0.5)) * r.size.y)

func _draw() -> void:
	var pad := 20.0
	var side: float = minf(size.x - pad * 2, size.y - pad * 2)
	var r := Rect2(Vector2((size.x - side) * 0.5, (size.y - side) * 0.5), Vector2(side, side))

	# quadrant tints
	var half := r.size * 0.5
	var q := [
		[Rect2(r.position + Vector2(half.x, 0), half), Palette.DEM],                       # fiscal+ social+
		[Rect2(r.position, half), Palette.IND],                                            # fiscal- social+
		[Rect2(r.position + Vector2(0, half.y), half), Palette.GOP],                       # fiscal- social-
		[Rect2(r.position + half, half), Palette.GOLD],                                    # fiscal+ social-
	]
	for item in q:
		var c: Color = item[1]
		c.a = 0.07
		draw_rect(item[0], c)

	# grid
	for i in 5:
		var t := float(i) / 4.0
		var gc := Palette.BORDER
		draw_line(r.position + Vector2(t * r.size.x, 0), r.position + Vector2(t * r.size.x, r.size.y), gc, 1.0)
		draw_line(r.position + Vector2(0, t * r.size.y), r.position + Vector2(r.size.x, t * r.size.y), gc, 1.0)
	# axes
	draw_line(r.position + Vector2(r.size.x * 0.5, 0), r.position + Vector2(r.size.x * 0.5, r.size.y), Palette.BORDER_HI, 1.5)
	draw_line(r.position + Vector2(0, r.size.y * 0.5), r.position + Vector2(r.size.x, r.size.y * 0.5), Palette.BORDER_HI, 1.5)
	draw_rect(r, Palette.BORDER, false, 1.0)

	# labels
	if Palette.font_ui:
		draw_string(Palette.font_ui, Vector2(r.position.x, r.position.y - 6),
			"PROGRESSIVE", HORIZONTAL_ALIGNMENT_CENTER, r.size.x, 9, Palette.FAINT)
		draw_string(Palette.font_ui, Vector2(r.position.x, r.position.y + r.size.y + 13),
			"TRADITIONAL", HORIZONTAL_ALIGNMENT_CENTER, r.size.x, 9, Palette.FAINT)
		draw_string(Palette.font_ui, Vector2(0, r.position.y + r.size.y * 0.5 - 4),
			"RIGHT", HORIZONTAL_ALIGNMENT_CENTER, r.position.x - 2, 9, Palette.FAINT)
		draw_string(Palette.font_ui, Vector2(r.position.x + r.size.x + 2, r.position.y + r.size.y * 0.5 - 4),
			"LEFT", HORIZONTAL_ALIGNMENT_CENTER, size.x - (r.position.x + r.size.x) - 2, 9, Palette.FAINT)

	# district marker
	if show_district:
		var dp := _to_px(Vector2(district_fiscal, district_social), r)
		var dc := Palette.GOLD
		draw_arc(dp, 9, 0, TAU, 24, dc, 2.0, true)
		draw_line(dp - Vector2(5, 0), dp + Vector2(5, 0), dc, 1.5)
		draw_line(dp - Vector2(0, 5), dp + Vector2(0, 5), dc, 1.5)

	# you
	var p := _to_px(_shown, r)
	var halo := Palette.ACCENT; halo.a = 0.25
	draw_circle(p, 14, halo)
	draw_circle(p, 7, Palette.ACCENT)
	draw_arc(p, 7, 0, TAU, 24, Palette.INK, 1.5, true)
