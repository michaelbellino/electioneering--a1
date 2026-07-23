extends Node
## Top-level game state, phase machine, weekly turn loop, and save/load.
## Autoloaded as `Game`. All mutable game state lives in `state` (a plain, JSON-safe
## Dictionary) so a run is fully serializable and replayable.

signal phase_changed(phase: String)
signal state_changed()
signal week_advanced(week: int)
signal news_added(text: String, tone: String)
signal dilemma_triggered(dilemma: Dictionary)
signal action_performed(action: Dictionary, result: Dictionary)
signal poll_updated()
signal toast(text: String, kind: String)

var phase := "title"
var state: Dictionary = {}
var electorate: Dictionary = {}
var rng := RandomNumberGenerator.new()

const SAVE_PATH := "user://stateline_save_%d.json"
const SETTINGS_PATH := "user://stateline_settings.json"

var settings := {
	"volume": 0.8,
	"music": true,
	"sfx": true,
	"reduced_motion": false,
}

# ---------------------------------------------------------------------------
# Campaign action deck (data-as-const; money is integer cents)
# ---------------------------------------------------------------------------
const USD := 100  # cents per dollar

const ACTIONS := [
	{ "id": "rally", "label": "Hold a Rally", "cat": "Events", "icon": "rally",
	  "desc": "Gather the faithful. A big name-recognition spike and a jolt of enthusiasm.",
	  "cost": 6000, "ap": 1, "cooldown": 2, "amp": "field_director", "fund": 0,
	  "effects": [
		{ "channel": "nameRecognition", "target": "self", "magnitude": 0.42, "ramp_weeks": 0.4, "half_life_weeks": 4.0 },
		{ "channel": "favorability", "target": "self", "magnitude": 0.05, "ramp_weeks": 0.4, "half_life_weeks": 3.0, "tone": 0.6 },
		{ "channel": "enthusiasm", "target": "self", "magnitude": 0.03, "ramp_weeks": 0.4, "half_life_weeks": 4.0, "tone": 0.7 } ] },
	{ "id": "tv_positive", "label": "Positive TV Ad", "cat": "Air War", "icon": "tv",
	  "desc": "The big megaphone. Strong reach for name recognition and warmth.",
	  "cost": 25000, "ap": 1, "cooldown": 0, "amp": "comms_director", "fund": 0,
	  "effects": [
		{ "channel": "nameRecognition", "target": "self", "magnitude": 0.7, "ramp_weeks": 0.7, "half_life_weeks": 3.6 },
		{ "channel": "favorability", "target": "self", "magnitude": 0.08, "ramp_weeks": 0.7, "half_life_weeks": 2.8, "tone": 0.8 } ] },
	{ "id": "tv_attack", "label": "Attack Ad", "cat": "Air War", "icon": "attack",
	  "desc": "Hit your opponent where it hurts. Drives their favorability down — with a little blowback.",
	  "cost": 20000, "ap": 1, "cooldown": 0, "amp": "oppo_researcher", "fund": 0,
	  "effects": [
		{ "channel": "favorability", "target": "opponent", "magnitude": -0.12, "ramp_weeks": 0.7, "half_life_weeks": 2.8, "tone": -0.8 },
		{ "channel": "favorability", "target": "self", "magnitude": -0.02, "ramp_weeks": 0.5, "half_life_weeks": 2.0, "tone": -0.8 } ] },
	{ "id": "radio", "label": "Radio Buy", "cat": "Air War", "icon": "radio",
	  "desc": "Drive-time persuasion at a working campaign's price.",
	  "cost": 7000, "ap": 1, "cooldown": 0, "amp": "comms_director", "fund": 0,
	  "effects": [
		{ "channel": "nameRecognition", "target": "self", "magnitude": 0.22, "ramp_weeks": 0.5, "half_life_weeks": 3.0 },
		{ "channel": "favorability", "target": "self", "magnitude": 0.035, "ramp_weeks": 0.5, "half_life_weeks": 2.6, "tone": 0.5 } ] },
	{ "id": "digital", "label": "Digital Blitz", "cat": "Air War", "icon": "digital",
	  "desc": "Cheap reach, shallow impressions — the name-recognition workhorse.",
	  "cost": 4000, "ap": 1, "cooldown": 0, "amp": "digital_director", "fund": 0,
	  "effects": [
		{ "channel": "nameRecognition", "target": "self", "magnitude": 0.30, "ramp_weeks": 0.4, "half_life_weeks": 2.0 } ] },
	{ "id": "issue_ad", "label": "Issue Ad", "cat": "Air War", "icon": "issue",
	  "desc": "Wage the long war. Nudges public opinion itself toward your strongest position.",
	  "cost": 12000, "ap": 1, "cooldown": 1, "amp": "comms_director", "fund": 0,
	  "effects": [
		{ "channel": "opinion", "target": "self", "magnitude": 0.05, "ramp_weeks": 1.0, "half_life_weeks": -1.0 } ] },
	{ "id": "speech", "label": "Give a Speech", "cat": "Message", "icon": "speech",
	  "desc": "Deliver a policy speech. Cheap; modest favorability and a little exposure.",
	  "cost": 1000, "ap": 1, "cooldown": 1, "amp": "comms_director", "fund": 0,
	  "effects": [
		{ "channel": "favorability", "target": "self", "magnitude": 0.05, "ramp_weeks": 0.3, "half_life_weeks": 2.6, "tone": 0.5 },
		{ "channel": "nameRecognition", "target": "self", "magnitude": 0.12, "ramp_weeks": 0.3, "half_life_weeks": 2.8 } ] },
	{ "id": "town_hall", "label": "Town Hall", "cat": "Message", "icon": "townhall",
	  "desc": "Ninety unscripted minutes. Competence carries the room; bluffing does not.",
	  "cost": 2500, "ap": 1, "cooldown": 1, "amp": "", "fund": 0,
	  "effects": [
		{ "channel": "favorability", "target": "self", "magnitude": 0.07, "ramp_weeks": 0.4, "half_life_weeks": 3.4, "tone": 0.5 },
		{ "channel": "enthusiasm", "target": "self", "magnitude": 0.02, "ramp_weeks": 0.4, "half_life_weeks": 3.0 } ] },
	{ "id": "canvass", "label": "Canvass & GOTV", "cat": "Ground Game", "icon": "canvass",
	  "desc": "Knock doors and bank votes. Lifts turnout among your supporters on election day.",
	  "cost": 3000, "ap": 1, "cooldown": 1, "amp": "field_director", "fund": 0,
	  "effects": [
		{ "channel": "turnout", "target": "self", "magnitude": 0.02, "ramp_weeks": 1.0, "half_life_weeks": -1.0 } ] },
	{ "id": "mail", "label": "Direct Mail", "cat": "Ground Game", "icon": "mail",
	  "desc": "A letter in the swing precincts' mailboxes. Narrow, deep, persuasive.",
	  "cost": 6000, "ap": 1, "cooldown": 0, "amp": "field_director", "fund": 0,
	  "effects": [
		{ "channel": "favorability", "target": "self", "magnitude": 0.05, "ramp_weeks": 0.6, "half_life_weeks": 3.0, "tone": 0.5 },
		{ "channel": "nameRecognition", "target": "self", "magnitude": 0.08, "ramp_weeks": 0.6, "half_life_weeks": 3.0 } ] },
	{ "id": "fundraiser", "label": "Host a Fundraiser", "cat": "Money", "icon": "money",
	  "desc": "Hold a donor event. Costs a little to host; raises a lot — more with a finance director.",
	  "cost": 2000, "ap": 1, "cooldown": 1, "amp": "fundraiser", "fund": 40000,
	  "effects": [] },
	{ "id": "poll", "label": "Commission a Poll", "cat": "Money", "icon": "poll",
	  "desc": "Buy real numbers. Tightens the margin of error and reveals where you truly stand.",
	  "cost": 5000, "ap": 1, "cooldown": 0, "amp": "pollster", "fund": 0,
	  "effects": [] },
]

