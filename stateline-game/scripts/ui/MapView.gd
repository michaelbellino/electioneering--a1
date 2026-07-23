class_name MapView
extends Control
## A living, stylized district map. Precinct cells colored by projected support, a
## touring campaign bus, ripples when you act, and precinct-by-precinct "reporting"
## on election night. Not literal geography — a legible abstraction of the race.

var district: Dictionary = {}
var cells: Array = []        # {pos, size, seg, baseLean, support, reported, reportT}
var towns: Array = []        # {pos, name, r, pulse}
var _t := 0.0
var _bus := {"pos": Vector2.ZERO, "target": 0, "traveling": false, "trailT": 0.0}
var ripples: Array = []      # {pos, t, color}
var player_share := 0.5
var seg_support: Dictionary = {}
var mode := "campaign"
var reporting := false
var report_pct := 0.0
var _rng := RandomNumberGenerator.new()
var reduced := false

func configure(d: Dictionary) -> void:
	district = d
	reduced = Game.settings.get("reduced_motion", false)
	_rng.seed = hash(d.get("id", "x"))
	_build()
	queue_redraw()

func _build() -> void:
	cells.clear()
	towns.clear()
	var shares: Dictionary = district.get("segmentShares", {})
	# Weighted list of segments for cell assignment
	var seg_pool: Array = []
	for seg in shares:
		var count: int = int(round(float(shares[seg]) * 140.0))
		for i in count:
			seg_pool.append(seg)
	if seg_pool.is_empty():
		seg_pool = ["white_college"]
	seg_pool.shuffle()
	# Jittered grid of precincts
	var cols := 18
	var rows := 9
	var idx := 0
	for r in rows:
		for c in cols:
			var seg: String = seg_pool[idx % seg_pool.size()]
			idx += 1
			var b: Dictionary = Content.behavior.get(seg, {})
			var lean: float = float(b.get("partisanLean", 0.0)) + float(district.get("lean", 0.0)) * 0.5
			cells.append({
				"gx": c, "gy": r,
				"jitter": Vector2(_rng.randf_range(-0.18, 0.18), _rng.randf_range(-0.18, 0.18)),
				"seg": seg, "baseLean": clampf(lean, -1, 1),
				"support": 0.5 + 0.5 * clampf(lean, -1, 1),
				"reported": false, "reportT": 0.0,
				"phase": _rng.randf() * TAU,
			})
	# Towns from district data placed at pleasant spots
	var names: Array = district.get("towns", [])
	var spots := [Vector2(0.18,0.30), Vector2(0.52,0.20), Vector2(0.80,0.34), Vector2(0.30,0.66), Vector2(0.64,0.72), Vector2(0.86,0.62), Vector2(0.44,0.46), Vector2(0.12,0.72)]
	for i in mini(names.size(), spots.size()):
		towns.append({"uv": spots[i], "name": names[i], "pulse": 0.0, "visited": false})
	if towns.size() > 0:
		_bus["pos"] = _uv_to_px(towns[0]["uv"])

func set_projection(p_share: float, seg_shares: Dictionary) -> void:
	player_share = p_share
	seg_support = seg_shares
	# recolor cells toward projected support in their segment
	for cell in cells:
		var seg: String = cell["seg"]
		var target: float = float(seg_shares.get(seg, p_share))
		cell["support"] = lerpf(cell["support"], clampf(target + _rng.randf_range(-0.06, 0.06), 0.02, 0.98), 0.5)
	queue_redraw()

func ripple(color := Palette.ACCENT) -> void:
	if towns.is_empty(): return
	var t: Dictionary = towns[_rng.randi() % towns.size()]
	ripples.append({"pos": _uv_to_px(t["uv"]), "t": 0.0, "color": color})
	t["pulse"] = 1.0

func tour_next() -> void:
	if towns.is_empty(): return
	_bus["target"] = (_bus["target"] + 1) % towns.size()
	_bus["traveling"] = true
	towns[_bus["target"]]["visited"] = true

func start_reporting() -> void:
	mode = "election"
	reporting = true
	report_pct = 0.0
	for cell in cells:
		cell["reported"] = false

func _uv_to_px(uv: Vector2) -> Vector2:
	var pad := 18.0
	return Vector2(pad + uv.x * (size.x - 2 * pad), pad + uv.y * (size.y - 2 * pad))

func _cell_rect(cell: Dictionary) -> Rect2:
	var pad := 14.0
	var w := (size.x - 2 * pad) / 18.0
	var h := (size.y - 2 * pad) / 9.0
	var x: float = pad + (float(cell["gx"]) + 0.5 + cell["jitter"].x) * w
	var y: float = pad + (float(cell["gy"]) + 0.5 + cell["jitter"].y) * h
	var cs := minf(w, h) * 0.80
	return Rect2(x - cs / 2, y - cs / 2, cs, cs)

