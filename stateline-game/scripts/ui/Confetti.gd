class_name Confetti
extends Node2D
## Celebration particles + floating "+text" popups. Add to a screen and call
## celebrate() for a full-screen confetti fall, or float_text() for action feedback.

var _emitters: Array[CPUParticles2D] = []

func _ready() -> void:
	z_index = 100

func _make_emitter() -> CPUParticles2D:
	var p := CPUParticles2D.new()
	p.emitting = false
	p.one_shot = true
	p.explosiveness = 0.85
	p.amount = 90
	p.lifetime = 2.6
	p.direction = Vector2(0, 1)
	p.spread = 40.0
	p.gravity = Vector2(0, 220)
	p.initial_velocity_min = 120.0
	p.initial_velocity_max = 320.0
	p.angular_velocity_min = -400.0
	p.angular_velocity_max = 400.0
	p.scale_amount_min = 2.0
	p.scale_amount_max = 5.0
	p.color = Palette.GOLD
	# color variation via ramp
	var grad := Gradient.new()
	grad.set_color(0, Palette.GOLD)
	grad.add_point(0.33, Palette.ACCENT)
	grad.add_point(0.66, Palette.GOOD)
	grad.set_color(1, Palette.IND)
	p.color_ramp = grad
	add_child(p)
	_emitters.append(p)
	return p

func celebrate(width := 1280.0) -> void:
	if Game.settings.get("reduced_motion", false):
		return
	for i in 3:
		var p := _make_emitter()
		p.position = Vector2(width * (0.2 + 0.3 * i), -10)
		p.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
		p.emission_rect_extents = Vector2(width * 0.25, 8)
		p.emitting = true
	# auto free after a while
	var tw := create_tween()
	tw.tween_interval(3.2)
	tw.tween_callback(func():
		for p in _emitters:
			if is_instance_valid(p): p.queue_free()
		_emitters.clear())

func burst(pos: Vector2, color := Palette.ACCENT, amount := 24) -> void:
	if Game.settings.get("reduced_motion", false):
		return
	var p := _make_emitter()
	p.position = pos
	p.amount = amount
	p.gravity = Vector2(0, 120)
	p.spread = 180.0
	p.direction = Vector2(0, -1)
	p.color_ramp = null
	p.color = color
	p.lifetime = 1.2
	p.emitting = true
	var tw := create_tween()
	tw.tween_interval(1.4)
	tw.tween_callback(func():
		if is_instance_valid(p): p.queue_free())

## Floating "+$40,000" style popup at a screen position.
func float_text(pos: Vector2, text: String, color := Palette.GOOD) -> void:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", 20)
	l.add_theme_color_override("font_color", color)
	l.add_theme_font_override("font", Palette.font_mono)
	l.position = pos
	l.z_index = 120
	add_child(l)
	if Game.settings.get("reduced_motion", false):
		var t0 := create_tween()
		t0.tween_interval(0.8)
		t0.tween_callback(l.queue_free)
		return
	l.modulate.a = 0.0
	var tw := create_tween()
	tw.set_parallel(true)
	tw.tween_property(l, "position:y", pos.y - 46, 1.0).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	tw.tween_property(l, "modulate:a", 1.0, 0.18)
	tw.chain().tween_interval(0.5)
	tw.chain().tween_property(l, "modulate:a", 0.0, 0.5)
	tw.chain().tween_callback(l.queue_free)