const STAFF := [
	{ "id": "manager",   "role": "manager",         "name": "Campaign Manager", "sign": 5000, "salary": 2500, "eff": 0.8,
	  "blurb": "+1 action point every week, and cooldowns recover faster." },
	{ "id": "comms",     "role": "comms_director",  "name": "Comms Director",   "sign": 3000, "salary": 2000, "eff": 0.7,
	  "blurb": "Amplifies every ad and speech; audiences tire of your ads slower." },
	{ "id": "field",     "role": "field_director",  "name": "Field Director",   "sign": 3000, "salary": 1800, "eff": 0.7,
	  "blurb": "Amplifies rallies, canvassing, and mail; ground presence lasts longer." },
	{ "id": "finance",   "role": "fundraiser",      "name": "Finance Director", "sign": 4000, "salary": 2200, "eff": 0.75,
	  "blurb": "Boosts fundraiser hauls AND the weekly small-dollar trickle by 50%." },
	{ "id": "pollster",  "role": "pollster",        "name": "Pollster",         "sign": 2500, "salary": 1500, "eff": 0.8,
	  "blurb": "Bigger samples, tighter margins — and polls at half price." },
	{ "id": "oppo",      "role": "oppo_researcher", "name": "Oppo Researcher",  "sign": 3500, "salary": 1700, "eff": 0.75,
	  "blurb": "Knows where the bodies are buried. Attack ads hit 35% harder." },
	{ "id": "digital",   "role": "digital_director","name": "Digital Director", "sign": 2500, "salary": 1600, "eff": 0.75,
	  "blurb": "Digital ads cheaper and stronger, plus a growing online-donation stream." },
]

