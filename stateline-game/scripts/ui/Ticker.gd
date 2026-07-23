class_name Ticker
extends Control
## A scrolling news chyron. Feed it {text,tone} items; it scrolls them right-to-left
## with a fixed "LIVE" flag on the left.

var items: Array = []
var _offset := 0.0
var speed := 60.0
var _segments: Array = []   # cached {text,color,width,x}
var _dirty := true

func set_items(list: Array) -> void:
	items = list
	_dirty = true
	queue_redraw()

func _tone_color(tone: String) -> Color:
	match tone:
		"pos": return Palette.GOOD
		"neg": return Palette.BAD
		"scandal": return Palette.BAD
		"poll": return Palette.ACCENT
		_: return Palette.MUTED

func _rebuild() -> void:
	_segments.clear()
	if Palette.font_ui == null: return
	var x := 0.0
	var loops := 2 if items.size() < 8 else 1
	for _l in loops:
		for it in items:
			var text: String = "  •  " + str(it.get("text", ""))
			var col := _tone_color(it.get("tone", "neutral"))
			var w := Palette.font_ui.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, 14).x
			_segments.append({"text": text, "color": col, "width": w})
			x += w
	_dirty = false

func _process(delta: float) -> void:
	if items.is_empty(): return
	_offset += delta * speed
	queue_redraw()

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Palette.BG2)
	draw_rect(Rect2(Vector2.ZERO, size), Palette.BORDER, false, 1.0)
	# LIVE flag
	var flag_w := 62.0
	draw_rect(Rect2(0, 0, flag_w, size.y), Palette.BAD)
	if Palette.font_ui:
		draw_string(Palette.font_ui, Vector2(10, size.y*0.5 + 5), "LIVE", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Palette.BG)
	if _dirty: _rebuild()
	if _segments.is_empty(): return
	var total := 0.0
	for s in _segments: total += s["width"]
	if total <= 0: return
	var start_x := flag_w + 8 - fmod(_offset, total)
	# draw two passes to fill the strip seamlessly
	var y := size.y * 0.5 + 5
	for pass_i in 3:
		var x := start_x + pass_i * total
		for s in _segments:
			if x > flag_w and x < size.x:
				draw_string(Palette.font_ui, Vector2(x, y), s["text"], HORIZONTAL_ALIGNMENT_LEFT, -1, 14, s["color"])
			x += s["width"]
			if x > size.x and pass_i > 0:
				break
	# mask under the flag so text slides beneath it
	draw_rect(Rect2(0, 0, flag_w, size.y), Palette.BAD)
	if Palette.font_ui:
		draw_string(Palette.font_ui, Vector2(10, y), "LIVE", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Palette.BG)
