class_name ElectionNight
extends GameScreen
## Election night as a broadcast, not a progress bar.
##
## The simulation has already decided the result before this screen opens — every
## number here is real and final. What this screen controls is the ORDER the
## county clerks hand it over in, and that order is the whole show:
##
##   * The true totals are distributed across the district's precincts, weighted
##     by each precinct's demographics, so they add back up to the sim's result
##     exactly. No fudging — the map and the tally can never disagree.
##   * Rural precincts count fast and report first; the dense town clusters count
##     slowest and land last. That produces a genuine early-returns bias that
##     unwinds as the cities come in — the shape of a real election night.
##   * Within that, a precinct's reporting time is pushed back by how CLOSE it is,
##     so blowout boxes dump immediately and the knife-edge ones are still
##     outstanding at 95%.
##   * The race is called on a schedule derived from the real final margin — a
##     landslide gets called around 30% in, a coin-flip runs to the final box —
##     and the count keeps running behind the call. Nothing waits for an
##     arbitrary 100%, and the projection never contradicts the tally.
##
## The result: you can lose a race you were winning at 40% reporting, and the
## screen never lies to you about why.

const REPORT_SECONDS := 26.0      # a normal count, before the speed control

var result: Dictionary = {}
var _map: MapView
var _needle: Needle
var _fx: Confetti

var _order: Array = []            # cell indices, in the order they report
var _next := 0
var _counted: Dictionary = {}     # cid -> votes counted so far
var _total_votes := 0.0
var _clock := 0.0
var _speed := 1.0
var _leader := ""
var _called := false

var _rows: Dictionary = {}        # cid -> {bar, pct, votes, row}
var _reporting_lbl: Label
var _status: PanelContainer
var _status_lbl: Label
var _margin_lbl: Label
var _turnout_lbl: Label
var _wire: VBoxContainer
var _banner: Label
var _continue: Button
var _speed_btn: Button
var _wire_lines: Array = []
var _fired: Dictionary = {}       # one-shot commentary triggers
var _rng := RandomNumberGenerator.new()

# ---------------------------------------------------------------------------
func on_enter(_data: Variant = null) -> void:
	result = Game.run_election()
	Game.set_phase("election")
	_rng.seed = hash(str(Game.state.get("seed", 0)) + str(Game.state.district.get("id", "")))
	_total_votes = float(result.get("totalVotes", 0))
	_fx = Confetti.new()
	add_child(_fx)

	var root := page(22, 10)

	var header := UI.hbox(12)
	header.add_child(UI.title("ELECTION NIGHT", 34))
	header.add_child(UI.spacer())
	header.add_child(UI.label(Game.state.district.get("name", ""), 15, Palette.MUTED))
	header.add_child(_build_speed())
	root.add_child(header)

	var body := UI.hbox(14)
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	root.add_child(body)
	body.add_child(_build_map_panel())
	body.add_child(_build_desk())

	for c in Game.all_candidates():
		_counted[c.id] = 0.0
	_build_precincts()
	_map.start_reporting()

	Audio.play_music("tension")
	_say("Polls have closed across %s. First returns any moment." % Game.state.district.get("name", "the district"))
	set_process(true)

# ---------------------------------------------------------------------------
# Layout
# ---------------------------------------------------------------------------
func _build_map_panel() -> Control:
	var panel := UI.panel()
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var v := UI.vbox(6)
	panel.add_child(v)
	_reporting_lbl = UI.num("0% in", 13, Palette.GOLD.darkened(0.15))
	v.add_child(UI.section("Precincts Reporting", Palette.GOOD, _reporting_lbl))
	_map = MapView.new()
	_map.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_map.custom_minimum_size = Vector2(400, 300)
	_map.configure(Game.state.district)
	for c in Game.all_candidates():
		_map.lead_colors[c.id] = Palette.party_color(c.party)
	v.add_child(_map)
	var legend := UI.hbox(14)
	legend.add_child(UI.label("○ outstanding", 11, Palette.FAINT))
	legend.add_child(UI.label("● counted — shaded by margin", 11, Palette.FAINT))
	legend.add_child(UI.spacer())
	legend.add_child(UI.label("Rural boxes count first; the towns come in last.", 11, Palette.FAINT))
	v.add_child(legend)
	return panel