const DIFFICULTIES := [
	{ "id": "easy",   "label": "Front-runner",     "points": 30, "cashMult": 1.5, "oppMult": 0.6,  "maxAP": 4, "dilemma": 0.35,
	  "desc": "Deep pockets, a sleepy opponent, a forgiving press. Learn the ropes." },
	{ "id": "normal", "label": "The Grind",        "points": 24, "cashMult": 1.0, "oppMult": 1.0,  "maxAP": 3, "dilemma": 0.45,
	  "desc": "A fair fight. Every dollar and every week has to work." },
	{ "id": "hard",   "label": "Uphill",           "points": 20, "cashMult": 0.7, "oppMult": 1.35, "maxAP": 3, "dilemma": 0.55,
	  "desc": "Outspent and outgunned. The fundamentals are not your friend." },
	{ "id": "brutal", "label": "Sacrificial Lamb", "points": 16, "cashMult": 0.55, "oppMult": 1.55, "maxAP": 2, "dilemma": 0.65,
	  "desc": "The party needed a name on the ballot. Shock the world." },
]

const TRAITS := [
	{ "id": "hometown_hero",  "label": "Hometown Hero",  "desc": "Everyone already knows your name — and your baggage.", "baseExposure": 0.25, "baseFavorability": -0.05 },
	{ "id": "self_funder",    "label": "Self-Funder",    "desc": "You write your own checks. Donors find that demotivating.", "cash": 40000, "attrs": {"fundraising": -0.15} },
	{ "id": "grassroots",     "label": "Grassroots Army","desc": "A volunteer machine: +1 action a week, but it runs on pizza money.", "ap": 1, "cash": -15000 },
	{ "id": "teflon",         "label": "Teflon",         "desc": "Scandals slide right off. Charisma was the price.", "scandalMult": 0.4, "attrs": {"charisma": -0.1} },
	{ "id": "insider",        "label": "Party Insider",  "desc": "The machine staffs you at mates' rates. You owe people.", "salaryMult": 0.65, "attrs": {"integrity": -0.1} },
	{ "id": "outsider",       "label": "Outsider",       "desc": "Voters like that you're not one of them. Pros charge you extra.", "baseFavorability": 0.08, "salaryMult": 1.35 },
	{ "id": "wonk",           "label": "Policy Wonk",    "desc": "You can cite the appendix. Crowds cite the exits.", "attrs": {"competence": 0.15, "charisma": -0.1} },
	{ "id": "firebrand",      "label": "Firebrand",      "desc": "You light up a room — sometimes with the room still in it.", "attrs": {"charisma": 0.15, "integrity": -0.1} },
]

func _ready() -> void:
	load_settings()
	rng.randomize()

func set_phase(p: String) -> void:
	phase = p
	phase_changed.emit(p)

# ---------------------------------------------------------------------------
# Content lookups
# ---------------------------------------------------------------------------
func difficulty(id: String) -> Dictionary:
	for d in DIFFICULTIES:
		if d.id == id: return d
	return DIFFICULTIES[1]

func action_def(id: String) -> Dictionary:
	for a in ACTIONS:
		if a.id == id: return a
	return {}

func staff_def(id: String) -> Dictionary:
	for s in STAFF:
		if s.id == id: return s
	return {}

func trait_def(id: String) -> Dictionary:
	for t in TRAITS:
		if t.id == id: return t
	return {}

