class_name UI
extends RefCounted
## Static UI helpers + runtime Theme builder. Keeps screens terse and consistent.

# ---------------------------------------------------------------------------
# StyleBox factories
# ---------------------------------------------------------------------------
static func flat(bg: Color, radius := 12, border := 0, border_col := Color.TRANSPARENT) -> StyleBoxFlat:
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
	var s := flat(Palette.PANEL, 14, 1, Palette.BORDER)
	s.shadow_color = Color(0, 0, 0, 0.45)
	s.shadow_size = 10
	s.shadow_offset = Vector2(0, 6)
	return s

# ---------------------------------------------------------------------------
# Widgets
# ---------------------------------------------------------------------------
static func label(text: String, size := 16, color := Palette.INK) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	return l

static func title(text: String, size := 28) -> Label:
	var l := label(text, size, Palette.INK)
	l.add_theme_font_override("font", Palette.font_display)
	return l

static func kicker(text: String) -> Label:
	var l := label(text.to_upper(), 12, Palette.MUTED)
	l.add_theme_constant_override("line_spacing", 2)
	return l

static func rich(text := "") -> RichTextLabel:
	var r := RichTextLabel.new()
	r.bbcode_enabled = true
	r.fit_content = true
	r.scroll_active = false
	r.add_theme_font_override("normal_font", Palette.font_ui)
	r.add_theme_color_override("default_color", Palette.INK)
	r.text = text
	return r

static func panel() -> PanelContainer:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", panel_style())
	return p

static func button(text: String, primary := false) -> Button:
	var b := Button.new()
	b.text = text
	b.focus_mode = Control.FOCUS_ALL
	b.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	_style_button(b, primary)
	return b

static func _style_button(b: Button, primary: bool) -> void:
	var base := Palette.ACCENT if primary else Palette.PANEL2
	var ink := Color("041627") if primary else Palette.INK
	var normal := flat(base, 10, 1, Palette.BORDER_HI if not primary else Color.TRANSPARENT)
	var hover := flat(base.lightened(0.10), 10, 1, Palette.BORDER_HI if not primary else Color.TRANSPARENT)
	var pressed := flat(base.darkened(0.08), 10, 1, Color.TRANSPARENT)
	var disabled := flat(Palette.PANEL, 10, 1, Palette.BORDER)
	for st in ["normal", "hover", "pressed", "disabled", "focus"]:
		var box: StyleBoxFlat = ({"normal": normal, "hover": hover, "pressed": pressed, "disabled": disabled, "focus": hover}[st]).duplicate()
		box.content_margin_left = 18
		box.content_margin_right = 18
		box.content_margin_top = 11
		box.content_margin_bottom = 11
		if st == "focus":
			box.border_color = Palette.ACCENT
			box.border_width_bottom = 2; box.border_width_top = 2
			box.border_width_left = 2; box.border_width_right = 2
		b.add_theme_stylebox_override(st, box)
	b.add_theme_color_override("font_color", ink)
	b.add_theme_color_override("font_hover_color", ink)
	b.add_theme_color_override("font_pressed_color", ink)
	b.add_theme_color_override("font_disabled_color", Palette.FAINT)
	b.add_theme_font_size_override("font_size", 16)

## Toggle button with an unmistakable selected state (accent tint + border + text).
static func style_toggle(b: Button, accent := Palette.ACCENT) -> void:
	b.toggle_mode = true
	b.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	var tint := Palette.BG2.lerp(accent, 0.24)
	var states := {
		"normal": flat(Palette.PANEL2, 10, 1, Palette.BORDER),
		"hover": flat(Palette.PANEL2.lightened(0.07), 10, 1, Palette.BORDER_HI),
		"pressed": flat(tint, 10, 2, accent),
		"hover_pressed": flat(tint.lightened(0.05), 10, 2, accent),
		"focus": flat(Palette.PANEL2.lightened(0.07), 10, 2, accent),
		"disabled": flat(Palette.PANEL, 10, 1, Palette.BORDER),
	}
	for st in states:
		var box: StyleBoxFlat = states[st]
		box.content_margin_left = 16; box.content_margin_right = 16
		box.content_margin_top = 10; box.content_margin_bottom = 10
		b.add_theme_stylebox_override(st, box)
	b.add_theme_color_override("font_color", Palette.MUTED)
	b.add_theme_color_override("font_hover_color", Palette.INK)
	b.add_theme_color_override("font_pressed_color", accent.lightened(0.3))
	b.add_theme_color_override("font_hover_pressed_color", accent.lightened(0.35))
	b.add_theme_color_override("font_focus_color", Palette.INK)
	b.add_theme_color_override("font_disabled_color", Palette.FAINT)
	b.add_theme_font_size_override("font_size", 15)

## A selectable segmented-control button.
static func selectable(text: String, accent := Palette.ACCENT) -> Button:
	var b := Button.new()
	b.text = text
	b.focus_mode = Control.FOCUS_ALL
	style_toggle(b, accent)
	return b

## A selectable card-button; caller fills it with a child laid out via UI.margin().
static func select_card(accent := Palette.ACCENT) -> Button:
	var b := Button.new()
	b.focus_mode = Control.FOCUS_ALL
	b.clip_text = false
	style_toggle(b, accent)
	return b

## A small rounded status chip (used for trait effects, race stats, filters).
static func chip(text: String, color := Palette.ACCENT, bg_alpha := 0.16) -> PanelContainer:
	var p := PanelContainer.new()
	var bg := color
	bg.a = bg_alpha
	var box := flat(bg, 999, 1, color.lerp(Palette.BORDER, 0.45))
	box.content_margin_left = 9; box.content_margin_right = 9
	box.content_margin_top = 3; box.content_margin_bottom = 3
	p.add_theme_stylebox_override("panel", box)
	p.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	p.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", 11)
	l.add_theme_color_override("font_color", color.lightened(0.25))
	p.add_child(l)
	return p

## Wrapping body text at a fixed width (prevents the overflow we had before).
static func wrap(text: String, width: float, size := 12, color := Palette.MUTED) -> Label:
	var l := label(text, size, color)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size = Vector2(width, 0)
	l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return l

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
# Runtime Theme (applied to root)
# ---------------------------------------------------------------------------
static func build_theme() -> Theme:
	var t := Theme.new()
	t.default_font = Palette.font_ui
	t.default_font_size = 16

	# Panel
	t.set_stylebox("panel", "PanelContainer", panel_style())
	t.set_stylebox("panel", "Panel", panel_style())

	# Labels
	t.set_color("font_color", "Label", Palette.INK)

	# LineEdit
	var le := flat(Palette.BG2, 8, 1, Palette.BORDER)
	t.set_stylebox("normal", "LineEdit", le)
	var lef := le.duplicate(); lef.border_color = Palette.ACCENT
	t.set_stylebox("focus", "LineEdit", lef)
	t.set_color("font_color", "LineEdit", Palette.INK)
	t.set_color("caret_color", "LineEdit", Palette.ACCENT)

	# ProgressBar
	var pb_bg := flat(Palette.BG2, 6, 1, Palette.BORDER)
	var pb_fg := flat(Palette.ACCENT, 6)
	t.set_stylebox("background", "ProgressBar", pb_bg)
	t.set_stylebox("fill", "ProgressBar", pb_fg)

	# ScrollContainer / scrollbars kept default

	# Tooltip
	var tip := flat(Palette.PANEL2, 8, 1, Palette.BORDER_HI)
	t.set_stylebox("panel", "TooltipPanel", tip)
	t.set_color("font_color", "TooltipLabel", Palette.INK)

	return t