func _build_desk() -> Control:
	var col := UI.vbox(10)
	col.custom_minimum_size = Vector2(432, 0)

	var needle_panel := UI.panel()
	var nv := UI.vbox(4)
	needle_panel.add_child(nv)
	nv.add_child(UI.section("Win Probability", Palette.IND))
	_needle = Needle.new()
	_needle.custom_minimum_size = Vector2(400, 150)
	_needle.label_right = "YOU"
	nv.add_child(_needle)
	col.add_child(needle_panel)

	var tally := UI.panel()
	var tv := UI.vbox(7)
	tally.add_child(tv)
	_status = UI.chip("COUNTING", Palette.MUTED, 0.16)
	_status_lbl = _status.get_child(0)
	tv.add_child(UI.section("The Count", Palette.GOLD2, _status))
	for c in Game.all_candidates():
		tv.add_child(_tally_row(c))
	tv.add_child(UI.rule())
	var mrow := UI.hbox(8)
	mrow.add_child(UI.label("Margin", 12, Palette.MUTED))
	mrow.add_child(UI.spacer())
	_margin_lbl = UI.num("—", 14, Palette.INK)
	mrow.add_child(_margin_lbl)
	tv.add_child(mrow)
	var trow := UI.hbox(8)
	trow.add_child(UI.label("Ballots counted", 12, Palette.MUTED))
	trow.add_child(UI.spacer())
	_turnout_lbl = UI.num("0", 14, Palette.MUTED)
	trow.add_child(_turnout_lbl)
	tv.add_child(trow)
	col.add_child(tally)

	# The anchor desk. Every line is generated from what actually just happened.
	var wire_panel := UI.quiet_panel()
	wire_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var wv := UI.vbox(6)
	wire_panel.add_child(wv)
	wv.add_child(UI.section("At the Desk", Palette.BAD))
	# In a scroller so a long line of copy can't grow the panel's minimum height
	# and shove the Continue button off the bottom of the screen.
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.custom_minimum_size = Vector2(0, 96)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_wire = UI.vbox(5)
	_wire.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(_wire)
	wv.add_child(scroll)
	col.add_child(wire_panel)

	_banner = UI.title("", 24)
	_banner.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(_banner)

	# Always present, so the call doesn't grow the column and shove itself off screen.
	_continue = UI.button("Counting…", true)
	_continue.custom_minimum_size = Vector2(0, 44)
	_continue.disabled = true
	_continue.pressed.connect(func(): Audio.sfx("click"); go("results", result))
	col.add_child(_continue)
	return col

func _build_speed() -> Control:
	var h := UI.hbox(6)
	_speed_btn = UI.button("Speed  1×")
	_speed_btn.tooltip_text = "Cycle the count speed: 1× → 2× → 4×  (S)"
	_speed_btn.pressed.connect(_cycle_speed)
	h.add_child(_speed_btn)
	var skip := UI.button("Skip to the call")
	skip.tooltip_text = "Jump straight to the projection  (Space)"
	skip.pressed.connect(_skip)
	h.add_child(skip)
	return h

func _cycle_speed() -> void:
	Audio.sfx("click")
	_speed = 1.0 if _speed >= 4.0 else _speed * 2.0
	_speed_btn.text = "Speed  %d×" % int(_speed)

func _tally_row(c: Dictionary) -> Control:
	var col := Palette.party_color(c.party)
	var v := UI.vbox(3)
	var top := UI.hbox(8)
	var nm := UI.label(c.name, 15, Palette.INK if c.id == "player" else Palette.MUTED)
	nm.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(nm)
	var pct := UI.num("0.0%", 16, col)
	top.add_child(pct)
	v.add_child(top)
	var bar := ProgressBar.new()
	bar.show_percentage = false
	bar.min_value = 0; bar.max_value = 1; bar.value = 0
	bar.custom_minimum_size = Vector2(0, 14)
	bar.add_theme_stylebox_override("fill", UI.flat(col, 4))
	bar.add_theme_stylebox_override("background", UI.flat(Palette.BG2, 4, 1, Palette.BORDER))
	v.add_child(bar)
	var votes := UI.num("0 votes", 11, Palette.FAINT)
	v.add_child(votes)
	_rows[c.id] = {"bar": bar, "pct": pct, "votes": votes, "name": nm}
	return v

# ---------------------------------------------------------------------------
# Tabulation: split the real result across real precincts
# ---------------------------------------------------------------------------
func _build_precincts() -> void:
	_order = _map.tabulate(result, Game.all_candidates(), int(_rng.seed))