# ---------------------------------------------------------------------------
# New game
# ---------------------------------------------------------------------------
func new_game(district_id: String, difficulty_id: String, player: Dictionary, seed_val: int = -1) -> void:
	var district: Dictionary = Content.district(district_id)
	if district.is_empty() and Content.districts.size() > 0:
		district = Content.districts[0]
	var diff: Dictionary = difficulty(difficulty_id)
	if seed_val < 0:
		seed_val = int(Time.get_unix_time_from_system() * 1000.0) & 0x7fffffff
	rng.seed = seed_val

	var weeks: int = 18 if district.get("office", "house") in ["governor", "senate"] else 14
	var start_cash: int = int(round(50000.0 * float(diff.cashMult))) * USD
	if district.get("office","house") in ["governor","senate"]:
		start_cash = int(round(120000.0 * float(diff.cashMult))) * USD

	player = player.duplicate(true)
	player["id"] = "player"
	# Apply trait modifiers
	var scandal_mult := 1.0
	var salary_mult := 1.0
	var ap_bonus := 0
	for tid in player.get("traits", []):
		var t: Dictionary = trait_def(tid)
		start_cash += int(t.get("cash", 0)) * USD
		player["baseExposure"] = float(player.get("baseExposure", 0.1)) + float(t.get("baseExposure", 0.0))
		player["baseFavorability"] = float(player.get("baseFavorability", 0.0)) + float(t.get("baseFavorability", 0.0))
		ap_bonus += int(t.get("ap", 0))
		scandal_mult *= float(t.get("scandalMult", 1.0))
		salary_mult *= float(t.get("salaryMult", 1.0))
		for k in t.get("attrs", {}):
			player["attrs"][k] = clampf(float(player["attrs"].get(k, 0.5)) + float(t["attrs"][k]), 0.0, 1.0)
	player["scandal"] = 0.0
	player["scandalMult"] = scandal_mult
	player["salaryMult"] = salary_mult

	var opponents := _make_opponents(district, diff)

	state = {
		"seed": seed_val,
		"difficultyId": difficulty_id,
		"districtId": district_id,
		"district": district,
		"player": player,
		"opponents": opponents,
		"cash": start_cash,
		"ap": diff.maxAP + ap_bonus,
		"maxAP": diff.maxAP + ap_bonus,
		"apBonus": ap_bonus,
		"week": 0,
		"totalWeeks": weeks,
		"staff": [],
		"offices": 0,
		"effects": [],
		"cooldowns": {},
		"adFatigue": {},
		"pollHistory": [],
		"news": [],
		"log": [],
		"endorsements": [],
		"flags": {},
		"seenDilemmas": [],
		"result": {},
	}
	electorate = Sim.build_electorate(district)
	_add_news("%s enters the race in %s." % [player.get("name","You"), district.get("name","the district")], "pos")
	_auto_poll(true)
	set_phase("hq")
	state_changed.emit()

func _make_opponents(district: Dictionary, diff: Dictionary) -> Array:
	var lean: float = float(district.get("lean", 0.0))
	var machine: bool = lean > 0.3
	var party: String = "D" if machine else "R"
	# Even a 50/50 seat fields a credible, established opponent (floor); safe seats field a wall.
	var strength: float = clampf(0.45 + 0.55 * absf(lean), 0.45, 1.0)
	var dir: float = 1.0 if machine else -1.0
	var opp_names: Array = Content.names.get("oppFirst", ["Hank","Carol","Denny","Rick","June","Walt"]) if Content.names else ["Hank","Carol","Denny","Rick","June","Walt"]
	var opp_last: Array = Content.names.get("oppLast", ["Voss","Brandt","Kessler","Stover","Alderman","Hering"]) if Content.names else ["Voss","Brandt","Kessler","Stover","Alderman","Hering"]
	var nm := "%s %s" % [opp_names[rng.randi() % opp_names.size()], opp_last[rng.randi() % opp_last.size()]]
	var positions: Dictionary = {}
	for iss in Sim.issue_ids():
		positions[iss] = dir * (0.22 + 0.24 * strength)
	var opp := {
		"id": "opp0",
		"name": "%s (%s)" % [nm, party],
		"party": party,
		"attrs": { "charisma": 0.52 + 0.16 * strength, "competence": 0.52 + 0.16 * strength, "integrity": 0.5, "fundraising": 0.55 + 0.3 * strength },
		"positions": positions,
		"baseExposure": 0.50 + 0.28 * strength,
		"baseFavorability": 0.04 + 0.06 * strength,
		"scandal": 0.0,
		"cash": int(round((85000.0 + 110000.0 * strength) * float(diff.oppMult))) * USD,
		"aggr": float(diff.oppMult),
	}
	var opps := [opp]
	# Statewide races get a third-party spoiler.
	if district.get("office","house") in ["governor","senate"]:
		var spoil_pos: Dictionary = {}
		for iss in Sim.issue_ids():
			spoil_pos[iss] = 0.05
		opps.append({
			"id": "opp1", "name": "Dr. Willa Grange (I)", "party": "I",
			"attrs": { "charisma": 0.65, "competence": 0.55, "integrity": 0.7, "fundraising": 0.35 },
			"positions": spoil_pos, "baseExposure": 0.2, "baseFavorability": 0.05, "scandal": 0.0,
			"cash": 20000 * USD, "aggr": 0.4 * float(diff.oppMult),
		})
	return opps

# ---------------------------------------------------------------------------
# Candidate helpers
# ---------------------------------------------------------------------------
func all_candidates() -> Array:
	var arr := [state["player"]]
	arr.append_array(state["opponents"])
	return arr

func player() -> Dictionary:
	return state.get("player", {})

