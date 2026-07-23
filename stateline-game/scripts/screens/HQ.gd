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

func on_enter(_data: Variant = null) -> void:
	_fx = Confetti.new()
	add_child(_fx)

	var root := UI.vbox(10)
	var m := UI.margin(16)
	m.add_child(root)
	add_child(m)

	root.add_child(_build_topbar())

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
	_week_lbl.custom_minimum_size = Vector2(150, 0)
	_week_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	h.add_child(_week_lbl)

	var cashv := UI.vbox(0)
	cashv.add_child(UI.label("WAR CHEST", 10, Palette.FAINT))
	_cash_lbl = UI.label("$0", 18, Palette.GOLD)
	_cash_lbl.add_theme_font_override("font", Palette.font_mono)
	cashv.add_child(_cash_lbl)
	h.add_child(cashv)

	var apv := UI.vbox(0)
	apv.add_child(UI.label("ACTIONS", 10, Palette.FAINT))
	_ap_ctl = Control.new()
	_ap_ctl.custom_minimum_size = Vector2(96, 22)
	_ap_ctl.draw.connect(_draw_ap)
	apv.add_child(_ap_ctl)
	h.add_child(apv)

	var menu := UI.button("☰")
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
	mv.add_child(UI.kicker("The District"))
	_map = MapView.new()
	_map.custom_minimum_size = Vector2(300, 250)
	_map.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_map.configure(Game.state.district)
	mv.add_child(_map)
	col.add_child(map_panel)

	var wire := UI.panel()
	var wv := UI.vbox(8)
	wire.add_child(wv)
	wv.add_child(UI.kicker("Race Wire"))
	_wire_box = UI.vbox(8)
	wv.add_child(_wire_box)
	col.add_child(wire)
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
	ph.add_child(UI.kicker("Polling — Your Share Over Time"))
	pv.add_child(ph)
	_chart = PollChart.new()
	_chart.custom_minimum_size = Vector2(0, 200)
	pv.add_child(_chart)
	col.add_child(poll_panel)

	# gauges
	var g_panel := UI.panel()
	var grid := GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 24)
	grid.add_theme_constant_override("v_separation", 10)
	g_panel.add_child(grid)
	_fav_g = _add_gauge(grid, "Net Favorability", true)
	_name_g = _add_gauge(grid, "Name Recognition", false)
	_cash_g = _add_gauge(grid, "Cash vs. Opponent", false)
	_mom_g = _add_gauge(grid, "Momentum", true)
	col.add_child(g_panel)

	# actions
	var act_panel := UI.panel()
	act_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var av := UI.vbox(8)
	act_panel.add_child(av)
	av.add_child(UI.kicker("This Week's Moves"))
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	var deck := UI.vbox(10)
	deck.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(deck)
	av.add_child(scroll)
	_build_action_deck(deck)
	col.add_child(act_panel)
	return col

func _add_gauge(grid: GridContainer, label: String, bipolar: bool) -> Gauge:
	var g := Gauge.new()
	g.custom_minimum_size = Vector2(260, 40)
	g.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	g.bipolar = bipolar
	g.label_text = label
	grid.add_child(g)
	return g

func _build_action_deck(deck: VBoxContainer) -> void:
	var cats := ["Air War", "Ground Game", "Message", "Events", "Money"]
	for cat in cats:
		var header := UI.label(cat.to_upper(), 11, Palette.FAINT)
		deck.add_child(header)
		var grid := GridContainer.new()
		grid.columns = 2
		grid.add_theme_constant_override("h_separation", 8)
		grid.add_theme_constant_override("v_separation", 8)
		for a in Game.ACTIONS:
			if a.cat != cat: continue
			grid.add_child(_action_button(a))
		deck.add_child(grid)

