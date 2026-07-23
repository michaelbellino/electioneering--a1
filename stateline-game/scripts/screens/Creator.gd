class_name Creator
extends GameScreen

var pname := "Alex Rivera"
var party := "D"
var attrs := {"charisma": 6, "competence": 6, "integrity": 5, "fundraising": 5}
var traits: Array = []
var positions: Dictionary = {}
var features: Dictionary = {}
var difficulty_id := "normal"
var district_id := ""
var _rng := RandomNumberGenerator.new()

var _portrait: Portrait
var _points_label: Label
var _launch: Button
var _race_cards: Array = []
var _trait_buttons: Dictionary = {}
var _diff_buttons: Dictionary = {}

func on_enter(_data: Variant = null) -> void:
	_rng.randomize()
	features = Portrait.make_features(_rng)
	for iss in Sim.issue_ids():
		positions[iss] = 0.0
	if Content.districts.size() > 0:
		district_id = Content.districts[0].get("id", "")
	if Content.names and Content.names.has("firstNames"):
		var fn: Array = Content.names.get("firstNames", ["Alex"])
		var ln: Array = Content.names.get("lastNames", ["Rivera"])
		pname = "%s %s" % [fn[_rng.randi()%fn.size()], ln[_rng.randi()%ln.size()]]

	var root := UI.vbox(12)
	var m := UI.margin(24)
	m.add_child(root)
	add_child(m)

	# Header
	var header := UI.hbox(12)
	header.add_child(UI.title("Build Your Candidate", 30))
	header.add_child(UI.spacer())
	var back := UI.button("← Menu")
	back.pressed.connect(func(): Audio.sfx("click"); go("title"))
	header.add_child(back)
	root.add_child(header)

	# Body: left identity + right scroll
	var body := UI.hbox(18)
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	root.add_child(body)

	body.add_child(_build_identity())

	var scroll := ScrollContainer.new()
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	var col := UI.vbox(16)
	col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(col)
	body.add_child(scroll)

	col.add_child(_section_difficulty())
	col.add_child(_section_attributes())
	col.add_child(_section_traits())
	col.add_child(_section_positions())
	col.add_child(_section_race())

	# Footer
	var footer := UI.hbox(12)
	footer.add_child(UI.spacer())
	_launch = UI.button("  Launch Campaign  →", true)
	_launch.pressed.connect(_launch_campaign)
	footer.add_child(_launch)
	root.add_child(footer)

	_update_points()

# --- Left identity panel ---
func _build_identity() -> Control:
	var panel := UI.panel()
	panel.custom_minimum_size = Vector2(360, 0)
	var v := UI.vbox(12)
	panel.add_child(v)

	_portrait = Portrait.new()
	_portrait.custom_minimum_size = Vector2(300, 240)
	_portrait.set_features(features)
	_portrait.set_party(party)
	v.add_child(_portrait)

	var pbtns := UI.hbox(8)
	var randomize := UI.button("⟳ Randomize")
	randomize.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	randomize.pressed.connect(func():
		Audio.sfx("blip")
		features = Portrait.make_features(_rng)
		_portrait.set_features(features))
	pbtns.add_child(randomize)
	var hair := UI.button("Hair")
	hair.pressed.connect(func(): _cycle("hairStyle", 6))
	pbtns.add_child(hair)
	var glasses := UI.button("Specs")
	glasses.pressed.connect(func():
		features["glasses"] = not features.get("glasses", false)
		_portrait.set_features(features); Audio.sfx("click"))
	pbtns.add_child(glasses)
	v.add_child(pbtns)

	v.add_child(UI.label("Candidate name", 13, Palette.MUTED))
	var name_edit := LineEdit.new()
	name_edit.text = pname
	name_edit.placeholder_text = "Your candidate's name"
	name_edit.text_changed.connect(func(t): pname = t; _refresh_launch())
	v.add_child(name_edit)

	v.add_child(UI.label("Party", 13, Palette.MUTED))
	var party_row := UI.hbox(8)
	for p in [["D", "Democrat", Palette.DEM], ["R", "Republican", Palette.GOP], ["I", "Independent", Palette.IND]]:
		var b := UI.button(p[1])
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.toggle_mode = true
		b.button_pressed = party == p[0]
		b.pressed.connect(func():
			party = p[0]
			_portrait.set_party(party)
			Audio.sfx("click")
			for c in party_row.get_children():
				c.button_pressed = false
			b.button_pressed = true)
		party_row.add_child(b)
	v.add_child(party_row)
	return panel

