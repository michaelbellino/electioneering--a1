class_name Creator
extends GameScreen
## Candidate creation as a four-step wizard:
##   1 Identity   — portrait, name, party
##   2 Strengths  — difficulty, point-buy attributes, background traits
##   3 Platform   — the 8 issues, each expandable into who it moves and why
##   4 The Race   — a filterable browser with a full detail pane
## Every choice shows its consequences; nothing is a bare unexplained toggle.

const STEPS := ["Identity", "Strengths", "Platform", "The Race"]

var step := 0
var pname := "Alex Rivera"
var party := "D"
var attrs := {"charisma": 6, "competence": 6, "integrity": 5, "fundraising": 5}
var traits: Array = []
var positions: Dictionary = {}
var stances: Dictionary = {}
var features: Dictionary = {}
var difficulty_id := "normal"
var district_id := ""
var expanded_issue := ""
var race_filter := "all"
var race_query := ""
var _rng := RandomNumberGenerator.new()

var _portrait: Portrait
var _compass: Compass
var _ideo_fiscal: Label
var _ideo_social: Label
var _fit_label: Label
var _area_rows: Dictionary = {}     # area id -> {stance: Label, brush: HSlider}
var _policy_rows: Dictionary = {}   # policy id -> {pick: Label, slider: HSlider}
var _body: Control
var _tabs: HBoxContainer
var _next_btn: Button
var _back_btn: Button
var _hint: Label
var _summary: Label

const ATTR_INFO := {
	"charisma":    ["Charisma", "Wins rooms and debates. Cuts the risk on charisma-tested dilemmas and boosts rally energy."],
	"competence":  ["Competence", "Survives scrutiny. Wonky answers land, editorial boards warm to you, oppo work stays clean."],
	"integrity":   ["Integrity", "Resists scandal. Denials hold, smears bounce off, and incoming damage is blunted."],
	"fundraising": ["Fundraising", "Bigger hauls at events and a fatter weekly small-dollar trickle all campaign long."],
}

func on_enter(_data: Variant = null) -> void:
	_rng.randomize()
	features = Portrait.make_features(_rng)
	stances = Sim.blank_stances()
	positions = Sim.aggregate_to_areas(stances)
	if Content.districts.size() > 0:
		district_id = str(Content.districts[0].get("id", ""))
	_roll_name()

	var root := page(20, 10)

	# --- header -------------------------------------------------------------
	var header := UI.hbox(14)
	var titles := UI.vbox(1)
	titles.add_child(UI.title("Build Your Candidate", 27))
	_summary = UI.label("", 12, Palette.MUTED)
	titles.add_child(_summary)
	header.add_child(titles)
	header.add_child(UI.spacer())
	var back_menu := UI.button("← Menu")
	back_menu.pressed.connect(func(): Audio.sfx("click"); go("title"))
	header.add_child(back_menu)
	root.add_child(header)

	_tabs = UI.hbox(8)
	root.add_child(_tabs)

	# --- body ---------------------------------------------------------------
	_body = Control.new()
	_body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	root.add_child(_body)

	# --- footer -------------------------------------------------------------
	var footer := UI.hbox(12)
	_back_btn = UI.button("← Back")
	_back_btn.pressed.connect(_go_back)
	footer.add_child(_back_btn)
	_hint = UI.label("", 12, Palette.WARN)
	footer.add_child(_hint)
	footer.add_child(UI.spacer())
	_next_btn = UI.button("Next →", true)
	_next_btn.custom_minimum_size = Vector2(210, 0)
	_next_btn.pressed.connect(_go_next)
	footer.add_child(_next_btn)
	root.add_child(footer)

	_rebuild()

# ---------------------------------------------------------------------------
# Wizard chrome
# ---------------------------------------------------------------------------
func _rebuild(animate := true) -> void:
	_area_rows.clear()
	_policy_rows.clear()
	for c in _tabs.get_children():
		c.queue_free()
	for i in STEPS.size():
		var b := UI.selectable("%d. %s" % [i + 1, STEPS[i]])
		b.button_pressed = (i == step)
		b.custom_minimum_size = Vector2(150, 0)
		b.disabled = i > step and not _steps_valid_through(i - 1)
		var idx := i
		b.pressed.connect(func():
			if idx <= step or _step_valid(step):
				step = idx
				Audio.sfx("click")
				_rebuild()
			else:
				b.button_pressed = false
				Audio.sfx("fail"))
		_tabs.add_child(b)

	for c in _body.get_children():
		c.queue_free()
	var pg: Control
	match step:
		0: pg = _step_identity()
		1: pg = _step_strengths()
		2: pg = _step_platform()
		_: pg = _step_race()
	pg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_body.add_child(pg)

	_back_btn.disabled = step == 0
	_next_btn.text = "  Launch Campaign  →" if step == STEPS.size() - 1 else "Next →"
	_refresh_footer()

	if animate and not Game.settings.get("reduced_motion", false):
		pg.modulate.a = 0.0
		var tw := create_tween()
		tw.tween_property(pg, "modulate:a", 1.0, 0.16)

func _refresh_footer() -> void:
	var d: Dictionary = _district()
	_summary.text = "%s (%s)  ·  %s  ·  %s" % [
		pname if pname.strip_edges() != "" else "unnamed",
		_party_word(party), Game.difficulty(difficulty_id).label,
		str(d.get("name", "no race chosen"))]
	var ok := _step_valid(step)
	_next_btn.disabled = not ok
	_hint.text = "" if ok else _step_hint(step)

func _step_valid(s: int) -> bool:
	match s:
		0: return pname.strip_edges() != ""
		1: return _spent_points() <= _budget()
		3: return district_id != ""
		_: return true

## Every step up to and including `upto` must be valid before jumping ahead.
func _steps_valid_through(upto: int) -> bool:
	for i in range(0, upto + 1):
		if not _step_valid(i):
			return false
	return true

func _step_hint(s: int) -> String:
	match s:
		0: return "Give your candidate a name to continue."
		1: return "You are over budget — lower an attribute."
		3: return "Pick a race to run in."
		_: return ""

func _go_next() -> void:
	if not _step_valid(step):
		Audio.sfx("fail")
		return
	if step == STEPS.size() - 1:
		_launch_campaign()
		return
	step += 1
	Audio.sfx("confirm")
	_rebuild()

func _go_back() -> void:
	if step == 0: return
	step -= 1
	Audio.sfx("click")
	_rebuild()