func cash_dollars() -> int:
	return int(state.get("cash", 0)) / USD

# ---------------------------------------------------------------------------
# Weeks / turn loop
# ---------------------------------------------------------------------------
func weeks_left() -> int:
	return int(state["totalWeeks"]) - int(state["week"])

func staff_has(role: String) -> bool:
	for sid in state.get("staff", []):
		if staff_def(sid).get("role","") == role:
			return true
	return false

func amp_for(action: Dictionary) -> float:
	var amp := 1.0
	var role: String = action.get("amp", "")
	if role != "" and staff_has(role):
		amp += 0.4 * staff_def(_staff_by_role(role)).get("eff", 0.7)
	# Field office multiplier
	amp += 0.05 * int(state.get("offices", 0))
	return amp

func _staff_by_role(role: String) -> String:
	for sid in state.get("staff", []):
		if staff_def(sid).get("role","") == role:
			return sid
	return ""

func can_do(action_id: String) -> bool:
	var a: Dictionary = action_def(action_id)
	if a.is_empty(): return false
	if int(state["ap"]) < int(a.ap): return false
	if int(state["cash"]) < int(a.cost) * USD: return false
	var cd: Dictionary = state.get("cooldowns", {})
	if int(cd.get(action_id, 0)) > int(state["week"]): return false
	return true

func cooldown_left(action_id: String) -> int:
	var cd: Dictionary = state.get("cooldowns", {})
	return maxi(0, int(cd.get(action_id, 0)) - int(state["week"]))

## Perform a campaign action. Returns a result dict for the UI (juice + text).
func do_action(action_id: String) -> Dictionary:
	var a: Dictionary = action_def(action_id)
	if a.is_empty() or not can_do(action_id):
		return { "ok": false, "text": "Can't do that right now." }
	state["cash"] = int(state["cash"]) - int(a.cost) * USD
	state["ap"] = int(state["ap"]) - int(a.ap)
	if int(a.cooldown) > 0:
		state["cooldowns"][action_id] = int(state["week"]) + int(a.cooldown)
	var amp := amp_for(a)
	var result := { "ok": true, "text": "", "action": a, "raised": 0, "kind": a.get("cat","") }

	# Ad fatigue for air-war spend
	if a.get("cat","") == "Air War":
		var n: int = int(state["adFatigue"].get(action_id, 0))
		amp *= 1.0 / (1.0 + 0.20 * n)
		state["adFatigue"][action_id] = n + 1

	# Fundraiser (diminishing returns so it can't snowball the whole game)
	if int(a.get("fund", 0)) > 0:
		var count: int = int(state.get("fundraiserCount", 0))
		var haul: float = float(a.fund) * amp
		if staff_has("fundraiser"): haul *= 1.5
		haul *= 1.0 + 0.3 * _player_exposure()
		haul *= 1.0 / (1.0 + 0.10 * count)
		state["fundraiserCount"] = count + 1
		var raised := int(round(haul)) * USD
		state["cash"] = int(state["cash"]) + raised
		result["raised"] = raised / USD
		result["text"] = "Raised $%s at the fundraiser." % _comma(raised / USD)
		Audio.sfx("cash")

	# Poll
	if action_id == "poll":
		_auto_poll(false, true)
		result["text"] = "Fresh numbers are in."
		Audio.sfx("blip")

	# Effects
	for ef in a.get("effects", []):
		_schedule_effect(ef, amp, action_id)

	if result["text"] == "":
		result["text"] = a.label + " — done."
	_log(a.label)
	Audio.sfx("confirm")
	action_performed.emit(a, result)
	state_changed.emit()
	return result

func _schedule_effect(ef: Dictionary, amp: float, source: String) -> void:
	var target: String = ef.get("target", "self")
	var cid := "player"
	if target == "opponent":
		cid = _poll_leading_opponent()
	var mag: float = float(ef.magnitude) * amp
	# Oppo researcher makes attacks land harder
	if source == "tv_attack" and staff_has("oppo_researcher"):
		mag *= 1.35
	var eff := {
		"cand": cid,
		"channel": ef.channel,
		"magnitude": mag,
		"start_week": float(state["week"]),
		"ramp_weeks": float(ef.get("ramp_weeks", 0.4)),
		"half_life_weeks": float(ef.get("half_life_weeks", 4.0)),
		"tone": float(ef.get("tone", 0.0)),
	}
	if ef.channel == "opinion":
		eff["cand"] = "player"
		eff["issue"] = _player_top_issue()
		# push opinion toward the player's own position on that issue
		var pos: float = float(state["player"]["positions"].get(eff["issue"], 0.0))
		eff["magnitude"] = float(ef.magnitude) * amp * signf(pos if pos != 0.0 else 1.0)
	state["effects"].append(eff)

