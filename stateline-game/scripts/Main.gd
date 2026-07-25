extends Control
## Root screen manager: owns the animated background, the active screen, a modal
## overlay layer, the confetti/FX layer, screen transitions, and global routing of
## Game signals (dilemmas, toasts).

var bg: BGField
var content_layer: Control
var overlay_layer: Control
var toast_layer: Control
var fx: Confetti
var fader: ColorRect
var current: GameScreen
var _pending_dilemma: Dictionary = {}
var _transitioning := false

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	theme = UI.build_theme()

	if "--selftest" in OS.get_cmdline_user_args() or "--selftest" in OS.get_cmdline_args():
		call_deferred("_selftest")
		return
	if "--balance" in OS.get_cmdline_user_args() or "--balance" in OS.get_cmdline_args():
		call_deferred("_balance")
		return

	bg = BGField.new()
	add_child(bg)

	content_layer = Control.new()
	content_layer.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	content_layer.mouse_filter = Control.MOUSE_FILTER_PASS
	add_child(content_layer)

	overlay_layer = Control.new()
	overlay_layer.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	overlay_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(overlay_layer)

	fx = Confetti.new()
	add_child(fx)

	toast_layer = Control.new()
	toast_layer.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	toast_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(toast_layer)

	fader = ColorRect.new()
	fader.color = Palette.BG
	fader.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	fader.mouse_filter = Control.MOUSE_FILTER_IGNORE
	fader.modulate.a = 0.0
	add_child(fader)

	Game.dilemma_triggered.connect(_on_dilemma)
	Game.toast.connect(func(t, k): show_toast(t, k))

	go_to("title")

	if "--shots" in OS.get_cmdline_user_args() or "--shots" in OS.get_cmdline_args():
		call_deferred("_run_shots")
	if "--portraits" in OS.get_cmdline_user_args() or "--portraits" in OS.get_cmdline_args():
		call_deferred("_portrait_sheet")
	if "--creator" in OS.get_cmdline_user_args() or "--creator" in OS.get_cmdline_args():
		call_deferred("_creator_shots")

func _goto_settled(name: String, data: Variant = null) -> void:
	while _transitioning:
		await get_tree().process_frame
	await go_to(name, data)
	while _transitioning:
		await get_tree().process_frame

func _creator_shots() -> void:
	Game.settings["reduced_motion"] = true
	await _goto_settled("creator")
	await _wait(0.6)
	var c := current
	for i in 4:
		c.step = i
		if i == 2:
			c.expanded_issue = "immigration"      # show an expanded issue
		c._rebuild()
		await _wait(0.7)
		await _save_shot("creator_%d" % i)
	print("CREATOR SHOTS done")
	get_tree().quit()

func _portrait_sheet() -> void:
	Game.settings["reduced_motion"] = true
	for c in content_layer.get_children():
		c.queue_free()
	var grid := GridContainer.new()
	grid.columns = 7
	grid.add_theme_constant_override("h_separation", 4)
	grid.add_theme_constant_override("v_separation", 4)
	grid.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	content_layer.add_child(grid)
	var rng := RandomNumberGenerator.new()
	rng.seed = 20260101
	var parties := ["D", "R", "I"]
	for i in 21:
		var f := Portrait.make_features(rng)
		f["hairStyle"] = i % Portrait.HAIR_STYLES     # cover every style
		if i >= 14:
			f["facial"] = 1 + (i % 3)
			f["glasses"] = (i % 2 == 0)
		var p := Portrait.new()
		p.custom_minimum_size = Vector2(178, 258)
		p.set_features(f)
		p.set_party(parties[i % 3])
		grid.add_child(p)
	await _wait(0.6)
	await _save_shot("portraits")
	print("PORTRAIT SHEET done")
	get_tree().quit()

func _run_shots() -> void:
	Game.settings["reduced_motion"] = true
	var out_dir := ProjectSettings.globalize_path("user://")
	print("SHOTS dir: %s" % out_dir)
	var sample := {
		"name": "Maya Okonkwo", "party": "D",
		"attrs": {"charisma": 0.7, "competence": 0.6, "integrity": 0.6, "fundraising": 0.5},
		"positions": {"taxes_spending": 0.2, "healthcare": 0.4, "immigration": 0.1, "guns": 0.2, "abortion": 0.4, "climate_energy": 0.5, "crime_policing": 0.1, "social_culture": 0.3},
		"traits": ["firebrand"], "baseExposure": 0.12, "baseFavorability": 0.02,
		"features": {"skin":"c68642","hairStyle":2,"hairColor":"2b2b2b","brow":1,"eyes":1,"suit":"1b2a3f","tie":"f5c451","glasses":false,"smile":0.8,"jaw":1.0},
	}
	await _wait(0.7); await _save_shot("01_title")
	Game.new_game("pa-07", "normal", sample, 4242)
	await _goto_settled("creator"); await _wait(0.7); await _save_shot("02_creator")
	await _goto_settled("hq"); await _wait(0.8); await _save_shot("03_hq")
	# play a few weeks so the chart/news populate
	for i in 6:
		for aid in ["fundraiser", "tv_positive", "rally", "canvass", "digital", "issue_ad"]:
			if Game.can_do(aid): Game.do_action(aid)
		Game.end_week()
	if current and current.has_method("refresh"): current.refresh()
	await _wait(0.9); await _save_shot("04_hq_midgame")
	# a dilemma card
	var d := Game._draw_dilemma()
	if not d.is_empty():
		await show_dilemma_shot(d)
		await _wait(0.5); await _save_shot("05_dilemma")
		for c in overlay_layer.get_children(): c.queue_free()
	await _goto_settled("election"); await _wait(4.5); await _save_shot("06_election")
	await _goto_settled("results", Game.state.get("result", {})); await _wait(0.8); await _save_shot("07_results")
	print("SHOTS complete")
	get_tree().quit()

