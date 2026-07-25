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
var _weekstrip: Control

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
## The HUD is deliberately the one dark surface on the screen. It reads as the
## game's frame rather than as another content card, which is what stops the
## dashboard from looking like nine identical boxes stacked in a grid.
const HUD_DIM := Color("8fa0bd")
const HUD_INK := Color("f4f7fc")

func _build_topbar() -> Control:
	var panel := UI.hud_panel()
	panel.custom_minimum_size = Vector2(0, 68)
	var h := UI.hbox(16)
	panel.add_child(h)

	var port := Portrait.new()
	port.custom_minimum_size = Vector2(50, 50)
	port.set_features(Game.player().get("features", {}))
	port.set_party(Game.player().get("party", "I"))
	h.add_child(port)

	var idv := UI.vbox(1)
	idv.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var pl: Dictionary = Game.player()
	idv.add_child(UI.label(pl.get("name", "You"), 18, HUD_INK))
	var dist := UI.label("%s · %s" % [Game.state.district.get("name", ""), _party_word(pl.get("party","I"))], 12, HUD_DIM)
	idv.add_child(dist)
	h.add_child(idv)

	h.add_child(UI.spacer())

	# Week — the clock, and the loudest thing after your money
	var wkv := UI.vbox(0)
	wkv.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	wkv.tooltip_text = "Weeks remaining before election day.\nEffects ramp up and decay over time, so late spending lands harder — but ads fatigue."
	wkv.mouse_filter = Control.MOUSE_FILTER_STOP
	wkv.add_child(_cap("WEEK"))
	_week_lbl = UI.title("", 22, HUD_INK)
	wkv.add_child(_week_lbl)
	h.add_child(wkv)
	_phase_lbl = UI.label("", 11, HUD_DIM)
	_phase_lbl.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	h.add_child(_phase_lbl)

	h.add_child(_hud_divider())

	var cashv := UI.vbox(0)
	cashv.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	cashv.tooltip_text = "Money on hand. Spend it — cash in the bank on election day wins zero votes.\nIncome comes from fundraisers, the weekly small-dollar trickle and your Finance Director."
	cashv.mouse_filter = Control.MOUSE_FILTER_STOP
	cashv.add_child(_cap("WAR CHEST"))
	_cash_lbl = UI.label("$0", 19, Palette.GOLD)
	_cash_lbl.add_theme_font_override("font", Palette.font_mono_bold)
	cashv.add_child(_cash_lbl)
	h.add_child(cashv)

	h.add_child(_hud_divider())

	var apv := UI.vbox(2)
	apv.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	apv.tooltip_text = "Action points left this week. Every move costs at least one.\nThey refresh when you end the week; a Campaign Manager grants one more."
	apv.mouse_filter = Control.MOUSE_FILTER_STOP
	apv.add_child(_cap("ACTIONS LEFT"))
	_ap_ctl = Control.new()
	_ap_ctl.custom_minimum_size = Vector2(96, 20)
	_ap_ctl.draw.connect(_draw_ap)
	apv.add_child(_ap_ctl)
	h.add_child(apv)

	var menu := Button.new()
	menu.text = "☰  Menu"
	menu.focus_mode = Control.FOCUS_ALL
	menu.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	menu.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_style_hud_button(menu)
	menu.tooltip_text = "Menu — save, load, settings, restart, quit  (Esc)"
	menu.pressed.connect(_open_menu)
	h.add_child(menu)
	return panel

func _cap(text: String) -> Label:
	var l := UI.label(text, 9, HUD_DIM)
	l.add_theme_font_override("font", Palette.font_ui_bold)
	return l

func _hud_divider() -> Control:
	var c := ColorRect.new()
	c.color = Color(1, 1, 1, 0.10)
	c.custom_minimum_size = Vector2(1, 36)
	c.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return c

