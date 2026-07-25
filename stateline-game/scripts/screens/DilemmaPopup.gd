class_name DilemmaPopup
extends Control
## A modal weekly-dilemma card. Emits `resolved` when the player has seen the outcome.

signal resolved()

var main: Node
var dilemma: Dictionary = {}
var _card: PanelContainer
var _body: VBoxContainer

func _init() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP

func setup(d: Dictionary) -> void:
	dilemma = d
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.62)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	dim.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(dim)

	_card = UI.panel()
	_card.custom_minimum_size = Vector2(600, 0)
	_card.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	_card.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_card.grow_vertical = Control.GROW_DIRECTION_BOTH
	add_child(_card)

	_body = UI.vbox(14)
	var mc := UI.margin(22)
	mc.add_child(_body)
	_card.add_child(mc)

	_body.add_child(UI.kicker("A moment on the trail"))
	_body.add_child(UI.title(str(d.get("title", "Dilemma")), 26))
	var prompt := UI.rich(str(d.get("prompt", "")))
	prompt.custom_minimum_size = Vector2(540, 0)
	_body.add_child(prompt)
	_body.add_child(UI.spacer(6))

	for opt in d.get("options", []):
		_body.add_child(_option_button(opt))

	Audio.sfx("blip")
	if not Game.settings.get("reduced_motion", false):
		_card.scale = Vector2(0.9, 0.9)
		_card.modulate.a = 0.0
		_card.pivot_offset = _card.size * 0.5
		var tw := create_tween()
		tw.set_parallel(true)
		tw.tween_property(_card, "modulate:a", 1.0, 0.2)
		tw.tween_property(_card, "scale", Vector2.ONE, 0.28).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)

func _option_button(opt: Dictionary) -> Control:
	var b := Button.new()
	b.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	b.custom_minimum_size = Vector2(540, 0)
	UI._style_button(b, false)
	b.add_theme_stylebox_override("normal", UI.flat(Palette.PANEL2, 10, 1, Palette.BORDER_HI))
	# rich content inside the button
	var vb := UI.vbox(2)
	vb.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var lbl := UI.label(str(opt.get("label", "Choose")), 16, Palette.INK)
	var blurb := UI.label(str(opt.get("blurb", "")), 13, Palette.MUTED)
	blurb.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	blurb.custom_minimum_size = Vector2(500, 0)
	vb.add_child(lbl)
	vb.add_child(blurb)
	var mc := UI.margin(6)
	mc.mouse_filter = Control.MOUSE_FILTER_IGNORE
	mc.add_child(vb)
	mc.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	b.add_child(mc)
	b.custom_minimum_size.y = 62
	b.pressed.connect(func(): _choose(opt.get("id", "")))
	return b

func _choose(option_id: String) -> void:
	var result := Game.resolve_dilemma(dilemma, option_id)
	# rebuild body with the outcome
	for c in _body.get_children():
		c.queue_free()
	var failed: bool = result.get("failed", false)
	_body.add_child(UI.kicker("Aftermath"))
	var head := UI.title(dilemma.get("title", ""), 24)
	_body.add_child(head)
	var res := UI.rich(str(result.get("text", "")))
	res.custom_minimum_size = Vector2(540, 0)
	res.add_theme_color_override("default_color", Palette.BAD if failed else Palette.GOOD)
	_body.add_child(res)
	_body.add_child(UI.spacer(8))
	var cont := UI.button("  Continue  ", true)
	cont.pressed.connect(func():
		Audio.sfx("click")
		resolved.emit())
	_body.add_child(cont)