func _balance() -> void:
	var pending := {"d": {}}
	Game.dilemma_triggered.connect(func(d): pending["d"] = d)
	var races := ["pa-07", "oh-09", "az-gov"]
	var seeds := 40
	print("=== BALANCE (%d seeds/cell, reasonable-play bot) ===" % seeds)
	for race in races:
		var line := "%-8s" % race
		for diff in ["easy", "normal", "hard", "brutal"]:
			var wins := 0
			for s in seeds:
				if _bot_run(race, diff, 1000 + s * 7, pending): wins += 1
			line += "  %s %3d%%" % [diff.substr(0,4), int(round(100.0 * wins / seeds))]
		print(line)
	print("=== targets: easy~75 normal~50 hard~30 brutal~10 ===")
	get_tree().quit()

func _bot_run(race: String, diff: String, seed_val: int, pending: Dictionary) -> bool:
	var player := {
		"name": "Bot", "party": "D",
		"attrs": {"charisma": 0.6, "competence": 0.6, "integrity": 0.5, "fundraising": 0.5},
		"positions": {"taxes_spending": 0.2, "healthcare": 0.3, "immigration": 0.1, "guns": 0.15, "abortion": 0.35, "climate_energy": 0.4, "crime_policing": 0.1, "social_culture": 0.25},
		"traits": [], "baseExposure": 0.10, "baseFavorability": 0.0,
	}
	Game.new_game(race, diff, player, seed_val)
	# sensible early hires
	if Game.state.cash > 15000 * 100: Game.hire("manager")
	if Game.state.cash > 12000 * 100: Game.hire("comms")
	var guard := 0
	while Game.weeks_left() > 0 and guard < 60:
		guard += 1
		var ap_guard := 0
		while int(Game.state.ap) > 0 and ap_guard < 8:
			ap_guard += 1
			if Game.cash_dollars() < 12000 and Game.can_do("fundraiser"):
				Game.do_action("fundraiser")
			elif Game.cash_dollars() > 26000 and Game.can_do("tv_positive"):
				Game.do_action("tv_positive")
			elif Game.can_do("canvass"):
				Game.do_action("canvass")
			elif Game.cash_dollars() > 7000 and Game.can_do("rally"):
				Game.do_action("rally")
			elif Game.can_do("digital"):
				Game.do_action("digital")
			elif Game.can_do("speech"):
				Game.do_action("speech")
			else:
				break
		pending["d"] = {}
		Game.end_week()
		if not pending["d"].is_empty():
			Game.resolve_dilemma(pending["d"], pending["d"].get("defaultOptionId", ""))
	return Game.run_election().get("won", false)

func show_dilemma_shot(d: Dictionary) -> void:
	overlay_layer.mouse_filter = Control.MOUSE_FILTER_STOP
	var popup := DilemmaPopup.new()
	popup.main = self
	overlay_layer.add_child(popup)
	popup.setup(d)

func _wait(sec: float) -> void:
	await get_tree().create_timer(sec).timeout

func _save_shot(name: String) -> void:
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	var path := ProjectSettings.globalize_path("user://shot_%s.png" % name)
	img.save_png(path)
	print("  shot: %s" % path)

func _screen_factory(name: String) -> GameScreen:
	match name:
		"title": return TitleScreen.new()
		"creator": return Creator.new()
		"hq": return HQ.new()
		"election": return ElectionNight.new()
		"results": return Results.new()
		"settings": return SettingsScreen.new()
		_: return TitleScreen.new()

func _music_for(name: String) -> void:
	match name:
		"title", "settings": Audio.play_music("menu")
		"creator": Audio.play_music("menu")
		"hq":
			# tension music if it's crunch time
			if Game.state.has("week") and Game.weeks_left() <= 3:
				Audio.play_music("tension")
			else:
				Audio.play_music("hq")
		"election": Audio.play_music("tension")
		_: pass

func go_to(name: String, data: Variant = null) -> void:
	if _transitioning:
		return
	_transitioning = true
	var reduced: bool = Game.settings.get("reduced_motion", false)
	var dur := 0.0 if reduced else 0.22
	var tw := create_tween()
	tw.tween_property(fader, "modulate:a", 1.0, dur)
	await tw.finished
	if current:
		current.on_exit()
		current.queue_free()
		current = null
	# clear overlays
	for c in overlay_layer.get_children():
		c.queue_free()
	current = _screen_factory(name)
	current.main = self
	current.navigate.connect(_on_navigate)
	content_layer.add_child(current)
	current.on_enter(data)
	_music_for(name)
	var tw2 := create_tween()
	tw2.tween_property(fader, "modulate:a", 0.0, dur)
	await tw2.finished
	_transitioning = false