func _process(delta: float) -> void:
	_t += delta
	# bus travel
	if _bus["traveling"] and towns.size() > 0:
		var dest: Vector2 = _uv_to_px(towns[_bus["target"]]["uv"])
		_bus["pos"] = _bus["pos"].lerp(dest, clampf(delta * 3.0, 0, 1))
		if _bus["pos"].distance_to(dest) < 3.0:
			_bus["traveling"] = false
	# ripples
	for r in ripples:
		r["t"] += delta * 1.6
	ripples = ripples.filter(func(r): return r["t"] < 1.0)
	for t in towns:
		t["pulse"] = maxf(0.0, t["pulse"] - delta * 1.5)
	# reporting
	if reporting:
		report_pct = minf(1.0, report_pct + delta * 0.28)
		var want := int(report_pct * cells.size())
		var got := 0
		for cell in cells:
			if cell["reported"]: got += 1
		# report cells in a shuffled but deterministic order
		while got < want:
			for cell in cells:
				if not cell["reported"]:
					cell["reported"] = true
					cell["reportT"] = 0.0
					got += 1
					break
		for cell in cells:
			if cell["reported"] and cell["reportT"] < 1.0:
				cell["reportT"] = minf(1.0, cell["reportT"] + delta * 3.0)
		if report_pct >= 1.0:
			reporting = false
	queue_redraw()

func _draw() -> void:
	# backdrop
	draw_rect(Rect2(Vector2.ZERO, size), Palette.BG2)
	draw_rect(Rect2(Vector2.ZERO, size), Palette.BORDER, false, 1.0)
	# faint grid glow
	# cells
	for cell in cells:
		var rect := _cell_rect(cell)
		var support: float = float(cell["support"])
		var col: Color
		if mode == "election" and not cell["reported"]:
			col = Palette.PANEL2
		else:
			# support 0..1 => R..D via player's leaning (player_share as neutral point)
			col = _support_color(support)
			if mode == "election":
				var rt: float = float(cell["reportT"])
				col = Palette.INK.lerp(col, rt)  # flash white then settle
		# breathing shimmer in campaign mode
		var a := 1.0
		if mode == "campaign" and not reduced:
			a = 0.86 + 0.14 * sin(_t * 1.4 + cell["phase"])
		col.a = a
		_draw_round_rect(rect, col, 3.0)
	# ripples
	for r in ripples:
		var rad: float = 8.0 + 80.0 * r["t"]
		var c: Color = r["color"]; c.a = (1.0 - r["t"]) * 0.5
		draw_arc(r["pos"], rad, 0, TAU, 40, c, 3.0, true)
	# towns
	for t in towns:
		var p := _uv_to_px(t["uv"])
		var pr: float = float(t["pulse"])
		if pr > 0.0:
			var gc := Palette.GOLD; gc.a = pr * 0.4
			draw_circle(p, 10 + pr * 10, gc)
		draw_circle(p, 5, Palette.GOLD if t["visited"] else Palette.MUTED)
		draw_circle(p, 5, Palette.BG, false, 1.5)
		if Palette.font_ui:
			draw_string(Palette.font_ui, p + Vector2(9, 4), t["name"], HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Palette.MUTED)
	# campaign bus
	if mode == "campaign" and towns.size() > 0:
		var bp: Vector2 = _bus["pos"]
		var bob := 0.0 if reduced else sin(_t * 6.0) * 1.5
		bp.y += bob
		draw_rect(Rect2(bp - Vector2(11, 6), Vector2(22, 12)), Palette.ACCENT, true)
		draw_rect(Rect2(bp - Vector2(11, 6), Vector2(22, 12)), Palette.INK, false, 1.0)
		draw_circle(bp + Vector2(-6, 7), 2.5, Palette.INK)
		draw_circle(bp + Vector2(6, 7), 2.5, Palette.INK)
		draw_rect(Rect2(bp + Vector2(-8, -4), Vector2(6, 5)), Palette.BG2)

func _support_color(support: float) -> Color:
	# support = player's share of the two-party-ish vote in the cell
	if support >= 0.5:
		return Color("2b3a52").lerp(Palette.DEM, (support - 0.5) * 2.0)
	return Color("2b3a52").lerp(Palette.GOP, (0.5 - support) * 2.0)

func _draw_round_rect(rect: Rect2, color: Color, radius: float) -> void:
	# approximate rounded rect with a filled rect + corner smoothing via draw_style? keep simple.
	draw_rect(rect, color, true)
