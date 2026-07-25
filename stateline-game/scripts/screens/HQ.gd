class_name HQ
extends GameScreen
## The campaign headquarters dashboard — the game's main loop lives here.

var _map: MapView
var _chart: PollChart
var _fx: Confetti

# dynamic labels
var _cash_lbl: Label
var _ap_ctl: Control
var _week_lbl: Label
var _phase_lbl: Label
var _fav_g: Gauge
var _name_g: Gauge
var _cash_g: Gauge
var _mom_g: Gauge
var _news_box: VBoxContainer
var _wire_box: VBoxContainer
var _staff_box: VBoxContainer
var _ticker: Ticker
var _action_rows: Array = []    # {id, button, sub}
var _end_btn: Button
var _busy := false
var _cat := "Air War"
var _cat_bar: HBoxContainer
var _deck: GridContainer
var _prev: Dictionary = {}          # last week's values, for deltas
var _staff_strip: Button

func on_enter(_data: Variant = null) -> void:
	_fx = Confetti.new()
	add_child(_fx)

	var root := page(16, 10)

	root.add_child(_build_topbar())
	root.add_child(_build_ticker())

	var body := UI.hbox(14)
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	root.add_child(body)
	body.add_child(_build_left())
	body.add_child(_build_center())
	body.add_child(_build_right())

	root.add_child(_build_bottom())

	Game.state_changed.connect(refresh)
	Game.poll_updated.connect(refresh)
	Game.action_performed.connect(_on_action_feedback)
	refresh()

func on_exit() -> void:
	if Game.state_changed.is_connected(refresh): Game.state_changed.disconnect(refresh)
	if Game.poll_updated.is_connected(refresh): Game.poll_updated.disconnect(refresh)

# ---------------------------------------------------------------------------
# Top bar
# ---------------------------------------------------------------------------
func _build_topbar() -> Control:
	var panel := UI.panel()
	panel.custom_minimum_size = Vector2(0, 70)
	var h := UI.hbox(14)
	panel.add_child(h)

	var port := Portrait.new()
	port.custom_minimum_size = Vector2(52, 52)
	port.set_features(Game.player().get("features", {}))
	port.set_party(Game.player().get("party", "I"))
	h.add_child(port)

	var idv := UI.vbox(1)
	var pl: Dictionary = Game.player()
	var nm := UI.label(pl.get("name", "You"), 18, Palette.INK)
	idv.add_child(nm)
	var dist := UI.label("%s · %s" % [Game.state.district.get("name", ""), _party_word(pl.get("party","I"))], 12, Palette.MUTED)
	idv.add_child(dist)
	h.add_child(idv)

	h.add_child(UI.spacer())

	h.add_child(_pill("Campaign", Palette.ACCENT))

	_week_lbl = UI.label("", 14, Palette.INK)
	_week_lbl.tooltip_text = "Weeks remaining before election day.\nEffects ramp up and decay over time, so late spending lands harder — but ads fatigue."
	_week_lbl.mouse_filter = Control.MOUSE_FILTER_STOP
	_week_lbl.custom_minimum_size = Vector2(150, 0)
	_week_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	h.add_child(_week_lbl)

	var cashv := UI.vbox(0)
	cashv.tooltip_text = "Money on hand. Spend it — cash in the bank on election day wins zero votes.\nIncome comes from fundraisers, the weekly small-dollar trickle and your Finance Director."
	cashv.mouse_filter = Control.MOUSE_FILTER_STOP
	cashv.add_child(UI.label("WAR CHEST", 10, Palette.FAINT))
	_cash_lbl = UI.label("$0", 18, Palette.GOLD)
	_cash_lbl.add_theme_font_override("font", Palette.font_mono)
	cashv.add_child(_cash_lbl)
	h.add_child(cashv)

	var apv := UI.vbox(0)
	apv.tooltip_text = "Action points left this week. Every move costs at least one.\nThey refresh when you end the week; a Campaign Manager grants one more."
	apv.mouse_filter = Control.MOUSE_FILTER_STOP
	apv.add_child(UI.label("ACTIONS", 10, Palette.FAINT))
	_ap_ctl = Control.new()
	_ap_ctl.custom_minimum_size = Vector2(132, 22)
	_ap_ctl.draw.connect(_draw_ap)
	apv.add_child(_ap_ctl)
	h.add_child(apv)

	var menu := UI.button("Menu")
	menu.tooltip_text = "Menu — save, load, settings, restart, quit  (Esc)"
	menu.pressed.connect(_open_menu)
	h.add_child(menu)
	return panel