# ---------------------------------------------------------------------------
# STEP 1 — Identity
# ---------------------------------------------------------------------------
func _step_identity() -> Control:
	var row := UI.hbox(16)

	# left: live portrait
	var left := UI.panel()
	left.custom_minimum_size = Vector2(330, 0)
	var lv := UI.vbox(10)
	left.add_child(lv)
	lv.add_child(UI.kicker("Your candidate"))
	_portrait = Portrait.new()
	_portrait.custom_minimum_size = Vector2(290, 330)
	_portrait.set_features(features)
	_portrait.set_party(party)
	lv.add_child(_portrait)
	lv.add_child(UI.spacer())
	var dice := UI.button("⟳  Randomize look", true)
	dice.tooltip_text = "Roll a whole new look."
	dice.pressed.connect(func():
		features = Portrait.make_features(_rng)
		_portrait.set_features(features)
		Audio.sfx("blip"))
	lv.add_child(dice)
	row.add_child(left)

	# middle: appearance cyclers
	var mid := UI.panel()
	mid.custom_minimum_size = Vector2(330, 0)
	var mv := UI.vbox(8)
	mid.add_child(mv)
	mv.add_child(UI.kicker("Appearance"))
	mv.add_child(_cycler("Hair", func(): return Portrait.HAIR_NAMES[int(features.get("hairStyle", 0)) % Portrait.HAIR_STYLES],
		func(dir): features["hairStyle"] = wrapi(int(features.get("hairStyle", 0)) + dir, 0, Portrait.HAIR_STYLES)))
	mv.add_child(_cycler("Hair colour", func(): return "Shade %d" % (Portrait.HAIRS.find(str(features.get("hairColor", ""))) + 1),
		func(dir): features["hairColor"] = Portrait.HAIRS[wrapi(Portrait.HAIRS.find(str(features.get("hairColor", ""))) + dir, 0, Portrait.HAIRS.size())]))
	mv.add_child(_cycler("Skin tone", func(): return "Tone %d" % (Portrait.SKINS.find(str(features.get("skin", ""))) + 1),
		func(dir): features["skin"] = Portrait.SKINS[wrapi(Portrait.SKINS.find(str(features.get("skin", ""))) + dir, 0, Portrait.SKINS.size())]))
	mv.add_child(_cycler("Facial hair", func(): return Portrait.FACIAL_NAMES[int(features.get("facial", 0)) % Portrait.FACIAL_STYLES],
		func(dir): features["facial"] = wrapi(int(features.get("facial", 0)) + dir, 0, Portrait.FACIAL_STYLES)))
	mv.add_child(_cycler("Suit", func(): return "Cut %d" % (Portrait.SUITS.find(str(features.get("suit", ""))) + 1),
		func(dir): features["suit"] = Portrait.SUITS[wrapi(Portrait.SUITS.find(str(features.get("suit", ""))) + dir, 0, Portrait.SUITS.size())]))
	mv.add_child(_cycler("Tie", func(): return "Colour %d" % (Portrait.TIES.find(str(features.get("tie", ""))) + 1),
		func(dir): features["tie"] = Portrait.TIES[wrapi(Portrait.TIES.find(str(features.get("tie", ""))) + dir, 0, Portrait.TIES.size())]))
	var specs := UI.selectable("Glasses")
	specs.button_pressed = bool(features.get("glasses", false))
	specs.pressed.connect(func():
		features["glasses"] = not bool(features.get("glasses", false))
		specs.button_pressed = bool(features["glasses"])
		_portrait.set_features(features)
		Audio.sfx("click"))
	mv.add_child(specs)
	row.add_child(mid)

	# right: name + party
	var right := UI.panel()
	right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var rv := UI.vbox(10)
	right.add_child(rv)
	rv.add_child(UI.kicker("Name & party"))
	var name_row := UI.hbox(8)
	var name_edit := LineEdit.new()
	name_edit.text = pname
	name_edit.placeholder_text = "Your candidate's name"
	name_edit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name_edit.tooltip_text = "This is the name on every yard sign, chyron and attack ad."
	name_edit.text_changed.connect(func(t):
		pname = t
		_refresh_footer())
	name_row.add_child(name_edit)
	var reroll := UI.button("⟳")
	reroll.tooltip_text = "Suggest a name"
	reroll.pressed.connect(func():
		_roll_name()
		name_edit.text = pname
		Audio.sfx("blip")
		_refresh_footer())
	name_row.add_child(reroll)
	rv.add_child(name_row)

	rv.add_child(UI.label("Party", 13, Palette.MUTED))
	rv.add_child(UI.wrap("Your party sets the partisan pull you inherit before you say a word. In a district that leans your way that is a head start; against the grain you are swimming upstream and must win on issues and character.", 470, 12, Palette.FAINT))
	for p in [
		["D", "Democrat", "Inherits Democratic-leaning voters. Strong where the seat already leans blue.", Palette.DEM],
		["R", "Republican", "Inherits Republican-leaning voters. Strong where the seat already leans red.", Palette.GOP],
		["I", "Independent", "No inherited base at all — you win purely on issues, character and name recognition. Hardest, most flexible.", Palette.IND]]:
		rv.add_child(_party_card(str(p[0]), str(p[1]), str(p[2]), p[3]))
	row.add_child(right)
	return row

func _cycler(label: String, getter: Callable, setter: Callable) -> Control:
	var row := UI.hbox(6)
	var l := UI.label(label, 13, Palette.MUTED)
	l.custom_minimum_size = Vector2(96, 0)
	row.add_child(l)
	var prev := UI.button("◀")
	var val := UI.label(str(getter.call()), 13, Palette.INK)
	val.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	val.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var next := UI.button("▶")
	var apply := func(dir):
		setter.call(dir)
		val.text = str(getter.call())
		_portrait.set_features(features)
		Audio.sfx("tick")
	prev.pressed.connect(func(): apply.call(-1))
	next.pressed.connect(func(): apply.call(1))
	row.add_child(prev); row.add_child(val); row.add_child(next)
	return row

func _party_card(id: String, label: String, desc: String, col: Color) -> Control:
	var b := UI.select_card(col)
	b.button_pressed = party == id
	b.custom_minimum_size = Vector2(0, 62)
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var v := UI.vbox(2)
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var top := UI.hbox(8)
	top.mouse_filter = Control.MOUSE_FILTER_IGNORE
	top.add_child(UI.label(label, 15, col))
	v.add_child(top)
	v.add_child(UI.wrap(desc, 430, 11, Palette.MUTED))
	var mc := UI.margin(8)
	mc.mouse_filter = Control.MOUSE_FILTER_IGNORE
	mc.add_child(v)
	b.add_child(mc)
	b.pressed.connect(func():
		party = id
		if _portrait: _portrait.set_party(party)
		Audio.sfx("confirm")
		_rebuild())
	return b