func _style_hud_button(b: Button) -> void:
	var states := {
		"normal": UI.flat(Color(1, 1, 1, 0.10), 7, 1, Color(1, 1, 1, 0.18)),
		"hover": UI.flat(Color(1, 1, 1, 0.18), 7, 1, Color(1, 1, 1, 0.30)),
		"pressed": UI.flat(Color(0, 0, 0, 0.20), 7, 1, Color(1, 1, 1, 0.18)),
		"focus": UI.flat(Color(1, 1, 1, 0.14), 7, 2, Palette.GOLD),
	}
	for st in states:
		var box: StyleBoxFlat = states[st]
		box.content_margin_left = 14; box.content_margin_right = 14
		box.content_margin_top = 8; box.content_margin_bottom = 8
		b.add_theme_stylebox_override(st, box)
	b.add_theme_font_override("font", Palette.font_ui_bold)
	b.add_theme_font_size_override("font_size", 14)
	for c in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
		b.add_theme_color_override(c, HUD_INK)

func _draw_ap() -> void:
	var cur: int = int(Game.state.get("ap", 0))
	var mx: int = int(Game.state.get("maxAP", 3))
	if Game.staff_has("manager"): mx += 1
	var x := 8.0
	for i in maxi(mx, cur):
		var filled := i < cur
		_ap_ctl.draw_circle(Vector2(x, 10), 7, Palette.GOLD if filled else Color(1, 1, 1, 0.08))
		_ap_ctl.draw_arc(Vector2(x, 10), 7, 0, TAU, 20,
			Palette.GOLD if filled else Color(1, 1, 1, 0.28), 1.5, true)
		x += 19

# ---------------------------------------------------------------------------
# Left: map + race wire
# ---------------------------------------------------------------------------
func _build_left() -> Control:
	var col := UI.vbox(12)
	col.custom_minimum_size = Vector2(330, 0)

	var map_panel := UI.panel()
	map_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var mv := UI.vbox(8)
	map_panel.add_child(mv)
	var mk := UI.section("The District", Palette.GOOD)
	mk.tooltip_text = "Each cell is a precinct, tinted by projected support.\nThe bus marks where your campaign has been. On election night these report one by one."
	mk.mouse_filter = Control.MOUSE_FILTER_STOP
	mv.add_child(mk)
	_map = MapView.new()
	# The map is the flexible element in this column: it takes whatever height is
	# left over, so a three-way race (which adds a row to the wire) shrinks the map
	# instead of shoving the End Week button off the bottom of the screen.
	_map.custom_minimum_size = Vector2(292, 128)
	_map.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_map.configure(Game.state.district)
	mv.add_child(_map)
	col.add_child(map_panel)

	var wire := UI.panel()
	var wv := UI.vbox(8)
	wire.add_child(wv)
	var wk := UI.section("Race Wire", Palette.BAD)
	wk.tooltip_text = "Everyone on the ballot, with their latest polling and an estimate of their money.\nOpponent cash is an estimate — your own figure is exact."
	wk.mouse_filter = Control.MOUSE_FILTER_STOP
	wv.add_child(wk)
	_wire_box = UI.vbox(9)
	wv.add_child(_wire_box)
	col.add_child(wire)

	# The vitals used to sit in the middle column, which starved the action deck
	# of height and left this column with 200px of nothing under the wire.
	var g_panel := UI.quiet_panel()
	var gv := UI.vbox(10)
	g_panel.add_child(gv)
	gv.add_child(UI.section("Your Numbers", Palette.GOLD2))
	_fav_g = _add_gauge(gv, "Net Favorability", true,
		"How warmly voters feel about you, from -100 to +100.\nRaised by positive ads, speeches and good weeks; cut by attacks and scandal.\nIt feeds directly into vote choice.")
	_name_g = _add_gauge(gv, "Name Recognition", false,
		"The share of voters who have heard of you at all.\nThis GATES everything: a voter who doesn't know you cannot vote for you,\nno matter how much they agree with you. Buy reach before persuasion.")
	_cash_g = _add_gauge(gv, "Weeks of Runway", false,
		"How many more weeks you could keep paying staff at your current burn.\nSalaries come out every week whether you act or not.")
	col.add_child(g_panel)
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
	var pk := UI.section("Polling — Your Share Over Time", Palette.ACCENT)
	pk.tooltip_text = "Sampled polls, not the true result. The shaded band is the margin of error.\nHire a Pollster or commission a poll for a tighter, more reliable read."
	pk.mouse_filter = Control.MOUSE_FILTER_STOP
	pv.add_child(pk)
	_chart = PollChart.new()
	_chart.custom_minimum_size = Vector2(0, 168)
	pv.add_child(_chart)
	col.add_child(poll_panel)

	# actions — the deck is the loudest card on the screen, and gets the height
	var act_panel := UI.panel()
	act_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var av := UI.vbox(9)
	act_panel.add_child(av)
	var ak := UI.section("This Week's Moves", Palette.IND,
		UI.label("hover a card for the numbers", 11, Palette.FAINT))
	ak.tooltip_text = "Spend action points and money here. Hover any move for exactly what it costs and does."
	ak.mouse_filter = Control.MOUSE_FILTER_STOP
	av.add_child(ak)
	_cat_bar = UI.hbox(5)
	av.add_child(_cat_bar)
	_deck = GridContainer.new()
	_deck.columns = 3
	_deck.add_theme_constant_override("h_separation", 9)
	_deck.add_theme_constant_override("v_separation", 9)
	_deck.size_flags_vertical = Control.SIZE_EXPAND_FILL
	av.add_child(_deck)
	_build_cat_bar()
	_build_deck()
	col.add_child(act_panel)
	return col

