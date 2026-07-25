class_name ElectionNight
extends GameScreen

var result: Dictionary = {}
var _map: MapView
var _needle: Needle
var _fx: Confetti
var _report_pct := 0.0
var _rows: Dictionary = {}      # cid -> {bar, pct, votes}
var _reporting_lbl: Label
var _banner: Label
var _continue: Button
var _declared := false
var _t := 0.0

func on_enter(_data: Variant = null) -> void:
	result = Game.run_election()
	Game.set_phase("election")
	_fx = Confetti.new()
	add_child(_fx)

	var root := page(24, 12)

	var header := UI.hbox(10)
	header.alignment = BoxContainer.ALIGNMENT_CENTER
	var t := UI.title("ELECTION NIGHT", 40)
	header.add_child(t)
	root.add_child(header)
	var sub := UI.label(Game.state.district.get("name", ""), 16, Palette.MUTED)
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	root.add_child(sub)

	var body := UI.hbox(18)
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	root.add_child(body)

	# left: map reporting
	var map_panel := UI.panel()
	map_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var mv := UI.vbox(6)
	map_panel.add_child(mv)
	mv.add_child(UI.kicker("Precincts Reporting"))
	_map = MapView.new()
	_map.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_map.custom_minimum_size = Vector2(420, 320)
	_map.configure(Game.state.district)
	_map.set_projection(float(result.shares.get("player", 0.5)), _final_seg_support())
	_map.start_reporting()
	mv.add_child(_map)
	body.add_child(map_panel)

	# right: needle + tallies
	var right := UI.vbox(14)
	right.custom_minimum_size = Vector2(440, 0)

	var needle_panel := UI.panel()
	var nv := UI.vbox(4)
	needle_panel.add_child(nv)
	nv.add_child(UI.kicker("Win Probability"))
	_needle = Needle.new()
	_needle.custom_minimum_size = Vector2(400, 160)
	_needle.label_right = "YOU"
	nv.add_child(_needle)
	right.add_child(needle_panel)

	var tally_panel := UI.panel()
	tally_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var tv := UI.vbox(10)
	tally_panel.add_child(tv)
	var th := UI.hbox(8)
	th.add_child(UI.kicker("The Count"))
	th.add_child(UI.spacer())
	_reporting_lbl = UI.label("0% reporting", 13, Palette.GOLD)
	_reporting_lbl.add_theme_font_override("font", Palette.font_mono)
	th.add_child(_reporting_lbl)
	tv.add_child(th)
	for c in Game.all_candidates():
		tv.add_child(_tally_row(c))
	right.add_child(tally_panel)

	_banner = UI.title("", 30)
	_banner.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	right.add_child(_banner)

	_continue = UI.button("  Continue  →", true)
	_continue.custom_minimum_size = Vector2(0, 46)
	_continue.visible = false
	_continue.pressed.connect(func(): Audio.sfx("click"); go("results", result))
	right.add_child(_continue)

	body.add_child(right)
	Audio.play_music("tension")
	set_process(true)

func _tally_row(c: Dictionary) -> Control:
	var col := Palette.party_color(c.party)
	var v := UI.vbox(3)
	var top := UI.hbox(8)
	top.add_child(UI.label(c.name, 15, Palette.INK if c.id == "player" else Palette.MUTED))
	top.add_child(UI.spacer())
	var pct := UI.label("0.0%", 15, col)
	pct.add_theme_font_override("font", Palette.font_mono)
	top.add_child(pct)
	v.add_child(top)
	var bar := ProgressBar.new()
	bar.show_percentage = false
	bar.min_value = 0; bar.max_value = 1; bar.value = 0
	bar.custom_minimum_size = Vector2(0, 14)
	bar.add_theme_stylebox_override("fill", UI.flat(col, 4))
	bar.add_theme_stylebox_override("background", UI.flat(Palette.BG2, 4, 1, Palette.BORDER))
	v.add_child(bar)
	var votes := UI.label("0 votes", 11, Palette.FAINT)
	votes.add_theme_font_override("font", Palette.font_mono)
	v.add_child(votes)
	_rows[c.id] = {"bar": bar, "pct": pct, "votes": votes}
	return v

func _final_seg_support() -> Dictionary:
	var out := {}
	for seg in result.get("segments", {}):
		var votes: Dictionary = result.segments[seg]
		var tot := 0.0
		for cid in votes: tot += float(votes[cid])
		out[seg] = float(votes.get("player", 0.0)) / tot if tot > 0 else 0.5
	return out

func _process(delta: float) -> void:
	_t += delta
	if _report_pct < 1.0:
		_report_pct = minf(1.0, _report_pct + delta * 0.16)
	var total_votes: float = float(result.get("totalVotes", 0))
	# noisy early, settling shares
	var wobble := (1.0 - _report_pct) * 0.06
	for cid in _rows:
		var final_share: float = float(result.shares.get(cid, 0.0))
		var noise := sin(_t * 5.0 + hash(cid) % 7) * wobble
		var shown: float = clampf(final_share + noise, 0.0, 1.0)
		var row: Dictionary = _rows[cid]
		row["bar"].value = shown
		row["pct"].text = "%.1f%%" % (shown * 100.0)
		row["votes"].text = "%s votes" % Game._comma(int(total_votes * final_share * _report_pct))
	_reporting_lbl.text = "%d%% reporting" % int(_report_pct * 100)
	# needle: read the margin from the votes counted SO FAR, with uncertainty that
	# narrows as precincts report. Early returns swing; the call tightens.
	var counted := maxf(_report_pct, 0.001)
	var lead := 0.0
	for cid in _rows:
		if cid == "player": continue
		lead = maxf(lead, float(result.shares.get(cid, 0.0)))
	var true_margin: float = float(result.shares.get("player", 0.0)) - lead
	# a seeded early-return bias that decays to zero as the count completes
	var bias := sin(float(hash(str(result.get("winner", "")))) * 0.0001 + 1.7) * 0.16
	var seen_margin: float = true_margin + bias * (1.0 - counted)
	var conf: float = 1.2 + 6.0 * counted          # confidence grows with the count
	var prob := clampf(0.5 + seen_margin * conf, 0.02, 0.98)
	_needle.set_prob(prob, (1.0 - _report_pct) * 0.16)
	if _report_pct >= 1.0 and not _declared:
		_declare()

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode in [KEY_SPACE, KEY_ENTER]:
			if _report_pct < 1.0:
				_report_pct = 1.0          # skip to the call
			elif _declared:
				go("results", result)
			get_viewport().set_input_as_handled()

func _top_opp_share() -> float:
	var best := 0.0
	for o in Game.state.opponents:
		best = maxf(best, float(result.shares.get(o.id, 0.0)))
	return best

func _declare() -> void:
	_declared = true
	if result.get("won", false):
		_banner.text = "PROJECTED WINNER"
		_banner.add_theme_color_override("font_color", Palette.GOOD)
		Audio.sfx("cheer")
		Audio.stop_music()
		Audio.play_music("victory")
		_fx.celebrate(size.x)
	else:
		_banner.text = "THE RACE IS CALLED"
		_banner.add_theme_color_override("font_color", Palette.BAD)
		Audio.sfx("fail")
	_continue.visible = true
