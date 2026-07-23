class_name PollChart
extends Control
## Animated polling line chart: one line per candidate over the weeks, a margin-of-error
## band around the player, and a soft area fill. Draws itself in with an eased reveal.

var series: Array = []          # [{id, name, color, points:[float 0..1]}]
var moe := 0.05
var total_weeks := 14
var _reveal := 0.0
var reduced := false

func set_data(history: Array, candidates: Array, weeks: int) -> void:
	reduced = Game.settings.get("reduced_motion", false)
	total_weeks = maxi(weeks, 1)
	series.clear()
	for c in candidates:
		var pts: Array = []
		for h in history:
			pts.append(float(h["shares"].get(c["id"], 0.0)))
		series.append({"id": c["id"], "name": c["name"], "color": c["color"], "points": pts})
	if history.size() > 0:
		moe = float(history[history.size() - 1].get("moe", 0.05))
	_reveal = 0.0 if not reduced else 1.0
	queue_redraw()

func _process(delta: float) -> void:
	if _reveal < 1.0:
		_reveal = minf(1.0, _reveal + delta * 1.4)
		queue_redraw()

func _plot(i: int, n: int, v: float, rect: Rect2) -> Vector2:
	var x := rect.position.x + (rect.size.x) * (float(i) / float(maxi(n - 1, 1)))
	var y := rect.position.y + rect.size.y * (1.0 - clampf(v / 0.75, 0.0, 1.0))
	return Vector2(x, y)

func _draw() -> void:
	var pad_l := 34.0
	var pad_b := 20.0
	var rect := Rect2(pad_l, 8, size.x - pad_l - 10, size.y - pad_b - 8)
	# gridlines at 25/50/75%
	for frac in [0.25, 0.5, 0.75]:
		var y: float = rect.position.y + rect.size.y * (1.0 - frac / 0.75)
		draw_line(Vector2(rect.position.x, y), Vector2(rect.position.x + rect.size.x, y), Palette.BORDER, 1.0)
		if Palette.font_mono:
			draw_string(Palette.font_mono, Vector2(4, y + 4), "%d%%" % int(frac * 100), HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Palette.FAINT)
	# 50% marker emphasized
	var y50 := rect.position.y + rect.size.y * (1.0 - 0.5 / 0.75)
	draw_line(Vector2(rect.position.x, y50), Vector2(rect.position.x + rect.size.x, y50), Palette.BORDER_HI, 1.0)

	if series.is_empty() or series[0]["points"].is_empty():
		if Palette.font_ui:
			draw_string(Palette.font_ui, rect.position + Vector2(10, rect.size.y / 2), "Awaiting first poll…", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Palette.FAINT)
		return

	var n: int = series[0]["points"].size()
	var shown: int = maxi(2, int(ceil(n * _reveal)))
	shown = mini(shown, n)

	# MOE band around player (series with id player)
	for s in series:
		if s["id"] != "player": continue
		var pts_top: PackedVector2Array = []
		var pts_bot: PackedVector2Array = []
		for i in shown:
			var v: float = s["points"][i]
			pts_top.append(_plot(i, n, minf(0.75, v + moe), rect))
			pts_bot.append(_plot(i, n, maxf(0.0, v - moe), rect))
		var poly: PackedVector2Array = pts_top.duplicate()
		for i in range(pts_bot.size() - 1, -1, -1):
			poly.append(pts_bot[i])
		if poly.size() >= 3:
			var band: Color = s["color"]; band.a = 0.12
			draw_colored_polygon(poly, band)

	# Lines
	for s in series:
		var line: PackedVector2Array = []
		for i in shown:
			line.append(_plot(i, n, s["points"][i], rect))
		if line.size() >= 2:
			draw_polyline(line, s["color"], 2.5, true)
		# end dot + value
		if line.size() > 0:
			var last: Vector2 = line[line.size() - 1]
			draw_circle(last, 4.0, s["color"])
			draw_circle(last, 4.0, Palette.BG, false, 1.5)
			if Palette.font_mono:
				var v: float = s["points"][shown - 1]
				draw_string(Palette.font_mono, last + Vector2(7, 4), "%d%%" % int(round(v * 100)), HORIZONTAL_ALIGNMENT_LEFT, -1, 12, s["color"])