func _roll_name() -> void:
	var fn: Array = Content.names.get("firstNames", ["Alex"]) if Content.names else ["Alex"]
	var ln: Array = Content.names.get("lastNames", ["Rivera"]) if Content.names else ["Rivera"]
	pname = "%s %s" % [fn[_rng.randi() % fn.size()], ln[_rng.randi() % ln.size()]]

# ---------------------------------------------------------------------------
# STEP 2 — Strengths
# ---------------------------------------------------------------------------
func _step_strengths() -> Control:
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	var col := UI.vbox(14)
	col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(col)

	# difficulty
	var dp := UI.panel()
	var dv := UI.vbox(8)
	dp.add_child(dv)
	dv.add_child(UI.kicker("Difficulty"))
	dv.add_child(UI.wrap("Difficulty never changes the rules — it rescales your budget, your week, and how hard the opposition pushes.", 900, 12, Palette.FAINT))
	var drow := UI.hbox(10)
	for d in Game.DIFFICULTIES:
		drow.add_child(_difficulty_card(d))
	dv.add_child(drow)
	col.add_child(dp)

	# attributes
	var ap := UI.panel()
	var av := UI.vbox(8)
	ap.add_child(av)
	var ahead := UI.hbox(8)
	ahead.add_child(UI.kicker("Attributes"))
	ahead.add_child(UI.spacer())
	var pts_lbl := UI.label("", 14, Palette.GOLD)
	pts_lbl.add_theme_font_override("font", Palette.font_mono)
	ahead.add_child(pts_lbl)
	av.add_child(ahead)
	av.add_child(UI.wrap("Points 1–6 cost 1 each, 7–8 cost 2, 9–10 cost 3. A specialist gives something up.", 900, 12, Palette.FAINT))
	var rows: Array = []
	for key in ["charisma", "competence", "integrity", "fundraising"]:
		var r := _attr_row(str(key), pts_lbl)
		rows.append(r)
		av.add_child(r)
	col.add_child(ap)
	_update_points_label(pts_lbl)

	# traits
	var tp := UI.panel()
	var tv := UI.vbox(8)
	tp.add_child(tv)
	var thead := UI.hbox(8)
	thead.add_child(UI.kicker("Background — pick up to two"))
	thead.add_child(UI.spacer())
	thead.add_child(UI.label("%d / 2 chosen" % traits.size(), 13, Palette.GOLD if traits.size() > 0 else Palette.MUTED))
	tv.add_child(thead)
	tv.add_child(UI.wrap("Every background is a trade — it gives you something and takes something back. The effects below are exact.", 900, 12, Palette.FAINT))
	var grid := GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 10)
	grid.add_theme_constant_override("v_separation", 10)
	for t in Game.TRAITS:
		grid.add_child(_trait_card(t))
	tv.add_child(grid)
	col.add_child(tp)
	return scroll

func _difficulty_card(d: Dictionary) -> Control:
	var b := UI.select_card()
	b.button_pressed = d.id == difficulty_id
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b.custom_minimum_size = Vector2(0, 172)
	var v := UI.vbox(4)
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_child(UI.label(str(d.label), 15, Palette.INK))
	v.add_child(UI.wrap(str(d.desc), 190, 11, Palette.MUTED))
	var chips := UI.vbox(3)
	chips.mouse_filter = Control.MOUSE_FILTER_IGNORE
	chips.add_child(UI.chip("%d creation points" % int(d.points), Palette.GOLD))
	chips.add_child(UI.chip("%d actions / week" % int(d.maxAP), Palette.ACCENT))
	chips.add_child(UI.chip("×%.2f starting cash" % float(d.cashMult), Palette.GOOD if float(d.cashMult) >= 1.0 else Palette.BAD))
	chips.add_child(UI.chip("×%.2f opponent push" % float(d.oppMult), Palette.BAD if float(d.oppMult) > 1.0 else Palette.GOOD))
	v.add_child(chips)
	var mc := UI.margin(8)
	mc.mouse_filter = Control.MOUSE_FILTER_IGNORE
	mc.add_child(v)
	b.add_child(mc)
	b.pressed.connect(func():
		difficulty_id = str(d.id)
		Audio.sfx("confirm")
		_rebuild())
	return b

func _attr_row(key: String, pts_lbl: Label) -> Control:
	var info: Array = ATTR_INFO.get(key, [key, ""])
	var v := UI.vbox(2)
	var row := UI.hbox(10)
	var name_lbl := UI.label(str(info[0]), 15)
	name_lbl.custom_minimum_size = Vector2(120, 0)
	row.add_child(name_lbl)
	var sld := HSlider.new()
	sld.min_value = 1; sld.max_value = 10; sld.step = 1
	sld.value = attrs[key]
	sld.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	sld.custom_minimum_size = Vector2(0, 24)
	sld.tooltip_text = str(info[1])
	var val_lbl := UI.label("", 14, Palette.INK)
	val_lbl.add_theme_font_override("font", Palette.font_mono)
	val_lbl.custom_minimum_size = Vector2(96, 0)
	var set_val := func(v2: int):
		val_lbl.text = "%2d  (%d pts)" % [v2, _cost(v2)]
	set_val.call(int(attrs[key]))
	sld.value_changed.connect(func(nv):
		var old: int = int(attrs[key])
		attrs[key] = int(nv)
		if _spent_points() > _budget():
			attrs[key] = old
			sld.set_value_no_signal(old)
			Audio.sfx("fail")
		else:
			Audio.sfx("tick", -8.0)
		set_val.call(int(attrs[key]))
		_update_points_label(pts_lbl)
		_refresh_footer())
	row.add_child(sld)
	row.add_child(val_lbl)
	v.add_child(row)
	v.add_child(UI.wrap(str(info[1]), 860, 11, Palette.FAINT))
	return v

func _update_points_label(l: Label) -> void:
	var rem := _budget() - _spent_points()
	l.text = "%d of %d points left" % [rem, _budget()]
	l.add_theme_color_override("font_color", Palette.GOOD if rem >= 0 else Palette.BAD)

