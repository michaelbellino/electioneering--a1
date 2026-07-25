class_name SettingsScreen
extends GameScreen

var _return_to := "title"

func on_enter(data: Variant = null) -> void:
	if data is Dictionary and data.has("return_to"):
		_return_to = str(data["return_to"])
	var box := UI.vbox(18)
	box.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	box.grow_horizontal = Control.GROW_DIRECTION_BOTH
	box.grow_vertical = Control.GROW_DIRECTION_BOTH
	box.custom_minimum_size = Vector2(460, 0)
	add_child(box)

	box.add_child(UI.title("Settings", 34))
	var panel := UI.panel()
	var inner := UI.vbox(16)
	panel.add_child(inner)
	box.add_child(panel)

	# Volume
	var vol_row := UI.vbox(6)
	vol_row.add_child(UI.label("Master Volume", 15, Palette.MUTED))
	var vol := HSlider.new()
	vol.min_value = 0.0; vol.max_value = 1.0; vol.step = 0.05
	vol.value = Game.settings.get("volume", 0.8)
	vol.custom_minimum_size = Vector2(0, 24)
	vol.value_changed.connect(func(v):
		Game.settings["volume"] = v
		Game.save_settings()
		Audio.sfx("tick"))
	vol_row.add_child(vol)
	inner.add_child(vol_row)

	inner.add_child(_toggle("Music", "music"))
	inner.add_child(_toggle("Sound effects", "sfx"))
	inner.add_child(_toggle("Reduced motion (fewer animations)", "reduced_motion"))

	var back := UI.button("  Back  ", true)
	back.pressed.connect(func():
		Audio.sfx("click")
		Audio.refresh_volume()
		go(_return_to))
	box.add_child(back)

func _toggle(label: String, key: String) -> Control:
	var row := UI.hbox(12)
	var cb := CheckButton.new()
	cb.button_pressed = Game.settings.get(key, true)
	cb.toggled.connect(func(on):
		Game.settings[key] = on
		Game.save_settings()
		Audio.refresh_volume()
		Audio.sfx("click"))
	var l := UI.label(label, 15)
	l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(l)
	row.add_child(cb)
	return row
