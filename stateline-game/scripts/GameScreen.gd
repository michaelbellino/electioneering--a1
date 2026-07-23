class_name GameScreen
extends Control
## Base class for every full screen. Screens request navigation by emitting `navigate`.

signal navigate(to: String, data: Variant)

var main: Node   ## set by the manager after instantiation

func _init() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_PASS

func on_enter(_data: Variant = null) -> void:
	pass

func on_exit() -> void:
	pass

func go(to: String, data: Variant = null) -> void:
	navigate.emit(to, data)