func _trait_effects(t: Dictionary) -> Array:
	## Turn a trait's raw modifiers into readable chips — this is what was missing.
	var out: Array = []
	if t.has("baseExposure"):
		out.append(["%+d%% starting name recognition" % int(round(float(t.baseExposure) * 100)), float(t.baseExposure) > 0])
	if t.has("baseFavorability"):
		out.append(["%+d starting favourability" % int(round(float(t.baseFavorability) * 100)), float(t.baseFavorability) > 0])
	if t.has("cash"):
		out.append(["%s%s starting cash" % ["+" if int(t.cash) > 0 else "−", Game.money_str(absi(int(t.cash)) * 100)], int(t.cash) > 0])
	if t.has("ap"):
		out.append(["%+d action point / week" % int(t.ap), int(t.ap) > 0])
	if t.has("salaryMult"):
		out.append(["%d%% staff salaries" % int(round(float(t.salaryMult) * 100)), float(t.salaryMult) < 1.0])
	if t.has("scandalMult"):
		out.append(["%d%% scandal damage" % int(round(float(t.scandalMult) * 100)), float(t.scandalMult) < 1.0])
	for k in t.get("attrs", {}):
		var d: float = float(t["attrs"][k])
		out.append(["%+d %s" % [int(round(d * 10)), str(ATTR_INFO.get(k, [k])[0])], d > 0])
	return out

func _trait_card(t: Dictionary) -> Control:
	var chosen: bool = traits.has(str(t.id))
	var b := UI.select_card(Palette.GOLD)
	b.button_pressed = chosen
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b.custom_minimum_size = Vector2(0, 128)
	var v := UI.vbox(4)
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var top := UI.hbox(6)
	top.mouse_filter = Control.MOUSE_FILTER_IGNORE
	top.add_child(UI.label(str(t.label), 15, Palette.GOLD if chosen else Palette.INK))
	top.add_child(UI.spacer())
	if chosen:
		top.add_child(UI.label("✓ chosen", 11, Palette.GOLD))
	v.add_child(top)
	v.add_child(UI.wrap(str(t.desc), 400, 11, Palette.MUTED))
	var flow := HFlowContainer.new()
	flow.mouse_filter = Control.MOUSE_FILTER_IGNORE
	flow.add_theme_constant_override("h_separation", 5)
	flow.add_theme_constant_override("v_separation", 4)
	for e in _trait_effects(t):
		flow.add_child(UI.chip(str(e[0]), Palette.GOOD if bool(e[1]) else Palette.BAD))
	v.add_child(flow)
	var mc := UI.margin(8)
	mc.mouse_filter = Control.MOUSE_FILTER_IGNORE
	mc.add_child(v)
	b.add_child(mc)
	b.pressed.connect(func():
		var tid := str(t.id)
		if traits.has(tid):
			traits.erase(tid)
			Audio.sfx("click")
		elif traits.size() < 2:
			traits.append(tid)
			Audio.sfx("confirm")
		else:
			Audio.sfx("fail")
		_rebuild())
	return b

func _cost(stepv: int) -> int:
	var c := 0
	for s in range(1, stepv + 1):
		c += 1 if s <= 6 else (2 if s <= 8 else 3)
	return c

func _spent_points() -> int:
	var total := 0
	for k in attrs: total += _cost(int(attrs[k]))
	return total

func _budget() -> int:
	return int(Game.difficulty(difficulty_id).points)

# ---------------------------------------------------------------------------
# STEP 3 — Platform. Your platform is 24 concrete POLICY stances, not 8 vague
# sliders. Area sliders are a quick brush; open an area to set each policy
# precisely, see how it polls relative to its area, and who it moves.
# ---------------------------------------------------------------------------
func _step_platform() -> Control:
	var row := UI.hbox(14)

	# ---- left: ideology compass + summary -----------------------------------
	var left := UI.panel()
	left.custom_minimum_size = Vector2(330, 0)
	var lv := UI.vbox(8)
	left.add_child(lv)
	lv.add_child(UI.kicker("Your ideology"))
	var ideo := Sim.ideology_of(stances)
	var compass := Compass.new()
	_compass = compass
	compass.custom_minimum_size = Vector2(290, 270)
	compass.set_values(float(ideo.fiscal), float(ideo.social))
	compass.tooltip_text = "Computed from all 24 of your policy stances.\nThe gold crosshair is where this district's voters sit."
	var d0: Dictionary = _district()
	if not d0.is_empty():
		var di := _district_ideology(d0)
		compass.set_district(float(di.fiscal), float(di.social))
	lv.add_child(compass)

	var fi := UI.hbox(6)
	fi.add_child(UI.label("Fiscal", 12, Palette.MUTED))
	fi.add_child(UI.spacer())
	_ideo_fiscal = UI.label(Sim.ideology_label(float(ideo.fiscal)), 12, Palette.ACCENT.darkened(0.15))
	fi.add_child(_ideo_fiscal)
	lv.add_child(fi)
	var so := UI.hbox(6)
	so.add_child(UI.label("Social", 12, Palette.MUTED))
	so.add_child(UI.spacer())
	_ideo_social = UI.label(Sim.ideology_label(float(ideo.social)), 12, Palette.IND.darkened(0.15))
	so.add_child(_ideo_social)
	lv.add_child(so)

	if not d0.is_empty():
		var fit := _platform_fit(d0)
		var fr := UI.hbox(6)
		fr.add_child(UI.label("Fit with race", 12, Palette.MUTED))
		fr.add_child(UI.spacer())
		_fit_label = UI.label("%d%% aligned" % int(round(fit * 100)), 13,
			Palette.GOOD if fit > 0.60 else (Palette.WARN if fit > 0.45 else Palette.BAD))
		_fit_label.add_theme_font_override("font", Palette.font_mono)
		fr.add_child(_fit_label)
		lv.add_child(fr)
		lv.add_child(UI.wrap("Measured against %s, weighting each group by size and by how much they care." % str(d0.get("name", "")), 280, 11, Palette.FAINT))

	lv.add_child(UI.spacer())
	var preset_lbl := UI.label("Quick presets", 12, Palette.MUTED)
	lv.add_child(preset_lbl)
	var prow := UI.hbox(6)
	for p in [["Progressive", 0.55], ["Centrist", 0.0], ["Conservative", -0.55]]:
		var pb := UI.button(str(p[0]))
		pb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		pb.add_theme_font_size_override("font_size", 12)
		pb.tooltip_text = "Set every policy to a %s starting point. You can still tune each one." % str(p[0]).to_lower()
		pb.pressed.connect(func():
			for pol in Content.policies:
				stances[str(pol.get("id", ""))] = float(p[1])
			Audio.sfx("confirm")
			_rebuild())
		prow.add_child(pb)
	lv.add_child(prow)
	row.add_child(left)

	# ---- right: the areas ---------------------------------------------------
	var right := UI.vbox(8)
	right.size_flags_horizontal = Control.SIZE_EXPAND_FILL

	var head := UI.panel()
	var hv := UI.vbox(4)
	head.add_child(hv)
	var hr := UI.hbox(8)
	hr.add_child(UI.kicker("Where you stand — %d policies across %d areas" % [Content.policies.size(), Content.issues.size()]))
	hr.add_child(UI.spacer())
	hr.add_child(UI.label("Open an area to set each policy precisely", 11, Palette.FAINT))
	hv.add_child(hr)
	right.add_child(head)

	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var col := UI.vbox(8)
	col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(col)
	for iss in Content.issues:
		col.add_child(_issue_row(iss))
	right.add_child(scroll)
	row.add_child(right)
	return row

