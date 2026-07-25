class_name MapView
extends Control
## The district map. Draws the REAL boundary of the seat you're contesting —
## congressional districts from Census TIGER, states from us-atlas — with
## precincts packed inside the outline, towns placed in the interior, and a
## campaign bus touring between them. On election night the precincts report in.

var district: Dictionary = {}
var rings: Array = []          # Array[PackedVector2Array] in 0..1 space
var cells: Array = []          # {uv, seg, support, reported, reportT, phase}
var towns: Array = []          # {uv, name, pulse, visited}
var _t := 0.0
var _bus := {"pos": Vector2.ZERO, "target": 0, "traveling": false}
var ripples: Array = []
var player_share := 0.5
var mode := "campaign"
var reporting := false
var report_pct := 0.0
var _rng := RandomNumberGenerator.new()
var reduced := false
var _fit_scale := 1.0
var _fit_off := Vector2.ZERO
var _bbox := Rect2()
var subtitle := ""

func configure(d: Dictionary) -> void:
	district = d
	reduced = Game.settings.get("reduced_motion", false)
	_rng.seed = hash(str(d.get("id", "x")))
	rings = Content.geo_rings(d)
	_recompute_bbox()
	subtitle = Content.geo_label(d)
	_build()
	queue_redraw()

# ---------------------------------------------------------------------------
# Layout inside the real outline
# ---------------------------------------------------------------------------
## Fit the shape's own bounding box — not the unit square it was normalised into —
## so a wide district actually fills a wide panel instead of floating in the middle
## of an invisible square with dead margins either side.
func _recompute_fit() -> void:
	var pad := 12.0
	var avail := Vector2(maxf(size.x - pad * 2.0, 1.0), maxf(size.y - pad * 2.0 - 10.0, 1.0))
	if _bbox.size.x <= 0.0 or _bbox.size.y <= 0.0:
		_fit_scale = maxf(minf(avail.x, avail.y), 1.0)
		_fit_off = Vector2((size.x - _fit_scale) * 0.5, (size.y - _fit_scale) * 0.5)
		return
	_fit_scale = minf(avail.x / _bbox.size.x, avail.y / _bbox.size.y)
	var drawn := _bbox.size * _fit_scale
	_fit_off = Vector2((size.x - drawn.x) * 0.5, (size.y - 10.0 - drawn.y) * 0.5) - _bbox.position * _fit_scale

func _uv_to_px(uv: Vector2) -> Vector2:
	return _fit_off + uv * _fit_scale

func _recompute_bbox() -> void:
	var mn := Vector2(INF, INF)
	var mx := Vector2(-INF, -INF)
	for ring in rings:
		for uv in ring:
			mn.x = minf(mn.x, uv.x); mn.y = minf(mn.y, uv.y)
			mx.x = maxf(mx.x, uv.x); mx.y = maxf(mx.y, uv.y)
	_bbox = Rect2(mn, mx - mn) if mn.x < INF else Rect2()

func _point_in_shape(p: Vector2) -> bool:
	# Even-odd across every ring: holes and multi-part shapes both behave.
	var inside := false
	for ring in rings:
		var n: int = ring.size()
		var j: int = n - 1
		for i in n:
			var a: Vector2 = ring[i]
			var b: Vector2 = ring[j]
			# The y-straddle test guarantees b.y != a.y, so divide directly —
			# clamping the denominator to a positive epsilon breaks downward edges.
			if ((a.y > p.y) != (b.y > p.y)) and \
			   (p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x):
				inside = not inside
			j = i
	return inside

func _build() -> void:
	cells.clear()
	towns.clear()
	if rings.is_empty():
		return

	var shares: Dictionary = district.get("segmentShares", {})
	var seg_pool: Array = []
	for seg in shares:
		for i in int(round(float(shares[seg]) * 200.0)):
			seg_pool.append(seg)
	if seg_pool.is_empty():
		seg_pool = ["white_college"]
	seg_pool.shuffle()

	# Poisson-ish scatter: sample the unit box, keep points inside the boundary.
	var want := 150
	var tries := 0
	var placed: Array = []
	var min_d := 0.052
	while placed.size() < want and tries < 9000:
		tries += 1
		var p := Vector2(_rng.randf(), _rng.randf())
		if not _point_in_shape(p):
			continue
		var ok := true
		for q in placed:
			if p.distance_to(q) < min_d:
				ok = false
				break
		if not ok:
			continue
		placed.append(p)
		if placed.size() > want * 0.6 and tries > 4000:
			min_d = 0.042      # relax so thin districts still fill
	var idx := 0
	for p in placed:
		var seg: String = seg_pool[idx % seg_pool.size()]
		idx += 1
		var b: Dictionary = Content.behavior.get(seg, {})
		var lean: float = float(b.get("partisanLean", 0.0)) + float(district.get("lean", 0.0)) * 0.5
		cells.append({
			"uv": p, "seg": seg,
			"support": 0.5 + 0.5 * clampf(lean, -1, 1),
			"reported": false, "reportT": 0.0,
			"phase": _rng.randf() * TAU,
		})

	# Towns: spread across the interior, far apart, biased away from the edge.
	var names: Array = district.get("towns", [])
	var spots: Array = []
	var t_tries := 0
	while spots.size() < names.size() and t_tries < 6000:
		t_tries += 1
		var p := Vector2(_rng.randf(), _rng.randf())
		if not _point_in_shape(p):
			continue
		var ok := true
		for q in spots:
			if p.distance_to(q) < 0.20:
				ok = false
				break
		if ok:
			spots.append(p)
	for i in mini(names.size(), spots.size()):
		towns.append({"uv": spots[i], "name": str(names[i]), "pulse": 0.0, "visited": false})
	if towns.size() > 0:
		_recompute_fit()
		_bus["pos"] = _uv_to_px(towns[0]["uv"])