func _player_top_issue() -> String:
	var best := ""
	var best_v := -1.0
	for iss in Sim.issue_ids():
		var v: float = absf(float(state["player"]["positions"].get(iss, 0.0)))
		if v > best_v:
			best_v = v
			best = iss
	return best if best != "" else Sim.issue_ids()[0]

func _player_exposure() -> float:
	return float(Sim.candidate_stats(state, state["player"]).exposure)

func _poll_leading_opponent() -> String:
	var opps: Array = state["opponents"]
	if opps.size() == 1:
		return opps[0].id
	var polls := current_poll_shares()
	var best: String = opps[0].id
	var best_share := -1.0
	for o in opps:
		var s: float = float(polls.get(o.id, 0.0))
		if s > best_share:
			best_share = s
			best = o.id
	return best

## Advance one week: opponent AI, fundraising trickle, salaries, dilemma, poll.
func end_week() -> void:
	# Opponent agents act
	_run_opponents()
	# Weekly small-dollar trickle
	var trickle := 2000.0 + 8000.0 * _player_exposure()
	if state["player"]["attrs"].has("fundraising"):
		trickle *= 0.6 + 0.8 * float(state["player"]["attrs"]["fundraising"])
	if staff_has("fundraiser"): trickle *= 1.5
	if staff_has("digital_director"): trickle += 3000.0 * _player_exposure()
	state["cash"] = int(state["cash"]) + int(round(trickle)) * USD
	# Salaries
	var salary := 0
	for sid in state.get("staff", []):
		salary += int(staff_def(sid).get("salary", 0))
	salary = int(round(salary * float(state["player"].get("salaryMult", 1.0))))
	state["cash"] = int(state["cash"]) - salary * USD

	state["week"] = int(state["week"]) + 1
	# Refresh AP (+manager)
	var ap: int = int(state["maxAP"])
	if staff_has("manager"): ap += 1
	state["ap"] = ap
	# Reduce ad fatigue slowly (audiences forget)
	for k in state["adFatigue"].keys():
		state["adFatigue"][k] = maxi(0, int(state["adFatigue"][k]) - 1)

	_auto_poll(false)
	_maybe_headline()
	week_advanced.emit(int(state["week"]))
	state_changed.emit()

	if int(state["week"]) >= int(state["totalWeeks"]):
		return  # caller routes to election

	# Maybe a dilemma
	var diff: Dictionary = difficulty(state["difficultyId"])
	if rng.randf() < float(diff.dilemma):
		var d := _draw_dilemma()
		if not d.is_empty():
			dilemma_triggered.emit(d)

func _run_opponents() -> void:
	var polls := current_poll_shares()
	var player_share: float = float(polls.get("player", 0.33))
	for o in state["opponents"]:
		var aggr: float = float(o.get("aggr", 1.0))
		var behind: bool = float(polls.get(o.id, 0.0)) < player_share
		# Opponents are real campaigns: 1-3 budgeted moves a week.
		var actions_this_week: int = 2
		if aggr > 1.2: actions_this_week = 3
		elif aggr < 0.8: actions_this_week = 1
		for _i in actions_this_week:
			if int(o.get("cash", 0)) < 8000 * USD:
				break
			var roll := rng.randf()
			if behind and roll < 0.5:
				# swing back with an attack
				_opp_effect(o, "favorability", "player", -0.07 * aggr, 0.6, 2.6)
				o["cash"] = int(o["cash"]) - 18000 * USD
			elif roll < 0.80:
				# positive push: exposure + warmth
				_opp_effect(o, "nameRecognition", "self", 0.15 * aggr, 0.5, 3.2)
				_opp_effect(o, "favorability", "self", 0.045 * aggr, 0.5, 2.8)
				o["cash"] = int(o["cash"]) - 20000 * USD
			else:
				# ground game
				_opp_effect(o, "turnout", "self", 0.012 * aggr, 1.0, -1.0)
				o["cash"] = int(o["cash"]) - 12000 * USD
		# Opponent fundraising keeps them in the fight
		o["cash"] = int(o["cash"]) + int(round((22000.0 + 16000.0 * aggr) * float(o["attrs"].get("fundraising", 0.5)))) * USD

func _opp_effect(o: Dictionary, channel: String, target: String, mag: float, ramp: float, half: float) -> void:
	var cid: String = o.id if target == "self" else "player"
	state["effects"].append({
		"cand": cid, "channel": channel, "magnitude": mag,
		"start_week": float(state["week"]), "ramp_weeks": ramp, "half_life_weeks": half, "tone": signf(mag),
	})

