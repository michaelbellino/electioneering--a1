class_name UI
extends RefCounted
## Shared UI kit. Modern sim/tycoon chrome: quiet neutral surfaces, crisp rules,
## colour used functionally (party, good/bad, money) rather than decoratively.
## The data is the thing you look at — the chrome gets out of its way.

# ---------------------------------------------------------------------------
# StyleBoxes
# ---------------------------------------------------------------------------
static func flat(bg: Color, radius := 6, border := 0, border_col := Color.TRANSPARENT) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.corner_radius_top_left = radius
	s.corner_radius_top_right = radius
	s.corner_radius_bottom_left = radius
	s.corner_radius_bottom_right = radius
	if border > 0:
		s.border_width_left = border
		s.border_width_right = border
		s.border_width_top = border
		s.border_width_bottom = border
		s.border_color = border_col
	s.content_margin_left = 14
	s.content_margin_right = 14
	s.content_margin_top = 10
	s.content_margin_bottom = 10
	return s

static func panel_style() -> StyleBoxFlat:
	var s := flat(Palette.PANEL, 8, 1, Palette.BORDER)
	s.shadow_color = Color(0.10, 0.12, 0.18, 0.10)
	s.shadow_size = 6
	s.shadow_offset = Vector2(0, 2)
	return s

# ---------------------------------------------------------------------------
# Text
# ---------------------------------------------------------------------------
static func label(text: String, size := 15, color := Palette.INK) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_override("font", Palette.font_ui)
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	return l

## Headline face: condensed caps. Used for screen titles and big figures.
static func title(text: String, size := 28, color := Palette.INK) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_override("font", Palette.font_display)
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	return l

## Small all-caps section marker.
static func kicker(text: String, color := Palette.MUTED) -> Label:
	var l := Label.new()
	l.text = text.to_upper()
	l.add_theme_font_override("font", Palette.font_display)
	l.add_theme_font_size_override("font_size", 13)
	l.add_theme_color_override("font_color", color)
	return l

## Figures that must line up (money, tallies, percentages).
static func num(text: String, size := 15, color := Palette.INK) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_override("font", Palette.font_mono)
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	return l

static func rich(text := "") -> RichTextLabel:
	var r := RichTextLabel.new()
	r.bbcode_enabled = true
	r.fit_content = true
	r.scroll_active = false
	r.add_theme_font_override("normal_font", Palette.font_ui)
	r.add_theme_font_size_override("normal_font_size", 15)
	r.add_theme_color_override("default_color", Palette.INK)
	r.text = text
	return r

static func wrap(text: String, width: float, size := 13, color := Palette.MUTED) -> Label:
	var l := label(text, size, color)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size = Vector2(width, 0)
	l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return l

static func panel() -> PanelContainer:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", panel_style())
	return p

static func rule() -> HSeparator:
	var h := HSeparator.new()
	var s := StyleBoxLine.new()
	s.color = Palette.BORDER
	s.thickness = 1
	h.add_theme_stylebox_override("separator", s)
	return h

# ---------------------------------------------------------------------------
# Buttons
# ---------------------------------------------------------------------------
static func button(text: String, primary := false) -> Button:
	var b := Button.new()
	b.text = text
	b.focus_mode = Control.FOCUS_ALL
	b.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	_style_button(b, primary)
	return b

static func _style_button(b: Button, primary: bool) -> void:
	var base := Palette.ACCENT if primary else Palette.PANEL
	var ink := Color.WHITE if primary else Palette.INK
	var edge := Palette.ACCENT2 if primary else Palette.BORDER_HI
	var normal := flat(base, 6, 1, edge)
	var hover := flat(base.lightened(0.06) if primary else Palette.PANEL2, 6, 1, edge)
	var pressed := flat(base.darkened(0.10) if primary else Palette.BG2, 6, 1, edge)
	var disabled := flat(Palette.BG2, 6, 1, Palette.BORDER)
	var focus := flat(base.lightened(0.04) if primary else Palette.PANEL2, 6, 2, Palette.ACCENT)
	var boxes := {"normal": normal, "hover": hover, "pressed": pressed, "disabled": disabled, "focus": focus}
	for st in boxes:
		var box: StyleBoxFlat = boxes[st]
		box.content_margin_left = 16
		box.content_margin_right = 16
		box.content_margin_top = 9
		box.content_margin_bottom = 9
		if not primary and st == "normal":
			box.shadow_color = Color(0.10, 0.12, 0.18, 0.07)
			box.shadow_size = 3
			box.shadow_offset = Vector2(0, 1)
		b.add_theme_stylebox_override(st, box)
	b.add_theme_font_override("font", Palette.font_ui_bold)
	b.add_theme_color_override("font_color", ink)
	b.add_theme_color_override("font_hover_color", ink)
	b.add_theme_color_override("font_pressed_color", ink)
	b.add_theme_color_override("font_focus_color", ink)
	b.add_theme_color_override("font_disabled_color", Palette.FAINT)
	b.add_theme_font_size_override("font_size", 15)