## Replay the count without the clock and report the fraction of precincts in
## when the race gets called. Used by the --enight harness to check that
## landslides resolve early and knife-edges go to the final box.
func call_point() -> float:
	var run: Dictionary = {}
	for cid in _counted:
		run[cid] = 0.0
	var counted := 0.0
	var true_winner: String = "player" if bool(result.get("won", false)) else _top_opponent()
	var sched := _call_point_for(_final_margin_pts())
	for n in _order.size():
		var cell: Dictionary = _map.cells[_order[n]]
		for cid in cell["votes"]:
			run[cid] = float(run[cid]) + float(cell["votes"][cid])
			counted += float(cell["votes"][cid])
		var top := ""
		var top_v := -1.0
		var second := 0.0
		for cid in run:
			var v: float = float(run[cid])
			if v > top_v:
				second = top_v
				top_v = v
				top = cid
			elif v > second:
				second = v
		var rep: float = float(n + 1) / float(_order.size())
		if top_v - maxf(second, 0.0) > maxf(_total_votes - counted, 0.0):
			return rep
		if rep >= sched and top == true_winner:
			return rep
	return 1.0

func _process(delta: float) -> void:
	if _order.is_empty():
		if not _called:
			_finish_count()
			_declare()
		set_process(false)
		return
	if _next >= _order.size():
		# every box is in — settle on the simulation's exact figures and stop
		_finish_count()
		if not _called:
			_declare()
		else:
			_once("wrapped", func(): _say("All precincts reporting. That is the final count."))
		set_process(false)
		return
	# once the race is called the remaining boxes come in quickly — nobody wants to
	# watch twenty more minutes of arithmetic after the confetti
	_clock += delta * _speed * (2.6 if _called else 1.0)
	var want := int(round(_ease(clampf(_clock / REPORT_SECONDS, 0.0, 1.0)) * _order.size()))
	var moved := false
	while _next < want and _next < _order.size():
		_count_precinct(_order[_next])
		_next += 1
		moved = true
	if moved:
		if not _called:
			Audio.sfx("tick", -16.0, 0.85 + _rng.randf() * 0.4)
		_refresh()
		_commentary()
		if not _called:
			_check_call()

## Returns arrive in a rush and then trail off, the way real returns do.
func _ease(t: float) -> float:
	return 1.0 - pow(1.0 - t, 1.7)

func _count_precinct(i: int) -> void:
	var cell: Dictionary = _map.cells[i]
	for cid in cell["votes"]:
		_counted[cid] = float(_counted.get(cid, 0.0)) + float(cell["votes"][cid])
	var finished_town: int = _map.reveal_cell(i)
	if finished_town >= 0:
		var t: Dictionary = _map.towns[finished_town]
		var who := str(cell.get("lead", ""))
		_say("%s has finished counting — %s carries it." % [str(t["name"]), _short_name(who)])

func _finish_count() -> void:
	while _next < _order.size():
		_count_precinct(_order[_next])
		_next += 1
	# snap to the sim's exact numbers so the last decimal can never drift
	for cid in _counted:
		_counted[cid] = float(result.shares.get(cid, 0.0)) * _total_votes
	_refresh()

func _counted_total() -> float:
	var t := 0.0
	for cid in _counted:
		t += float(_counted[cid])
	return t

func _reporting() -> float:
	if _order.is_empty():
		return 1.0
	return float(_next) / float(_order.size())

func _standings() -> Array:
	var arr: Array = []
	for cid in _counted:
		arr.append({"id": cid, "votes": float(_counted[cid])})
	arr.sort_custom(func(a, b): return float(a["votes"]) > float(b["votes"]))
	return arr

# ---------------------------------------------------------------------------
func _refresh() -> void:
	var counted := _counted_total()
	var rep := _reporting()
	_map.set_report_pct(rep)
	_reporting_lbl.text = "%d%% in" % int(round(rep * 100.0))
	_turnout_lbl.text = Game._comma(int(round(counted)))

	for cid in _rows:
		var share: float = float(_counted.get(cid, 0.0)) / maxf(counted, 1.0)
		var row: Dictionary = _rows[cid]
		row["bar"].value = share
		row["pct"].text = "%.1f%%" % (share * 100.0)
		row["votes"].text = "%s votes" % Game._comma(int(round(float(_counted.get(cid, 0.0)))))

	var st := _standings()
	if st.size() >= 2:
		var lead_votes: float = float(st[0]["votes"]) - float(st[1]["votes"])
		var lead_pts: float = lead_votes / maxf(counted, 1.0) * 100.0
		var player_ahead: bool = str(st[0]["id"]) == "player"
		_margin_lbl.text = "%s +%.1f pts  ·  %s" % [
			_short_name(str(st[0]["id"])), lead_pts, Game._comma(int(round(lead_votes)))]
		_margin_lbl.add_theme_color_override("font_color", Palette.GOOD if player_ahead else Palette.BAD)
		# The needle reads the count, never the answer. It asks: could the vote still
		# outstanding overturn this margin? Uncertainty shrinks as the pile shrinks,
		# so a 7-point lead at 20% in is genuinely shakier than at 90% in.
		var outstanding_frac: float = clampf(1.0 - counted / maxf(_total_votes, 1.0), 0.0, 1.0)
		var se: float = maxf(0.22 * pow(outstanding_frac, 0.65), 0.0015)
		var z: float = (lead_pts / 100.0) / se
		var prob: float = 1.0 / (1.0 + exp(-1.702 * z))
		if not player_ahead:
			prob = 1.0 - prob
		_needle.set_prob(clampf(prob, 0.01, 0.99), (1.0 - rep) * 0.10)

	# bold whoever is ahead — the tally should read at a glance
	for cid in _rows:
		var is_lead: bool = st.size() > 0 and str(st[0]["id"]) == cid
		_rows[cid]["name"].add_theme_color_override("font_color",
			Palette.INK if (is_lead or cid == "player") else Palette.MUTED)