# ---------------------------------------------------------------------------
# Polling
# ---------------------------------------------------------------------------
func true_shares() -> Dictionary:
	var res := Sim.evaluate(state, electorate, all_candidates())
	return res.shares

func current_poll_shares() -> Dictionary:
	var ph: Array = state.get("pollHistory", [])
	if ph.size() > 0:
		return ph[ph.size() - 1].shares
	return true_shares()

func current_poll() -> Dictionary:
	var ph: Array = state.get("pollHistory", [])
	if ph.size() > 0:
		return ph[ph.size() - 1]
	return { "week": 0, "shares": true_shares(), "moe": 0.05, "sample": 400 }

func _auto_poll(initial := false, commissioned := false) -> void:
	var n := 400
	if commissioned: n = 900
	if staff_has("pollster"): n = int(n * 1.6)
	var res := Sim.run_poll(true_shares(), n, rng)
	res["week"] = int(state["week"])
	state["pollHistory"].append(res)
	# keep history bounded
	if state["pollHistory"].size() > 40:
		state["pollHistory"].pop_front()
	poll_updated.emit()

# ---------------------------------------------------------------------------
# Dilemmas
# ---------------------------------------------------------------------------
func _draw_dilemma() -> Dictionary:
	var pool: Array = []
	for d in Content.dilemmas:
		if int(d.get("minWeek", 0)) > int(state["week"]): continue
		if state["seenDilemmas"].has(d.get("id","")): continue
		pool.append(d)
	if pool.is_empty():
		state["seenDilemmas"].clear()  # reshuffle
		for d in Content.dilemmas:
			if int(d.get("minWeek", 0)) <= int(state["week"]):
				pool.append(d)
	if pool.is_empty(): return {}
	# weighted pick
	var total := 0.0
	for d in pool: total += float(d.get("weight", 1.0))
	var r := rng.randf() * total
	for d in pool:
		r -= float(d.get("weight", 1.0))
		if r <= 0.0:
			state["seenDilemmas"].append(d.get("id",""))
			return d
	return pool[0]

## Resolve a dilemma option. Returns { text, failed }.
func resolve_dilemma(dilemma: Dictionary, option_id: String) -> Dictionary:
	var opt: Dictionary = {}
	for o in dilemma.get("options", []):
		if o.get("id","") == option_id:
			opt = o
			break
	if opt.is_empty():
		return { "text": "", "failed": false }
	var failed := false
	var text: String = opt.get("resultText", "")
	# Base consequence
	_apply_consequence(opt.get("consequence", {}))
	# Risk roll
	var risk: Dictionary = opt.get("risk", {})
	if not risk.is_empty():
		var chance: float = float(risk.get("chance", 0.0))
		var mit: String = risk.get("mitigatedBy", "")
		if mit != "":
			chance *= (1.0 - float(state["player"]["attrs"].get(mit, 0.5)))
		if rng.randf() < chance:
			failed = true
			text = risk.get("failText", text)
			_apply_consequence(risk.get("onFail", {}))
	_log("Dilemma: %s" % dilemma.get("title",""))
	Audio.sfx("fail" if failed else "confirm")
	state_changed.emit()
	poll_updated.emit()
	return { "text": text, "failed": failed }

func _apply_consequence(c: Dictionary) -> void:
	if c.is_empty(): return
	if c.has("cashDelta"):
		state["cash"] = int(state["cash"]) + int(c.cashDelta) * USD
	if c.has("apDelta"):
		state["ap"] = maxi(0, int(state["ap"]) + int(c.apDelta))
	if c.has("scandal"):
		var sc: Dictionary = c.scandal
		var tgt: String = sc.get("target","self")
		var amt: float = float(sc.get("amount", 0.0))
		if tgt == "self":
			amt *= float(state["player"].get("scandalMult", 1.0))
			state["player"]["scandal"] = clampf(float(state["player"].get("scandal",0.0)) + amt, 0.0, 1.0)
		else:
			var opp: Dictionary = state["opponents"][0]
			opp["scandal"] = clampf(float(opp.get("scandal",0.0)) + amt, 0.0, 1.0)
	if c.has("positionShifts"):
		for ps in c.positionShifts:
			var iss: String = ps.get("issueId","")
			if iss != "":
				state["player"]["positions"][iss] = clampf(float(state["player"]["positions"].get(iss,0.0)) + float(ps.get("delta",0.0)), -1.0, 1.0)
	for ef in c.get("effects", []):
		_schedule_effect(ef, 1.0, "dilemma")

