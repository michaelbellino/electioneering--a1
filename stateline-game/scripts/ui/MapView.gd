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
var lead_colors: Dictionary = {}     # candidate id -> colour, set by ElectionNight

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

## Roughly how far a point sits from the nearest boundary edge, in uv units.
func _edge_clearance(p: Vector2) -> float:
	var best := INF
	for ring in rings:
		var n: int = ring.size()
		for i in n:
			var a: Vector2 = ring[i]
			var b: Vector2 = ring[(i + 1) % n]
			best = minf(best, Geometry2D.get_closest_point_to_segment(p, a, b).distance_to(p))
	return 0.0 if best == INF else best

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
			# filled in by ElectionNight when the count starts
			"weight": 0.7 + _rng.randf() * 0.6,
			"votes": {}, "lead": "", "margin": 0.0, "town": -1, "flash": 0.0,
		})

	# Towns: best-candidate sampling. For each town, try a batch of interior points
	# and keep whichever sits farthest from the towns already placed. A plain
	# rejection loop clumps them whenever the district is an awkward shape.
	var names: Array = district.get("towns", [])
	var spots: Array = []
	for _n in names.size():
		var best := Vector2(-1, -1)
		var best_score := -1.0
		var fallback := Vector2(-1, -1)
		for _k in 140:
			var p := Vector2(_rng.randf(), _rng.randf())
			if not _point_in_shape(p):
				continue
			if fallback.x < 0.0:
				fallback = p
			# a hard margin off the boundary, so labels have somewhere to sit —
			# used as a gate, never as part of the score, or every town migrates
			# to the middle of the district
			if _edge_clearance(p) < 0.030:
				continue
			var score := 4.0
			for q in spots:
				score = minf(score, p.distance_to(q))
			if score > best_score:
				best_score = score
				best = p
		if best.x < 0.0:
			best = fallback
		if best.x >= 0.0:
			spots.append(best)
	for i in mini(names.size(), spots.size()):
		towns.append({"uv": spots[i], "name": str(names[i]), "pulse": 0.0, "visited": false,
			"reported": 0, "total": 0, "called": false})
	if towns.size() > 0:
		_recompute_fit()
		_bus["pos"] = _uv_to_px(towns[0]["uv"])
	# Every precinct belongs to its nearest town, and how close it sits to that town
	# stands in for density: the tight urban clusters count slowest, exactly like
	# the real thing, which is why cities so often come in last and swing a race.
	for cell in cells:
		var best := -1
		var best_d := INF
		for i in towns.size():
			var d: float = Vector2(cell["uv"]).distance_to(Vector2(towns[i]["uv"]))
			if d < best_d:
				best_d = d
				best = i
		cell["town"] = best
		cell["urban"] = clampf(1.0 - best_d / 0.30, 0.0, 1.0)
		if best >= 0:
			towns[best]["total"] = int(towns[best]["total"]) + 1

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

## Hand the election's real totals down to the precincts and work out the order
## the clerks report them in. Returns that order as cell indices.
##
## The split is exact: each candidate's final vote count is divided among the
## precincts in proportion to that precinct's demographic affinity for them, so
## the precincts always add back up to the simulation's result to the vote. The
## map can never disagree with the tally.
func tabulate(result: Dictionary, cands: Array, seed_val: int) -> Array:
	if cells.is_empty():
		return []
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_val
	var total_votes: float = float(result.get("totalVotes", 0))
	var seg_share := _segment_shares(result)

	var totals: Dictionary = {}
	for c in cands:
		totals[c.id] = 0.0
	for cell in cells:
		var aff: Dictionary = {}
		var base: Dictionary = seg_share.get(str(cell.get("seg", "")), {})
		for c in cands:
			var s: float = float(base.get(c.id, 1.0 / maxf(cands.size(), 1)))
			aff[c.id] = maxf(s * (1.0 + rng.randfn(0.0, 0.16)), 0.004) * float(cell.get("weight", 1.0))
			totals[c.id] = float(totals[c.id]) + float(aff[c.id])
		cell["aff"] = aff

	for cell in cells:
		var votes: Dictionary = {}
		var sum := 0.0
		for c in cands:
			var v: float = float(result.shares.get(c.id, 0.0)) * total_votes \
				* float(cell["aff"][c.id]) / maxf(float(totals[c.id]), 1e-9)
			votes[c.id] = v
			sum += v
		cell["votes"] = votes
		var best := ""; var best_v := -1.0; var second := 0.0
		for cid in votes:
			var v2: float = float(votes[cid])
			if v2 > best_v:
				second = best_v
				best_v = v2
				best = cid
			elif v2 > second:
				second = v2
		cell["lead"] = best
		cell["margin"] = (best_v - maxf(second, 0.0)) / maxf(sum, 1e-9)

	var seq: Array = []
	for i in cells.size():
		# Enough of a density skew that the towns visibly come in last and can
		# swing it; a closeness penalty so the knife-edge boxes are the ones still
		# outstanding at 95%; and a little per-clerk noise on top.
		var t: float = float(cells[i].get("urban", 0.5)) * 0.32
		t += _closeness_delay(float(cells[i]["margin"]))
		t += rng.randf() * 0.30
		seq.append({"i": i, "t": t})
	seq.sort_custom(func(a, b): return float(a["t"]) < float(b["t"]))
	var order: Array = []
	for e in seq:
		order.append(int(e["i"]))
	return order