# ---------------------------------------------------------------------------
# Calling the race
# ---------------------------------------------------------------------------
## When the desk is willing to put its name on the race, as a fraction of
## precincts in — derived from the FINAL margin, not from the running count.
##
## Trying to project off the count itself does not work here: the reporting
## order is deliberately unrepresentative (rural first, tight boxes last), so a
## threshold loose enough to call a landslide early also calls half-point races
## at 65% and then has to watch the margin close. Scheduling the call from the
## true margin instead gives the thing that actually matters — a landslide
## resolves fast and feels triumphal, a coin-flip runs to the final box — and it
## never contradicts itself. It is the same trick The Campaign Trail uses to
## order its state calls, and it is the most-praised thing in that game.
func _call_point_for(margin_pts: float) -> float:
	var m := absf(margin_pts)
	if m >= 20.0: return 0.30
	if m >= 12.0: return 0.42
	if m >= 8.0:  return 0.55
	if m >= 5.0:  return 0.68
	if m >= 3.0:  return 0.80
	if m >= 1.5:  return 0.90
	if m >= 0.5:  return 0.97
	return 1.0

func _final_margin_pts() -> float:
	var mine: float = float(result.shares.get("player", 0.0))
	var best := 0.0
	for cid in result.get("shares", {}):
		if cid == "player": continue
		best = maxf(best, float(result.shares[cid]))
	return absf(mine - best) * 100.0

func _check_call() -> void:
	var st := _standings()
	if st.size() < 2:
		return
	var counted := _counted_total()
	var outstanding: float = maxf(_total_votes - counted, 0.0)
	var lead: float = float(st[0]["votes"]) - float(st[1]["votes"])
	var lead_pts: float = lead / maxf(counted, 1.0) * 100.0
	var rep := _reporting()

	# Arithmetically out of reach — the desk would call this no matter what.
	if lead > outstanding:
		_leader = str(st[0]["id"])
		_declare()
		return
	# Scheduled call. Never fires while the wrong candidate is still nominally
	# ahead, so the projection and the tally can't disagree on screen.
	var true_winner: String = "player" if bool(result.get("won", false)) else _top_opponent()
	if rep >= _call_point_for(_final_margin_pts()) and str(st[0]["id"]) == true_winner:
		_leader = true_winner
		_declare()
		return
	if rep > 0.70 and lead_pts < 2.0:
		_once("wire", func(): _flag("TOO CLOSE TO CALL", Palette.BAD))

func _top_opponent() -> String:
	var best := ""
	var best_v := -1.0
	for cid in result.get("shares", {}):
		if cid == "player": continue
		if float(result.shares[cid]) > best_v:
			best_v = float(result.shares[cid])
			best = cid
	return best

## The call is not the end of the night. Precincts keep coming in behind it —
## that is what makes an early call feel like a rout instead of a cut to black.
func _declare() -> void:
	if _called:
		return
	_called = true
	var won: bool = bool(result.get("won", false))
	var winner: String = "player" if won else _top_opponent()
	if _reporting() >= 1.0:
		_finish_count()

	_flag("RACE CALLED", Palette.GOOD if won else Palette.BAD)
	Audio.sfx("gavel")
	var pct := int(round(_reporting() * 100.0))
	_say("PROJECTED WINNER: %s. Called at %d%% of precincts reporting." % [_short_name(winner), pct], true)

	if won:
		_banner.text = "YOU WIN"
		_banner.add_theme_color_override("font_color", Palette.GOOD)
		Audio.stop_music()
		Audio.play_music("victory")
		Audio.sfx("cheer")
		_fx.celebrate(size.x)
	else:
		_banner.text = "THE RACE IS CALLED"
		_banner.add_theme_color_override("font_color", Palette.BAD)
		Audio.sfx("fail")
	_continue.text = "  Continue  →     (Space)"
	_continue.disabled = false
	_continue.grab_focus()
	if _reporting() < 0.995:
		_say("Counting continues in the outstanding precincts.")

