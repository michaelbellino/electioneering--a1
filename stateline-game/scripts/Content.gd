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
	loaded = true
	print("[Content] loaded: %d issues, %d policies, %d districts, %d dilemmas" % [issues.size(), policies.size(), districts.size(), dilemmas.size()])

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