# ---------------------------------------------------------------------------
func set_projection(p_share: float, seg_shares: Dictionary) -> void:
	player_share = p_share
	for cell in cells:
		var target: float = float(seg_shares.get(cell["seg"], p_share))
		cell["support"] = lerpf(float(cell["support"]), clampf(target + _rng.randf_range(-0.05, 0.05), 0.02, 0.98), 0.5)
	queue_redraw()

func ripple(color := Palette.ACCENT) -> void:
	if towns.is_empty(): return
	var t: Dictionary = towns[_rng.randi() % towns.size()]
	ripples.append({"uv": t["uv"], "t": 0.0, "color": color})
	t["pulse"] = 1.0

func tour_next() -> void:
	if towns.is_empty(): return
	_bus["target"] = (int(_bus["target"]) + 1) % towns.size()
	_bus["traveling"] = true
	towns[int(_bus["target"])]["visited"] = true

func start_reporting() -> void:
	mode = "election"
	reporting = true
	report_pct = 0.0
	for cell in cells:
		cell["reported"] = false

func _process(delta: float) -> void:
	_t += delta
	_recompute_fit()
	if _bus["traveling"] and towns.size() > 0:
		var dest := _uv_to_px(towns[int(_bus["target"])]["uv"])
		_bus["pos"] = Vector2(_bus["pos"]).lerp(dest, clampf(delta * 3.0, 0, 1))
		if Vector2(_bus["pos"]).distance_to(dest) < 3.0:
			_bus["traveling"] = false
	for r in ripples:
		r["t"] += delta * 1.6
	ripples = ripples.filter(func(r): return r["t"] < 1.0)
	for t in towns:
		t["pulse"] = maxf(0.0, float(t["pulse"]) - delta * 1.5)
	if reporting:
		report_pct = minf(1.0, report_pct + delta * 0.26)
		var want := int(report_pct * cells.size())
		var got := 0
		for cell in cells:
			if cell["reported"]: got += 1
		while got < want:
			var moved := false
			for cell in cells:
				if not cell["reported"]:
					cell["reported"] = true
					cell["reportT"] = 0.0
					got += 1
					moved = true
					break
			if not moved: break
		for cell in cells:
			if cell["reported"] and float(cell["reportT"]) < 1.0:
				cell["reportT"] = minf(1.0, float(cell["reportT"]) + delta * 3.0)
		if report_pct >= 1.0:
			reporting = false
	queue_redraw()

