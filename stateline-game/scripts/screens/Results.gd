class_name Results
extends GameScreen
## The morning after. The map is the point — it is the one image that sums up a
## whole campaign, and it is the thing players actually keep and show people.
## The numbers sit beside it, not instead of it.

func on_enter(data: Variant = null) -> void:
	var result: Dictionary = data if data is Dictionary else Game.state.get("result", {})
	var won: bool = result.get("won", false)

	var root := page(22, 10)

	var head := UI.vbox(2)
	var kicker := UI.label(Game.state.district.get("name", ""), 14, Palette.MUTED)
	kicker.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	head.add_child(kicker)
	var title := UI.title("VICTORY" if won else "DEFEAT", 46)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_color_override("font_color", Palette.GOOD if won else Palette.BAD)
	head.add_child(title)
	var flavor := UI.label(_flavor(won), 15, Palette.INK)
	flavor.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	flavor.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	head.add_child(flavor)
	root.add_child(head)

	var body := UI.hbox(14)
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	root.add_child(body)
	body.add_child(_final_map(result))
	body.add_child(_scorecard(result, won))

	var btns := UI.hbox(12)
	btns.alignment = BoxContainer.ALIGNMENT_CENTER
	var again := UI.button("  Run Again  ", true)
	again.custom_minimum_size = Vector2(220, 42)
	again.pressed.connect(func(): Audio.sfx("confirm"); go("creator"))
	btns.add_child(again)
	var menu := UI.button("Main Menu")
	menu.custom_minimum_size = Vector2(180, 42)
	menu.pressed.connect(func(): Audio.sfx("click"); go("title"))
	btns.add_child(menu)
	root.add_child(btns)

	if not Game.settings.get("reduced_motion", false):
		modulate.a = 0.0
		var tw := create_tween()
		tw.tween_property(self, "modulate:a", 1.0, 0.5)

## The same precinct split election night used — same seed, same numbers, so the
## map you are looking at is the map you just watched fill in.
func _final_map(result: Dictionary) -> Control:
	var panel := UI.panel()
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var v := UI.vbox(6)
	panel.add_child(v)
	v.add_child(UI.section("How the District Voted", Palette.GOOD))
	var map := MapView.new()
	map.size_flags_vertical = Control.SIZE_EXPAND_FILL
	map.custom_minimum_size = Vector2(420, 240)
	map.configure(Game.state.district)
	for c in Game.all_candidates():
		map.lead_colors[c.id] = Palette.party_color(c.party)
	map.tabulate(result, Game.all_candidates(),
		hash(str(Game.state.get("seed", 0)) + str(Game.state.district.get("id", ""))))
	map.show_final()
	v.add_child(map)
	var key := UI.hbox(14)
	for c in Game.all_candidates():
		var chip := UI.hbox(5)
		var col := Palette.party_color(c.party)
		var dot := Control.new()
		dot.custom_minimum_size = Vector2(9, 9)
		dot.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		dot.draw.connect(func(): dot.draw_circle(Vector2(4.5, 4.5), 4.5, col))
		chip.add_child(dot)
		chip.add_child(UI.label(_short(str(c.name)), 11, Palette.MUTED))
		key.add_child(chip)
	key.add_child(UI.spacer())
	key.add_child(UI.label("%d precincts · deeper shade, bigger margin" % map.cells.size(), 11, Palette.FAINT))
	v.add_child(key)
	return panel

func _scorecard(result: Dictionary, won: bool) -> Control:
	var col := UI.vbox(10)
	col.custom_minimum_size = Vector2(392, 0)

	var panel := UI.panel()
	var v := UI.vbox(8)
	panel.add_child(v)
	v.add_child(UI.section("The Result", Palette.GOLD2))
	var grid := GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 24)
	grid.add_theme_constant_override("v_separation", 7)
	v.add_child(grid)

	var pshare: float = float(result.get("shares", {}).get("player", 0.0))
	var oshare := 0.0
	for o in Game.state.opponents:
		oshare = maxf(oshare, float(result.get("shares", {}).get(o.id, 0.0)))
	var margin := (pshare - oshare) * 100.0
	_stat(grid, "Your share", "%.1f%%" % (pshare * 100.0))
	_stat(grid, "Margin", "%+.1f pts" % margin)
	_stat(grid, "Turnout", "%.1f%%" % (float(result.get("turnout", 0.0)) * 100.0))
	_stat(grid, "Total votes", Game._comma(int(result.get("totalVotes", 0))))
	_stat(grid, "War chest left", Game.money_str(int(Game.state.cash)))
	_stat(grid, "Campaign score", str(_score(won, pshare, margin)))
	col.add_child(panel)

	# What actually decided it — the coalition you built, best group first.
	var seg_panel := UI.quiet_panel()
	seg_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var sv := UI.vbox(5)
	seg_panel.add_child(sv)
	sv.add_child(UI.section("Where your votes came from", Palette.ACCENT))
	for row in _segment_breakdown(result):
		var r := UI.hbox(8)
		var nm := UI.label(str(row["label"]), 12, Palette.MUTED)
		nm.custom_minimum_size = Vector2(148, 0)
		nm.clip_text = true
		nm.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		r.add_child(nm)
		var bar := UI.bar(float(row["share"]), Palette.party_color(Game.player().get("party", "I")), 9)
		bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		r.add_child(bar)
		var pc := UI.num("%d%%" % int(round(float(row["share"]) * 100.0)), 11, Palette.MUTED)
		pc.custom_minimum_size = Vector2(32, 0)
		pc.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		r.add_child(pc)
		sv.add_child(r)
	col.add_child(seg_panel)

	if won:
		col.add_child(UI.wrap("Next build: take the seat and govern — draft bills, whip votes, and defend the record into re-election.",
			370, 12, Palette.ACCENT))
	return col

## Your share of each demographic group, best first.
func _segment_breakdown(result: Dictionary) -> Array:
	var rows: Array = []
	for seg in result.get("segments", {}):
		var votes: Dictionary = result.segments[seg]
		var tot := 0.0
		for cid in votes:
			tot += float(votes[cid])
		if tot <= 0:
			continue
		rows.append({
			"label": Content.segment_label(str(seg)),
			"share": float(votes.get("player", 0.0)) / tot,
		})
	rows.sort_custom(func(a, b2): return float(a["share"]) > float(b2["share"]))
	return rows

func _short(n: String) -> String:
	var paren := n.find(" (")
	return n.substr(0, paren) if paren > 0 else n

func _stat(grid: GridContainer, label: String, value: String) -> void:
	var l := UI.label(label, 13, Palette.MUTED)
	l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.add_child(l)
	var v := UI.num(value, 16, Palette.INK)
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	v.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	grid.add_child(v)

func _score(won: bool, share: float, margin: float) -> int:
	var base := 500 if won else 100
	base += int(share * 300)
	base += int(clampf(margin, -50, 50) * 4)
	base += int(Game.difficulty(Game.state.difficultyId).oppMult * 200)
	base -= int(Game.state.week) * 3
	return maxi(0, base)

func _flavor(won: bool) -> String:
	var pool: Array = Content.copy.get("victoryFlavor" if won else "defeatFlavor", [])
	if pool.size() > 0:
		return str(pool[Game.rng.randi() % pool.size()])
	return "The people have spoken. On to the next fight." if won else "Not this time. But the machine remembers a good fight."