func _issue_row(iss: Dictionary) -> Control:
	var iid := str(iss.get("id", ""))
	var open: bool = expanded_issue == iid
	var area_val: float = float(_areas().get(iid, 0.0))
	var panel := UI.panel()
	var v := UI.vbox(6)
	panel.add_child(v)

	var top := UI.hbox(8)
	var pols := Sim.policies_for_area(iid)
	var expander := UI.button(("▾  " if open else "▸  ") + str(iss.get("name", "")))
	expander.tooltip_text = "Open the %d specific policies under %s" % [pols.size(), str(iss.get("name", ""))]
	expander.custom_minimum_size = Vector2(220, 0)
	expander.pressed.connect(func():
		expanded_issue = "" if open else iid
		Audio.sfx("click")
		_rebuild())
	top.add_child(expander)
	var stance := UI.label(_stance_text(iss, area_val), 12, _stance_color(area_val))
	stance.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(stance)
	top.add_child(UI.chip("%d policies" % pols.size(), Palette.MUTED, 0.10))
	var sal := UI.chip("salience %d%%" % int(round(float(iss.get("baseSalience", 0.5)) * 100)), Palette.MUTED, 0.10)
	sal.tooltip_text = "How much weight voters put on this area nationally."
	top.add_child(sal)
	v.add_child(top)

	# area-level brush: moves every policy underneath it at once
	var brow := UI.hbox(8)
	var bleft := UI.label(str(iss.get("left", "")), 11, Palette.GOP)
	bleft.custom_minimum_size = Vector2(160, 0)
	bleft.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	var bsld := HSlider.new()
	bsld.min_value = -1.0; bsld.max_value = 1.0; bsld.step = 0.05
	bsld.value = area_val
	bsld.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bsld.custom_minimum_size = Vector2(0, 22)
	bsld.tooltip_text = "Sets every policy in this area at once. Open the area to fine-tune individual policies."
	bsld.value_changed.connect(func(val):
		Sim.stances_from_area(stances, iid, val)
		stance.text = _stance_text(iss, val)
		stance.add_theme_color_override("font_color", _stance_color(val))
		# mirror the brush into any policy rows currently on screen
		for p2 in Sim.policies_for_area(iid):
			var pid2 := str(p2.get("id", ""))
			if _policy_rows.has(pid2):
				var r: Dictionary = _policy_rows[pid2]
				r["slider"].set_value_no_signal(val)
				r["pick"].text = _policy_stance_text(p2, val)
				r["pick"].add_theme_color_override("font_color", _stance_color(val))
		_refresh_platform_readouts()
		Audio.sfx("tick", -14.0))
	var bright := UI.label(str(iss.get("right", "")), 11, Palette.DEM)
	bright.custom_minimum_size = Vector2(160, 0)
	brow.add_child(bleft); brow.add_child(bsld); brow.add_child(bright)
	v.add_child(brow)
	_area_rows[iid] = {"stance": stance, "brush": bsld, "iss": iss}

	if open:
		v.add_child(_area_detail(iss, pols))
	return panel

## The precise layer: one slider per named policy, with its polling character.
func _area_detail(iss: Dictionary, pols: Array) -> Control:
	var iid := str(iss.get("id", ""))
	var inner := PanelContainer.new()
	inner.add_theme_stylebox_override("panel", UI.flat(Palette.BG2, 8, 1, Palette.BORDER))
	var box := UI.vbox(8)
	inner.add_child(box)

	box.add_child(UI.label("SPECIFIC POSITIONS", 11, Palette.GOLD))
	box.add_child(UI.wrap("Your area position is the weighted average of these. Specific policies poll differently from the area they sit in — background checks outrun \"gun control\".", 780, 11, Palette.FAINT))

	for p in pols:
		box.add_child(_policy_row(p))

	# who this area moves
	var d: Dictionary = _district()
	if not d.is_empty():
		box.add_child(HSeparator.new())
		var avg := _electorate_avg(d, iid)
		var mine: float = float(_areas().get(iid, 0.0))
		var line := UI.hbox(8)
		line.add_child(UI.chip("Your area position %+.2f" % mine, Palette.ACCENT))
		line.add_child(UI.chip("This electorate %+.2f" % avg, Palette.GOLD))
		var gap: float = absf(mine - avg)
		line.add_child(UI.chip("Gap %.2f — %s" % [gap, ("close" if gap < 0.35 else ("wide" if gap > 0.8 else "workable"))],
			Palette.GOOD if gap < 0.35 else (Palette.BAD if gap > 0.8 else Palette.WARN)))
		box.add_child(line)
		box.add_child(UI.label("How each group sees you on this area", 12, Palette.MUTED))
		for r in _segment_agreement(d, iid, mine):
			box.add_child(_agreement_row(r))
	return inner