func _draw_ap() -> void:
	var cur: int = int(Game.state.get("ap", 0))
	var mx: int = int(Game.state.get("maxAP", 3))
	if Game.staff_has("manager"): mx += 1
	var x := 6.0
	for i in maxi(mx, cur):
		var filled := i < cur
		_ap_ctl.draw_circle(Vector2(x, 11), 7, Palette.GOLD if filled else Palette.PANEL2)
		_ap_ctl.draw_arc(Vector2(x, 11), 7, 0, TAU, 20, Palette.GOLD if filled else Palette.BORDER, 1.5, true)
		x += 18

# ---------------------------------------------------------------------------
# Left: map + race wire
# ---------------------------------------------------------------------------
func _build_left() -> Control:
	var col := UI.vbox(12)
	col.custom_minimum_size = Vector2(340, 0)

	var map_panel := UI.panel()
	var mv := UI.vbox(8)
	map_panel.add_child(mv)
	var mk := UI.kicker("The District")
	mk.tooltip_text = "Each cell is a precinct, tinted by projected support.\nThe bus marks where your campaign has been. On election night these report one by one."
	mk.mouse_filter = Control.MOUSE_FILTER_STOP
	mv.add_child(mk)
	_map = MapView.new()
	_map.custom_minimum_size = Vector2(300, 210)
	_map.configure(Game.state.district)
	mv.add_child(_map)
	col.add_child(map_panel)

	var wire := UI.panel()
	var wv := UI.vbox(8)
	wire.add_child(wv)
	var wk := UI.kicker("Race Wire")
	wk.tooltip_text = "Everyone on the ballot, with their latest polling and an estimate of their money.\nOpponent cash is an estimate — your own figure is exact."
	wk.mouse_filter = Control.MOUSE_FILTER_STOP
	wv.add_child(wk)
	_wire_box = UI.vbox(8)
	wv.add_child(_wire_box)
	col.add_child(wire)
	col.add_child(UI.spacer())
	return col

# ---------------------------------------------------------------------------
# Center: polling + gauges + actions
# ---------------------------------------------------------------------------
func _build_center() -> Control:
	var col := UI.vbox(12)
	col.size_flags_horizontal = Control.SIZE_EXPAND_FILL

	var poll_panel := UI.panel()
	var pv := UI.vbox(6)
	poll_panel.add_child(pv)
	var ph := UI.hbox(8)
	var pk := UI.kicker("Polling — Your Share Over Time")
	pk.tooltip_text = "Sampled polls, not the true result. The shaded band is the margin of error.\nHire a Pollster or commission a poll for a tighter, more reliable read."
	pk.mouse_filter = Control.MOUSE_FILTER_STOP
	ph.add_child(pk)
	pv.add_child(ph)
	_chart = PollChart.new()
	_chart.custom_minimum_size = Vector2(0, 150)
	pv.add_child(_chart)
	col.add_child(poll_panel)

	# gauges
	var g_panel := UI.panel()
	var grid := GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 24)
	grid.add_theme_constant_override("v_separation", 10)
	g_panel.add_child(grid)
	_fav_g = _add_gauge(grid, "Net Favorability", true,
		"How warmly voters feel about you, from -100 to +100.\nRaised by positive ads, speeches and good weeks; cut by attacks and scandal.\nIt feeds directly into vote choice.")
	_name_g = _add_gauge(grid, "Name Recognition", false,
		"The share of voters who have heard of you at all.\nThis GATES everything: a voter who doesn't know you cannot vote for you,\nno matter how much they agree with you. Buy reach before persuasion.")
	_cash_g = _add_gauge(grid, "Weeks of Runway", false,
		"How many more weeks you could keep paying staff at your current burn.\nSalaries come out every week whether you act or not.")
	col.add_child(g_panel)

	# actions
	var act_panel := UI.panel()
	act_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var av := UI.vbox(8)
	act_panel.add_child(av)
	var ak := UI.kicker("This Week's Moves")
	ak.tooltip_text = "Spend action points and money here. Hover any move for exactly what it costs and does."
	ak.mouse_filter = Control.MOUSE_FILTER_STOP
	av.add_child(ak)
	_cat_bar = UI.hbox(4)
	av.add_child(_cat_bar)
	_deck = GridContainer.new()
	_deck.columns = 3
	_deck.add_theme_constant_override("h_separation", 8)
	_deck.add_theme_constant_override("v_separation", 8)
	_deck.size_flags_vertical = Control.SIZE_EXPAND_FILL
	av.add_child(_deck)
	_build_cat_bar()
	_build_deck()
	col.add_child(act_panel)
	return col