# ---------------------------------------------------------------------------
func _draw() -> void:
	_recompute_fit()
	draw_rect(Rect2(Vector2.ZERO, size), Color("fbf8f0"))

	if rings.is_empty():
		if Palette.font_ui:
			draw_string(Palette.font_ui, Vector2(12, size.y * 0.5), "No map data",
				HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Palette.FAINT)
		return

	# landmass fill + a soft drop so the shape reads as a solid object
	for ring in rings:
		var pts := PackedVector2Array()
		for uv in ring:
			pts.append(_uv_to_px(uv) + Vector2(2, 3))
		if pts.size() >= 3:
			_fill_poly(pts, Color(0.55, 0.52, 0.45, 0.18))
	for ring in rings:
		var pts2 := PackedVector2Array()
		for uv in ring:
			pts2.append(_uv_to_px(uv))
		if pts2.size() >= 3:
			_fill_poly(pts2, Color("f2ecdf"))

	# precincts
	for cell in cells:
		var p := _uv_to_px(cell["uv"])
		var col: Color
		if mode == "election" and not cell["reported"]:
			col = Color("ded6c6")
		else:
			col = _support_color(float(cell["support"]))
			if mode == "election":
				col = Color("fff3cc").lerp(col, float(cell["reportT"]))
		if mode == "campaign" and not reduced:
			col.a = 0.80 + 0.20 * sin(_t * 1.3 + float(cell["phase"]))
		var r := maxf(_fit_scale * 0.011, 2.0)
		draw_circle(p, r, col)

	# boundary on top
	for ring in rings:
		var line := PackedVector2Array()
		for uv in ring:
			line.append(_uv_to_px(uv))
		if line.size() >= 2:
			line.append(line[0])
			draw_polyline(line, Palette.INK, 2.0, true)

	# ripples
	for r in ripples:
		var rad: float = 6.0 + 60.0 * float(r["t"])
		var c: Color = r["color"]
		c.a = (1.0 - float(r["t"])) * 0.55
		draw_arc(_uv_to_px(r["uv"]), rad, 0, TAU, 32, c, 2.5, true)

	# towns — markers first, then labels, so a nearby pin never lands on top of a name
	for t in towns:
		var p := _uv_to_px(t["uv"])
		var pr: float = float(t["pulse"])
		if pr > 0.0:
			var gc := Palette.GOLD; gc.a = pr * 0.45
			draw_circle(p, 9 + pr * 10, gc)
		draw_circle(p, 4.5, Palette.GOLD if t["visited"] else Palette.INK)
		draw_arc(p, 4.5, 0, TAU, 16, Color("ffffff"), 1.5, true)
	_draw_town_labels()

	# the bus
	if mode == "campaign" and towns.size() > 0:
		var bp: Vector2 = _bus["pos"]
		if not reduced:
			bp.y += sin(_t * 6.0) * 1.5
		draw_rect(Rect2(bp - Vector2(10, 5.5), Vector2(20, 11)), Palette.ACCENT, true)
		draw_rect(Rect2(bp - Vector2(10, 5.5), Vector2(20, 11)), Palette.ACCENT2, false, 1.5)
		draw_rect(Rect2(bp + Vector2(-7.5, -3.5), Vector2(5, 4)), Color("ffffff"))
		draw_circle(bp + Vector2(-5, 6), 2.2, Palette.INK)
		draw_circle(bp + Vector2(5, 6), 2.2, Palette.INK)

	# what you're looking at
	if subtitle != "" and Palette.font_ui:
		draw_string(Palette.font_ui, Vector2(8, size.y - 7), subtitle,
			HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Palette.FAINT)

func _fill_poly(pts: PackedVector2Array, col: Color) -> void:
	var idx := Geometry2D.triangulate_polygon(pts)
	if idx.is_empty():
		draw_colored_polygon(pts, col)
		return
	var i := 0
	while i + 2 < idx.size():
		draw_colored_polygon(PackedVector2Array([pts[idx[i]], pts[idx[i + 1]], pts[idx[i + 2]]]), col)
		i += 3

func _support_color(support: float) -> Color:
	if support >= 0.5:
		return Color("cfc7b4").lerp(Palette.DEM, (support - 0.5) * 2.0)
	return Color("cfc7b4").lerp(Palette.GOP, (0.5 - support) * 2.0)

## Greedy label placement: try each candidate offset around the pin and take the
## first that clears every label already on the map. Names that cannot be placed
## are dropped — an unreadable pile of overlapping text is worse than no text.
func _draw_town_labels() -> void:
	if Palette.font_ui_bold == null:
		return
	var taken: Array = []
	var offsets := [Vector2(8, 4), Vector2(8, -8), Vector2(8, 16), Vector2(-8, 4),
		Vector2(-8, -8), Vector2(-8, 16), Vector2(0, -11), Vector2(0, 18)]
	for t in towns:
		var p := _uv_to_px(t["uv"])
		var label := str(t["name"])
		var m := Palette.font_ui_bold.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, 11)
		var placed := false
		for off in offsets:
			var tp: Vector2 = p + off
			if off.x < 0:
				tp.x = p.x + off.x - m.x
			var box := Rect2(tp.x - 2, tp.y - m.y + 1, m.x + 4, m.y + 2)
			if box.position.x < 2 or box.end.x > size.x - 2 \
			   or box.position.y < 2 or box.end.y > size.y - 14:
				continue
			var clash := false
			for other in taken:
				if box.intersects(other):
					clash = true
					break
			if clash:
				continue
			taken.append(box)
			draw_string_outline(Palette.font_ui_bold, tp, label, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, 4, Color(1, 1, 1, 0.9))
			draw_string(Palette.font_ui_bold, tp, label, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Palette.INK)
			placed = true
			break
		if not placed:
			continue