func _policy_row(p: Dictionary) -> Control:
	var pid := str(p.get("id", ""))
	var val: float = float(stances.get(pid, 0.0))
	var v := UI.vbox(2)

	var top := UI.hbox(6)
	var nm := UI.label(str(p.get("label", "")), 13, Palette.INK)
	nm.custom_minimum_size = Vector2(210, 0)
	top.add_child(nm)
	var pick := UI.label(_policy_stance_text(p, val), 12, _stance_color(val))
	pick.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(pick)
	top.add_child(UI.chip("weight %d%%" % int(round(float(p.get("weight", 0.0)) * 100)), Palette.MUTED, 0.10))
	var off := float(p.get("popularOffset", 0.0))
	if absf(off) >= 0.05:
		var polls_better := off > 0.0
		var c := UI.chip(("polls %+d vs area" % int(round(off * 100))), Palette.GOOD if polls_better else Palette.BAD)
		c.tooltip_text = ("The progressive side of this policy is MORE popular than its area overall."
			if polls_better else "The progressive side of this policy is LESS popular than its area overall.")
		top.add_child(c)
	v.add_child(top)

	var row := UI.hbox(8)
	var left := UI.label(str(p.get("con", "")), 11, Palette.GOP)
	left.custom_minimum_size = Vector2(160, 0)
	left.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	var sld := HSlider.new()
	sld.min_value = -1.0; sld.max_value = 1.0; sld.step = 0.05
	sld.value = val
	sld.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	sld.custom_minimum_size = Vector2(0, 20)
	sld.tooltip_text = "%s  ←→  %s" % [str(p.get("con", "")), str(p.get("pro", ""))]
	sld.value_changed.connect(func(nv):
		stances[pid] = nv
		pick.text = _policy_stance_text(p, nv)
		pick.add_theme_color_override("font_color", _stance_color(nv))
		var area := str(p.get("area", ""))
		if _area_rows.has(area):
			var ar: Dictionary = _area_rows[area]
			var av: float = float(_areas().get(area, 0.0))
			ar["brush"].set_value_no_signal(av)
			ar["stance"].text = _stance_text(ar["iss"], av)
			ar["stance"].add_theme_color_override("font_color", _stance_color(av))
		_refresh_platform_readouts()
		Audio.sfx("tick", -16.0))
	var right := UI.label(str(p.get("pro", "")), 11, Palette.DEM)
	right.custom_minimum_size = Vector2(160, 0)
	row.add_child(left); row.add_child(sld); row.add_child(right)
	v.add_child(row)
	_policy_rows[pid] = {"pick": pick, "slider": sld}
	return v

## Live update of the compass, ideology labels and fit — no page rebuild, no flicker.
func _refresh_platform_readouts() -> void:
	var ideo := Sim.ideology_of(stances)
	if is_instance_valid(_compass):
		_compass.set_values(float(ideo.fiscal), float(ideo.social))
	if is_instance_valid(_ideo_fiscal):
		_ideo_fiscal.text = Sim.ideology_label(float(ideo.fiscal))
	if is_instance_valid(_ideo_social):
		_ideo_social.text = Sim.ideology_label(float(ideo.social))
	if is_instance_valid(_fit_label):
		var d := _district()
		if not d.is_empty():
			var fit := _platform_fit(d)
			_fit_label.text = "%d%% aligned" % int(round(fit * 100))
			_fit_label.add_theme_color_override("font_color",
				Palette.GOOD if fit > 0.60 else (Palette.WARN if fit > 0.45 else Palette.BAD))

func _agreement_row(r: Dictionary) -> Control:
	var hr := UI.hbox(8)
	var nm := UI.label(str(r["label"]), 11, Palette.INK)
	nm.custom_minimum_size = Vector2(180, 0)
	hr.add_child(nm)
	var bar := ProgressBar.new()
	bar.show_percentage = false
	bar.min_value = 0; bar.max_value = 1
	bar.value = float(r["agree"])
	bar.custom_minimum_size = Vector2(0, 10)
	bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var c: Color = Palette.GOOD if float(r["agree"]) > 0.66 else (Palette.WARN if float(r["agree"]) > 0.42 else Palette.BAD)
	bar.add_theme_stylebox_override("fill", UI.flat(c, 3))
	bar.add_theme_stylebox_override("background", UI.flat(Palette.PANEL2, 3))
	hr.add_child(bar)
	var pct := UI.label("%d%%" % int(round(float(r["agree"]) * 100)), 11, c)
	pct.add_theme_font_override("font", Palette.font_mono)
	pct.custom_minimum_size = Vector2(42, 0)
	hr.add_child(pct)
	var share := UI.label("%d%% of voters" % int(round(float(r["share"]) * 100)), 11, Palette.FAINT)
	share.custom_minimum_size = Vector2(92, 0)
	hr.add_child(share)
	var cares := UI.label("cares ×%.2f" % float(r["salience"]), 11, Palette.FAINT)
	cares.add_theme_font_override("font", Palette.font_mono)
	hr.add_child(cares)
	return hr

func _policy_stance_text(p: Dictionary, v: float) -> String:
	var a := absf(v)
	if a < 0.08:
		return "No firm position"
	var intensity := "Lean:" if a < 0.35 else ("Support:" if a < 0.7 else "Champion:")
	return "%s %s" % [intensity, str(p.get("pro", "")) if v > 0 else str(p.get("con", ""))]

func _stance_text(iss: Dictionary, v: float) -> String:
	var a := absf(v)
	if a < 0.08:
		return "Neutral — refusing to pick a side"
	var intensity := "Leans toward" if a < 0.35 else ("Firmly for" if a < 0.7 else "Strongly for")
	var pole := str(iss.get("right", "")) if v > 0 else str(iss.get("left", ""))
	return "%s %s" % [intensity, pole]

func _stance_color(v: float) -> Color:
	if absf(v) < 0.08: return Palette.MUTED
	return Palette.DEM if v > 0 else Palette.GOP

## Current 8 area positions, aggregated from the 24 stances.
func _areas() -> Dictionary:
	return Sim.aggregate_to_areas(stances)

## CVAP- and salience-weighted average position of this electorate on an area.
func _electorate_avg(d: Dictionary, issue: String) -> float:
	var num := 0.0
	var den := 0.0
	for seg in d.get("segmentShares", {}):
		var b: Dictionary = Content.behavior.get(seg, {})
		if b.is_empty(): continue
		var share := float(d["segmentShares"][seg])
		var sal := float(b.get("issueSalience", {}).get(issue, 1.0))
		num += share * sal * float(b.get("issuePositions", {}).get(issue, 0.0))
		den += share * sal
	return num / den if den > 0.0 else 0.0

func _segment_agreement(d: Dictionary, issue: String, mine: float) -> Array:
	var out: Array = []
	for seg in d.get("segmentShares", {}):
		var b: Dictionary = Content.behavior.get(seg, {})
		if b.is_empty(): continue
		var pos := float(b.get("issuePositions", {}).get(issue, 0.0))
		var sal := float(b.get("issueSalience", {}).get(issue, 1.0))
		out.append({
			"label": _segment_label(str(seg)),
			"share": float(d["segmentShares"][seg]),
			"salience": sal,
			"agree": clampf(1.0 - absf(pos - mine), 0.0, 1.0),
		})
	out.sort_custom(func(a, b2): return float(a["share"]) > float(b2["share"]))
	return out