## Toggle with an unmistakable selected state.
static func style_toggle(b: Button, accent := Palette.ACCENT) -> void:
	b.toggle_mode = true
	b.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	var sel := Palette.BG.lerp(accent, 0.14)
	var states := {
		"normal": flat(Palette.PANEL, 6, 1, Palette.BORDER),
		"hover": flat(Palette.PANEL2, 6, 1, Palette.BORDER_HI),
		"pressed": flat(sel, 6, 2, accent),
		"hover_pressed": flat(sel.darkened(0.03), 6, 2, accent),
		"focus": flat(Palette.PANEL2, 6, 2, accent),
		"disabled": flat(Palette.BG2, 6, 1, Palette.BORDER),
	}
	for st in states:
		var box: StyleBoxFlat = states[st]
		box.content_margin_left = 14; box.content_margin_right = 14
		box.content_margin_top = 9; box.content_margin_bottom = 9
		b.add_theme_stylebox_override(st, box)
	b.add_theme_font_override("font", Palette.font_ui_bold)
	b.add_theme_color_override("font_color", Palette.MUTED)
	b.add_theme_color_override("font_hover_color", Palette.INK)
	b.add_theme_color_override("font_pressed_color", accent.darkened(0.15))
	b.add_theme_color_override("font_hover_pressed_color", accent.darkened(0.15))
	b.add_theme_color_override("font_focus_color", Palette.INK)
	b.add_theme_color_override("font_disabled_color", Palette.FAINT)
	b.add_theme_font_size_override("font_size", 14)

static func selectable(text: String, accent := Palette.ACCENT) -> Button:
	var b := Button.new()
	b.text = text
	b.focus_mode = Control.FOCUS_ALL
	style_toggle(b, accent)
	return b

static func select_card(accent := Palette.ACCENT) -> Button:
	var b := Button.new()
	b.focus_mode = Control.FOCUS_ALL
	b.clip_text = false
	style_toggle(b, accent)
	return b

# ---------------------------------------------------------------------------
# Bits
# ---------------------------------------------------------------------------
static func chip(text: String, color := Palette.ACCENT, bg_alpha := 0.14) -> PanelContainer:
	var p := PanelContainer.new()
	var bg := color
	bg.a = bg_alpha
	var box := flat(bg, 4, 1, color.lerp(Palette.PANEL, 0.55))
	box.content_margin_left = 8; box.content_margin_right = 8
	box.content_margin_top = 3; box.content_margin_bottom = 3
	p.add_theme_stylebox_override("panel", box)
	p.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	p.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var l := Label.new()
	l.text = text
	l.add_theme_font_override("font", Palette.font_ui_bold)
	l.add_theme_font_size_override("font_size", 11)
	l.add_theme_color_override("font_color", color.darkened(0.25))
	p.add_child(l)
	return p

static func bar(value: float, color: Color, height := 10) -> ProgressBar:
	var b := ProgressBar.new()
	b.show_percentage = false
	b.min_value = 0; b.max_value = 1; b.value = value
	b.custom_minimum_size = Vector2(0, height)
	b.add_theme_stylebox_override("fill", flat(color, 3))
	b.add_theme_stylebox_override("background", flat(Palette.BG2, 3, 1, Palette.BORDER))
	return b

static func tip(c: Control, text: String) -> Control:
	c.tooltip_text = text
	return c

static func hbox(sep := 12) -> HBoxContainer:
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", sep)
	return h

static func vbox(sep := 10) -> VBoxContainer:
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", sep)
	return v

static func spacer(min_size := 0) -> Control:
	var c := Control.new()
	c.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	c.size_flags_vertical = Control.SIZE_EXPAND_FILL
	if min_size > 0:
		c.custom_minimum_size = Vector2(min_size, min_size)
	return c

static func margin(m := 24) -> MarginContainer:
	var mc := MarginContainer.new()
	mc.add_theme_constant_override("margin_left", m)
	mc.add_theme_constant_override("margin_right", m)
	mc.add_theme_constant_override("margin_top", m)
	mc.add_theme_constant_override("margin_bottom", m)
	return mc

# ---------------------------------------------------------------------------
# Theme
# ---------------------------------------------------------------------------
static func build_theme() -> Theme:
	var t := Theme.new()
	t.default_font = Palette.font_ui
	t.default_font_size = 15

	t.set_stylebox("panel", "PanelContainer", panel_style())
	t.set_stylebox("panel", "Panel", panel_style())
	t.set_color("font_color", "Label", Palette.INK)

	var le := flat(Color.WHITE, 6, 1, Palette.BORDER_HI)
	t.set_stylebox("normal", "LineEdit", le)
	var lef := le.duplicate(); lef.border_color = Palette.ACCENT; lef.border_width_bottom = 2
	t.set_stylebox("focus", "LineEdit", lef)
	t.set_color("font_color", "LineEdit", Palette.INK)
	t.set_color("font_placeholder_color", "LineEdit", Palette.FAINT)
	t.set_color("caret_color", "LineEdit", Palette.ACCENT)
	t.set_font("font", "LineEdit", Palette.font_ui)

	t.set_stylebox("background", "ProgressBar", flat(Palette.BG2, 3, 1, Palette.BORDER))
	t.set_stylebox("fill", "ProgressBar", flat(Palette.ACCENT, 3))

	# Sliders: a clear track and a grabbable handle
	t.set_stylebox("slider", "HSlider", flat(Palette.BG2, 3, 1, Palette.BORDER))
	t.set_stylebox("grabber_area", "HSlider", flat(Palette.ACCENT.lerp(Palette.BG, 0.45), 3))
	t.set_stylebox("grabber_area_highlight", "HSlider", flat(Palette.ACCENT.lerp(Palette.BG, 0.25), 3))

	var tip_box := flat(Palette.INK, 6, 1, Palette.INK)
	tip_box.content_margin_left = 12; tip_box.content_margin_right = 12
	tip_box.content_margin_top = 9; tip_box.content_margin_bottom = 9
	t.set_stylebox("panel", "TooltipPanel", tip_box)
	t.set_color("font_color", "TooltipLabel", Color("f2f4f8"))
	t.set_font("font", "TooltipLabel", Palette.font_ui)
	t.set_font_size("font_size", "TooltipLabel", 13)

	t.set_stylebox("panel", "PopupMenu", flat(Palette.PANEL, 6, 1, Palette.BORDER_HI))
	return t