func _on_navigate(to: String, data: Variant) -> void:
	go_to(to, data)

# ---------------------------------------------------------------------------
# Weekly advance with dilemma sequencing
# ---------------------------------------------------------------------------
func advance_week() -> void:
	_pending_dilemma = {}
	Game.end_week()
	await get_tree().process_frame
	await show_week_review()
	if not _pending_dilemma.is_empty():
		var d: Dictionary = _pending_dilemma
		_pending_dilemma = {}
		await show_dilemma(d)
	if Game.weeks_left() <= 0:
		go_to("election")
	else:
		if current and current.has_method("refresh"):
			current.refresh()
		# escalate music near the end
		if Game.weeks_left() <= 3:
			Audio.play_music("tension")

func _on_dilemma(d: Dictionary) -> void:
	_pending_dilemma = d

func show_week_review() -> void:
	var report: Dictionary = Game.state.get("weekReport", {})
	if report.is_empty():
		return
	overlay_layer.mouse_filter = Control.MOUSE_FILTER_STOP
	var sheet := WeekReview.new()
	overlay_layer.add_child(sheet)
	sheet.setup(report)
	await sheet.dismissed
	if is_instance_valid(sheet):
		sheet.queue_free()
	overlay_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE

func show_dilemma(d: Dictionary) -> void:
	overlay_layer.mouse_filter = Control.MOUSE_FILTER_STOP
	var popup := DilemmaPopup.new()
	popup.main = self
	overlay_layer.add_child(popup)
	popup.setup(d)
	await popup.resolved
	if is_instance_valid(popup):
		popup.queue_free()
	overlay_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE

# ---------------------------------------------------------------------------
# Toasts
# ---------------------------------------------------------------------------
func show_pause_menu() -> void:
	for c in overlay_layer.get_children():
		if c is PauseMenu:
			return
	overlay_layer.mouse_filter = Control.MOUSE_FILTER_STOP
	var menu := PauseMenu.new()
	menu.main = self
	overlay_layer.add_child(menu)
	menu.closed.connect(func():
		if is_instance_valid(menu): menu.queue_free()
		overlay_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE)
	menu.request.connect(func(action: String):
		if is_instance_valid(menu): menu.queue_free()
		overlay_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_menu_action(action))

func _menu_action(action: String) -> void:
	match action:
		"load":
			if Game.load_game():
				go_to("hq")
				show_toast("Campaign loaded.", "good")
			else:
				show_toast("No save found.", "bad")
		"settings":
			go_to("settings", {"return_to": "hq"})
		"restart":
			var st: Dictionary = Game.state
			if st.is_empty():
				go_to("title")
				return
			var player: Dictionary = st.player.duplicate(true)
			Game.new_game(str(st.districtId), str(st.difficultyId), player)
			go_to("hq")
			show_toast("Race restarted.", "good")
		"title":
			go_to("title")
		"quit":
			get_tree().quit()

func show_toast(text: String, kind := "info") -> void:
	var panel := UI.panel()
	panel.modulate.a = 0.0
	var col := Palette.GOOD if kind == "good" else (Palette.BAD if kind == "bad" else Palette.INK)
	var lbl := UI.label(text, 15, col)
	panel.add_child(lbl)
	panel.position = Vector2(size.x * 0.5 - 120, size.y - 90)
	panel.custom_minimum_size = Vector2(240, 0)
	toast_layer.add_child(panel)
	var tw := create_tween()
	tw.tween_property(panel, "modulate:a", 1.0, 0.2)
	tw.tween_interval(1.6)
	tw.tween_property(panel, "modulate:a", 0.0, 0.5)
	tw.tween_callback(panel.queue_free)

# ---------------------------------------------------------------------------
# Selftest passthrough (headless)
# ---------------------------------------------------------------------------
func _selftest() -> void:
	var player := {
		"name": "Alex Rivera", "party": "D",
		"attrs": {"charisma": 0.6, "competence": 0.6, "integrity": 0.6, "fundraising": 0.5},
		"positions": {"taxes_spending": 0.2, "healthcare": 0.3, "immigration": 0.1, "guns": 0.2, "abortion": 0.3, "climate_energy": 0.4, "crime_policing": 0.1, "social_culture": 0.2},
		"traits": ["grassroots"], "baseExposure": 0.1, "baseFavorability": 0.0,
	}
	Game.new_game("pa-07", "normal", player, 12345)
	var wk := 0
	while Game.weeks_left() > 0 and wk < 40:
		for aid in ["fundraiser", "tv_positive", "canvass", "rally", "digital"]:
			if Game.can_do(aid): Game.do_action(aid)
		Game.end_week()
		wk += 1
	var res := Game.run_election()
	print("SELFTEST result: player=%.1f%% -> %s" % [float(res.shares.get("player",0))*100.0, ("WON" if res.won else "LOST")])
	get_tree().quit()