const CATS := ["Air War", "Ground Game", "Message", "Events", "Money"]

func _cat_count(cat: String) -> int:
	var n := 0
	for a in Game.ACTIONS:
		if a.cat == cat: n += 1
	return n

func _build_cat_bar() -> void:
	for c in _cat_bar.get_children(): c.queue_free()
	var i := 1
	for cat in CATS:
		var b := UI.selectable("%s (%d)" % [cat, _cat_count(cat)])
		b.button_pressed = cat == _cat
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.add_theme_font_size_override("font_size", 12)
		b.tooltip_text = "Show %s moves  (%d)" % [cat, i]
		b.pressed.connect(func():
			_cat = cat
			Audio.sfx("click")
			_build_cat_bar()
			_build_deck()
			refresh())
		_cat_bar.add_child(b)
		i += 1

func _build_deck() -> void:
	_action_rows.clear()
	for c in _deck.get_children():
		_deck.remove_child(c)
		c.queue_free()
	for a in Game.ACTIONS:
		if a.cat != _cat: continue
		_deck.add_child(_action_button(a))

func _add_gauge(grid: GridContainer, label: String, bipolar: bool, tip := "") -> Gauge:
	var g := Gauge.new()
	g.custom_minimum_size = Vector2(260, 40)
	g.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	g.bipolar = bipolar
	g.label_text = label
	g.tooltip_text = tip
	g.mouse_filter = Control.MOUSE_FILTER_STOP
	grid.add_child(g)
	return g

func _action_button(a: Dictionary) -> Control:
	var b := Button.new()
	b.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	b.custom_minimum_size = Vector2(150, 84)
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	UI._style_button(b, false)
	b.tooltip_text = Game.action_tooltip(a)
	var v := UI.vbox(1)
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var name_lbl := UI.label(a.label, 14, Palette.INK)
	name_lbl.clip_text = true
	v.add_child(name_lbl)
	var cost_row := UI.hbox(5)
	cost_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	cost_row.add_child(UI.label("●".repeat(int(a.ap)), 11, Palette.GOLD.darkened(0.15)))
	if int(a.cost) > 0:
		cost_row.add_child(UI.num("$" + Game._comma(int(a.cost)), 12, Palette.GOLD.darkened(0.25)))
	else:
		cost_row.add_child(UI.label("free", 11, Palette.GOOD))
	if int(a.get("fund", 0)) > 0:
		cost_row.add_child(UI.label("→ raises", 10, Palette.GOOD))
	v.add_child(cost_row)
	var sub := UI.label(a.desc, 11, Palette.MUTED)
	sub.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	sub.custom_minimum_size = Vector2(140, 0)
	sub.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	v.add_child(sub)
	var mc := UI.margin(8)
	mc.mouse_filter = Control.MOUSE_FILTER_IGNORE
	mc.add_child(v)
	b.add_child(mc)
	b.pressed.connect(func(): _do_action(a.id, b))
	_action_rows.append({"id": a.id, "button": b, "sub": sub})
	return b

func _do_action(id: String, b: Button) -> void:
	if _busy or not Game.can_do(id):
		Audio.sfx("fail")
		return
	var res := Game.do_action(id)
	# juice: float text near the button
	var gpos := b.global_position + Vector2(b.size.x * 0.5, 0)
	if res.get("raised", 0) > 0:
		_fx.float_text(gpos, "+$%s" % Game._comma(res.raised), Palette.GOLD)
	else:
		_fx.float_text(gpos, "✓ " + str(res.get("action", {}).get("label", "")), Palette.ACCENT)
	if _map: _map.ripple(Palette.ACCENT)
	refresh()

func _on_action_feedback(_a: Dictionary, _r: Dictionary) -> void:
	pass