const CATS := ["Air War", "Ground Game", "Message", "Events", "Money"]

## Each lane of play gets its own colour, carried from the tab to the card edge,
## so the deck reads as five kinds of move rather than one wall of tiles.
func _cat_color(cat: String) -> Color:
	match cat:
		"Air War": return Palette.ACCENT
		"Ground Game": return Palette.GOOD
		"Message": return Palette.IND
		"Events": return Palette.WARN
		"Money": return Palette.GOLD2
		_: return Palette.MUTED

func _cat_count(cat: String) -> int:
	var n := 0
	for a in Game.ACTIONS:
		if a.cat == cat: n += 1
	return n

func _build_cat_bar() -> void:
	for c in _cat_bar.get_children(): c.queue_free()
	var i := 1
	for cat in CATS:
		var b := UI.selectable("%s  %d" % [cat, _cat_count(cat)], _cat_color(cat))
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

func _add_gauge(parent: Container, label: String, bipolar: bool, tip := "") -> Gauge:
	var g := Gauge.new()
	g.custom_minimum_size = Vector2(0, 32)
	g.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	g.bipolar = bipolar
	g.label_text = label
	g.tooltip_text = tip
	g.mouse_filter = Control.MOUSE_FILTER_STOP
	parent.add_child(g)
	return g

