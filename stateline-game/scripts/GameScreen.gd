class_name GameScreen
extends Control
## Base class for every full screen. Screens request navigation by emitting `navigate`.

signal navigate(to: String, data: Variant)

var main: Node   ## set by the manager after instantiation

func _init() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_PASS

## Standard page root: a full-rect margin box with a vertical stack inside.
## (Containers only size to their minimum unless anchored, so this must be
## anchored or every child collapses.)
func page(margin := 20, sep := 10) -> VBoxContainer:
	var m := UI.margin(margin)
	m.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(m)
	var v := UI.vbox(sep)
	v.size_flags_vertical = Control.SIZE_EXPAND_FILL
	m.add_child(v)
	return v

func on_enter(_data: Variant = null) -> void:
	pass

func on_exit() -> void:
	pass

func go(to: String, data: Variant = null) -> void:
	navigate.emit(to, data)