# ---------------------------------------------------------------------------
# Right: staff + news
# ---------------------------------------------------------------------------
func _build_right() -> Control:
	var col := UI.vbox(12)
	col.custom_minimum_size = Vector2(300, 0)

	var staff_panel := UI.panel()
	var sv := UI.vbox(8)
	staff_panel.add_child(sv)
	sv.add_child(UI.kicker("Campaign Staff"))
	_staff_strip = UI.button("")
	_staff_strip.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_staff_strip.tooltip_text = "Hire campaign staff — each one amplifies a kind of move"
	_staff_strip.pressed.connect(_open_staff)
	sv.add_child(_staff_strip)
	_staff_box = UI.vbox(6)     # populated inside the staff modal
	_staff_box.visible = false
	sv.add_child(_staff_box)
	col.add_child(staff_panel)

	var news_panel := UI.panel()
	news_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var nv := UI.vbox(8)
	news_panel.add_child(nv)
	nv.add_child(UI.kicker("Field Notes"))
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_news_box = UI.vbox(5)
	_news_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(_news_box)
	nv.add_child(scroll)
	col.add_child(news_panel)
	return col

# ---------------------------------------------------------------------------
# Bottom: ticker + end week
# ---------------------------------------------------------------------------
func _build_ticker() -> Control:
	_ticker = Ticker.new()
	_ticker.custom_minimum_size = Vector2(0, 30)
	return _ticker

func _build_bottom() -> Control:
	var h := UI.hbox(12)
	h.custom_minimum_size = Vector2(0, 56)
	h.add_child(UI.spacer())
	_end_btn = UI.button("End Week  ▶", true)
	_end_btn.custom_minimum_size = Vector2(300, 56)
	_end_btn.add_theme_font_size_override("font_size", 17)
	_end_btn.tooltip_text = "Bank the week and advance.  (Space)\nYour opponent moves, money comes in, salaries go out, a fresh poll lands —\nand something may happen on the trail."
	_end_btn.pressed.connect(_end_week)
	h.add_child(_end_btn)
	return h

func _end_week() -> void:
	if _busy: return
	_busy = true
	_end_btn.disabled = true
	Audio.sfx("whoosh")
	if main and main.has_method("advance_week"):
		await main.advance_week()
	_busy = false
	if is_instance_valid(_end_btn):
		_end_btn.disabled = false

