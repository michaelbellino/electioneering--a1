extends Node
## Loads all game content (data-as-JSON) at boot and exposes typed lookups.
## Autoloaded as `Content`. Real placeholder now; full data wired in later.

var issues: Array = []
var policies: Array = []
var segments: Array = []
var behavior: Dictionary = {}      # segment_id -> behavior dict
var districts: Array = []
var dilemmas: Array = []
var headlines: Array = []
var debates: Array = []
var bills: Array = []
var endorsers: Array = []
var names: Dictionary = {}
var ads: Dictionary = {}
var copy: Dictionary = {}
var geo: Dictionary = {}
var loaded := false

func _ready() -> void:
	_load_all()

func _load_all() -> void:
	issues     = _json("res://data/issues.json", [])
	policies   = _json("res://data/policies.json", [])
	var vm      = _json("res://data/voter_model.json", {})
	segments   = vm.get("segments", []) if vm is Dictionary else []
	behavior   = {}
	if vm is Dictionary:
		for b in vm.get("behavior", []):
			behavior[b.get("segmentId", "")] = b
	districts  = _json("res://data/districts.json", [])
	dilemmas   = _json("res://data/dilemmas.json", [])
	headlines  = _json("res://data/headlines.json", [])
	debates    = _json("res://data/debates.json", [])
	bills      = _json("res://data/bills.json", [])
	endorsers  = _json("res://data/endorsers.json", [])
	names      = _json("res://data/names.json", {})
	ads        = _json("res://data/ads.json", {})
	copy       = _json("res://data/copy.json", {})
	geo        = _json("res://data/geo.json", {})
	loaded = true
	print("[Content] loaded: %d issues, %d policies, %d districts, %d dilemmas, geo %d states / %d CDs" % [issues.size(), policies.size(), districts.size(), dilemmas.size(), geo.get("states", {}).size(), geo.get("districts", {}).size()])

func _json(path: String, fallback):
	if not ResourceLoader.exists(path) and not FileAccess.file_exists(path):
		return fallback
	var f := FileAccess.open(path, FileAccess.READ)
	if f == null:
		return fallback
	var txt := f.get_as_text()
	f.close()
	var data = JSON.parse_string(txt)
	return data if data != null else fallback

func issue(id: String) -> Dictionary:
	for i in issues:
		if i.get("id", "") == id:
			return i
	return {}

func district(id: String) -> Dictionary:
	for d in districts:
		if d.get("id", "") == id:
			return d
	return {}


## --- Real geography -------------------------------------------------------
## Boundaries are baked to a 0..1 box by tools/bake_geo.py (Census TIGER for
## congressional districts, us-atlas for states).

func _rings_from(entry: Dictionary) -> Array:
	var out: Array = []
	for ring in entry.get("rings", []):
		var pv := PackedVector2Array()
		for p in ring:
			pv.append(Vector2(float(p[0]), float(p[1])))
		if pv.size() >= 3:
			out.append(pv)
	return out

## The boundary to draw for a race: its own district shape, else its state.
func geo_rings(d: Dictionary) -> Array:
	if geo.is_empty():
		return []
	var abbr := str(d.get("abbr", "")).to_upper()
	var office := str(d.get("office", ""))
	if office == "house":
		var num := _district_number(str(d.get("id", "")), str(d.get("name", "")))
		if num != "":
			var key := "%s-%s" % [abbr, num]
			var cds: Dictionary = geo.get("districts", {})
			if cds.has(key):
				return _rings_from(cds[key])
	var states: Dictionary = geo.get("states", {})
	if states.has(abbr):
		return _rings_from(states[abbr])
	return []

## A caption saying what the outline actually is.
func geo_label(d: Dictionary) -> String:
	var abbr := str(d.get("abbr", "")).to_upper()
	var office := str(d.get("office", ""))
	if office == "house":
		var num := _district_number(str(d.get("id", "")), str(d.get("name", "")))
		var cds: Dictionary = geo.get("districts", {})
		if num != "" and cds.has("%s-%s" % [abbr, num]):
			return "Real district boundary · US Census TIGER"
	if geo.get("states", {}).has(abbr):
		return "Real state boundary · US Census"
	return ""

## Pull a zero-padded district number out of an id like "pa-07" or a name.
func _district_number(id: String, nm: String) -> String:
	var parts := id.split("-")
	if parts.size() >= 2 and parts[1].is_valid_int():
		return "%02d" % int(parts[1])
	var digits := ""
	for ch in nm:
		if ch >= "0" and ch <= "9":
			digits += ch
		elif digits != "":
			break
	if digits != "":
		return "%02d" % int(digits)
	return ""

## Human-readable name for a voter segment ("white_noncollege" -> "White, no
## college degree"). The labels live on the segment list, not the behaviour table.
func segment_label(id: String) -> String:
	for s in segments:
		if str(s.get("id", "")) == id:
			return str(s.get("label", id))
	return id
