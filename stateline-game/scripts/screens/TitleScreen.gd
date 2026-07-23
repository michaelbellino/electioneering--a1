class_name TitleScreen
extends GameScreen

var _t := 0.0
var _star: Control

func on_enter(_data: Variant = null) -> void:
	var center := UI.vbox(14)
	center.alignment = BoxContainer.ALIGNMENT_CENTER
	center.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	center.grow_horizontal = Control.GROW_DIRECTION_BOTH
	center.grow_vertical = Control.GROW_DIRECTION_BOTH
	center.custom_minimum_size = Vector2(520, 0)
	add_child(center)

	# star motif
	_star = Control.new()
	_star.custom_minimum_size = Vector2(120, 100)
	_star.draw.connect(_draw_star)
	center.add_child(_star)

	var kicker := UI.label("A US POLITICAL & ELECTORAL SIMULATION", 13, Palette.MUTED)
	kicker.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	center.add_child(kicker)

	var title := UI.title("STATELINE", 84)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	center.add_child(title)

	var sub := UI.title("Campaign Trail", 28)
	sub.add_theme_color_override("font_color", Palette.GOLD)
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	center.add_child(sub)

	var tag := UI.label("Create a candidate. Run a real race. Win the room, then the world.", 15, Palette.MUTED)
	tag.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	center.add_child(tag)

	center.add_child(UI.spacer(16))

	var new_btn := UI.button("  New Campaign  ", true)
	new_btn.custom_minimum_size = Vector2(260, 0)
	new_btn.pressed.connect(func(): Audio.sfx("confirm"); go("creator"))
	center.add_child(_center(new_btn))

	if Game.has_save():
		var cont := UI.button("Continue")
		cont.custom_minimum_size = Vector2(260, 0)
		cont.pressed.connect(func():
			Audio.sfx("confirm")
			if Game.load_game(): go("hq"))
		center.add_child(_center(cont))

	var settings_btn := UI.button("Settings")
	settings_btn.custom_minimum_size = Vector2(260, 0)
	settings_btn.pressed.connect(func(): Audio.sfx("click"); go("settings"))
	center.add_child(_center(settings_btn))

	if OS.get_name() != "Web":
		var quit := UI.button("Quit")
		quit.custom_minimum_size = Vector2(260, 0)
		quit.pressed.connect(func(): get_tree().quit())
		center.add_child(_center(quit))

	var ver := UI.label("alpha 0.1.0  ·  built with Godot", 12, Palette.FAINT)
	ver.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	center.add_child(UI.spacer(8))
	center.add_child(ver)

	# entrance
	if not Game.settings.get("reduced_motion", false):
		center.modulate.a = 0.0
		center.position.y += 20
		var tw := create_tween()
		tw.set_parallel(true)
		tw.tween_property(center, "modulate:a", 1.0, 0.5)
		tw.tween_property(center, "position:y", center.position.y - 20, 0.6).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	set_process(true)

func _center(c: Control) -> Control:
	var h := UI.hbox()
	h.alignment = BoxContainer.ALIGNMENT_CENTER
	h.add_child(c)
	return h

func _process(delta: float) -> void:
	_t += delta
	if _star: _star.queue_redraw()

func _draw_star() -> void:
	var center := _star.size * 0.5
	var pulse := 1.0 if Game.settings.get("reduced_motion", false) else (0.94 + 0.06 * sin(_t * 2.0))
	var pts: PackedVector2Array = []
	for i in 10:
		var a := -PI/2 + TAU * i / 10.0
		var r := (44.0 if i % 2 == 0 else 18.0) * pulse
		pts.append(center + Vector2(cos(a) * r, sin(a) * r))
	_star.draw_colored_polygon(pts, Palette.GOLD)
	var glow := Palette.GOLD; glow.a = 0.18
	_star.draw_circle(center, 56 * pulse, glow)