# ---------------------------------------------------------------------------
# Refresh (pull all dynamic values from state)
# ---------------------------------------------------------------------------
func refresh() -> void:
	if not is_inside_tree(): return
	var st := Game.state
	if st.is_empty(): return
	_cash_lbl.text = Game.money_str(int(st.cash))
	if int(st.cash) < 0:
		_cash_lbl.add_theme_color_override("font_color", Palette.BAD)
	else:
		_cash_lbl.add_theme_color_override("font_color", Palette.GOLD)
	var wl := Game.weeks_left()
	_week_lbl.text = "Week %d of %d\n%d week%s to election" % [int(st.week) + 1, int(st.totalWeeks), wl, ("" if wl == 1 else "s")]
	_ap_ctl.queue_redraw()

	# stats
	var pstats := Sim.candidate_stats(st, Game.player())
	var fav := float(pstats.favorability)
	var exp := float(pstats.exposure)
	_fav_g.set_value(fav)
	_fav_g.value_text = "%+d%s" % [int(round(fav * 100)), _delta_str("fav", fav, 100.0)]
	_name_g.set_value(exp)
	_name_g.value_text = "%d%%%s" % [int(round(exp * 100)), _delta_str("exp", exp, 100.0)]

	# runway: weeks of staff salary you can still cover
	var burn := 0
	for sid in st.staff:
		burn += int(Game.staff_def(sid).get("salary", 0))
	burn = int(round(burn * float(Game.player().get("salaryMult", 1.0))))
	var runway: float = 99.0 if burn <= 0 else float(Game.cash_dollars()) / float(burn)
	_cash_g.set_value(clampf(runway / 12.0, 0.0, 1.0))
	_cash_g.value_text = ("∞" if burn <= 0 else "%.1f wk" % runway)

	var ph: Array = st.pollHistory

	# chart
	_chart.set_data(ph, _chart_candidates(), int(st.totalWeeks))

	# map projection
	if _map:
		var seg := _seg_support()
		_map.set_projection(float(Game.current_poll_shares().get("player", 0.5)), seg)

	# action states
	for row in _action_rows:
		var b: Button = row["button"]
		var id: String = row["id"]
		var ok := Game.can_do(id)
		b.disabled = not ok
		var sub: Label = row["sub"]
		var a: Dictionary = Game.action_def(id)
		var cd := Game.cooldown_left(id)
		# Say WHY it is blocked, on the face of the tile — never only in a tooltip
		# on a disabled control the player has to discover by hovering.
		if cd > 0:
			sub.text = "On cooldown · %d week%s" % [cd, ("" if cd == 1 else "s")]
			sub.add_theme_color_override("font_color", Palette.WARN)
		elif int(st.ap) < int(a.get("ap", 1)):
			sub.text = "Needs an action point"
			sub.add_theme_color_override("font_color", Palette.WARN)
		elif int(st.cash) < int(a.get("cost", 0)) * 100:
			sub.text = "Short $%s" % Game._comma(int(a.get("cost", 0)) - Game.cash_dollars())
			sub.add_theme_color_override("font_color", Palette.BAD)
		else:
			sub.text = str(a.get("desc", ""))
			sub.add_theme_color_override("font_color", Palette.MUTED)

	# dynamic call-to-action, Civ-style: name the thing that is blocking you
	var ap_left: int = int(st.ap)
	if is_instance_valid(_end_btn):
		if wl <= 1:
			_end_btn.text = "ELECTION DAY  ▶"
		elif ap_left > 0:
			_end_btn.text = "%d action%s unspent — End Week  ▶" % [ap_left, "" if ap_left == 1 else "s"]
		else:
			_end_btn.text = "End Week  ▶     (Space)"
	_rebuild_wire()
	_refresh_staff_strip()
	_rebuild_news()

	# ticker items
	var items: Array = []
	for n in st.news:
		items.append({"text": n.get("text", ""), "tone": n.get("tone", "neutral")})
	_ticker.set_items(items)

## A "  ▲+3" suffix comparing against the value at the last week boundary.
func _delta_str(key: String, value: float, scale: float) -> String:
	var wk := int(Game.state.get("week", 0))
	var slot := "%s_w" % key
	if int(_prev.get(slot, -1)) != wk:
		_prev[slot] = wk
		if not _prev.has(key):
			_prev[key] = value
		else:
			_prev["%s_last" % key] = _prev[key]
			_prev[key] = value
	var last: float = float(_prev.get("%s_last" % key, value))
	var d := (value - last) * scale
	if absf(d) < 0.5:
		return ""
	return "  %s%d" % ["▲+" if d > 0 else "▼", int(round(absf(d))) * (1 if d > 0 else 1)]

func _chart_candidates() -> Array:
	var arr := [{"id": "player", "name": Game.player().get("name","You"), "color": Palette.party_color(Game.player().get("party","I"))}]
	for o in Game.state.opponents:
		arr.append({"id": o.id, "name": o.name, "color": Palette.party_color(o.party)})
	return arr

func _seg_support() -> Dictionary:
	var res := Sim.evaluate(Game.state, Game.electorate, Game.all_candidates())
	var out := {}
	for seg in res.segments:
		var votes: Dictionary = res.segments[seg]
		var tot := 0.0
		for cid in votes: tot += float(votes[cid])
		out[seg] = float(votes.get("player", 0.0)) / tot if tot > 0 else 0.5
	return out

func _rebuild_wire() -> void:
	for c in _wire_box.get_children(): c.queue_free()
	var polls := Game.current_poll_shares()
	# player line
	_wire_box.add_child(_wire_row("player", Game.player().get("name","You"), Game.player().get("party","I"), float(polls.get("player",0)), int(Game.state.cash), true))
	for o in Game.state.opponents:
		# fuzz opponent cash into a band for "intel"
		var est := int(round(float(o.get("cash",0)) / 1000.0 / 10.0)) * 10 * 1000
		_wire_box.add_child(_wire_row(o.id, o.name, o.party, float(polls.get(o.id,0)), est, false))

