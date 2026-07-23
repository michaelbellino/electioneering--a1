class_name Results
extends GameScreen

func on_enter(data: Variant = null) -> void:
	var result: Dictionary = data if data is Dictionary else Game.state.get("result", {})
	var won: bool = result.get("won", false)

	var box := UI.vbox(16)
	box.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	box.grow_horizontal = Control.GROW_DIRECTION_BOTH
	box.grow_vertical = Control.GROW_DIRECTION_BOTH
	box.custom_minimum_size = Vector2(620, 0)
	add_child(box)

	var kicker := UI.label(Game.state.district.get("name", ""), 14, Palette.MUTED)
	kicker.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(kicker)

	var title := UI.title("VICTORY" if won else "DEFEAT", 56)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_color_override("font_color", Palette.GOOD if won else Palette.BAD)
	box.add_child(title)

	var flavor := UI.label(_flavor(won), 16, Palette.INK)
	flavor.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	flavor.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	flavor.custom_minimum_size = Vector2(560, 0)
	box.add_child(flavor)

	# result panel
	var panel := UI.panel()
	var grid := GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 40)
	grid.add_theme_constant_override("v_separation", 10)
	panel.add_child(grid)

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
	_stat(grid, "Weeks fought", str(int(Game.state.totalWeeks)))
	var score := _score(won, pshare, margin)
	_stat(grid, "Campaign score", str(score))
	box.add_child(panel)

	if won:
		var gov := UI.label("Next build: take the seat and govern — draft bills, whip votes, and defend the record into re-election.", 13, Palette.ACCENT)
		gov.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		gov.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		gov.custom_minimum_size = Vector2(560, 0)
		box.add_child(gov)

	var btns := UI.hbox(12)
	btns.alignment = BoxContainer.ALIGNMENT_CENTER
	var again := UI.button("  Run Again  ", true)
	again.pressed.connect(func(): Audio.sfx("confirm"); go("creator"))
	btns.add_child(again)
	var menu := UI.button("Main Menu")
	menu.pressed.connect(func(): Audio.sfx("click"); go("title"))
	btns.add_child(menu)
	box.add_child(btns)

	if not Game.settings.get("reduced_motion", false):
		box.modulate.a = 0.0
		var tw := create_tween()
		tw.tween_property(box, "modulate:a", 1.0, 0.6)

func _stat(grid: GridContainer, label: String, value: String) -> void:
	var l := UI.label(label, 14, Palette.MUTED)
	var v := UI.label(value, 18, Palette.INK)
	v.add_theme_font_override("font", Palette.font_mono)
	v.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	grid.add_child(l)
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
