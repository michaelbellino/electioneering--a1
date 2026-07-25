class_name PauseMenu
extends Control
## The in-game menu. Opened by the HQ menu button or Esc. Everything you'd expect
## to find in a game menu is here — not just "save".

signal closed()
signal request(action: String)

var main: Node
var _card: PanelContainer
var _status: Label

func _init() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP

func _ready() -> void:
	var dim := ColorRect.new()
	dim.color = Color(0.09, 0.10, 0.13, 0.55)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	dim.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(dim)

	_card = UI.panel()
	_card.custom_minimum_size = Vector2(420, 0)
	_card.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	_card.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_card.grow_vertical = Control.GROW_DIRECTION_BOTH
	add_child(_card)

	var v := UI.vbox(8)
	_card.add_child(v)

	v.add_child(UI.title("PAUSED", 30))
	var st: Dictionary = Game.state
	if not st.is_empty():
		v.add_child(UI.label("%s · %s · week %d of %d" % [
			str(st.player.get("name", "")), str(st.district.get("name", "")),
			int(st.week) + 1, int(st.totalWeeks)], 12, Palette.MUTED))
	v.add_child(UI.rule())

	_add(v, "Resume", "resume", true, "Back to the campaign  (Esc)")
	_add(v, "Save campaign", "save", false, "Write your progress to the save slot")
	_add(v, "Load last save", "load", false, "Reload the last saved campaign", not Game.has_save())
	_add(v, "Settings", "settings", false, "Volume, music, reduced motion")
	v.add_child(UI.rule())
	_add(v, "Restart this race", "restart", false, "Start this same race over from week 1")
	_add(v, "Abandon and return to menu", "title", false, "Leave the campaign — unsaved progress is lost")
	if OS.get_name() != "Web":
		_add(v, "Quit to desktop", "quit", false, "Close the game")

	_status = UI.label("", 12, Palette.GOOD)
	_status.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(_status)

	if not Game.settings.get("reduced_motion", false):
		_card.modulate.a = 0.0
		var tw := create_tween()
		tw.tween_property(_card, "modulate:a", 1.0, 0.12)

func _add(v: VBoxContainer, text: String, action: String, primary: bool, tip := "", disabled := false) -> void:
	var b := UI.button(text, primary)
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b.tooltip_text = tip
	b.disabled = disabled
	b.pressed.connect(func(): _do(action))
	v.add_child(b)

func _do(action: String) -> void:
	Audio.sfx("click")
	match action:
		"save":
			Game.save_game(0)
			_flash("Campaign saved.")
			return
		"resume":
			closed.emit()
			return
		_:
			request.emit(action)

func _flash(msg: String) -> void:
	_status.text = msg
	var tw := create_tween()
	tw.tween_interval(1.4)
	tw.tween_callback(func(): if is_instance_valid(_status): _status.text = "")

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_ESCAPE:
			Audio.sfx("click")
			closed.emit()
			get_viewport().set_input_as_handled()