func _cycle(key: String, mod: int) -> void:
	features[key] = (int(features.get(key, 0)) + 1) % mod
	_portrait.set_features(features)
	Audio.sfx("click")

# --- Difficulty ---
func _section_difficulty() -> Control:
	var s := _section("Difficulty", "Rescales money, the action economy, and how hard the press and your opponent push.")
	var row := UI.hbox(10)
	for d in Game.DIFFICULTIES:
		var b := UI.button(d.label)
		b.tooltip_text = "%s\nCreation points: %d · Action points: %d" % [d.desc, d.points, d.maxAP]
		b.toggle_mode = true
		b.button_pressed = d.id == difficulty_id
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_diff_buttons[d.id] = b
		b.pressed.connect(func():
			difficulty_id = d.id
			Audio.sfx("click")
			for k in _diff_buttons: _diff_buttons[k].button_pressed = (k == d.id)
			_update_points())
		row.add_child(b)
	s.get_child(0).add_child(row)
	return s

# --- Attributes ---
func _section_attributes() -> Control:
	var s := _section("Attributes", "Spend your creation points. The last few points in any stat cost more.")
	var box := UI.vbox(10)
	_points_label = UI.label("", 14, Palette.GOLD)
	box.add_child(_points_label)
	for a in [["charisma","Charisma","Wins rooms, debates, and viral moments."],
			  ["competence","Competence","Survives scrutiny; wonky plays land."],
			  ["integrity","Integrity","Resists scandal and dirty tricks."],
			  ["fundraising","Fundraising","Bigger hauls and a fatter weekly trickle."]]:
		box.add_child(_attr_row(a[0], a[1], a[2]))
	s.get_child(0).add_child(box)
	return s

func _attr_row(key: String, label: String, tip: String) -> Control:
	var row := UI.hbox(10)
	var name_lbl := UI.label(label, 15)
	name_lbl.custom_minimum_size = Vector2(120, 0)
	name_lbl.tooltip_text = tip
	row.add_child(name_lbl)
	var sld := HSlider.new()
	sld.min_value = 1; sld.max_value = 10; sld.step = 1
	sld.value = attrs[key]
	sld.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	sld.custom_minimum_size = Vector2(0, 24)
	var val_lbl := UI.label(str(attrs[key]), 14, Palette.MUTED)
	val_lbl.custom_minimum_size = Vector2(28, 0)
	sld.value_changed.connect(func(v):
		var old: int = attrs[key]
		attrs[key] = int(v)
		if _spent_points() > _budget():
			attrs[key] = old
			sld.set_value_no_signal(old)
			Audio.sfx("fail")
		else:
			Audio.sfx("tick")
		val_lbl.text = str(attrs[key])
		_update_points())
	row.add_child(sld)
	row.add_child(val_lbl)
	return row

func _cost(step: int) -> int:
	var c := 0
	for s in range(1, step + 1):
		c += 1 if s <= 6 else (2 if s <= 8 else 3)
	return c

func _spent_points() -> int:
	var total := 0
	for k in attrs: total += _cost(int(attrs[k]))
	return total

func _budget() -> int:
	return Game.difficulty(difficulty_id).points

func _update_points() -> void:
	if _points_label:
		var rem := _budget() - _spent_points()
		_points_label.text = "Creation points remaining: %d / %d" % [rem, _budget()]
		_points_label.add_theme_color_override("font_color", Palette.GOOD if rem >= 0 else Palette.BAD)
	_refresh_launch()

# --- Traits ---
func _section_traits() -> Control:
	var s := _section("Background (pick up to 2)", "Each trait is a trade-off bundle — never strictly better.")
	var flow := HFlowContainer.new()
	flow.add_theme_constant_override("h_separation", 8)
	flow.add_theme_constant_override("v_separation", 8)
	for t in Game.TRAITS:
		var b := UI.button(t.label)
		b.toggle_mode = true
		b.tooltip_text = t.desc
		b.custom_minimum_size = Vector2(220, 0)
		_trait_buttons[t.id] = b
		b.pressed.connect(func(): _toggle_trait(t.id, b))
		flow.add_child(b)
	s.get_child(0).add_child(flow)
	return s