func _flag(text: String, col: Color) -> void:
	if not is_instance_valid(_status_lbl):
		return
	_status_lbl.text = text
	_status_lbl.add_theme_color_override("font_color", col.darkened(0.25))
	var box := UI.flat(Color(col.r, col.g, col.b, 0.18), 4, 1, col.lerp(Palette.PANEL, 0.45))
	box.content_margin_left = 8; box.content_margin_right = 8
	box.content_margin_top = 3; box.content_margin_bottom = 3
	_status.add_theme_stylebox_override("panel", box)

# ---------------------------------------------------------------------------
# The anchor desk
# ---------------------------------------------------------------------------
func _once(key: String, fn: Callable) -> void:
	if _fired.has(key):
		return
	_fired[key] = true
	fn.call()

func _commentary() -> void:
	var rep := _reporting()
	var st := _standings()
	if st.size() < 2:
		return
	var counted := _counted_total()
	var lead_pts: float = (float(st[0]["votes"]) - float(st[1]["votes"])) / maxf(counted, 1.0) * 100.0
	var top := str(st[0]["id"])

	if rep >= 0.04:
		_once("first", func(): _say("First returns are in from the rural boxes — %s out early." % _short_name(top)))

	# A dead-heat count flips the lead on nearly every box. Announcing all of them
	# turns the desk into noise, so a change has to be worth at least a third of a
	# point and can't land on top of the last one.
	if _leader == "":
		_leader = top
	elif top != _leader and rep >= 0.10 and lead_pts >= 0.35 \
	   and rep - float(_fired.get("lead_at", -1.0)) > 0.08:
		_leader = top
		_fired["lead_at"] = rep
		_say("LEAD CHANGE — %s moves ahead." % _short_name(top), true)
		Audio.sfx("blip")

	for mark in [0.25, 0.50, 0.75, 0.90]:
		if rep >= mark:
			_once("m%d" % int(mark * 100), func():
				_say("%d%% of precincts reporting. %s leads by %.1f." % [
					int(mark * 100), _short_name(top), lead_pts]))

	if rep > 0.55 and lead_pts < 1.5:
		_once("tight", func(): _say("This one is going to the wire."))
	if rep > 0.60 and lead_pts > 12.0:
		_once("rout", func(): _say("The margin is opening up. This is turning into a rout."))

## Newest line at the top; the desk only keeps what fits.
func _say(text: String, loud := false) -> void:
	if not is_instance_valid(_wire):
		return
	var row := UI.hbox(6)
	var tick := UI.label("▸", 11, Palette.BAD if loud else Palette.BORDER_HI)
	tick.custom_minimum_size = Vector2(10, 0)
	row.add_child(tick)
	var l := UI.label(text, 12, Palette.INK if loud else Palette.MUTED)
	if loud:
		l.add_theme_font_override("font", Palette.font_ui_bold)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(l)
	_wire.add_child(row)
	_wire.move_child(row, 0)
	_wire_lines.append(row)
	while _wire_lines.size() > 8:
		var old: Control = _wire_lines.pop_front()
		if is_instance_valid(old):
			old.queue_free()
	if not Game.settings.get("reduced_motion", false):
		row.modulate.a = 0.0
		var tw := create_tween()
		tw.tween_property(row, "modulate:a", 1.0, 0.18)

func _short_name(cid: String) -> String:
	for c in Game.all_candidates():
		if c.id == cid:
			var n := str(c.name)
			var paren := n.find(" (")
			return n.substr(0, paren) if paren > 0 else n
	return "the leader"

# ---------------------------------------------------------------------------
func _skip() -> void:
	if _called:
		go("results", result)
		return
	_finish_count()
	var st := _standings()
	if st.size() > 0:
		_leader = str(st[0]["id"])
	_declare()

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		match event.keycode:
			KEY_SPACE, KEY_ENTER:
				_skip()
				get_viewport().set_input_as_handled()
			KEY_S:
				_cycle_speed()
				get_viewport().set_input_as_handled()
