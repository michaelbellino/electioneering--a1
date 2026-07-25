class_name WeekReview
extends Control
## The beat between weeks. The simulation does a lot of work when you end a week —
## opponents move, money arrives, salaries go out, effects ramp and decay, a new
## poll lands. Previously all of that happened silently and the player just saw
## different numbers. This says what happened and why.

signal dismissed()

var report: Dictionary = {}
var _card: PanelContainer

func _init() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP

func setup(r: Dictionary) -> void:
	report = r
	var dim := ColorRect.new()
	dim.color = Color(0.09, 0.10, 0.13, 0.42)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	dim.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(dim)

	_card = UI.panel()
	_card.custom_minimum_size = Vector2(560, 0)
	_card.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	_card.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_card.grow_vertical = Control.GROW_DIRECTION_BOTH
	add_child(_card)

	var v := UI.vbox(8)
	_card.add_child(v)

	var head := UI.hbox(8)
	head.add_child(UI.title("WEEK %d WRAPPED" % int(report.get("week", 1)), 26))
	head.add_child(UI.spacer())
	var left: int = Game.weeks_left()
	head.add_child(UI.chip("%d week%s to election" % [left, "" if left == 1 else "s"],
		Palette.BAD if left <= 2 else Palette.MUTED, 0.16))
	v.add_child(head)
	v.add_child(UI.rule())

	# ---- the poll ---------------------------------------------------------
	var before: float = float(report.get("pollBefore", 0.0))
	var after: float = float(report.get("pollAfter", 0.0))
	var delta := (after - before) * 100.0
	var poll_row := UI.hbox(10)
	poll_row.add_child(UI.label("Your polling", 15, Palette.MUTED))
	poll_row.add_child(UI.spacer())
	poll_row.add_child(UI.num("%.1f%%" % (before * 100.0), 15, Palette.FAINT))
	poll_row.add_child(UI.label("→", 15, Palette.FAINT))
	poll_row.add_child(UI.num("%.1f%%" % (after * 100.0), 19, Palette.INK))
	poll_row.add_child(UI.chip("%+.1f" % delta,
		Palette.GOOD if delta > 0.05 else (Palette.BAD if delta < -0.05 else Palette.MUTED), 0.18))
	v.add_child(poll_row)

	# ---- what moved it ----------------------------------------------------
	var effects: Array = report.get("effects", [])
	if effects.size() > 0:
		v.add_child(UI.label("What's moving your numbers", 12, Palette.MUTED))
		for e in effects:
			var val: float = float(e.get("value", 0.0))
			var row := UI.hbox(8)
			var dot := UI.label("▲" if val > 0 else "▼", 12, Palette.GOOD if val > 0 else Palette.BAD)
			dot.custom_minimum_size = Vector2(16, 0)
			row.add_child(dot)
			var lbl := UI.label(str(e.get("text", "")), 13, Palette.INK)
			lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			row.add_child(lbl)
			row.add_child(UI.num("%+.2f" % val, 12, Palette.GOOD if val > 0 else Palette.BAD))
			v.add_child(row)

	# ---- the opposition ---------------------------------------------------
	var opp: Array = report.get("opponents", [])
	if opp.size() > 0:
		v.add_child(UI.rule())
		v.add_child(UI.label("The other side", 12, Palette.MUTED))
		for line in opp:
			v.add_child(UI.label("• " + str(line), 13, Palette.INK))

	# ---- the books --------------------------------------------------------
	v.add_child(UI.rule())
	v.add_child(UI.label("The books", 12, Palette.MUTED))
	var grid := GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 20)
	grid.add_theme_constant_override("v_separation", 3)
	_money(grid, "Opening balance", int(report.get("cashOpen", 0)) / 100, Palette.MUTED)
	_money(grid, "Small-dollar donations", int(report.get("trickle", 0)), Palette.GOOD, true)
	_money(grid, "Staff salaries", -int(report.get("salaries", 0)), Palette.BAD, true)
	_money(grid, "Closing balance", int(report.get("cashClose", 0)) / 100, Palette.INK)
	v.add_child(grid)

	var ap_row := UI.hbox(8)
	ap_row.add_child(UI.label("Action points restored", 13, Palette.MUTED))
	ap_row.add_child(UI.spacer())
	var ap_txt := "%d" % int(report.get("apRestored", 0))
	if bool(report.get("managerBonus", false)):
		ap_txt += "  (+1 Campaign Manager)"
	ap_row.add_child(UI.num(ap_txt, 13, Palette.GOLD.darkened(0.2)))
	v.add_child(ap_row)

	# ---- headline ---------------------------------------------------------
	var news := str(report.get("news", ""))
	if news != "":
		v.add_child(UI.rule())
		var n := UI.wrap("“%s”" % news, 520, 13, Palette.INK)
		v.add_child(n)

	v.add_child(UI.spacer())
	var btn := UI.button("Next week  →     (Space)", true)
	btn.custom_minimum_size = Vector2(0, 46)
	btn.pressed.connect(_dismiss)
	v.add_child(btn)

	if not Game.settings.get("reduced_motion", false):
		_card.modulate.a = 0.0
		var tw := create_tween()
		tw.tween_property(_card, "modulate:a", 1.0, 0.14)

func _money(grid: GridContainer, label: String, amount: int, color: Color, signed := false) -> void:
	grid.add_child(UI.label(label, 13, Palette.MUTED))
	var txt := ""
	if signed:
		txt = "%s$%s" % ["+" if amount > 0 else "−", Game._comma(absi(amount))]
	else:
		txt = "$" + Game._comma(amount)
	var l := UI.num(txt, 13, color)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	grid.add_child(l)

func _dismiss() -> void:
	Audio.sfx("click")
	dismissed.emit()

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode in [KEY_SPACE, KEY_ENTER, KEY_ESCAPE]:
			_dismiss()
			get_viewport().set_input_as_handled()