# ---------------------------------------------------------------------------
# Staff / offices
# ---------------------------------------------------------------------------
func hire(staff_id: String) -> bool:
	var s: Dictionary = staff_def(staff_id)
	if s.is_empty() or state["staff"].has(staff_id): return false
	var cost := int(round(s.sign * float(state["player"].get("salaryMult", 1.0)))) * USD
	if int(state["cash"]) < cost: return false
	state["cash"] = int(state["cash"]) - cost
	state["staff"].append(staff_id)
	if s.role == "manager":
		state["ap"] = int(state["ap"]) + 1
	_log("Hired %s" % s.name)
	Audio.sfx("confirm")
	state_changed.emit()
	return true

# ---------------------------------------------------------------------------
# Election
# ---------------------------------------------------------------------------
func run_election() -> Dictionary:
	var res := Sim.evaluate(state, electorate, all_candidates())
	# Election-day draw: small correlated noise around the true result
	var shares: Dictionary = {}
	var tot := 0.0
	for cid in res.shares:
		var s: float = float(res.shares[cid]) + rng.randf_range(-0.02, 0.02)
		s = maxf(s, 0.0)
		shares[cid] = s
		tot += s
	for cid in shares:
		shares[cid] = float(shares[cid]) / tot if tot > 0.0 else 0.0
	var winner := ""
	var best := -1.0
	for cid in shares:
		if float(shares[cid]) > best:
			best = float(shares[cid])
			winner = cid
	var won: bool = winner == "player"
	state["result"] = {
		"shares": shares,
		"trueShares": res.shares,
		"turnout": res.turnout,
		"totalVotes": res.totalVotes,
		"winner": winner,
		"won": won,
		"segments": res.segments,
	}
	return state["result"]

# ---------------------------------------------------------------------------
# News / log
# ---------------------------------------------------------------------------
func _add_news(text: String, tone: String) -> void:
	state["news"].push_front({"text": text, "tone": tone, "week": int(state["week"])})
	if state["news"].size() > 30:
		state["news"].pop_back()
	news_added.emit(text, tone)

func _maybe_headline() -> void:
	if Content.headlines.is_empty():
		return
	var h: Dictionary = Content.headlines[rng.randi() % Content.headlines.size()]
	var text: String = _fill_placeholders(h.get("text",""))
	var tone: String = h.get("tone","neutral")
	_add_news(text, tone)

func _fill_placeholders(t: String) -> String:
	var d: Dictionary = state.get("district", {})
	var towns: Array = d.get("towns", ["town"])
	t = t.replace("{name}", state["player"].get("name","You"))
	t = t.replace("{opp}", state["opponents"][0].get("name","your opponent"))
	t = t.replace("{district}", d.get("name","the district"))
	t = t.replace("{town}", towns[rng.randi() % towns.size()] if towns.size() > 0 else "town")
	return t

func _log(text: String) -> void:
	state["log"].push_front("W%d: %s" % [int(state["week"]) + 1, text])
	if state["log"].size() > 60:
		state["log"].pop_back()

# ---------------------------------------------------------------------------
# Save / load
# ---------------------------------------------------------------------------
func save_game(slot := 0) -> void:
	var payload := { "state": state, "rng": rng.state, "seed": rng.seed, "version": "0.1.0" }
	var f := FileAccess.open(SAVE_PATH % slot, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(payload))
		f.close()
		toast.emit("Game saved.", "good")

func has_save(slot := 0) -> bool:
	return FileAccess.file_exists(SAVE_PATH % slot)

func load_game(slot := 0) -> bool:
	if not has_save(slot): return false
	var f := FileAccess.open(SAVE_PATH % slot, FileAccess.READ)
	if not f: return false
	var data = JSON.parse_string(f.get_as_text())
	f.close()
	if data == null or not data.has("state"): return false
	state = data["state"]
	rng.seed = int(data.get("seed", 0))
	rng.state = int(data.get("rng", 0))
	electorate = Sim.build_electorate(state["district"])
	set_phase("hq")
	state_changed.emit()
	poll_updated.emit()
	return true

func save_settings() -> void:
	var f := FileAccess.open(SETTINGS_PATH, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(settings))
		f.close()

func load_settings() -> void:
	if not FileAccess.file_exists(SETTINGS_PATH): return
	var f := FileAccess.open(SETTINGS_PATH, FileAccess.READ)
	if not f: return
	var data = JSON.parse_string(f.get_as_text())
	f.close()
	if data is Dictionary:
		for k in data: settings[k] = data[k]

# ---------------------------------------------------------------------------
# Small utils
# ---------------------------------------------------------------------------
func _comma(n: int) -> String:
	var s := str(absi(n))
	var out := ""
	var c := 0
	for i in range(s.length() - 1, -1, -1):
		out = s[i] + out
		c += 1
		if c % 3 == 0 and i > 0:
			out = "," + out
	return ("-" if n < 0 else "") + out

func money_str(cents: int) -> String:
	return "$" + _comma(cents / USD)