func _action_button(a: Dictionary) -> Control:
	var b := Button.new()
	b.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	b.custom_minimum_size = Vector2(250, 58)
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	UI._style_button(b, false)
	b.tooltip_text = a.desc
	var v := UI.vbox(1)
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var top := UI.hbox(6)
	top.mouse_filter = Control.MOUSE_FILTER_IGNORE
	top.add_child(UI.label(a.label, 15, Palette.INK))
	top.add_child(UI.spacer())
	var cost_txt := "●".repeat(int(a.ap)) + ("  $%s" % Game._comma(int(a.cost)) if int(a.cost) > 0 else "")
	var cost := UI.label(cost_txt, 12, Palette.GOLD)
	cost.add_theme_font_override("font", Palette.font_mono)
	top.add_child(cost)
	v.add_child(top)
	var sub := UI.label(a.desc, 11, Palette.MUTED)
	sub.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	sub.custom_minimum_size = Vector2(220, 0)
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
	_staff_box = UI.vbox(6)
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
func _build_bottom() -> Control:
	var h := UI.hbox(12)
	h.custom_minimum_size = Vector2(0, 44)
	_ticker = Ticker.new()
	_ticker.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_ticker.custom_minimum_size = Vector2(0, 40)
	h.add_child(_ticker)
	_end_btn = UI.button("  End Week  →", true)
	_end_btn.custom_minimum_size = Vector2(200, 40)
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
	_fav_g.set_value(float(pstats.favorability))
	_fav_g.value_text = "%+d" % int(round(float(pstats.favorability) * 100))
	_name_g.set_value(float(pstats.exposure))
	_name_g.value_text = "%d%%" % int(round(float(pstats.exposure) * 100))

	# cash vs opp
	var opp_cash := 0
	for o in st.opponents: opp_cash = maxi(opp_cash, int(o.get("cash", 0)))
	var ratio: float = 0.5
	if int(st.cash) + opp_cash > 0:
		ratio = float(maxi(0, int(st.cash))) / float(maxi(1, int(st.cash) + opp_cash))
	_cash_g.set_value(ratio)
	_cash_g.value_text = "%d%%" % int(round(ratio * 100))

	# momentum from poll history
	var ph: Array = st.pollHistory
	var mom := 0.0
	if ph.size() >= 3:
		var now: float = float(ph[ph.size()-1].shares.get("player", 0.0))
		var then: float = float(ph[maxi(0, ph.size()-4)].shares.get("player", 0.0))
		mom = clampf((now - then) * 8.0, -1.0, 1.0)
	_mom_g.set_value(mom)
	_mom_g.value_text = ("▲" if mom > 0.05 else ("▼" if mom < -0.05 else "—"))

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
		var cd := Game.cooldown_left(id)
		var sub: Label = row["sub"]
		if cd > 0:
			sub.text = "On cooldown · %d week%s" % [cd, ("" if cd == 1 else "s")]
			sub.add_theme_color_override("font_color", Palette.WARN)
		else:
			sub.add_theme_color_override("font_color", Palette.MUTED)

	_rebuild_wire()
	_rebuild_staff()
	_rebuild_news()

	# ticker items
	var items: Array = []
	for n in st.news:
		items.append({"text": n.get("text", ""), "tone": n.get("tone", "neutral")})
	_ticker.set_items(items)

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

func _rebuild_staff() -> void:
	for c in _staff_box.get_children(): c.queue_free()
	for s in Game.STAFF:
		var hired: bool = Game.state.staff.has(s.id)
		var cost := int(round(s.sign * float(Game.player().get("salaryMult", 1.0))))
		var b := Button.new()
		b.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.custom_minimum_size = Vector2(0, 46)
		UI._style_button(b, false)
		b.tooltip_text = s.blurb + "\nSalary $%s/wk" % Game._comma(int(s.salary))
		b.disabled = hired or int(Game.state.cash) < cost * 100
		var v := UI.vbox(0)
		v.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var top := UI.hbox(6)
		top.mouse_filter = Control.MOUSE_FILTER_IGNORE
		top.add_child(UI.label(s.name, 13, Palette.INK))
		top.add_child(UI.spacer())
		top.add_child(UI.label(("HIRED" if hired else "$" + Game._comma(cost)), 12, Palette.GOOD if hired else Palette.GOLD))
		v.add_child(top)
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
	Game.save_game(0)

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
