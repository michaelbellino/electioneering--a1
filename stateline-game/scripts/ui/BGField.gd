class_name BGField
extends Control
## Page ground. Deliberately plain: a warm neutral field with a soft vignette and
## a very quiet grid, so panels read as cards on a table and the data stays the
## brightest thing on screen.

var reduced := false

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	reduced = Game.settings.get("reduced_motion", false)

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Palette.BG)
	# faint measuring grid — reads as a planning surface, not decoration
	var step := 48.0
	var g := Palette.BORDER
	g.a = 0.22
	var x := step
	while x < size.x:
		draw_line(Vector2(x, 0), Vector2(x, size.y), g, 1.0)
		x += step
	var y := step
	while y < size.y:
		draw_line(Vector2(0, y), Vector2(size.x, y), g, 1.0)
		y += step
	# soft corner vignette so full-bleed screens don't feel flat
	var v := Palette.BORDER_HI
	v.a = 0.10
	draw_circle(Vector2(-40, -40), 320, v)
	draw_circle(Vector2(size.x + 40, size.y + 40), 380, v)