func _toggle_trait(tid: String, b: Button) -> void:
	if traits.has(tid):
		traits.erase(tid)
		b.button_pressed = false
		Audio.sfx("click")
	elif traits.size() < 2:
		traits.append(tid)
		b.button_pressed = true
		Audio.sfx("confirm")
	else:
		b.button_pressed = false
		Audio.sfx("fail")

# --- Positions ---
func _section_positions() -> Control:
	var s := _section("Where You Stand", "Slide toward the pole you champion. Voters reward proximity — and punish it.")
	var box := UI.vbox(8)
	for iss in Content.issues:
		box.add_child(_position_row(iss))
	s.get_child(0).add_child(box)
	return s

func _position_row(iss: Dictionary) -> Control:
	var v := UI.vbox(2)
	var top := UI.hbox(8)
	top.add_child(UI.label(iss.get("name",""), 14))
	v.add_child(top)
	var row := UI.hbox(8)
	var left := UI.label(iss.get("left",""), 11, Palette.GOP)
	left.custom_minimum_size = Vector2(150, 0)
	left.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	var sld := HSlider.new()
	sld.min_value = -1.0; sld.max_value = 1.0; sld.step = 0.1
	sld.value = 0.0
	sld.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	sld.custom_minimum_size = Vector2(0, 22)
	var iid: String = iss.get("id","")
	sld.value_changed.connect(func(val): positions[iid] = val; Audio.sfx("tick", -8.0))
	var right := UI.label(iss.get("right",""), 11, Palette.DEM)
	right.custom_minimum_size = Vector2(150, 0)
	row.add_child(left); row.add_child(sld); row.add_child(right)
	v.add_child(row)
	return v

# --- Race selection ---
func _section_race() -> Control:
	var s := _section("Choose Your Race", "Real jurisdictions (figures stylized). Stars rate the fundamentals for a center-left run.")
	var grid := GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 10)
	grid.add_theme_constant_override("v_separation", 10)
	for d in Content.districts:
		grid.add_child(_race_card(d))
	s.get_child(0).add_child(grid)
	return s

func _race_card(d: Dictionary) -> Control:
	var b := Button.new()
	b.toggle_mode = true
	b.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	b.custom_minimum_size = Vector2(320, 96)
	b.button_pressed = d.get("id","") == district_id
	UI._style_button(b, false)
	var v := UI.vbox(3)
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var top := UI.hbox(6)
	top.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var nm := UI.label(d.get("name",""), 15, Palette.INK)
	top.add_child(nm)
	top.add_child(UI.spacer())
	var stars := UI.label("★".repeat(int(d.get("stars",1))), 13, Palette.GOLD)
	top.add_child(stars)
	v.add_child(top)
	var tag := UI.label(str(d.get("tagline","")) + " · " + str(d.get("office","")).capitalize(), 12, Palette.ACCENT)
	v.add_child(tag)
	var blurb := UI.label(d.get("blurb",""), 12, Palette.MUTED)
	blurb.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	blurb.custom_minimum_size = Vector2(290, 0)
	v.add_child(blurb)
	var mc := UI.margin(8)
	mc.mouse_filter = Control.MOUSE_FILTER_IGNORE
	mc.add_child(v)
	b.add_child(mc)
	_race_cards.append(b)
	b.pressed.connect(func():
		district_id = d.get("id","")
		Audio.sfx("confirm")
		for c in _race_cards: c.button_pressed = false
		b.button_pressed = true
		_refresh_launch())
	return b

# --- helpers ---
func _section(title: String, sub := "") -> PanelContainer:
	var panel := UI.panel()
	var v := UI.vbox(10)
	panel.add_child(v)
	v.add_child(UI.kicker(title))
	if sub != "":
		var l := UI.label(sub, 12, Palette.FAINT)
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		v.add_child(l)
	return panel

func _refresh_launch() -> void:
	if _launch == null: return
	var ok := pname.strip_edges() != "" and district_id != "" and _spent_points() <= _budget()
	_launch.disabled = not ok

func _launch_campaign() -> void:
	var attr_floats := {}
	for k in attrs: attr_floats[k] = float(attrs[k]) / 10.0
	var player := {
		"name": pname.strip_edges(),
		"party": party,
		"attrs": attr_floats,
		"positions": positions.duplicate(),
		"traits": traits.duplicate(),
		"features": features.duplicate(),
		"baseExposure": 0.10,
		"baseFavorability": 0.0,
	}
	Audio.sfx("cash")
	Game.new_game(district_id, difficulty_id, player)
	go("hq")