func _segment_label(seg: String) -> String:
	for s in Content.segments:
		if str(s.get("id", "")) == seg:
			return str(s.get("label", seg))
	return seg

## Where this district's voters sit on the two ideology axes.
func _district_ideology(d: Dictionary) -> Dictionary:
	var f := 0.0
	var fw := 0.0
	var s := 0.0
	var sw := 0.0
	for p in Content.policies:
		var area := str(p.get("area", ""))
		var epos := _electorate_avg(d, area) + float(p.get("popularOffset", 0.0))
		var w := float(p.get("weight", 0.0))
		var pf := float(p.get("fiscal", 0.0))
		var ps := float(p.get("social", 0.0))
		f += clampf(epos, -1, 1) * pf * w; fw += pf * w
		s += clampf(epos, -1, 1) * ps * w; sw += ps * w
	return {"fiscal": (f / fw) if fw > 0 else 0.0, "social": (s / sw) if sw > 0 else 0.0}

## Platform alignment, computed POLICY BY POLICY so precise positions matter:
## each policy is compared against the electorate's area position shifted by that
## policy's own popularity offset, weighted by policy weight × group size × salience.
func _platform_fit(d: Dictionary) -> float:
	var num := 0.0
	var den := 0.0
	for p in Content.policies:
		var area := str(p.get("area", ""))
		var pw := float(p.get("weight", 0.0))
		var mine := float(stances.get(str(p.get("id", "")), 0.0))
		for seg in d.get("segmentShares", {}):
			var b: Dictionary = Content.behavior.get(seg, {})
			if b.is_empty(): continue
			var w := pw * float(d["segmentShares"][seg]) * float(b.get("issueSalience", {}).get(area, 1.0))
			var epos := clampf(float(b.get("issuePositions", {}).get(area, 0.0)) + float(p.get("popularOffset", 0.0)), -1.0, 1.0)
			num += w * clampf(1.0 - absf(epos - mine), 0.0, 1.0)
			den += w
	return num / den if den > 0.0 else 0.5
# ---------------------------------------------------------------------------
# STEP 4 — The race (browser + detail; no more overflowing card wall)
# ---------------------------------------------------------------------------
func _step_race() -> Control:
	var row := UI.hbox(14)

	# left: search + filters + list
	var left := UI.panel()
	left.custom_minimum_size = Vector2(420, 0)
	var lv := UI.vbox(8)
	left.add_child(lv)
	lv.add_child(UI.kicker("Choose your race"))

	var search := LineEdit.new()
	search.placeholder_text = "Search state, district or theme…"
	search.text = race_query
	search.text_changed.connect(func(t):
		race_query = t
		_rebuild())
	lv.add_child(search)

	var filters := UI.hbox(6)
	for f in [["all", "All"], ["house", "House"], ["senate", "Senate"], ["governor", "Governor"], ["mayor", "Mayor"]]:
		var fb := UI.selectable(str(f[1]))
		fb.button_pressed = race_filter == str(f[0])
		fb.custom_minimum_size = Vector2(0, 30)
		fb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		fb.add_theme_font_size_override("font_size", 12)
		fb.pressed.connect(func():
			race_filter = str(f[0])
			Audio.sfx("click")
			_rebuild())
		filters.add_child(fb)
	lv.add_child(filters)

	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var list := UI.vbox(6)
	list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(list)
	var shown := 0
	for d in Content.districts:
		if race_filter != "all" and str(d.get("office", "")) != race_filter:
			continue
		var q := race_query.strip_edges().to_lower()
		if q != "" and not (str(d.get("name", "")) + str(d.get("state", "")) + str(d.get("tagline", ""))).to_lower().contains(q):
			continue
		list.add_child(_race_row(d))
		shown += 1
	if shown == 0:
		list.add_child(UI.label("No races match that search.", 12, Palette.FAINT))
	lv.add_child(scroll)
	lv.add_child(UI.label("%d race%s available" % [shown, "" if shown == 1 else "s"], 11, Palette.FAINT))
	row.add_child(left)

	# right: detail
	var right := UI.panel()
	right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var rv := UI.vbox(10)
	right.add_child(rv)
	var d2: Dictionary = _district()
	if d2.is_empty():
		rv.add_child(UI.label("Pick a race on the left.", 13, Palette.FAINT))
	else:
		_build_race_detail(rv, d2)
	row.add_child(right)
	return row

func _race_row(d: Dictionary) -> Control:
	var selected: bool = str(d.get("id", "")) == district_id
	var b := UI.select_card()
	b.button_pressed = selected
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b.custom_minimum_size = Vector2(0, 54)
	var v := UI.vbox(2)
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var top := UI.hbox(6)
	top.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var nm := UI.label(str(d.get("name", "")), 14, Palette.INK if selected else Palette.MUTED)
	nm.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(nm)
	v.add_child(top)
	var sub := UI.hbox(6)
	sub.mouse_filter = Control.MOUSE_FILTER_IGNORE
	sub.add_child(UI.label("★%d" % int(d.get("stars", 1)), 11, Palette.GOLD))
	sub.add_child(UI.label(str(d.get("tagline", "")), 11, Palette.ACCENT))
	sub.add_child(UI.spacer())
	sub.add_child(UI.label(_lean_word(float(d.get("lean", 0.0))), 11, Palette.lean_color(float(d.get("lean", 0.0)))))
	v.add_child(sub)
	var mc := UI.margin(7)
	mc.mouse_filter = Control.MOUSE_FILTER_IGNORE
	mc.add_child(v)
	b.add_child(mc)
	b.pressed.connect(func():
		district_id = str(d.get("id", ""))
		Audio.sfx("confirm")
		_rebuild())
	return b