## A move card. A Button is not a Container, so its children are NOT auto-sized —
## the inner box has to be anchored to the button's rect or the wrapped blurb
## measures against its own minimum width and spills out the bottom edge. It is
## also hard-clipped to two lines so no amount of copy can ever break the grid.
func _action_button(a: Dictionary) -> Control:
	var accent := _cat_color(str(a.cat))
	var b := Button.new()
	b.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	b.custom_minimum_size = Vector2(150, 100)
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b.size_flags_vertical = Control.SIZE_EXPAND_FILL
	b.clip_contents = true
	UI._style_button(b, false)
	b.tooltip_text = Game.action_tooltip(a)

	# a colour stripe down the left edge ties the card to its lane
	var stripe := ColorRect.new()
	stripe.color = accent
	stripe.mouse_filter = Control.MOUSE_FILTER_IGNORE
	stripe.set_anchors_and_offsets_preset(Control.PRESET_LEFT_WIDE)
	stripe.offset_left = 1; stripe.offset_right = 4
	stripe.offset_top = 6; stripe.offset_bottom = -6
	b.add_child(stripe)

	var mc := MarginContainer.new()
	mc.mouse_filter = Control.MOUSE_FILTER_IGNORE
	mc.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mc.add_theme_constant_override("margin_left", 12)
	mc.add_theme_constant_override("margin_right", 9)
	mc.add_theme_constant_override("margin_top", 8)
	mc.add_theme_constant_override("margin_bottom", 8)
	mc.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	b.add_child(mc)

	var v := UI.vbox(3)
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	mc.add_child(v)

	var name_lbl := UI.label(a.label, 14, Palette.INK)
	name_lbl.add_theme_font_override("font", Palette.font_ui_bold)
	name_lbl.clip_text = true
	name_lbl.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	v.add_child(name_lbl)

	var cost_row := UI.hbox(6)
	cost_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	cost_row.add_child(UI.label("●".repeat(int(a.ap)), 11, Palette.GOLD.darkened(0.15)))
	if int(a.cost) > 0:
		cost_row.add_child(UI.num("$" + Game._comma(int(a.cost)), 12, Palette.GOLD.darkened(0.25)))
	else:
		cost_row.add_child(UI.label("free", 11, Palette.GOOD))
	if int(a.get("fund", 0)) > 0:
		cost_row.add_child(UI.label("→ raises", 10, Palette.GOOD))
	v.add_child(cost_row)

	var sub := UI.clamped(str(a.desc), 3, 11, Palette.MUTED)
	sub.size_flags_vertical = Control.SIZE_EXPAND_FILL
	v.add_child(sub)

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
	col.custom_minimum_size = Vector2(288, 0)

	var staff_panel := UI.quiet_panel()
	var sv := UI.vbox(8)
	staff_panel.add_child(sv)
	sv.add_child(UI.section("Campaign Staff", Palette.ACCENT2))
	_staff_strip = UI.button("")
	_staff_strip.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_staff_strip.tooltip_text = "Hire campaign staff — each one amplifies a kind of move"
	_staff_strip.pressed.connect(_open_staff)
	sv.add_child(_staff_strip)
	_staff_box = UI.vbox(5)     # the roster of who you've actually hired
	sv.add_child(_staff_box)
	col.add_child(staff_panel)

	var news_panel := UI.quiet_panel()
	news_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var nv := UI.vbox(8)
	news_panel.add_child(nv)
	nv.add_child(UI.section("Field Notes", Palette.MUTED))
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_news_box = UI.vbox(2)
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
	var h := UI.hbox(14)
	h.custom_minimum_size = Vector2(0, 56)

	# The calendar. Cheap to read at a glance and it stops the footer from being
	# 900px of empty page next to one button.
	_weekstrip = Control.new()
	_weekstrip.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_weekstrip.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_weekstrip.custom_minimum_size = Vector2(0, 34)
	_weekstrip.tooltip_text = "The campaign calendar. Filled blocks are weeks you have already spent."
	_weekstrip.mouse_filter = Control.MOUSE_FILTER_STOP
	_weekstrip.draw.connect(_draw_weekstrip)
	h.add_child(_weekstrip)

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
	_week_lbl.text = "%d / %d" % [int(st.week) + 1, int(st.totalWeeks)]
	if is_instance_valid(_phase_lbl):
		_phase_lbl.text = "ELECTION DAY" if wl <= 1 else "%d week%s\nto election" % [wl, ("" if wl == 1 else "s")]
		_phase_lbl.add_theme_color_override("font_color", Palette.GOLD if wl <= 3 else HUD_DIM)
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
	if is_instance_valid(_weekstrip): _weekstrip.queue_redraw()
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
	_staff_strip.text = ("Hire your first staffer  +" if n == 0 else "Hire staff  ·  %d of %d  ·  $%s/wk  +") \
		% ([] if n == 0 else [n, Game.STAFF.size(), Game._comma(burn)])
	# who's actually on the payroll, so the panel isn't an empty box all game
	for c in _staff_box.get_children(): c.queue_free()
	for sid in Game.state.staff:
		var s: Dictionary = Game.staff_def(sid)
		var row := UI.hbox(6)
		var dot := UI.label("●", 10, Palette.GOOD)
		row.add_child(dot)
		var nm := UI.label(str(s.get("name", sid)), 12, Palette.INK)
		nm.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		nm.clip_text = true
		nm.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
		row.add_child(nm)
		row.add_child(UI.num("$%s" % Game._comma(int(s.get("salary", 0))), 11, Palette.FAINT))
		row.tooltip_text = str(s.get("blurb", ""))
		row.mouse_filter = Control.MOUSE_FILTER_STOP
		_staff_box.add_child(row)

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
		b.custom_minimum_size = Vector2(0, 94)
		b.clip_contents = true
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
		mc.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		b.add_child(mc)
		if not hired:
			b.pressed.connect(func():
				if Game.hire(str(s.id)):
					on_change.call())
		box.add_child(b)