func _closeness_delay(margin: float) -> float:
	if margin < 0.01: return 0.55
	if margin < 0.02: return 0.40
	if margin < 0.04: return 0.22
	if margin < 0.08: return 0.08
	return 0.0

func _segment_shares(result: Dictionary) -> Dictionary:
	var out := {}
	for seg in result.get("segments", {}):
		var votes: Dictionary = result.segments[seg]
		var tot := 0.0
		for cid in votes:
			tot += float(votes[cid])
		var row := {}
		for cid in votes:
			row[cid] = float(votes[cid]) / tot if tot > 0 else 0.0
		out[seg] = row
	return out

## Show the finished map with every box counted — no animation, no suspense.
func show_final() -> void:
	mode = "election"
	reporting = false
	report_pct = 1.0
	for cell in cells:
		cell["reported"] = true
		cell["reportT"] = 1.0
		cell["flash"] = 0.0
	for t in towns:
		t["reported"] = int(t["total"])
		t["called"] = true
	queue_redraw()

## Switch to election-night rendering. The count itself is driven from outside
## (ElectionNight owns the clock and the tabulation) — the map only renders it.
func start_reporting() -> void:
	mode = "election"
	reporting = true
	report_pct = 0.0
	for cell in cells:
		cell["reported"] = false
		cell["reportT"] = 0.0
	for t in towns:
		t["reported"] = 0
		t["called"] = false

## Mark one precinct as counted. Returns its town index if that town just finished.
func reveal_cell(i: int) -> int:
	if i < 0 or i >= cells.size():
		return -1
	var cell: Dictionary = cells[i]
	if cell["reported"]:
		return -1
	cell["reported"] = true
	cell["reportT"] = 0.0
	cell["flash"] = 1.0
	var ti: int = int(cell.get("town", -1))
	if ti >= 0 and ti < towns.size():
		var t: Dictionary = towns[ti]
		t["reported"] = int(t["reported"]) + 1
		t["pulse"] = 0.7
		if not t["called"] and int(t["reported"]) >= int(t["total"]):
			t["called"] = true
			return ti
	return -1

func set_report_pct(p: float) -> void:
	report_pct = clampf(p, 0.0, 1.0)

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
	if mode == "election":
		for cell in cells:
			if cell["reported"]:
				if float(cell["reportT"]) < 1.0:
					cell["reportT"] = minf(1.0, float(cell["reportT"]) + delta * 3.2)
				if float(cell["flash"]) > 0.0:
					cell["flash"] = maxf(0.0, float(cell["flash"]) - delta * 1.8)
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
	var base_r := maxf(_fit_scale * 0.011, 2.0)
	for cell in cells:
		var p := _uv_to_px(cell["uv"])
		var col: Color
		var r := base_r
		if mode == "election":
			if not cell["reported"]:
				# outstanding: a hollow dot, so "not counted yet" never reads as a result
				draw_arc(p, base_r, 0, TAU, 12, Color("cdc4b1"), 1.2, true)
				continue
			col = _result_color(cell)
			var t: float = float(cell["reportT"])
			col = Color("fff8e0").lerp(col, t)
			var fl: float = float(cell["flash"])
			if fl > 0.0 and not reduced:
				var halo := Palette.GOLD
				halo.a = fl * 0.35
				draw_circle(p, base_r + 5.0 * fl, halo)
				r = base_r * (1.0 + 0.45 * fl)
		else:
			col = _support_color(float(cell["support"]))
			if not reduced:
				col.a = 0.80 + 0.20 * sin(_t * 1.3 + float(cell["phase"]))
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
		var dot := Palette.INK
		if mode == "election":
			dot = Palette.GOLD if t["called"] else Palette.INK.lerp(Palette.BG, 0.45)
		elif t["visited"]:
			dot = Palette.GOLD
		draw_circle(p, 4.5, dot)
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

## A counted precinct is coloured by who actually carried it and by how hard —
## a 51/49 precinct should not look like a 90/10 one.
func _result_color(cell: Dictionary) -> Color:
	var lead := str(cell.get("lead", ""))
	if lead == "":
		return _support_color(float(cell.get("support", 0.5)))
	var base: Color = lead_colors.get(lead, Palette.IND)
	var m: float = clampf(float(cell.get("margin", 0.0)) / 0.35, 0.10, 1.0)
	return Color("e6dfd0").lerp(base, 0.35 + 0.65 * m)

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