func _build_race_detail(rv: VBoxContainer, d: Dictionary) -> void:
	var head := UI.hbox(8)
	var titles := UI.vbox(1)
	titles.add_child(UI.title(str(d.get("name", "")), 22))
	titles.add_child(UI.label("%s · %s · %s" % [
		str(d.get("tagline", "")), str(d.get("office", "")).capitalize(), str(d.get("state", ""))], 12, Palette.ACCENT))
	head.add_child(titles)
	head.add_child(UI.spacer())
	head.add_child(UI.label("★".repeat(int(d.get("stars", 1))), 16, Palette.GOLD))
	rv.add_child(head)
	rv.add_child(UI.wrap(str(d.get("blurb", "")), 640, 12, Palette.MUTED))

	# lean meter
	var lean := float(d.get("lean", 0.0))
	var lr := UI.hbox(8)
	lr.add_child(UI.label("Partisan lean", 12, Palette.MUTED))
	var g := Gauge.new()
	g.bipolar = true
	g.custom_minimum_size = Vector2(300, 34)
	g.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	g.setup("", lean, Palette.ACCENT, _lean_word(lean), true)
	lr.add_child(g)
	rv.add_child(lr)

	# stat grid
	var grid := GridContainer.new()
	grid.columns = 4
	grid.add_theme_constant_override("h_separation", 18)
	grid.add_theme_constant_override("v_separation", 6)
	_stat(grid, "Voting-age pop.", Game._comma(int(d.get("cvap", 0))))
	_stat(grid, "Median income", "$" + Game._comma(int(d.get("medianIncome", 0))))
	_stat(grid, "Median age", str(int(d.get("medianAge", 0))))
	_stat(grid, "Typical turnout", "%d%%" % int(round(float(d.get("turnout", 0.5)) * 100)))
	rv.add_child(grid)

	# electorate composition
	rv.add_child(UI.label("Who lives here", 12, Palette.MUTED))
	var shares: Dictionary = d.get("segmentShares", {})
	var keys := shares.keys()
	keys.sort_custom(func(a, b): return float(shares[a]) > float(shares[b]))
	for seg in keys:
		var hr := UI.hbox(8)
		var nm := UI.label(_segment_label(str(seg)), 11, Palette.INK)
		nm.custom_minimum_size = Vector2(190, 0)
		hr.add_child(nm)
		var bar := ProgressBar.new()
		bar.show_percentage = false
		bar.min_value = 0; bar.max_value = 1
		bar.value = float(shares[seg])
		bar.custom_minimum_size = Vector2(0, 10)
		bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		bar.add_theme_stylebox_override("fill", UI.flat(Palette.ACCENT, 3))
		bar.add_theme_stylebox_override("background", UI.flat(Palette.PANEL2, 3))
		hr.add_child(bar)
		var pct := UI.label("%d%%" % int(round(float(shares[seg]) * 100)), 11, Palette.MUTED)
		pct.add_theme_font_override("font", Palette.font_mono)
		pct.custom_minimum_size = Vector2(40, 0)
		hr.add_child(pct)
		rv.add_child(hr)

	# towns
	var towns: Array = d.get("towns", [])
	if towns.size() > 0:
		var flow := HFlowContainer.new()
		flow.add_theme_constant_override("h_separation", 5)
		flow.add_theme_constant_override("v_separation", 4)
		for t in towns:
			flow.add_child(UI.chip(str(t), Palette.MUTED, 0.10))
		rv.add_child(flow)

	# opening projection — the real model, not a guess
	var share := _preview_share(d)
	var pp := PanelContainer.new()
	pp.add_theme_stylebox_override("panel", UI.flat(Palette.BG2, 8, 1, Palette.BORDER))
	var pv := UI.vbox(4)
	pp.add_child(pv)
	pv.add_child(UI.label("If the election were held today", 12, Palette.MUTED))
	var pr := UI.hbox(10)
	pr.add_child(UI.label("%s%s" % [pname, " (%s)" % party], 13, Palette.party_color(party)))
	pr.add_child(UI.spacer())
	pr.add_child(UI.chip("%d%% projected" % int(round(share * 100)),
		Palette.GOOD if share > 0.52 else (Palette.WARN if share > 0.46 else Palette.BAD), 0.20))
	pv.add_child(pr)
	pv.add_child(UI.wrap("Your platform and party against a generic opponent, before any campaigning. Name recognition, money and a real opponent all come later — this is just the ground you start on.", 620, 11, Palette.FAINT))
	rv.add_child(pp)

func _stat(grid: GridContainer, label: String, value: String) -> void:
	var v := UI.vbox(0)
	v.add_child(UI.label(label, 11, Palette.FAINT))
	var val := UI.label(value, 15, Palette.INK)
	val.add_theme_font_override("font", Palette.font_mono)
	v.add_child(val)
	grid.add_child(v)

func _lean_word(lean: float) -> String:
	var a := absf(lean)
	var side := "D" if lean > 0 else "R"
	if a < 0.05: return "Tossup"
	if a < 0.18: return "Leans %s" % side
	if a < 0.40: return "Likely %s" % side
	return "Safe %s" % side

## Fundamentals preview through the real simulation: you vs a generic opponent,
## equal awareness, no campaigning yet.
func _preview_share(d: Dictionary) -> float:
	var elec := Sim.build_electorate(d)
	var state := {"effects": [], "week": 0}
	var attr_floats := {}
	for k in attrs: attr_floats[k] = float(attrs[k]) / 10.0
	var me := {
		"id": "player", "party": party, "positions": Sim.aggregate_to_areas(stances), "attrs": attr_floats,
		"scandal": 0.0, "baseExposure": 0.5, "baseFavorability": 0.0,
	}
	var opp_dir: float = -1.0 if party == "D" else 1.0
	var opp_pos := {}
	for iss in Sim.issue_ids():
		opp_pos[iss] = opp_dir * 0.35
	var opp := {
		"id": "opp0", "party": ("R" if party == "D" else "D"), "positions": opp_pos,
		"attrs": {"charisma": 0.55, "competence": 0.55, "integrity": 0.5, "fundraising": 0.6},
		"scandal": 0.0, "baseExposure": 0.5, "baseFavorability": 0.0,
	}
	var res := Sim.evaluate(state, elec, [me, opp])
	return float(res.shares.get("player", 0.5))

func _district() -> Dictionary:
	return Content.district(district_id)

func _party_word(p: String) -> String:
	return {"D": "Democrat", "R": "Republican", "I": "Independent"}.get(p, "Independent")

# ---------------------------------------------------------------------------
func _launch_campaign() -> void:
	var attr_floats := {}
	for k in attrs: attr_floats[k] = float(attrs[k]) / 10.0
	var player := {
		"name": pname.strip_edges(),
		"party": party,
		"attrs": attr_floats,
		"positions": Sim.aggregate_to_areas(stances),
		"stances": stances.duplicate(),
		"traits": traits.duplicate(),
		"features": features.duplicate(),
		"baseExposure": 0.10,
		"baseFavorability": 0.0,
	}
	Audio.sfx("cash")
	Game.new_game(district_id, difficulty_id, player)
	go("hq")