## Grouped by week rather than shown as one undifferentiated bullet list — a
## 20-line stack of identical dashes is unreadable and reads as filler.
func _rebuild_news() -> void:
	for c in _news_box.get_children(): c.queue_free()
	if Game.state.log.is_empty():
		var empty := UI.wrap("Nothing on the wire yet. Every move you make gets logged here.",
			250, 12, Palette.FAINT)
		_news_box.add_child(empty)
		return
	var last_week := ""
	for entry in Game.state.log:
		var text := str(entry)
		var week := ""
		var colon := text.find(":")
		if colon > 0 and text.begins_with("W"):
			week = text.substr(0, colon)
			text = text.substr(colon + 1).strip_edges()
		if week != last_week:
			last_week = week
			if _news_box.get_child_count() > 0:
				var gap := Control.new()
				gap.custom_minimum_size = Vector2(0, 7)
				_news_box.add_child(gap)
			var hdr := UI.label(("WEEK " + week.substr(1)) if week != "" else "EARLIER", 10, Palette.FAINT)
			hdr.add_theme_font_override("font", Palette.font_display)
			_news_box.add_child(hdr)
		var row := UI.hbox(6)
		var tick := UI.label("›", 12, Palette.BORDER_HI)
		tick.custom_minimum_size = Vector2(8, 0)
		row.add_child(tick)
		var l := UI.label(text, 12, Palette.MUTED)
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(l)
		_news_box.add_child(row)

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

func _party_word(p: String) -> String:
	return {"D": "Democrat", "R": "Republican", "I": "Independent"}.get(p, "Independent")

## A row of week blocks: spent, current, still to come — then the ballot box.
func _draw_weekstrip() -> void:
	var total: int = maxi(int(Game.state.get("totalWeeks", 14)), 1)
	var cur: int = int(Game.state.get("week", 0))
	var w: float = _weekstrip.size.x
	var y := _weekstrip.size.y * 0.5
	var end_pad := 78.0
	var track: float = maxf(w - end_pad, 40.0)
	var gap := 3.0
	var bw: float = maxf((track - gap * (total - 1)) / float(total), 2.0)
	for i in total:
		var x := i * (bw + gap)
		var r := Rect2(x, y - 5, bw, 10)
		var col := Palette.BORDER
		if i < cur:
			col = Palette.ACCENT.lerp(Palette.BG, 0.45)
		elif i == cur:
			col = Palette.GOLD
			r = Rect2(x, y - 8, bw, 16)
		elif total - i <= 3:
			col = Palette.BAD.lerp(Palette.BG, 0.6)
		_weekstrip.draw_rect(r, col)
	if Palette.font_ui_bold:
		_weekstrip.draw_string(Palette.font_ui_bold, Vector2(track + 10, y + 4),
			"ELECTION", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Palette.BAD)
