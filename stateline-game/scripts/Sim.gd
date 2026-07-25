extends Node
## Deterministic simulation core — the calibrated voter model, the effects ledger,
## election evaluation, and polling. PURE functions over plain dictionaries so the
## whole game is replayable from (seed + action log). Randomness only enters where a
## RandomNumberGenerator is passed in (polls, election-night draw, dilemma risk, AI).
##
## Direction convention: +1 = progressive/Democratic pole, -1 = conservative/Republican.

# --- Model weights (tunable) ---
const W_SPATIAL := 1.15
const W_PARTISAN := 2.55
const W_VALENCE := 0.85
const W_FAV := 1.05
const TAU := 0.55

var ISSUE_IDS: Array = []

func _ready() -> void:
	# Populated once Content is ready.
	call_deferred("_init_issue_ids")

func _init_issue_ids() -> void:
	ISSUE_IDS.clear()
	for i in Content.issues:
		ISSUE_IDS.append(i.get("id", ""))
	if ISSUE_IDS.is_empty():
		ISSUE_IDS = ["taxes_spending","healthcare","immigration","guns","abortion","climate_energy","crime_policing","social_culture"]

func issue_ids() -> Array:
	if ISSUE_IDS.is_empty():
		_init_issue_ids()
	return ISSUE_IDS

# ---------------------------------------------------------------------------
# Electorate construction
# ---------------------------------------------------------------------------

## Build an electorate from a district + the calibrated voter model.
func build_electorate(district: Dictionary) -> Dictionary:
	var shares: Dictionary = district.get("segmentShares", {})
	var cvap: float = float(district.get("cvap", 500000))
	var groups: Array = []
	var weighted_lean := 0.0
	var mean_prop := 0.0
	for seg_id in shares.keys():
		var share: float = float(shares[seg_id])
		if share <= 0.0:
			continue
		var b: Dictionary = Content.behavior.get(seg_id, {})
		if b.is_empty():
			continue
		var g := {
			"seg": seg_id,
			"cvap": cvap * share,
			"share": share,
			"partisanLean": float(b.get("partisanLean", 0.0)),
			"partisanStrength": float(b.get("partisanStrength", 0.5)),
			"turnoutPropensity": float(b.get("turnoutPropensity", 0.5)),
			"issuePositions": b.get("issuePositions", {}).duplicate(),
			"issueSalience": b.get("issueSalience", {}).duplicate(),
		}
		groups.append(g)
		weighted_lean += share * g["partisanLean"]
		mean_prop += share * g["turnoutPropensity"]
	# Calibration offset: shift each group's lean so the CVAP-weighted baseline
	# reproduces the district's real recent lean.
	var offset: float = float(district.get("lean", 0.0)) - weighted_lean
	return {
		"groups": groups,
		"cvap": cvap,
		"baselineTurnout": float(district.get("turnout", 0.5)),
		"meanPropensity": mean_prop if mean_prop > 0.0 else 1.0,
		"calibrationOffset": offset,
	}

# ---------------------------------------------------------------------------
# Effects ledger
# ---------------------------------------------------------------------------

## Current value of a single scheduled effect at `week` (weeks since campaign start).
func effect_value(effect: Dictionary, week: float) -> float:
	var t: float = week - float(effect.get("start_week", 0))
	if t < 0.0:
		return 0.0
	var mag: float = float(effect.get("magnitude", 0.0))
	var ramp: float = maxf(float(effect.get("ramp_weeks", 0.4)), 0.15)
	var half: float = float(effect.get("half_life_weeks", 4.0))
	var ramp_frac: float = clampf(t / ramp, 0.0, 1.0)
	var v: float = mag * ramp_frac
	if half > 0.0 and t > ramp:
		v = mag * pow(0.5, (t - ramp) / half)
	return v

## Sum of a candidate's effects on a channel at the given week.
func channel_sum(effects: Array, cand_id: String, channel: String, week: float) -> float:
	var s := 0.0
	for e in effects:
		if e.get("cand", "") == cand_id and e.get("channel", "") == channel:
			s += effect_value(e, week)
	return s

## Net electorate opinion shift per issue (issue-ad channel), aggregated over all effects.
func opinion_shift(effects: Array, week: float, cap := 0.12) -> Dictionary:
	var out: Dictionary = {}
	for e in effects:
		if e.get("channel", "") == "opinion":
			var iss: String = e.get("issue", "")
			if iss == "":
				continue
			out[iss] = clampf(float(out.get(iss, 0.0)) + effect_value(e, week), -cap, cap)
	return out

# ---------------------------------------------------------------------------
# Candidate derived stats
# ---------------------------------------------------------------------------