func _wire_row(_id: String, nm: String, pty: String, share: float, cash_cents: int, is_player: bool) -> Control:
	var v := UI.vbox(2)
	var top := UI.hbox(6)
	var dot := Control.new()
	dot.custom_minimum_size = Vector2(10, 10)
	var c := Palette.party_color(pty)
	dot.draw.connect(func(): dot.draw_circle(Vector2(5,7), 5, c))
	top.add_child(dot)
	var name_lbl := UI.label(nm, 13, Palette.INK if is_player else Palette.MUTED)
	name_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(name_lbl)
	top.add_child(UI.label("%d%%" % int(round(share*100)), 13, c))
	v.add_child(top)
	var meta := UI.label(("$%s" % Game._comma(cash_cents/100)) + ("" if is_player else " est."), 11, Palette.FAINT)
	meta.add_theme_font_override("font", Palette.font_mono)
	v.add_child(meta)
	# bar
	var bar := ProgressBar.new()
	bar.show_percentage = false
	bar.min_value = 0; bar.max_value = 1; bar.value = share
	bar.custom_minimum_size = Vector2(0, 5)
	bar.add_theme_stylebox_override("fill", UI.flat(c, 3))
	v.add_child(bar)
	return v

func _refresh_staff_strip() -> void:
	if not is_instance_valid(_staff_strip): return
	var n: int = Game.state.staff.size()
	var burn := 0
	for sid in Game.state.staff:
		burn += int(Game.staff_def(sid).get("salary", 0))
	burn = int(round(burn * float(Game.player().get("salaryMult", 1.0))))
	_staff_strip.text = "Staff  %d / %d      $%s / week      [ Hire ]" % [n, Game.STAFF.size(), Game._comma(burn)]

func _rebuild_staff() -> void:
	for c in _staff_box.get_children(): c.queue_free()
	for s in Game.STAFF:
		var hired: bool = Game.state.staff.has(s.id)
		var cost := int(round(s.sign * float(Game.player().get("salaryMult", 1.0))))
		var b := Button.new()
		b.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.custom_minimum_size = Vector2(0, 92)
		UI._style_button(b, false)
		b.tooltip_text = s.blurb + "\nSalary $%s/wk" % Game._comma(int(s.salary))
		b.disabled = hired or int(Game.state.cash) < cost * 100
		var v := UI.vbox(2)
		v.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var top := UI.hbox(6)
		top.mouse_filter = Control.MOUSE_FILTER_IGNORE
		top.add_child(UI.label(s.name, 13, Palette.INK))
		top.add_child(UI.spacer())
		top.add_child(UI.label(("HIRED" if hired else "$" + Game._comma(cost)), 12, Palette.GOOD if hired else Palette.GOLD))
		v.add_child(top)
		var blurb := UI.wrap(str(s.blurb), 240, 10, Palette.GOOD if hired else Palette.MUTED)
		blurb.mouse_filter = Control.MOUSE_FILTER_IGNORE
		v.add_child(blurb)
		var sal := UI.label("$%s / week" % Game._comma(int(s.salary)), 10, Palette.FAINT)
		sal.mouse_filter = Control.MOUSE_FILTER_IGNORE
		v.add_child(sal)
		var mc := UI.margin(6)
		mc.mouse_filter = Control.MOUSE_FILTER_IGNORE
		mc.add_child(v)
		b.add_child(mc)
		if not hired:
			b.pressed.connect(func():
				if Game.hire(s.id):
					_fx.float_text(b.global_position + Vector2(60, 0), "Hired!", Palette.GOOD)
				refresh())
		_staff_box.add_child(b)

## Staff is a one-time decision — it lives in a modal, not permanent real estate.
func _open_staff() -> void:
	Audio.sfx("click")
	var dim := ColorRect.new()
	dim.color = Color(0.09, 0.10, 0.13, 0.45)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	dim.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(dim)

	var card := UI.panel()
	card.custom_minimum_size = Vector2(520, 0)
	card.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	card.grow_horizontal = Control.GROW_DIRECTION_BOTH
	card.grow_vertical = Control.GROW_DIRECTION_BOTH
	dim.add_child(card)

	var v := UI.vbox(8)
	card.add_child(v)
	var head := UI.hbox(8)
	head.add_child(UI.title("CAMPAIGN STAFF", 24))
	head.add_child(UI.spacer())
	head.add_child(UI.label("Salaries are paid every week", 12, Palette.MUTED))
	v.add_child(head)
	v.add_child(UI.rule())
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(0, 380)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	var box := UI.vbox(6)
	box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(box)
	v.add_child(scroll)
	_fill_staff(box, func(): 
		for c in box.get_children(): c.queue_free()
		_fill_staff(box, func(): pass)
		refresh())
	var close := UI.button("Done", true)
	close.pressed.connect(func():
		Audio.sfx("click")
		dim.queue_free()
		refresh())
	v.add_child(close)

