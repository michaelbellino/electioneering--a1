extends Node
## Sound + music manager. Autoloaded as `Audio`.
## Loads the procedurally-generated WAVs, pools SFX players, and crossfades music.

var _sfx_players: Array[AudioStreamPlayer] = []
var _sfx_cache: Dictionary = {}
var _music_a: AudioStreamPlayer
var _music_b: AudioStreamPlayer
var _music_current: AudioStreamPlayer
var _music_track := ""
var _fade := 0.0
var _fade_dir := 0.0
const POOL := 10

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	for i in POOL:
		var p := AudioStreamPlayer.new()
		p.bus = "Master"
		add_child(p)
		_sfx_players.append(p)
	_music_a = _make_music_player()
	_music_b = _make_music_player()
	_music_current = _music_a
	set_process(true)

func _make_music_player() -> AudioStreamPlayer:
	var p := AudioStreamPlayer.new()
	p.bus = "Master"
	p.volume_db = -80.0
	add_child(p)
	return p

func _sfx_stream(name: String) -> AudioStream:
	if _sfx_cache.has(name):
		return _sfx_cache[name]
	var path := "res://audio/sfx_%s.wav" % name
	var s: AudioStream = null
	if ResourceLoader.exists(path):
		s = load(path)
	_sfx_cache[name] = s
	return s

func sfx(name: String, volume_db := 0.0, pitch := 1.0) -> void:
	if not Game.settings.get("sfx", true):
		return
	var s := _sfx_stream(name)
	if s == null:
		return
	for p in _sfx_players:
		if not p.playing:
			p.stream = s
			p.pitch_scale = pitch
			p.volume_db = volume_db + _master_db()
			p.play()
			return
	# all busy: steal the first
	var p0 := _sfx_players[0]
	p0.stream = s; p0.pitch_scale = pitch; p0.volume_db = volume_db + _master_db(); p0.play()

func _master_db() -> float:
	var v: float = clampf(float(Game.settings.get("volume", 0.8)), 0.0, 1.0)
	if v <= 0.001:
		return -80.0
	return linear_to_db(v)

func play_music(track: String) -> void:
	if track == _music_track:
		return
	if not Game.settings.get("music", true):
		_music_track = track
		return
	var path := "res://audio/music_%s.wav" % track
	if not ResourceLoader.exists(path):
		return
	var stream: AudioStream = load(path)
	if stream is AudioStreamWAV and track != "victory":
		stream.loop_mode = AudioStreamWAV.LOOP_FORWARD
		stream.loop_begin = 0
		stream.loop_end = stream.data.size() / 2  # 16-bit mono
	# crossfade: bring up the *other* player
	var incoming := _music_b if _music_current == _music_a else _music_a
	incoming.stream = stream
	incoming.volume_db = -80.0
	incoming.play()
	_music_current = incoming
	_music_track = track
	_fade = 0.0
	_fade_dir = 1.0

func stop_music() -> void:
	_fade_dir = -1.0
	_music_track = ""

func refresh_volume() -> void:
	# called when settings change
	if not Game.settings.get("music", true):
		_music_a.stop(); _music_b.stop()
		_music_track = ""

func _process(delta: float) -> void:
	# simple crossfade toward the current player at master*music level
	var target_db := _master_db() - 6.0
	var other := _music_b if _music_current == _music_a else _music_a
	if _music_current:
		_music_current.volume_db = lerpf(_music_current.volume_db, target_db, clampf(delta * 2.0, 0, 1))
	if other and other.playing:
		other.volume_db = lerpf(other.volume_db, -80.0, clampf(delta * 2.5, 0, 1))
		if other.volume_db < -60.0:
			other.stop()