func candidate_valence(cand: Dictionary) -> float:
	var a: Dictionary = cand.get("attrs", {})
	var v: float = 0.45 * float(a.get("competence", 0.5)) \
		+ 0.30 * float(a.get("charisma", 0.5)) \
		+ 0.25 * float(a.get("integrity", 0.5))
	v -= 0.8 * float(cand.get("scandal", 0.0))
	return clampf(v, -0.5, 1.0)

## Full derived stats used in evaluation and UI.
func candidate_stats(state: Dictionary, cand: Dictionary) -> Dictionary:
	var effects: Array = state.get("effects", [])
	var week: float = float(state.get("week", 0))
	var cid: String = cand.get("id", "")
	var exposure: float = clampf(float(cand.get("baseExposure", 0.1)) + channel_sum(effects, cid, "nameRecognition", week), 0.0, 1.0)
	var fav: float = clampf(float(cand.get("baseFavorability", 0.0)) + channel_sum(effects, cid, "favorability", week) - 0.5 * float(cand.get("scandal", 0.0)), -1.0, 1.0)
	return {
		"exposure": exposure,
		"favorability": fav,
		"valence": candidate_valence(cand),
		"awareness": exposure,
		"gotv": minf(channel_sum(effects, cid, "turnout", week), 0.06),
	}

# ---------------------------------------------------------------------------
# Evaluation (vote + turnout)
# ---------------------------------------------------------------------------

func _party_dir(p: String) -> float:
	if p == "D": return 1.0
	if p == "R": return -1.0
	return 0.0

func _group_utility(group: Dictionary, cand_pos: Dictionary, cand: Dictionary, stats: Dictionary, offset: float, opinion: Dictionary) -> float:
	var wsum := 0.0
	var dist := 0.0
	for iss in issue_ids():
		var sal: float = float(group["issueSalience"].get(iss, 1.0))
		wsum += sal
		var gp: float = float(group["issuePositions"].get(iss, 0.0)) + float(opinion.get(iss, 0.0))
		gp = clampf(gp, -1.0, 1.0)
		var d: float = gp - float(cand_pos.get(iss, 0.0))
		dist += sal * d * d
	var proximity: float = -(dist / wsum) if wsum > 0.0 else 0.0
	var eff_lean: float = clampf(float(group["partisanLean"]) + offset, -1.0, 1.0)
	var partisan: float = float(group["partisanStrength"]) * eff_lean * _party_dir(cand.get("party", "I"))
	return W_SPATIAL * proximity + W_PARTISAN * partisan + W_VALENCE * float(stats["valence"]) + W_FAV * float(stats["favorability"])

## Evaluate an election. Returns shares, votes, turnout, and a per-segment breakdown.
## `candidates` is an array of candidate dicts; `state` supplies the ledger + week.
func evaluate(state: Dictionary, electorate: Dictionary, candidates: Array) -> Dictionary:
	var opinion: Dictionary = opinion_shift(state.get("effects", []), float(state.get("week", 0)))
	var offset: float = float(electorate.get("calibrationOffset", 0.0))
	var mean_prop: float = float(electorate.get("meanPropensity", 1.0))
	var base_turnout: float = float(electorate.get("baselineTurnout", 0.5))

	var stats: Dictionary = {}
	for c in candidates:
		stats[c.get("id", "")] = candidate_stats(state, c)

	var votes: Dictionary = {}
	for c in candidates:
		votes[c.get("id", "")] = 0.0
	var turned_out := 0.0
	var seg_breakdown: Dictionary = {}

	for group in electorate["groups"]:
		# First pass: within-group shares (awareness-gated softmax).
		var raws: Array = []
		var raw_sum := 0.0
		for c in candidates:
			var st: Dictionary = stats[c.get("id", "")]
			var u: float = _group_utility(group, c.get("positions", {}), c, st, offset, opinion)
			var r: float = float(st["awareness"]) * exp(u / TAU)
			raws.append(r)
			raw_sum += r
		# Turnout: base propensity ratio + GOTV that only lifts a candidate's own supporters.
		var prop_ratio: float = float(group["turnoutPropensity"]) / mean_prop
		var gotv_boost := 0.0
		if raw_sum > 0.0:
			for i in candidates.size():
				var c2: Dictionary = candidates[i]
				var share_in_group: float = raws[i] / raw_sum
				gotv_boost += float(stats[c2.get("id","")]["gotv"]) * share_in_group
		var turnout: float = clampf(base_turnout * prop_ratio + gotv_boost, 0.0, 0.98)
		var voters: float = float(group["cvap"]) * turnout
		turned_out += voters
		if raw_sum <= 0.0:
			continue
		for i in candidates.size():
			var cid: String = candidates[i].get("id", "")
			var v: float = voters * (raws[i] / raw_sum)
			votes[cid] = float(votes[cid]) + v
			var sb: Dictionary = seg_breakdown.get(group["seg"], {})
			sb[cid] = float(sb.get(cid, 0.0)) + v
			seg_breakdown[group["seg"]] = sb

	var total := 0.0
	for cid in votes:
		total += float(votes[cid])
	var shares: Dictionary = {}
	for cid in votes:
		shares[cid] = float(votes[cid]) / total if total > 0.0 else 0.0
	return {
		"shares": shares,
		"votes": votes,
		"totalVotes": total,
		"turnout": turned_out / float(electorate["cvap"]) if float(electorate["cvap"]) > 0.0 else 0.0,
		"segments": seg_breakdown,
	}