func _fill_staff(box: VBoxContainer, on_change: Callable) -> void:
	for s in Game.STAFF:
		var hired: bool = Game.state.staff.has(s.id)
		var cost := int(round(s.sign * float(Game.player().get("salaryMult", 1.0))))
		var b := UI.select_card(Palette.GOOD)
		b.button_pressed = hired
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.custom_minimum_size = Vector2(0, 84)
		b.disabled = hired or int(Game.state.cash) < cost * 100
		var v := UI.vbox(2)
		v.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var top := UI.hbox(6)
		top.mouse_filter = Control.MOUSE_FILTER_IGNORE
		top.add_child(UI.label(str(s.name), 14, Palette.INK))
		top.add_child(UI.spacer())
		if hired:
			top.add_child(UI.chip("ON STAFF", Palette.GOOD))
		else:
			top.add_child(UI.num("$" + Game._comma(cost), 13, Palette.GOLD.darkened(0.2)))
		v.add_child(top)
		var bl := UI.wrap(str(s.blurb), 430, 11, Palette.MUTED)
		bl.mouse_filter = Control.MOUSE_FILTER_IGNORE
		v.add_child(bl)
		var sal := UI.num("$%s / week" % Game._comma(int(s.salary)), 10, Palette.FAINT)
		sal.mouse_filter = Control.MOUSE_FILTER_IGNORE
		v.add_child(sal)
		var mc := UI.margin(8)
		mc.mouse_filter = Control.MOUSE_FILTER_IGNORE
		mc.add_child(v)
		b.add_child(mc)
		if not hired:
			b.pressed.connect(func():
				if Game.hire(str(s.id)):
					on_change.call())
		box.add_child(b)

func _rebuild_news() -> void:
	for c in _news_box.get_children(): c.queue_free()
	for entry in Game.state.log:
		var l := UI.label("· " + str(entry), 12, Palette.MUTED)
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.custom_minimum_size = Vector2(260, 0)
		_news_box.add_child(l)

# ---------------------------------------------------------------------------
# Menu / pill helpers
# ---------------------------------------------------------------------------
func _open_menu() -> void:
	Audio.sfx("click")
	if main and main.has_method("show_pause_menu"):
		main.show_pause_menu()

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		match event.keycode:
			KEY_ESCAPE:
				_open_menu()
				get_viewport().set_input_as_handled()
			KEY_1, KEY_2, KEY_3, KEY_4, KEY_5:
				var ci: int = event.keycode - KEY_1
				if ci < CATS.size():
					_cat = CATS[ci]
					Audio.sfx("click")
					_build_cat_bar(); _build_deck(); refresh()
					get_viewport().set_input_as_handled()
			KEY_Q, KEY_E:
				var cur := CATS.find(_cat)
				_cat = CATS[wrapi(cur + (1 if event.keycode == KEY_E else -1), 0, CATS.size())]
				Audio.sfx("click")
				_build_cat_bar(); _build_deck(); refresh()
				get_viewport().set_input_as_handled()
			KEY_SPACE, KEY_ENTER:
				if not _busy and is_instance_valid(_end_btn) and not _end_btn.disabled:
					_end_week()
					get_viewport().set_input_as_handled()

func _pill(text: String, color: Color) -> PanelContainer:
	var p := PanelContainer.new()
	p.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	p.add_theme_stylebox_override("panel", UI.flat(Palette.PANEL2, 999, 1, color))
	var l := UI.label(text, 12, color)
	var mc := MarginContainer.new()
	mc.add_theme_constant_override("margin_left", 12)
	mc.add_theme_constant_override("margin_right", 12)
	mc.add_theme_constant_override("margin_top", 3)
	mc.add_theme_constant_override("margin_bottom", 3)
	mc.add_child(l)
	p.add_child(mc)
	return p

func _party_word(p: String) -> String:
	return {"D": "Democrat", "R": "Republican", "I": "Independent"}.get(p, "Independent")