# ---------------------------------------------------------------------------
# Polling (sampled, with margin of error)
# ---------------------------------------------------------------------------

func run_poll(true_shares: Dictionary, sample_size: int, rng: RandomNumberGenerator, house_effect := 0.0) -> Dictionary:
	var n: int = maxi(sample_size, 60)
	var sampled: Dictionary = {}
	var tot := 0.0
	for cid in true_shares:
		var p: float = float(true_shares[cid])
		var se: float = sqrt(maxf(p * (1.0 - p), 0.0001) / float(n))
		var val: float = p + rng.randfn(0.0, se) + house_effect
		val = maxf(val, 0.0)
		sampled[cid] = val
		tot += val
	for cid in sampled:
		sampled[cid] = float(sampled[cid]) / tot if tot > 0.0 else 0.0
	return {
		"shares": sampled,
		"moe": 1.96 * sqrt(0.25 / float(n)),
		"sample": n,
	}

# ---------------------------------------------------------------------------
# Helpers for content / AI
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# The POLICY layer: a platform is 24 concrete stances, not 8 abstract sliders.
# Each area position the electorate model consumes is the weighted aggregate of
# the stances beneath it, so precise positions drive the whole simulation.
# ---------------------------------------------------------------------------

func policies_for_area(area: String) -> Array:
	var out: Array = []
	for p in Content.policies:
		if str(p.get("area", "")) == area:
			out.append(p)
	return out

func policy(id: String) -> Dictionary:
	for p in Content.policies:
		if str(p.get("id", "")) == id:
			return p
	return {}

## 24 stances → the 8 calibrated area positions the voter model uses.
func aggregate_to_areas(stances: Dictionary) -> Dictionary:
	var out: Dictionary = {}
	for area in issue_ids():
		var ps := policies_for_area(area)
		var total_w := 0.0
		var acc := 0.0
		for p in ps:
			var w := float(p.get("weight", 0.0))
			total_w += w
			acc += float(stances.get(str(p.get("id", "")), 0.0)) * w
		out[area] = acc / total_w if total_w > 0.0 else 0.0
	return out

## Fill every stance in an area from a single area-level slider (quick platform).
func stances_from_area(stances: Dictionary, area: String, value: float) -> void:
	for p in policies_for_area(area):
		stances[str(p.get("id", ""))] = value

func blank_stances() -> Dictionary:
	var d: Dictionary = {}
	for p in Content.policies:
		d[str(p.get("id", ""))] = 0.0
	return d

## Fiscal / social ideology, each −1 (conservative) .. +1 (progressive).
func ideology_of(stances: Dictionary) -> Dictionary:
	var f := 0.0
	var fw := 0.0
	var s := 0.0
	var sw := 0.0
	for p in Content.policies:
		var v := float(stances.get(str(p.get("id", "")), 0.0))
		var w := float(p.get("weight", 0.0))
		var pf := float(p.get("fiscal", 0.0))
		var ps := float(p.get("social", 0.0))
		f += v * pf * w
		fw += pf * w
		s += v * ps * w
		sw += ps * w
	return {
		"fiscal": (f / fw) if fw > 0.0 else 0.0,
		"social": (s / sw) if sw > 0.0 else 0.0,
	}

func ideology_label(v: float) -> String:
	var mag := absf(v)
	if mag < 0.1:
		return "Centrist"
	var dir := "progressive" if v > 0.0 else "conservative"
	if mag < 0.35: return "Lean %s" % dir
	if mag < 0.65: return "Solidly %s" % dir
	return "Staunchly %s" % dir

## Blank position map (all centrist).
func blank_positions() -> Dictionary:
	var d: Dictionary = {}
	for iss in issue_ids():
		d[iss] = 0.0
	return d

## A rough "fundamentals" read for star-rating / preview (generic D vs generic R).
func generic_lean_preview(district: Dictionary) -> float:
	return float(district.get("lean", 0.0))
