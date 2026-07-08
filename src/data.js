/*
 * Campaign Trail — game content & design data (generated, then committed as source).
 * Produced by the design workflow (judge-panel of 3 proposals -> synthesis -> parallel
 * content generation), then post-processed to fix the electoral-vote total (regions
 * originally summed to 328; scaled to exactly 538 to preserve the 270/538 identity).
 *
 * Shipped as a JS module (NOT fetched JSON) so the game runs from file:// with no server.
 * UMD: window.Campaign.Data in the browser, require() in Node.
 *
 * Effect channels (events/actions manipulate these): funds, momentum, nationalApproval, scandalLevel, mediaBuzz, volunteers, actionPoints, regionLean, opponentMomentum, opponentScandal.
 * regionLean effects use a selector: all, strongest, weakest, random, mostVotes, none.
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else { root.Campaign = root.Campaign || {}; root.Campaign.Data = mod; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return {
    "meta": {
      "name": "Campaign Trail: Road to 270",
      "generator": "campaign-trail-design workflow (judge-panel + synthesis + parallel content)",
      "totalElectoralVotes": 538,
      "electoralVotesToWin": 270,
      "totalTurns": 12,
      "actionPointsPerTurn": 5,
      "counts": {
        "regions": 18,
        "candidates": 3,
        "events": 34
      },
      "evFix": {
        "scaledFrom": 328,
        "scaledTo": 538,
        "note": "regions scaled to sum exactly totalElectoralVotes; per-region baseElectoralVotes preserved"
      },
      "projectedStart": {
        "playerEV": 295,
        "opponentEV": 243,
        "note": "starting balance subject to empirical tuning in the verify phase"
      },
      "effectChannels": [
        "funds",
        "momentum",
        "nationalApproval",
        "scandalLevel",
        "mediaBuzz",
        "volunteers",
        "actionPoints",
        "regionLean",
        "opponentMomentum",
        "opponentScandal"
      ],
      "leanSelectors": [
        "all",
        "strongest",
        "weakest",
        "random",
        "mostVotes",
        "none"
      ]
    },
    "design": {
      "name": "Campaign Trail: Road to 270",
      "summary": "You are a national campaign manager with 12 weeks until election day, fighting across 18 regions worth 538 electoral votes to clinch 270. Every turn is one week, and there is no script: you freely spend a fresh pool of 5 Action Points plus a carryover Funds war chest on any mix of actions targeting a single region or the whole nation. Pour cash into a TV/social air war for reliable lean swings, build field offices and recruit volunteers for a sticky ground game that snowballs late, chase rallies and debates for volatile momentum and media buzz, fundraise to stay solvent, or go negative with opposition research at real scandal risk. A reactive opponent AI campaigns against you every week, concentrating fire on the most valuable tossups, counterpunching your momentum, and exploiting your scandals. Dynamic events crash in with branching choices. Polls obey believable physics: momentum decays, region leans regress toward a structural baseline, and volatility keeps tossups alive. AP is the true bottleneck (only 5/week, never banked) so no single lever dominates. Win by holding 270+ when ballots close or clinching early; lose by missing 270 on election day, going bankrupt, or maxing the scandal meter.",
      "resources": [
        {
          "id": "funds",
          "name": "Campaign Funds",
          "description": "War chest in thousands of dollars. Spent on ads, rallies, ground operations, opposition research, and consultants. Replenished by fundraisers and some events; carries over between turns. The flexible resource you can refill, which is exactly why time (AP) matters more.",
          "starting": 1200
        },
        {
          "id": "actionPoints",
          "name": "Action Points (AP)",
          "description": "Candidate and senior-staff time each week. Every action costs 1-3 AP. Refreshes to 5 at the start of each turn and does NOT bank, so unspent AP is lost. This is the true scarce currency that forces hard prioritization since funds can be refilled but time cannot.",
          "starting": 5
        },
        {
          "id": "volunteers",
          "name": "Volunteers",
          "description": "Persistent ground-game workforce in thousands. Grown via Recruit Volunteers and Build Field Office; multiplies the punch of ground-game actions and unlocks decisive late-game GOTV. Carries over between turns but attritions 5% per turn if no ground action is taken. The engine-builder that pays off only if you invest early.",
          "starting": 8
        }
      ],
      "stats": [
        {
          "id": "momentum",
          "name": "National Momentum",
          "description": "Short-term national tailwind in [-100,100]. Amplifies the lean gain of every region-targeting action (multiplier = 1 + momentum/200, so +100 momentum = +50% gains) and feeds a small per-turn drift into all region leans (lean += momentum*0.05). Decays 20% toward 0 each turn. The engine of comebacks that evaporates if you coast.",
          "min": -100,
          "max": 100,
          "scope": "national"
        },
        {
          "id": "nationalApproval",
          "name": "National Approval",
          "description": "Structural baseline favorability in [-100,100]. Each turn every region lean is pulled toward (regionBaseline + nationalApproval*0.10), modeling regression to a national mood. Moves slowly; the durable floor under the volatile momentum layer. Also scales fundraising yield.",
          "min": -100,
          "max": 100,
          "scope": "national"
        },
        {
          "id": "scandalLevel",
          "name": "Scandal Level",
          "description": "Your accumulated controversy in [0,100]. Each point above 30 reduces all ad/rally lean gains (penalty = 1 - max(0,scandalLevel-30)*0.005) and above 40 subtracts (scandalLevel-40)/10 from momentum and approval each turn. Raised by attack backfires and opponent attacks; lowered by Damage Control. Decays 4 per turn naturally. At 80+ you lose.",
          "min": 0,
          "max": 100,
          "scope": "national"
        },
        {
          "id": "mediaBuzz",
          "name": "Media Buzz",
          "description": "Earned-media attention in [0,100]. Multiplies rally and debate momentum gains and boosts fundraising yield, and raises the chance a rally goes viral. But when scandal is high it amplifies scandal damage. Decays 20% per turn. A volatile force multiplier.",
          "min": 0,
          "max": 100,
          "scope": "national"
        },
        {
          "id": "lean",
          "name": "Region Lean",
          "description": "Per-region preference in [-100,100]; positive favors the player. On election day each region's electoral votes go to the player if lean > 0 and to the opponent if lean <= 0 (ties go to opponent as incumbent). Moved by targeted actions, momentum drift, opponent pressure, and per-turn regression toward the region's structural baseline. The core battleground the player paints.",
          "min": -100,
          "max": 100,
          "scope": "region"
        },
        {
          "id": "opponentMomentum",
          "name": "Opponent Momentum",
          "description": "The opponent AI's national tailwind in [-100,100], symmetric to player momentum. Drives a per-turn drift of contested region leans toward the opponent (lean -= opponentMomentum*0.05) and scales how hard the AI pushes regions. Accrues ~+6/turn from AI activity; reduced by your attack ads, counter-messaging, and opponent scandal. Decays 20% per turn.",
          "min": -100,
          "max": 100,
          "scope": "opponent"
        },
        {
          "id": "opponentScandal",
          "name": "Opponent Scandal",
          "description": "The opponent's controversy in [0,100]. Raised by your Opposition Research and Attack Ads; while above 40 it suppresses opponentMomentum and drifts contested regions toward you. Decays 5 per turn.",
          "min": 0,
          "max": 100,
          "scope": "opponent"
        }
      ],
      "actions": [
        {
          "id": "tv_ad_blitz",
          "name": "TV / Social Ad Blitz",
          "description": "Saturate one region with paid broadcast and digital ads. The core air-war lever: reliable, money-hungry, AP-light, no scandal risk. Scales up with momentum and down with high scandal. Repeated buys in the same region carry diminishing returns the engine tracks, so spreading buys matters.",
          "costFunds": 180,
          "costActionPoints": 1,
          "targeting": "region",
          "effectSummary": "Target region lean += 12 * momentumMultiplier(1+momentum/200) * scandalPenalty(1-max(0,scandalLevel-30)*0.005), floor +3; +3 mediaBuzz (national). 4th+ blitz on same region this game at 60% effect.",
          "magnitude": 12
        },
        {
          "id": "attack_ad",
          "name": "Attack Ad",
          "description": "Run a negative ad against the opponent in a region. Cheaper per lean point than positive ads and it wounds the opponent, but going negative raises your own scandal slightly (blowback). A high-pressure tactical lever.",
          "costFunds": 140,
          "costActionPoints": 1,
          "targeting": "region",
          "effectSummary": "Target region lean += 9 * momentumMultiplier (region); opponentMomentum -= 6 and opponentScandal += 5 (opponent); your scandalLevel += 3 (national).",
          "magnitude": 9
        },
        {
          "id": "build_field_office",
          "name": "Build Field Office",
          "description": "Stand up a permanent ground operation in a region. High upfront AP and cash, but boosts volunteers and creates a per-turn passive lean gain in that region for the rest of the game whose swing is sticky (resists regression). The backbone of a ground-game strategy.",
          "costFunds": 120,
          "costActionPoints": 2,
          "targeting": "region",
          "effectSummary": "Target region lean += 6 now plus a passive +3/turn thereafter scaling with volunteers/10 (region, flagged 'organized' so it regresses 50% slower); volunteers += 3 (resource).",
          "magnitude": 6
        },
        {
          "id": "volunteer_canvass",
          "name": "Volunteer Canvass (GOTV)",
          "description": "Deploy your volunteer army door-to-door in a region. Cheap on cash, costs AP, and its punch scales hard with accumulated volunteers, rewarding early recruitment. The anti-money-dominance lever; its gains are sticky.",
          "costFunds": 40,
          "costActionPoints": 1,
          "targeting": "region",
          "effectSummary": "Target region lean += (5 + volunteers*0.6) * momentumMultiplier (region, flagged 'organized', regresses 50% slower); nationalApproval += 1 (national). Strongly rewards a large volunteer pool.",
          "magnitude": 5
        },
        {
          "id": "recruit_volunteers",
          "name": "Recruit Volunteers",
          "description": "Invest time and cash to grow your persistent ground-game pool, compounding the value of every future canvass and field office. A tempo play that only pays off if you have turns left to spend the volunteers.",
          "costFunds": 150,
          "costActionPoints": 1,
          "targeting": "national",
          "effectSummary": "volunteers += 8 (+2 bonus if mediaBuzz > 40); mediaBuzz += 2 (national). No direct lean change. Also grants +0.4 passive lean/turn to regions already leaning > 0.",
          "magnitude": 8
        },
        {
          "id": "campaign_rally",
          "name": "Campaign Rally",
          "description": "Hold a high-energy rally in a region. Modest direct lean bump but spikes national momentum and media buzz and can go viral for double effect. Cheap-ish on cash, AP-heavy; best when buzz is already high to compound. Small gaffe/scandal risk.",
          "costFunds": 90,
          "costActionPoints": 2,
          "targeting": "region",
          "effectSummary": "Target region lean += 6 * momentumMultiplier (region); momentum += 10 + mediaBuzz*0.05, mediaBuzz += 8 (national). Viral roll chance = 0.10 + mediaBuzz*0.003 doubles lean+momentum gains. 12% chance scandalLevel += 3 (gaffe).",
          "magnitude": 10
        },
        {
          "id": "major_fundraiser",
          "name": "Major Fundraiser",
          "description": "Spend a week courting donors to refill the war chest. Yield scales with approval, momentum, and media buzz (donors back winners), so it pays best when you are ahead. The economic engine; does nothing to the map directly.",
          "costFunds": 0,
          "costActionPoints": 2,
          "targeting": "national",
          "effectSummary": "funds += round((220 + momentum*2 + nationalApproval*3) * (1 + mediaBuzz*0.01)), floor 150 (resource); momentum -= 3 (time off the trail).",
          "magnitude": 220
        },
        {
          "id": "opposition_research",
          "name": "Opposition Research",
          "description": "Dig for dirt and go negative on the opponent nationally. Raises opponentScandal sharply and cuts opponentMomentum, freeing your contested regions, but carries a real backfire chance that raises your own scandal. High-variance.",
          "costFunds": 110,
          "costActionPoints": 2,
          "targeting": "national",
          "effectSummary": "Success (chance = 0.75 - max(0,scandalLevel-30)*0.005): opponentScandal += 18, opponentMomentum -= 8, mediaBuzz += 6. Backfire: scandalLevel += 12, opponentScandal gain halved, mediaBuzz += 6.",
          "magnitude": 18
        },
        {
          "id": "damage_control",
          "name": "Damage Control",
          "description": "Lawyer up, spin, and calm the press to bury your own scandal. The primary defensive valve and the only reliable way to pull scandalLevel back from the brink before the loss threshold.",
          "costFunds": 80,
          "costActionPoints": 1,
          "targeting": "national",
          "effectSummary": "scandalLevel = max(0, scandalLevel - 20); mediaBuzz -= 4 (national). If scandalLevel was > 50, also momentum += 4 (relief-rally effect).",
          "magnitude": 20
        },
        {
          "id": "debate_prep_appearance",
          "name": "Debate / Major Media Appearance",
          "description": "A national debate or interview moment. Big approval, momentum, and buzz swing when you are clean, but going in with high scandal can backfire into more scandal and lost momentum. Rewards a low-scandal posture.",
          "costFunds": 100,
          "costActionPoints": 2,
          "targeting": "national",
          "effectSummary": "If scandalLevel < 40: nationalApproval += 5, momentum += 6, mediaBuzz += 16 (national). If scandalLevel >= 40: 45% chance scandalLevel += 10 and momentum -= 5 instead; otherwise half the clean effect.",
          "magnitude": 5
        },
        {
          "id": "counter_messaging",
          "name": "Counter-Messaging",
          "description": "Blunt the opponent's surge with a rapid national message. The dedicated counterplay tool when the AI is on a roll: directly cuts opponentMomentum and slightly lifts your own. Cheap AP.",
          "costFunds": 100,
          "costActionPoints": 1,
          "targeting": "national",
          "effectSummary": "opponentMomentum -= 12 (opponent), effect +50% if opponentMomentum was > 40; momentum += 3, mediaBuzz += 2 (national).",
          "magnitude": 12
        },
        {
          "id": "polling_consultant",
          "name": "Hire Polling Consultant",
          "description": "Reveal the opponent's next-turn target regions and all region baselines for one turn, and gain a targeting edge. An information/efficiency play that rewards planning over brute force.",
          "costFunds": 100,
          "costActionPoints": 1,
          "targeting": "national",
          "effectSummary": "Reveals opponent's next-turn target regions and all region structural baselines (UI). The next region-targeted action this turn gets +25% magnitude. No stat side effects.",
          "magnitude": 1
        }
      ],
      "turnStructure": {
        "totalTurns": 12,
        "unit": "week",
        "actionPointsPerTurn": 5,
        "phases": [
          "Briefing: refresh AP to 5; show updated polls, projected electoral count, the opponent's last move, and any consultant intel.",
          "Upkeep: apply momentum drift to all leans (lean += momentum*0.05) and opponent drift to contested leans (lean -= opponentMomentum*0.05); apply field-office passive lean; regress each region 12% of the way toward (regionBaseline + nationalApproval*0.10), at half rate for 'organized' leans; if scandalLevel > 40 subtract (scandalLevel-40)/10 from momentum and approval; decay momentum 20% toward 0, mediaBuzz 20% toward 0, scandalLevel by 4, opponentMomentum 20% toward 0, opponentScandal by 5; attrition volunteers 5% if no ground action last turn; apply +/-2.5 N(0) volatility jolt to up to 2 contested regions (abs lean < 25).",
          "Event: with eventChancePerTurn probability fire a dynamic event with 2-3 branching choices adjusting channels.",
          "Player Action: freely spend up to 5 AP and available funds on any mix of region/national actions in any order until AP or funds run out or the player ends the week.",
          "Opponent AI: opponent spends its per-week budget and AP per its strategy (attack tossups, counterpunch momentum, exploit scandal, fundraise, accrue opponentMomentum).",
          "Resolution: clamp all stats to ranges; recompute electoral tally; check win/fail conditions. On Week 12 end, run the final election-day count."
        ]
      },
      "winConditions": [
        {
          "id": "win_electoral_majority",
          "description": "Win the election by holding a majority of the electoral college on election day.",
          "rule": "At end of turn index 12 (final Resolution), sum electoralVotes of all regions where lean > 0 (assigned to player); if that sum >= electoralVotesToWin (270), player wins."
        },
        {
          "id": "win_early_clinch",
          "description": "Clinch an insurmountable lead before election day by locking down enough safe regions.",
          "rule": "At any Resolution on turn index <= 11, if the sum of electoralVotes for regions with lean >= 40 (treated as safe-for-player) >= 270 AND the opponent cannot mathematically reach 270 from all remaining non-safe regions (totalElectoralVotes - playerSafeVotes < 270), declare immediate player win (opponent concedes)."
        },
        {
          "id": "win_opponent_collapse",
          "description": "Drive the opponent out of the race via overwhelming scandal.",
          "rule": "At any Resolution, if opponentScandal >= 90 AND opponentMomentum <= -40, the opponent withdraws and the player wins immediately."
        }
      ],
      "failConditions": [
        {
          "id": "fail_electoral_loss",
          "description": "Lose the election by failing to reach an electoral majority on election day.",
          "rule": "At end of turn index 12 (final Resolution), assign each region with lean > 0 to the player and lean <= 0 to the opponent; if the player's electoral total < electoralVotesToWin (270), the player loses."
        },
        {
          "id": "fail_bankruptcy",
          "description": "The campaign runs out of money and folds before election day.",
          "rule": "At any Resolution before turn 12, if funds <= bankruptcyThreshold (0) AND volunteers < 3 AND momentum < 0, the campaign is declared insolvent and the player loses immediately. (Grace: being broke is survivable if you still have a volunteer base or positive momentum to coast on.)"
        },
        {
          "id": "fail_scandal_collapse",
          "description": "An unmanaged scandal destroys the campaign.",
          "rule": "At any Resolution, if scandalLevel >= scandalLossThreshold (80), the player is forced to drop out and loses immediately."
        }
      ],
      "opponentAI": {
        "description": "A reactive rival campaign that always acts after the player each week, so it responds to your moves. It spends a per-turn funds budget scaling from ~200/week early to ~340/week late (times the difficulty strengthMultiplier) plus 5 effective AP, behaving as a weighted-priority planner. Each turn it scores every region and concentrates fire (at most 2 regions/week) rather than spreading: it attacks the most electorally valuable tossups where your lead is thinnest, counter-advertises regions you just blitzed or rallied, hardens its own threatened leads, exploits your scandal when scandalLevel is high, fundraises when its internal funds run low, and runs damage control when its own opponentScandal is high. It accrues ~+6/turn opponentMomentum from activity which you must actively suppress with attack ads or counter-messaging. Its action effectiveness scales with (1 + opponentMomentum/200) and is suppressed by opponentScandal (effectiveness *= 1 - opponentScandal*0.005). It never wastes budget on safe regions (abs lean >= 40), forcing the player to keep contesting mid-tier swing regions.",
        "strategies": [
          "Tossup focus: rank regions by abs(lean); pour ~60% of budget into regions with abs(lean) < 15, prioritizing the highest electoralVotes (mostVotes selector), pushing their lean toward the opponent.",
          "Knife-fight the thin lead: target regions where the player lean is between 0 and +20 and electoralVotes are high, attempting to flip thin player leads negative.",
          "Counterpunch: if the player ran a TV Ad Blitz or Rally in a region last turn, run an attack ad there next turn to claw back ~7 lean; if player momentum > 40 or mediaBuzz > 60, divert up to 20% of budget to opposition research against the player and ads on the player's single strongest contested region.",
          "Exploit scandal: when player scandalLevel > 40, spend extra budget on attack actions that add +4 to +8 to player scandalLevel, pushing toward the loss threshold.",
          "Defend leads: allocate ~25% to its own regions with lean between -25 and -10 (opponent-favored but flippable) to harden them.",
          "Self-preservation: when its internal funds drop below ~150 spend the week on a fundraiser; when opponentScandal > 55 divert to damage control; cut losses on safe regions (abs lean >= 40) and redistribute that budget to tossups."
        ],
        "difficultyModifiers": [
          {
            "level": "easy",
            "description": "Forgiving onboarding. Opponent budget x0.7, gains x0.8, ignores scandal-vulture amplification and rarely counterpunches, momentum accrual +4/turn, and the player starts with a slight map edge.",
            "strengthMultiplier": 0.7
          },
          {
            "level": "normal",
            "description": "Balanced and winnable-with-smart-play. Baseline budget and gains, full strategy set, momentum accrual +6/turn. Designed so a focused adaptive player wins and a careless one loses.",
            "strengthMultiplier": 1
          },
          {
            "level": "hard",
            "description": "Relentless. Opponent budget x1.3, gains x1.15, counterpunches aggressively, prioritizes opposition research against the player, momentum accrual +8/turn, and starts with +5 opponent lean (toward it) in 4 high-value regions.",
            "strengthMultiplier": 1.3
          }
        ]
      },
      "balance": {
        "startingFunds": 1200,
        "totalElectoralVotes": 538,
        "electoralVotesToWin": 270,
        "fundraisingYield": 220,
        "adEffectiveness": 1,
        "groundGameEffectiveness": 1,
        "momentumDecay": 0.2,
        "baseVolatility": 2.5,
        "eventChancePerTurn": 0.45,
        "bankruptcyThreshold": 0,
        "scandalLossThreshold": 80,
        "notes": "18 regions summing to exactly 538 EV: 55,38,29,29,20,20,18,16,16,15,14,13,11,10,10,7,4,3 (= 538); 270 to win. Each region has a fixed structural baseline in [-30,30] that leans regress 12% toward each turn (half-rate for 'organized' ground-game leans). Start map on Normal: ~5 safe-player regions (lean +25..+40, ~120 EV), ~5 safe-opponent (lean -25..-40, ~120 EV), ~8 swing regions (lean -18..+18) holding the remaining ~298 EV — the contested battlefield. Player begins around 235 projected EV and must net ~35-40 EV of swing to win: achievable in 12 weeks but not free. Economy: 5 AP/turn x 12 = 60 lifetime AP and AP does NOT bank, so a deep buy (2-3 AP) means ~2-3 meaningful plays/week — AP is the true bottleneck preventing any single dominant spam strategy. Funds: starting 1200 + ~250/fundraiser; a TV-heavy air war needs ~6 fundraiser turns total; a pure-attack/ad player with no fundraising goes broke around Week 6 (bankruptcy is real but grace-protected by volunteers/momentum). Three viable lanes tuned to comparable strength: AIR WAR (TV/Attack Ads + Major Fundraiser + Counter-Messaging) — reliable raw lean but funds-hungry and bankruptcy-prone; GROUND GAME (Build Field Office + Recruit + Volunteer Canvass) — AP/volunteer-hungry, slow to start, sticky and snowballs late; MOMENTUM (Rally + Debate + Opposition Research + Polling Consultant) — cheap and broad but volatile and scandal-exposed. Momentum amplifier caps action gains at +50% and decays 20%/turn so chaining rallies before an ad blitz is a legit combo but never a permanent snowball. Volatility = N(0, 2.5) jitter on up to 2 contested regions/turn keeps tossups live and prevents a fully solved board. Opponent baseline pressure plus regression costs the player ~12-18 lean/turn that must be actively replaced, so coasting is a slow loss. Numbers tuned so a focused adaptive player reaches ~285-320 EV by Week 12 on Normal, while an unfocused or over-leveraged player slips under 270 or busts on scandal/bankruptcy."
      },
      "tutorialBeats": [
        "Each week you get 5 Action Points and your Funds carry over. AP resets every turn and CANNOT be saved — it is your scarcest resource, so spend it where it swings the most electoral votes.",
        "Regions have a Lean from -100 to +100. On election day every region you're leading (lean above 0) gives you its electoral votes. Reach 270 of 538 to win; watch the projected total at the top.",
        "Watch the swing regions in yellow — that's where the election is decided, and where your opponent attacks too. Safe regions (lean over +40) don't need your money.",
        "Pick a lane: flood TV (air war), build field offices and recruit volunteers (ground game), or chase rallies, debates, and media buzz (momentum). Mixing is fine, but spreading too thin loses.",
        "Polls have physics: momentum decays 20% a week and leans drift back toward their baseline. Stop pushing a region and it slides back — but ground-game gains are sticky and resist regression.",
        "Going negative works but bites back: Attack Ads and Opposition Research can raise YOUR Scandal Level. Hit 80 and you're out, so keep Damage Control handy and consider a clean Debate to rebuild approval.",
        "Fundraise before you're desperate — yields scale with your momentum, approval, and buzz, so raise money while you're winning, not when you're broke."
      ]
    },
    "regions": [
      {
        "id": "calforna",
        "name": "Calforna",
        "abbreviation": "CF",
        "electoralVotes": 90,
        "initialLean": 34,
        "population": 10,
        "mediaCostMultiplier": 2,
        "volatility": 0.15,
        "archetype": "coastal stronghold (player base)",
        "baseElectoralVotes": 55
      },
      {
        "id": "texano",
        "name": "Texano",
        "abbreviation": "TX",
        "electoralVotes": 62,
        "initialLean": -31,
        "population": 9,
        "mediaCostMultiplier": 1.6,
        "volatility": 0.2,
        "archetype": "sun-belt opponent stronghold",
        "baseElectoralVotes": 38
      },
      {
        "id": "floridia",
        "name": "Floridia",
        "abbreviation": "FD",
        "electoralVotes": 48,
        "initialLean": -6,
        "population": 9,
        "mediaCostMultiplier": 1.7,
        "volatility": 0.85,
        "archetype": "sun-belt mega-tossup",
        "baseElectoralVotes": 29
      },
      {
        "id": "new_yorke",
        "name": "New Yorke",
        "abbreviation": "NY",
        "electoralVotes": 48,
        "initialLean": 33,
        "population": 9,
        "mediaCostMultiplier": 1.9,
        "volatility": 0.15,
        "archetype": "coastal stronghold (player base)",
        "baseElectoralVotes": 29
      },
      {
        "id": "pennsylvia",
        "name": "Pennsylvia",
        "abbreviation": "PV",
        "electoralVotes": 33,
        "initialLean": 4,
        "population": 7,
        "mediaCostMultiplier": 1.2,
        "volatility": 0.9,
        "archetype": "rust-belt swing (premier battleground)",
        "baseElectoralVotes": 20
      },
      {
        "id": "illinoy",
        "name": "Illinoy",
        "abbreviation": "IL",
        "electoralVotes": 33,
        "initialLean": 22,
        "population": 7,
        "mediaCostMultiplier": 1.3,
        "volatility": 0.3,
        "archetype": "midwest lean-player anchor",
        "baseElectoralVotes": 20
      },
      {
        "id": "ohiola",
        "name": "Ohiola",
        "abbreviation": "OH",
        "electoralVotes": 30,
        "initialLean": -12,
        "population": 7,
        "mediaCostMultiplier": 1,
        "volatility": 0.75,
        "archetype": "rust-belt swing drifting opponent",
        "baseElectoralVotes": 18
      },
      {
        "id": "georgiana",
        "name": "Georgiana",
        "abbreviation": "GA",
        "electoralVotes": 26,
        "initialLean": -3,
        "population": 6,
        "mediaCostMultiplier": 1.1,
        "volatility": 0.9,
        "archetype": "sun-belt new tossup",
        "baseElectoralVotes": 16
      },
      {
        "id": "michagan",
        "name": "Michagan",
        "abbreviation": "MG",
        "electoralVotes": 26,
        "initialLean": 7,
        "population": 6,
        "mediaCostMultiplier": 1,
        "volatility": 0.85,
        "archetype": "rust-belt swing (player-tilt)",
        "baseElectoralVotes": 16
      },
      {
        "id": "north_carla",
        "name": "North Carla",
        "abbreviation": "NC",
        "electoralVotes": 25,
        "initialLean": -9,
        "population": 6,
        "mediaCostMultiplier": 1.05,
        "volatility": 0.8,
        "archetype": "sun-belt growth tossup",
        "baseElectoralVotes": 15
      },
      {
        "id": "new_jerza",
        "name": "New Jerza",
        "abbreviation": "NJ",
        "electoralVotes": 23,
        "initialLean": 26,
        "population": 6,
        "mediaCostMultiplier": 1.5,
        "volatility": 0.25,
        "archetype": "coastal lean-player suburb belt",
        "baseElectoralVotes": 14
      },
      {
        "id": "virgina",
        "name": "Virgina",
        "abbreviation": "VA",
        "electoralVotes": 21,
        "initialLean": 11,
        "population": 5,
        "mediaCostMultiplier": 1.2,
        "volatility": 0.6,
        "archetype": "mid-atlantic suburban lean-player",
        "baseElectoralVotes": 13
      },
      {
        "id": "arizonia",
        "name": "Arizonia",
        "abbreviation": "AZ",
        "electoralVotes": 18,
        "initialLean": -2,
        "population": 5,
        "mediaCostMultiplier": 0.95,
        "volatility": 0.9,
        "archetype": "sun-belt desert tossup",
        "baseElectoralVotes": 11
      },
      {
        "id": "wisconsa",
        "name": "Wisconsa",
        "abbreviation": "WI",
        "electoralVotes": 16,
        "initialLean": 2,
        "population": 4,
        "mediaCostMultiplier": 0.85,
        "volatility": 0.95,
        "archetype": "rust-belt razor-edge tossup",
        "baseElectoralVotes": 10
      },
      {
        "id": "tennesa",
        "name": "Tennesa",
        "abbreviation": "TN",
        "electoralVotes": 16,
        "initialLean": -28,
        "population": 4,
        "mediaCostMultiplier": 0.8,
        "volatility": 0.2,
        "archetype": "southern opponent stronghold",
        "baseElectoralVotes": 10
      },
      {
        "id": "nevadia",
        "name": "Nevadia",
        "abbreviation": "NV",
        "electoralVotes": 11,
        "initialLean": -1,
        "population": 3,
        "mediaCostMultiplier": 0.9,
        "volatility": 0.9,
        "archetype": "mountain-west tossup",
        "baseElectoralVotes": 7
      },
      {
        "id": "montania",
        "name": "Montania",
        "abbreviation": "MT",
        "electoralVotes": 7,
        "initialLean": -26,
        "population": 2,
        "mediaCostMultiplier": 0.6,
        "volatility": 0.25,
        "archetype": "rural opponent base",
        "baseElectoralVotes": 4
      },
      {
        "id": "vermonta",
        "name": "Vermonta",
        "abbreviation": "VT",
        "electoralVotes": 5,
        "initialLean": 30,
        "population": 1,
        "mediaCostMultiplier": 0.5,
        "volatility": 0.2,
        "archetype": "small rural player stronghold",
        "baseElectoralVotes": 3
      }
    ],
    "candidates": [
      {
        "id": "charismatic_outsider",
        "name": "Dana Reyes",
        "party": "Independent Reform",
        "color": "#E8552D",
        "archetype": "The Charismatic Outsider",
        "bio": "A former tech founder and viral media personality who has never held office. Reyes runs on energy and authenticity, packing arenas and dominating the news cycle. Donors and the press love a frontrunner, but the lack of a real organization and a thin policy record leave the campaign exposed when the momentum stalls or the press turns hostile.",
        "strengths": [
          "Rallies and debates spike momentum and media buzz hard, fueling comeback runs",
          "Earned-media engine makes fundraisers and viral moments pay off when ahead",
          "Cheap, broad MOMENTUM lane play that snowballs while the buzz is hot"
        ],
        "weaknesses": [
          "Thin ground game: starts with fewer volunteers and weak canvass/field-office payoff",
          "Gaffe-prone and scandal-exposed, so coasting on momentum is dangerous",
          "Volatile: when momentum decays the map regresses fast with no sticky base"
        ],
        "attributes": {
          "charisma": 92,
          "policy": 38,
          "organization": 30,
          "media": 88,
          "warChest": 55
        },
        "startingModifiers": "Starts with +20 National Momentum and +15 Media Buzz but only 4 volunteers (vs 8). Rally and Debate momentum/buzz gains +20%, and viral roll chance gets a flat +5%. Counterweight: ground-game actions (Build Field Office, Volunteer Canvass) are 15% less effective and the rally gaffe chance rises from 12% to 18%. Net start: roughly even projected EV but front-loaded and high-variance."
      },
      {
        "id": "seasoned_insider",
        "name": "Senator Marcus Hale",
        "party": "Establishment Coalition",
        "color": "#1F4E8C",
        "archetype": "The Seasoned Insider",
        "bio": "A three-term senator with a deep donor network and decades of policy fluency. Hale is the safe, well-funded choice: a fat war chest, a steady hand on the air war, and the discipline to bury a scandal before it metastasizes. The trade-off is a low ceiling on excitement: rallies feel flat, the press is bored, and momentum-driven comebacks are harder to manufacture.",
        "strengths": [
          "Largest starting war chest and a discounted, reliable TV/air-war lane",
          "Disciplined: lower scandal exposure and stronger Damage Control",
          "Steady fundraising baseline keeps the air war solvent deep into the race"
        ],
        "weaknesses": [
          "Low momentum ceiling: rallies and debates generate less buzz and tailwind",
          "Uninspiring earned media caps viral upside and momentum-stacking combos",
          "Slow to swing the map without spending; relies on grinding cash advantage"
        ],
        "attributes": {
          "charisma": 45,
          "policy": 90,
          "organization": 70,
          "media": 40,
          "warChest": 90
        },
        "startingModifiers": "Starts with +250 funds (1450 vs 1200) and a higher starting National Approval (+10). TV / Social Ad Blitz costs 150 funds (vs 180), and Damage Control removes 26 scandal (vs 20). Counterweight: starts with -10 National Momentum, and Campaign Rally / Debate momentum and media-buzz gains are reduced 20%. Net start: ahead on resources and floor, behind on ceiling and tempo."
      },
      {
        "id": "grassroots_organizer",
        "name": "Maria Okonkwo",
        "party": "People's Progressive",
        "color": "#2E8B57",
        "archetype": "The Grassroots Organizer",
        "bio": "A community organizer and labor leader who built a movement from the ground up. Okonkwo starts with a small army of dedicated volunteers and an instinct for field operations. Her canvasses and field offices snowball into a sticky, regression-resistant lead, but she starts cash-poor and media-light, so the early weeks are lean and she must invest before she can win.",
        "strengths": [
          "Large starting volunteer pool that compounds every canvass and field office",
          "Sticky 'organized' leans resist regression, locking in late-game gains",
          "Cheap ground lane plus strong late GOTV makes the map hard to take back"
        ],
        "weaknesses": [
          "Cash-poor start and weak fundraising make a TV air war hard to sustain",
          "Low media buzz: viral moments and momentum stacking underperform",
          "Slow ramp: investment-heavy early turns leave her behind on early polls"
        ],
        "attributes": {
          "charisma": 65,
          "policy": 60,
          "organization": 92,
          "media": 35,
          "warChest": 35
        },
        "startingModifiers": "Starts with 16 volunteers (vs 8) but only 950 funds (vs 1200). Build Field Office, Volunteer Canvass, and Recruit Volunteers are 20% more effective, and volunteer attrition is halved (2.5% vs 5%). Counterweight: Major Fundraiser yield reduced 15% and TV / Social Ad Blitz is 10% less effective. Net start: behind on cash and air power, but the strongest late-game compounding engine."
      }
    ],
    "events": [
      {
        "id": "b1_hot_mic_rope_line",
        "title": "Hot Mic on the Rope Line",
        "category": "gaffe",
        "description": "A boom mic catches your candidate muttering a sarcastic insult about voters in your strongest region just after a rally. The clip is already trending. Staff want a plan before the morning shows.",
        "triggerWeight": 7,
        "choices": [
          {
            "id": "b1_hot_mic_apologize",
            "label": "Issue a humble, on-camera apology tour",
            "description": "Eat the news cycle now, limit the bleeding",
            "effects": [
              {
                "type": "scandalLevel",
                "value": 5,
                "note": "controversy spikes briefly"
              },
              {
                "type": "nationalApproval",
                "value": 3,
                "note": "voters reward contrition"
              },
              {
                "type": "mediaBuzz",
                "value": 6,
                "note": "apology dominates coverage"
              },
              {
                "type": "actionPoints",
                "value": -1,
                "note": "a day off the trail"
              }
            ]
          },
          {
            "id": "b1_hot_mic_deny",
            "label": "Claim the audio was doctored",
            "description": "Fight it, but risk a bigger blowup",
            "effects": [
              {
                "type": "scandalLevel",
                "value": 12,
                "note": "the lie compounds the gaffe"
              },
              {
                "type": "momentum",
                "value": 4,
                "note": "the base loves the fight"
              },
              {
                "type": "mediaBuzz",
                "value": 10,
                "note": "feeding-frenzy coverage"
              }
            ]
          },
          {
            "id": "b1_hot_mic_ignore",
            "label": "Say nothing and stay on message",
            "description": "Starve it of oxygen, hope it fades",
            "effects": [
              {
                "type": "regionLean",
                "value": -7,
                "selector": "strongest",
                "note": "insulted home region cools"
              },
              {
                "type": "scandalLevel",
                "value": 3,
                "note": "lingering unease"
              }
            ]
          }
        ]
      },
      {
        "id": "b1_intern_leaked_strategy",
        "title": "Leaked Strategy Memo",
        "category": "leaked-tape",
        "description": "An internal memo leaks showing you privately wrote off a swing region as 'unwinnable.' Voters there feel abandoned and reporters smell a story.",
        "triggerWeight": 6,
        "choices": [
          {
            "id": "b1_memo_recommit",
            "label": "Publicly recommit with a surprise visit",
            "description": "Win them back with cash and time",
            "effects": [
              {
                "type": "regionLean",
                "value": 9,
                "selector": "weakest",
                "note": "recommitment energizes the written-off region"
              },
              {
                "type": "funds",
                "value": -200,
                "note": "emergency travel and ads"
              },
              {
                "type": "actionPoints",
                "value": -2,
                "note": "a full day diverted"
              }
            ]
          },
          {
            "id": "b1_memo_spin",
            "label": "Frame it as 'tough prioritization'",
            "description": "Lean into discipline messaging",
            "effects": [
              {
                "type": "nationalApproval",
                "value": -3,
                "note": "reads as cold"
              },
              {
                "type": "momentum",
                "value": 3,
                "note": "pundits respect the focus"
              },
              {
                "type": "mediaBuzz",
                "value": 4,
                "note": "a debatable narrative"
              }
            ]
          },
          {
            "id": "b1_memo_blame",
            "label": "Fire the staffer and disavow the memo",
            "description": "Make a scapegoat, accept some scandal",
            "effects": [
              {
                "type": "scandalLevel",
                "value": 6,
                "note": "chaotic internal optics"
              },
              {
                "type": "volunteers",
                "value": -2,
                "note": "morale dips, some quit"
              },
              {
                "type": "opponentScandal",
                "value": 4,
                "note": "you muddy the waters somewhat"
              }
            ]
          }
        ]
      },
      {
        "id": "b1_dark_money_pac",
        "title": "Dark Money Windfall",
        "category": "fundraising-controversy",
        "description": "A shadowy super PAC offers to dump a fortune into ads on your behalf, but the donors are unsavory and the press is already asking questions.",
        "triggerWeight": 5,
        "choices": [
          {
            "id": "b1_pac_accept",
            "label": "Quietly welcome the support",
            "description": "Take the war chest, court the risk",
            "effects": [
              {
                "type": "funds",
                "value": 700,
                "note": "massive cash infusion"
              },
              {
                "type": "scandalLevel",
                "value": 10,
                "note": "donor scrutiny mounts"
              },
              {
                "type": "mediaBuzz",
                "value": 5,
                "note": "the money makes news"
              }
            ]
          },
          {
            "id": "b1_pac_reject",
            "label": "Loudly refuse the dirty money",
            "description": "Take the high road, bank the goodwill",
            "effects": [
              {
                "type": "nationalApproval",
                "value": 5,
                "note": "integrity plays well"
              },
              {
                "type": "momentum",
                "value": 4,
                "note": "a clean-hands narrative"
              },
              {
                "type": "opponentScandal",
                "value": 5,
                "note": "you imply they'd take it"
              }
            ]
          },
          {
            "id": "b1_pac_redirect",
            "label": "Steer them toward attacking the opponent",
            "description": "Keep your hands clean-ish, wound the rival",
            "effects": [
              {
                "type": "opponentMomentum",
                "value": -9,
                "note": "PAC attacks batter the rival"
              },
              {
                "type": "scandalLevel",
                "value": 5,
                "note": "coordination questions linger"
              },
              {
                "type": "opponentScandal",
                "value": 6,
                "note": "the rival gets dragged in too"
              }
            ]
          }
        ]
      },
      {
        "id": "b1_opp_oppo_dump",
        "title": "Opponent Drops Oppo File",
        "category": "opposition-attack",
        "description": "The opponent's campaign releases a damaging dossier on your business dealings the night before a big news cycle. It is half-true and entirely embarrassing.",
        "triggerWeight": 8,
        "choices": [
          {
            "id": "b1_oppo_counterpunch",
            "label": "Counterpunch with your own oppo",
            "description": "Mutually assured destruction",
            "effects": [
              {
                "type": "opponentScandal",
                "value": 12,
                "note": "you return fire hard"
              },
              {
                "type": "scandalLevel",
                "value": 7,
                "note": "the mud splashes back"
              },
              {
                "type": "opponentMomentum",
                "value": -6,
                "note": "they're on defense now"
              },
              {
                "type": "actionPoints",
                "value": -1,
                "note": "war-room time"
              }
            ]
          },
          {
            "id": "b1_oppo_transparency",
            "label": "Release everything proactively",
            "description": "Defuse it with radical transparency",
            "effects": [
              {
                "type": "scandalLevel",
                "value": -4,
                "note": "owning it disarms the attack"
              },
              {
                "type": "nationalApproval",
                "value": 2,
                "note": "voters respect candor"
              },
              {
                "type": "funds",
                "value": -150,
                "note": "crisis comms and legal review"
              }
            ]
          },
          {
            "id": "b1_oppo_ignore_pivot",
            "label": "Ignore it and flood the zone with policy",
            "description": "Change the subject with substance",
            "effects": [
              {
                "type": "scandalLevel",
                "value": 4,
                "note": "the story still simmers"
              },
              {
                "type": "regionLean",
                "value": 5,
                "selector": "mostVotes",
                "note": "a policy push lands in the big prize"
              },
              {
                "type": "mediaBuzz",
                "value": -3,
                "note": "you cede the cycle"
              }
            ]
          }
        ]
      },
      {
        "id": "b1_old_tweet_resurfaces",
        "title": "Decade-Old Posts Resurface",
        "category": "scandal",
        "description": "Opposition researchers unearth a thread of crude social posts from years ago. The content is ugly and the screenshots are spreading fast.",
        "triggerWeight": 7,
        "choices": [
          {
            "id": "b1_tweets_apologize",
            "label": "Apologize and call it growth",
            "description": "Contrition with a redemption arc",
            "effects": [
              {
                "type": "scandalLevel",
                "value": 6,
                "note": "a manageable hit"
              },
              {
                "type": "nationalApproval",
                "value": 2,
                "note": "a relatable arc for some"
              },
              {
                "type": "mediaBuzz",
                "value": 7,
                "note": "the story trends a day"
              }
            ]
          },
          {
            "id": "b1_tweets_context",
            "label": "Argue they're taken out of context",
            "description": "Defend the record, gamble on doubt",
            "effects": [
              {
                "type": "scandalLevel",
                "value": 11,
                "note": "the defense reads as denial"
              },
              {
                "type": "momentum",
                "value": 3,
                "note": "the base rallies"
              },
              {
                "type": "regionLean",
                "value": -5,
                "selector": "random",
                "note": "a contested region recoils"
              }
            ]
          },
          {
            "id": "b1_tweets_surrogate",
            "label": "Send a surrogate to absorb the heat",
            "description": "Spend allies' credibility, save your time",
            "effects": [
              {
                "type": "volunteers",
                "value": -1,
                "note": "allies stretched thin"
              },
              {
                "type": "scandalLevel",
                "value": 8,
                "note": "deflection only half-works"
              },
              {
                "type": "funds",
                "value": -100,
                "note": "surrogate travel and prep"
              }
            ]
          }
        ]
      },
      {
        "id": "b1_donor_dinner_quote",
        "title": "Closed-Door Donor Quote",
        "category": "leaked-tape",
        "description": "A recording from a private high-dollar dinner has you promising donors special access. The phrase 'pay to play' is already in every headline.",
        "triggerWeight": 6,
        "choices": [
          {
            "id": "b1_donor_disavow",
            "label": "Disavow and return the donations",
            "description": "Costly but cleansing",
            "effects": [
              {
                "type": "funds",
                "value": -500,
                "note": "refunding tainted checks"
              },
              {
                "type": "scandalLevel",
                "value": -6,
                "note": "decisive action calms press"
              },
              {
                "type": "nationalApproval",
                "value": 3,
                "note": "voters notice the sacrifice"
              }
            ]
          },
          {
            "id": "b1_donor_normalize",
            "label": "Insist it's just how politics works",
            "description": "Brazen it out, keep the cash",
            "effects": [
              {
                "type": "scandalLevel",
                "value": 9,
                "note": "cynicism backfires"
              },
              {
                "type": "funds",
                "value": 150,
                "note": "donors stay loyal"
              },
              {
                "type": "opponentMomentum",
                "value": 5,
                "note": "the rival pounces"
              }
            ]
          },
          {
            "id": "b1_donor_reform",
            "label": "Pivot to a campaign-finance reform pledge",
            "description": "Turn the scandal into a platform",
            "effects": [
              {
                "type": "momentum",
                "value": 6,
                "note": "a bold pivot energizes coverage"
              },
              {
                "type": "mediaBuzz",
                "value": 8,
                "note": "a striking narrative turn"
              },
              {
                "type": "scandalLevel",
                "value": 3,
                "note": "some still cry hypocrisy"
              }
            ]
          }
        ]
      },
      {
        "id": "b1_viral_misspeak",
        "title": "Viral Misspeak at Town Hall",
        "category": "gaffe",
        "description": "Your candidate badly garbles the name of a beloved local landmark and confuses two states on live TV. The clip is a meme within the hour.",
        "triggerWeight": 8,
        "choices": [
          {
            "id": "b1_misspeak_selfdeprecate",
            "label": "Lean in with self-deprecating humor",
            "description": "Make yourself in on the joke",
            "effects": [
              {
                "type": "mediaBuzz",
                "value": 9,
                "note": "a likable late-night moment"
              },
              {
                "type": "nationalApproval",
                "value": 3,
                "note": "humanizing"
              },
              {
                "type": "momentum",
                "value": 2,
                "note": "a small lift"
              }
            ]
          },
          {
            "id": "b1_misspeak_ignore",
            "label": "Plow ahead, never acknowledge it",
            "description": "Treat it as beneath you",
            "effects": [
              {
                "type": "regionLean",
                "value": -6,
                "selector": "random",
                "note": "the slighted locale sours"
              },
              {
                "type": "mediaBuzz",
                "value": 4,
                "note": "the clip circulates anyway"
              }
            ]
          },
          {
            "id": "b1_misspeak_overcorrect",
            "label": "Stage an elaborate landmark photo-op",
            "description": "Spend time and money to prove you care",
            "effects": [
              {
                "type": "regionLean",
                "value": 7,
                "selector": "random",
                "note": "a contested region warms"
              },
              {
                "type": "funds",
                "value": -130,
                "note": "production and travel"
              },
              {
                "type": "actionPoints",
                "value": -1,
                "note": "a half-day detour"
              }
            ]
          }
        ]
      },
      {
        "id": "b1_super_pac_attack_wave",
        "title": "Opponent Super PAC Air Assault",
        "category": "opposition-attack",
        "description": "A rival-aligned PAC carpet-bombs your two best swing regions with attack ads questioning your honesty. Your numbers there are sliding by the hour.",
        "triggerWeight": 7,
        "choices": [
          {
            "id": "b1_attack_matchspend",
            "label": "Match the spend ad-for-ad",
            "description": "Defend the map with cash",
            "effects": [
              {
                "type": "funds",
                "value": -450,
                "note": "a costly air war"
              },
              {
                "type": "regionLean",
                "value": 8,
                "selector": "strongest",
                "note": "you hold your best region"
              },
              {
                "type": "opponentMomentum",
                "value": -4,
                "note": "their wave is blunted"
              }
            ]
          },
          {
            "id": "b1_attack_groundgame",
            "label": "Counter with a volunteer door-knock surge",
            "description": "Answer the air war on the ground",
            "effects": [
              {
                "type": "regionLean",
                "value": 6,
                "selector": "mostVotes",
                "note": "ground game shores up the big prize"
              },
              {
                "type": "volunteers",
                "value": -2,
                "note": "you burn out organizers"
              },
              {
                "type": "nationalApproval",
                "value": 2,
                "note": "earnest grassroots optics"
              }
            ]
          },
          {
            "id": "b1_attack_judo",
            "label": "Run an ad mocking the PAC's billionaire backers",
            "description": "Turn their attack into your message",
            "effects": [
              {
                "type": "opponentScandal",
                "value": 8,
                "note": "their funders get exposed"
              },
              {
                "type": "momentum",
                "value": 4,
                "note": "a clever counter resonates"
              },
              {
                "type": "funds",
                "value": -160,
                "note": "the response ad buy"
              }
            ]
          }
        ]
      },
      {
        "id": "b1_charity_audit",
        "title": "Foundation Audit Goes Public",
        "category": "fundraising-controversy",
        "description": "An audit alleges your campaign foundation mingled charity money with political spending. It is murky, document-heavy, and irresistible to cable news.",
        "triggerWeight": 5,
        "choices": [
          {
            "id": "b1_audit_release",
            "label": "Release every record and invite scrutiny",
            "description": "Transparency to kill the story",
            "effects": [
              {
                "type": "actionPoints",
                "value": -2,
                "note": "days lost to document dumps"
              },
              {
                "type": "scandalLevel",
                "value": -5,
                "note": "openness defuses it"
              },
              {
                "type": "mediaBuzz",
                "value": 4,
                "note": "a brief flare of coverage"
              }
            ]
          },
          {
            "id": "b1_audit_lawyers",
            "label": "Stonewall behind a wall of lawyers",
            "description": "Run out the clock, eat the suspicion",
            "effects": [
              {
                "type": "funds",
                "value": -300,
                "note": "legal fees mount"
              },
              {
                "type": "scandalLevel",
                "value": 8,
                "note": "stonewalling looks guilty"
              },
              {
                "type": "momentum",
                "value": -3,
                "note": "the drag persists"
              }
            ]
          },
          {
            "id": "b1_audit_counteraccuse",
            "label": "Accuse the auditors of partisan bias",
            "description": "Discredit the source, energize the base",
            "effects": [
              {
                "type": "momentum",
                "value": 5,
                "note": "the base buys the framing"
              },
              {
                "type": "scandalLevel",
                "value": 5,
                "note": "neutral voters doubt you"
              },
              {
                "type": "opponentScandal",
                "value": 3,
                "note": "you sow some confusion"
              }
            ]
          }
        ]
      },
      {
        "id": "b1_staffer_misconduct",
        "title": "Senior Staffer Misconduct Scandal",
        "category": "scandal",
        "description": "A trusted campaign manager is credibly accused of serious misconduct. Reporters want to know what you knew and when.",
        "triggerWeight": 6,
        "choices": [
          {
            "id": "b1_staffer_fire",
            "label": "Fire them immediately and apologize to victims",
            "description": "Decisive, painful, principled",
            "effects": [
              {
                "type": "scandalLevel",
                "value": -3,
                "note": "swift action contains it"
              },
              {
                "type": "actionPoints",
                "value": -2,
                "note": "a leadership vacuum to fill"
              },
              {
                "type": "nationalApproval",
                "value": 3,
                "note": "voters reward accountability"
              }
            ]
          },
          {
            "id": "b1_staffer_defend",
            "label": "Stand by them pending 'due process'",
            "description": "Loyalty over optics",
            "effects": [
              {
                "type": "scandalLevel",
                "value": 11,
                "note": "perceived as protecting power"
              },
              {
                "type": "momentum",
                "value": 2,
                "note": "some praise the loyalty"
              },
              {
                "type": "volunteers",
                "value": -3,
                "note": "activists walk away disgusted"
              }
            ]
          },
          {
            "id": "b1_staffer_quietexit",
            "label": "Arrange a quiet resignation",
            "description": "Minimize noise, risk a cover-up story",
            "effects": [
              {
                "type": "scandalLevel",
                "value": 6,
                "note": "the hush looks evasive"
              },
              {
                "type": "mediaBuzz",
                "value": -2,
                "note": "you keep it low-key for now"
              },
              {
                "type": "funds",
                "value": -120,
                "note": "severance and NDAs"
              }
            ]
          }
        ]
      },
      {
        "id": "b1_opp_caught_lying",
        "title": "Opponent Caught in a Lie",
        "category": "opposition-attack",
        "description": "Fact-checkers catch your opponent fabricating a key biographical claim. The window to capitalize is short before they spin it away.",
        "triggerWeight": 6,
        "choices": [
          {
            "id": "b1_opplie_hammer",
            "label": "Hammer it with a national ad blitz",
            "description": "Spend big to make it stick",
            "effects": [
              {
                "type": "opponentScandal",
                "value": 14,
                "note": "the lie defines their week"
              },
              {
                "type": "opponentMomentum",
                "value": -8,
                "note": "they reel"
              },
              {
                "type": "funds",
                "value": -350,
                "note": "a saturation buy"
              }
            ]
          },
          {
            "id": "b1_opplie_restrained",
            "label": "Let the press carry it, stay presidential",
            "description": "Look above the fray, smaller wound",
            "effects": [
              {
                "type": "opponentScandal",
                "value": 6,
                "note": "the media does some work"
              },
              {
                "type": "nationalApproval",
                "value": 4,
                "note": "you look like the adult"
              },
              {
                "type": "momentum",
                "value": 3,
                "note": "a quiet lift"
              }
            ]
          },
          {
            "id": "b1_opplie_overreach",
            "label": "Tie it to a sweeping 'pattern of deceit' narrative",
            "description": "Go big, risk looking like you overreach",
            "effects": [
              {
                "type": "opponentScandal",
                "value": 9,
                "note": "the framing partly lands"
              },
              {
                "type": "scandalLevel",
                "value": 4,
                "note": "voters tire of negativity"
              },
              {
                "type": "mediaBuzz",
                "value": 7,
                "note": "a loud, contested cycle"
              }
            ]
          }
        ]
      },
      {
        "id": "b2_celebrity_endorsement",
        "title": "A-List Endorsement Offer",
        "category": "endorsement",
        "description": "A wildly popular entertainer wants to headline a rally for you, but their team is demanding you publicly back a divisive cause first. The optics could be electric, or radioactive.",
        "triggerWeight": 6,
        "choices": [
          {
            "id": "b2_celeb_embrace",
            "label": "Share the stage and back the cause",
            "description": "Buzz and momentum spike, but you pick up some scandal heat.",
            "effects": [
              {
                "type": "mediaBuzz",
                "value": 18
              },
              {
                "type": "momentum",
                "value": 8
              },
              {
                "type": "scandalLevel",
                "value": 6,
                "note": "the divisive cause draws fire"
              },
              {
                "type": "regionLean",
                "value": 6,
                "selector": "strongest",
                "note": "energizes your base region"
              }
            ]
          },
          {
            "id": "b2_celeb_quiet",
            "label": "Accept a low-key, apolitical event",
            "description": "Modest, clean buzz with a small fundraising bump.",
            "effects": [
              {
                "type": "mediaBuzz",
                "value": 6
              },
              {
                "type": "funds",
                "value": 250
              }
            ]
          },
          {
            "id": "b2_celeb_decline",
            "label": "Politely decline the whole thing",
            "description": "No upside, no risk; you keep your message disciplined.",
            "effects": [
              {
                "type": "nationalApproval",
                "value": 2,
                "note": "voters reward staying on-message"
              }
            ]
          }
        ]
      },
      {
        "id": "b2_rival_defector_endorses",
        "title": "Opponent's Ally Crosses Over",
        "category": "endorsement",
        "description": "A respected figure from your opponent's own coalition publicly breaks ranks and offers to endorse you. Your opponent's camp is scrambling.",
        "triggerWeight": 4,
        "choices": [
          {
            "id": "b2_defector_full",
            "label": "Stage a high-profile defection announcement",
            "description": "Wounds the opponent and earns big media, but they hit back.",
            "effects": [
              {
                "type": "opponentMomentum",
                "value": -10
              },
              {
                "type": "mediaBuzz",
                "value": 12
              },
              {
                "type": "opponentScandal",
                "value": 6
              },
              {
                "type": "scandalLevel",
                "value": 4,
                "note": "opponent paints it as a stunt"
              }
            ]
          },
          {
            "id": "b2_defector_quiet",
            "label": "Accept a quiet written endorsement",
            "description": "Steady approval gain with no blowback.",
            "effects": [
              {
                "type": "nationalApproval",
                "value": 5
              },
              {
                "type": "opponentMomentum",
                "value": -4
              }
            ]
          }
        ]
      },
      {
        "id": "b2_union_endorsement_strings",
        "title": "Labor Union Endorsement",
        "category": "endorsement",
        "description": "A major regional labor union dangles its endorsement and volunteer network, but they want commitments that will cost you elsewhere.",
        "triggerWeight": 5,
        "choices": [
          {
            "id": "b2_union_accept",
            "label": "Make the commitments and take the army",
            "description": "A surge of volunteers and ground strength.",
            "effects": [
              {
                "type": "volunteers",
                "value": 9
              },
              {
                "type": "regionLean",
                "value": 7,
                "selector": "mostVotes",
                "note": "union turnout in the biggest prize"
              },
              {
                "type": "nationalApproval",
                "value": -3,
                "note": "moderates wince at the concessions"
              }
            ]
          },
          {
            "id": "b2_union_hedge",
            "label": "Take the endorsement, dodge the promises",
            "description": "Smaller volunteer bump, but you keep credibility.",
            "effects": [
              {
                "type": "volunteers",
                "value": 4
              },
              {
                "type": "mediaBuzz",
                "value": 4
              }
            ]
          }
        ]
      },
      {
        "id": "b2_bold_policy_rollout",
        "title": "Signature Policy Rollout",
        "category": "policy-proposal",
        "description": "Your team has drafted a bold, sweeping policy plan. Going big could define the race, or hand the opponent a fat target.",
        "triggerWeight": 6,
        "choices": [
          {
            "id": "b2_policy_bold",
            "label": "Roll out the ambitious version",
            "description": "Big momentum and buzz, but it costs to message and invites attacks.",
            "effects": [
              {
                "type": "momentum",
                "value": 12
              },
              {
                "type": "mediaBuzz",
                "value": 14
              },
              {
                "type": "funds",
                "value": -200,
                "note": "rollout tour and materials"
              },
              {
                "type": "opponentMomentum",
                "value": 5,
                "note": "gives the opponent a counterpunch"
              }
            ]
          },
          {
            "id": "b2_policy_safe",
            "label": "Release a cautious, poll-tested version",
            "description": "Slow, durable approval gain with no exposure.",
            "effects": [
              {
                "type": "nationalApproval",
                "value": 6
              },
              {
                "type": "momentum",
                "value": 3
              }
            ]
          },
          {
            "id": "b2_policy_shelve",
            "label": "Shelve it and stay flexible",
            "description": "Bank the time; nothing changes.",
            "effects": [
              {
                "type": "actionPoints",
                "value": 1,
                "note": "freed-up staff time this week"
              }
            ]
          }
        ]
      },
      {
        "id": "b2_policy_leak_crisis",
        "title": "Leaked Draft Proposal",
        "category": "policy-proposal",
        "description": "An unfinished, controversial draft of one of your proposals has leaked to the press out of context. The phones are ringing off the hook.",
        "triggerWeight": 5,
        "choices": [
          {
            "id": "b2_leak_own",
            "label": "Own it and reframe on your terms",
            "description": "You spend to control the story and limit the damage.",
            "effects": [
              {
                "type": "funds",
                "value": -150
              },
              {
                "type": "scandalLevel",
                "value": 4
              },
              {
                "type": "mediaBuzz",
                "value": 8
              },
              {
                "type": "nationalApproval",
                "value": 2,
                "note": "decisiveness plays well"
              }
            ]
          },
          {
            "id": "b2_leak_disavow",
            "label": "Disavow the draft as not final",
            "description": "Cheaper, but looks evasive and bleeds a swing region.",
            "effects": [
              {
                "type": "scandalLevel",
                "value": 8
              },
              {
                "type": "regionLean",
                "value": -5,
                "selector": "weakest",
                "note": "wobbliest region sours"
              }
            ]
          }
        ]
      },
      {
        "id": "b2_jobs_report_boom",
        "title": "Surprise Economic Boom",
        "category": "economic-news",
        "description": "A blockbuster jobs and growth report just dropped. The incumbent climate suddenly feels optimistic, and everyone wants to know who gets the credit.",
        "triggerWeight": 6,
        "choices": [
          {
            "id": "b2_boom_claim",
            "label": "Claim credit aggressively",
            "description": "Strong momentum, but the opponent claims it too.",
            "effects": [
              {
                "type": "momentum",
                "value": 10
              },
              {
                "type": "nationalApproval",
                "value": 4
              },
              {
                "type": "opponentMomentum",
                "value": 4,
                "note": "opponent piggybacks the good news"
              }
            ]
          },
          {
            "id": "b2_boom_donors",
            "label": "Ride the optimism into a donor blitz",
            "description": "Donors love a winning climate; cash in.",
            "effects": [
              {
                "type": "funds",
                "value": 450
              },
              {
                "type": "mediaBuzz",
                "value": 4
              }
            ]
          }
        ]
      },
      {
        "id": "b2_market_crash",
        "title": "Market Tumble and Layoffs",
        "category": "economic-news",
        "description": "Markets just cratered and a major employer announced layoffs in a battleground region. Anxious voters are looking for steady leadership, or a scapegoat.",
        "triggerWeight": 5,
        "choices": [
          {
            "id": "b2_crash_blame",
            "label": "Pin it on the opponent",
            "description": "An attack that lands but raises your own temperature.",
            "effects": [
              {
                "type": "opponentMomentum",
                "value": -8
              },
              {
                "type": "opponentScandal",
                "value": 6
              },
              {
                "type": "scandalLevel",
                "value": 5,
                "note": "blowback from going negative on a crisis"
              },
              {
                "type": "regionLean",
                "value": 5,
                "selector": "random",
                "note": "message lands somewhere"
              }
            ]
          },
          {
            "id": "b2_crash_calm",
            "label": "Project calm, propose a relief plan",
            "description": "Approval rises; you spend to fund the plan's rollout.",
            "effects": [
              {
                "type": "nationalApproval",
                "value": 6
              },
              {
                "type": "funds",
                "value": -200
              },
              {
                "type": "regionLean",
                "value": 8,
                "selector": "weakest",
                "note": "the hardest-hit swing region responds"
              }
            ]
          },
          {
            "id": "b2_crash_ignore",
            "label": "Stay on your existing message",
            "description": "You look out of touch as the moment passes.",
            "effects": [
              {
                "type": "momentum",
                "value": -5
              },
              {
                "type": "nationalApproval",
                "value": -2
              }
            ]
          }
        ]
      },
      {
        "id": "b2_debate_curveball",
        "title": "Debate Night Curveball",
        "category": "debate-night",
        "description": "Mid-debate, the moderator throws you an unexpected, loaded question in front of a massive audience. The room goes quiet, waiting.",
        "triggerWeight": 7,
        "choices": [
          {
            "id": "b2_debate_swing",
            "label": "Swing for a viral knockout line",
            "description": "High risk, high reward in front of the whole country.",
            "effects": [
              {
                "type": "momentum",
                "value": 14
              },
              {
                "type": "mediaBuzz",
                "value": 16
              },
              {
                "type": "scandalLevel",
                "value": 8,
                "note": "the gamble can read as a cheap shot"
              },
              {
                "type": "opponentMomentum",
                "value": -6
              }
            ]
          },
          {
            "id": "b2_debate_pivot",
            "label": "Pivot smoothly to your strengths",
            "description": "Reliable, clean gains with no downside.",
            "effects": [
              {
                "type": "nationalApproval",
                "value": 5
              },
              {
                "type": "momentum",
                "value": 6
              },
              {
                "type": "mediaBuzz",
                "value": 8
              }
            ]
          },
          {
            "id": "b2_debate_honest",
            "label": "Give a candid, vulnerable answer",
            "description": "Wins trust but reads as weak to some.",
            "effects": [
              {
                "type": "nationalApproval",
                "value": 7
              },
              {
                "type": "momentum",
                "value": -3,
                "note": "pundits call it flat"
              }
            ]
          }
        ]
      },
      {
        "id": "b2_debate_gaffe",
        "title": "Debate Stage Stumble",
        "category": "debate-night",
        "description": "You flubbed a key fact on live television and the clip is already spreading. Your team is debating how to handle the morning-after spin.",
        "triggerWeight": 4,
        "choices": [
          {
            "id": "b2_gaffe_spend",
            "label": "Flood the zone with damage control",
            "description": "Expensive, but you smother the story fast.",
            "effects": [
              {
                "type": "funds",
                "value": -180
              },
              {
                "type": "scandalLevel",
                "value": -6
              },
              {
                "type": "mediaBuzz",
                "value": -4
              }
            ]
          },
          {
            "id": "b2_gaffe_joke",
            "label": "Lean in and laugh it off",
            "description": "Self-deprecation can win you goodwill, or backfire.",
            "effects": [
              {
                "type": "mediaBuzz",
                "value": 10
              },
              {
                "type": "nationalApproval",
                "value": 3
              },
              {
                "type": "scandalLevel",
                "value": 3,
                "note": "some say you're not taking it seriously"
              }
            ]
          }
        ]
      },
      {
        "id": "b2_townhall_protester",
        "title": "Town Hall Confrontation",
        "category": "town-hall",
        "description": "At a packed town hall, an angry constituent stands up and challenges you directly. Cameras swivel. How you respond will define the clip.",
        "triggerWeight": 6,
        "choices": [
          {
            "id": "b2_townhall_engage",
            "label": "Engage with empathy and patience",
            "description": "A warm, human moment that travels well.",
            "effects": [
              {
                "type": "nationalApproval",
                "value": 5
              },
              {
                "type": "mediaBuzz",
                "value": 8
              },
              {
                "type": "regionLean",
                "value": 6,
                "selector": "weakest",
                "note": "the local swing region warms to you"
              }
            ]
          },
          {
            "id": "b2_townhall_fire",
            "label": "Fire back hard",
            "description": "Rallies the base, alienates the middle.",
            "effects": [
              {
                "type": "momentum",
                "value": 6
              },
              {
                "type": "regionLean",
                "value": 5,
                "selector": "strongest",
                "note": "base loves the fight"
              },
              {
                "type": "nationalApproval",
                "value": -4
              },
              {
                "type": "scandalLevel",
                "value": 3
              }
            ]
          },
          {
            "id": "b2_townhall_volunteer",
            "label": "Turn the moment into a call to organize",
            "description": "Channels the energy into your ground game.",
            "effects": [
              {
                "type": "volunteers",
                "value": 5
              },
              {
                "type": "mediaBuzz",
                "value": 3
              }
            ]
          }
        ]
      },
      {
        "id": "b2_townhall_viral_moment",
        "title": "Town Hall Goes Viral",
        "category": "town-hall",
        "description": "A heartfelt exchange with a young voter at your town hall was caught on camera and is exploding online overnight. The energy is real, and so is the scrutiny.",
        "triggerWeight": 5,
        "choices": [
          {
            "id": "b2_viral_amplify",
            "label": "Pour resources into amplifying it",
            "description": "Spend to ride the wave nationwide.",
            "effects": [
              {
                "type": "funds",
                "value": -150
              },
              {
                "type": "mediaBuzz",
                "value": 16
              },
              {
                "type": "momentum",
                "value": 8
              },
              {
                "type": "regionLean",
                "value": 5,
                "selector": "all",
                "note": "a small national lift everywhere"
              }
            ]
          },
          {
            "id": "b2_viral_fundraise",
            "label": "Convert the moment into grassroots cash",
            "description": "Small-dollar donations and new volunteers pour in.",
            "effects": [
              {
                "type": "funds",
                "value": 350
              },
              {
                "type": "volunteers",
                "value": 4
              },
              {
                "type": "mediaBuzz",
                "value": 4
              }
            ]
          }
        ]
      },
      {
        "id": "b3_grassroots_doorstep_army",
        "title": "Doorstep Army Forms Overnight",
        "category": "grassroots-surge",
        "description": "A viral group chat has spontaneously organized hundreds of supporters who want to canvass this weekend. They are energized but disorganized, and they will lose steam fast if you do not give them direction.",
        "triggerWeight": 7,
        "choices": [
          {
            "id": "b3_grassroots_doorstep_army_embrace",
            "label": "Open the floodgates and absorb them all",
            "description": "Big volunteer surge, but coordinating them eats your week",
            "effects": [
              {
                "type": "volunteers",
                "value": 9,
                "note": "mass intake of new canvassers"
              },
              {
                "type": "actionPoints",
                "value": -1,
                "note": "staff time spent onboarding"
              }
            ]
          },
          {
            "id": "b3_grassroots_doorstep_army_focus",
            "label": "Point them at your best region",
            "description": "Immediate lean bump where you are already strongest, smaller pool",
            "effects": [
              {
                "type": "volunteers",
                "value": 3,
                "note": "the committed few stay on"
              },
              {
                "type": "regionLean",
                "value": 6,
                "selector": "strongest",
                "note": "concentrated door-knocking"
              }
            ]
          },
          {
            "id": "b3_grassroots_doorstep_army_ignore",
            "label": "Let it fizzle, stay on message",
            "description": "No disruption, but the moment and the goodwill evaporate",
            "effects": [
              {
                "type": "mediaBuzz",
                "value": -3,
                "note": "missed organic story"
              }
            ]
          }
        ]
      },
      {
        "id": "b3_grassroots_smalldollar_wave",
        "title": "Small-Dollar Donation Wave",
        "category": "grassroots-surge",
        "description": "A grassroots fundraising email written by a volunteer goes unexpectedly viral. Thousands of small donors are flooding in, but the campaign finance team is overwhelmed and the optics of how you handle the windfall matter.",
        "triggerWeight": 6,
        "choices": [
          {
            "id": "b3_grassroots_smalldollar_wave_bank",
            "label": "Bank every dollar quietly",
            "description": "Maximize the cash haul, nothing flashy",
            "effects": [
              {
                "type": "funds",
                "value": 600,
                "note": "small-dollar flood"
              }
            ]
          },
          {
            "id": "b3_grassroots_smalldollar_wave_amplify",
            "label": "Turn it into a national story",
            "description": "Less cash captured, but real momentum and buzz",
            "effects": [
              {
                "type": "funds",
                "value": 300,
                "note": "partial haul"
              },
              {
                "type": "momentum",
                "value": 8,
                "note": "people-powered narrative"
              },
              {
                "type": "mediaBuzz",
                "value": 6,
                "note": "underdog headlines"
              }
            ]
          }
        ]
      },
      {
        "id": "b3_viral_townhall_clip",
        "title": "Town Hall Clip Goes Viral",
        "category": "viral-moment",
        "description": "A candid, emotional answer you gave at a town hall is racing across social media. It is overwhelmingly positive, but a few seconds could be clipped out of context if your opponent pounces.",
        "triggerWeight": 8,
        "choices": [
          {
            "id": "b3_viral_townhall_clip_lean_in",
            "label": "Lean all the way in, cut an ad from it",
            "description": "Huge buzz and momentum, but you expose the risky clip",
            "effects": [
              {
                "type": "mediaBuzz",
                "value": 14,
                "note": "everyone is sharing it"
              },
              {
                "type": "momentum",
                "value": 9,
                "note": "authentic moment lands"
              },
              {
                "type": "scandalLevel",
                "value": 4,
                "note": "opponent clips it out of context"
              }
            ]
          },
          {
            "id": "b3_viral_townhall_clip_let_ride",
            "label": "Let it ride organically",
            "description": "Modest, clean gains with no blowback",
            "effects": [
              {
                "type": "mediaBuzz",
                "value": 6,
                "note": "steady organic spread"
              },
              {
                "type": "nationalApproval",
                "value": 2,
                "note": "warmth without overexposure"
              }
            ]
          }
        ]
      },
      {
        "id": "b3_viral_opponent_meme",
        "title": "An Opponent Gaffe Becomes a Meme",
        "category": "viral-moment",
        "description": "Your opponent flubbed a line badly and the internet will not let it go. The meme is doing your work for you, but piling on personally could look like bullying.",
        "triggerWeight": 6,
        "choices": [
          {
            "id": "b3_viral_opponent_meme_pileon",
            "label": "Quietly amplify it through surrogates",
            "description": "Wound the opponent, small risk it traces back to you",
            "effects": [
              {
                "type": "opponentMomentum",
                "value": -8,
                "note": "opponent rattled"
              },
              {
                "type": "opponentScandal",
                "value": 6,
                "note": "the clip sticks"
              },
              {
                "type": "scandalLevel",
                "value": 3,
                "note": "looks like dirty tricks"
              }
            ]
          },
          {
            "id": "b3_viral_opponent_meme_highroad",
            "label": "Take the high road publicly",
            "description": "Approval bump for graciousness, opponent still dinged a little",
            "effects": [
              {
                "type": "nationalApproval",
                "value": 4,
                "note": "voters reward restraint"
              },
              {
                "type": "opponentMomentum",
                "value": -3,
                "note": "opponent still off-footing"
              }
            ]
          },
          {
            "id": "b3_viral_opponent_meme_ignore",
            "label": "Stay focused on your own message",
            "description": "No effect, you keep your discipline",
            "effects": [
              {
                "type": "regionLean",
                "value": 0,
                "selector": "none",
                "note": "no engagement"
              }
            ]
          }
        ]
      },
      {
        "id": "b3_disaster_hurricane_response",
        "title": "Hurricane Slams a Swing Region",
        "category": "natural-disaster-response",
        "description": "A major hurricane has devastated one of the most electoral-rich states on the map. The nation is watching how every candidate responds. Compassion plays well, but a misstep looks like exploitation.",
        "triggerWeight": 7,
        "choices": [
          {
            "id": "b3_disaster_hurricane_response_boots",
            "label": "Suspend the campaign and send volunteers to help",
            "description": "Costs you a beat, but earns deep goodwill where it counts most",
            "effects": [
              {
                "type": "regionLean",
                "value": 9,
                "selector": "mostVotes",
                "note": "boots on the ground in the disaster zone"
              },
              {
                "type": "nationalApproval",
                "value": 4,
                "note": "selfless leadership"
              },
              {
                "type": "actionPoints",
                "value": -1,
                "note": "week diverted to relief"
              }
            ]
          },
          {
            "id": "b3_disaster_hurricane_response_donate",
            "label": "Make a large relief donation from the war chest",
            "description": "Buys goodwill with money instead of time",
            "effects": [
              {
                "type": "funds",
                "value": -350,
                "note": "relief fund donation"
              },
              {
                "type": "mediaBuzz",
                "value": 6,
                "note": "covered widely"
              },
              {
                "type": "nationalApproval",
                "value": 3,
                "note": "seen as generous"
              }
            ]
          },
          {
            "id": "b3_disaster_hurricane_response_photoop",
            "label": "Do a quick photo-op tour",
            "description": "Cheap buzz, but risks looking opportunistic",
            "effects": [
              {
                "type": "mediaBuzz",
                "value": 8,
                "note": "dramatic footage"
              },
              {
                "type": "scandalLevel",
                "value": 6,
                "note": "accused of exploiting tragedy"
              }
            ]
          }
        ]
      },
      {
        "id": "b3_disaster_wildfire_relief",
        "title": "Wildfires and a Relief Vote",
        "category": "natural-disaster-response",
        "description": "Wildfires are spreading through a region leaning your way, and emergency funding is stalled in a partisan fight. Your team can broker a deal, but it means publicly working with the other side.",
        "triggerWeight": 5,
        "choices": [
          {
            "id": "b3_disaster_wildfire_relief_bipartisan",
            "label": "Broker a bipartisan relief deal",
            "description": "Statesmanlike approval gain, but it also lifts your opponent",
            "effects": [
              {
                "type": "nationalApproval",
                "value": 6,
                "note": "credited as a dealmaker"
              },
              {
                "type": "opponentMomentum",
                "value": 4,
                "note": "opponent shares the credit"
              }
            ]
          },
          {
            "id": "b3_disaster_wildfire_relief_blame",
            "label": "Blame the opponent for the holdup",
            "description": "Wounds the opponent but you take some blowback for politicizing it",
            "effects": [
              {
                "type": "opponentScandal",
                "value": 8,
                "note": "tagged as obstructionist"
              },
              {
                "type": "scandalLevel",
                "value": 4,
                "note": "criticized for playing politics with a crisis"
              }
            ]
          }
        ]
      },
      {
        "id": "b3_foreign_hostage_crisis",
        "title": "Overseas Hostage Crisis",
        "category": "foreign-policy-crisis",
        "description": "Citizens have been taken hostage abroad and the country is anxious. Voters want strength and steadiness. Your every word will be parsed for fitness to lead on the world stage.",
        "triggerWeight": 6,
        "choices": [
          {
            "id": "b3_foreign_hostage_crisis_statesman",
            "label": "Deliver a sober, presidential address",
            "description": "Approval and momentum if it lands, but you must stake out a position",
            "effects": [
              {
                "type": "nationalApproval",
                "value": 5,
                "note": "looks like a commander-in-chief"
              },
              {
                "type": "momentum",
                "value": 5,
                "note": "rally-around-the-flag"
              },
              {
                "type": "mediaBuzz",
                "value": 4,
                "note": "wall-to-wall coverage"
              }
            ]
          },
          {
            "id": "b3_foreign_hostage_crisis_hawk",
            "label": "Demand aggressive action now",
            "description": "Big momentum spike, but a reckless tone raises scandal risk",
            "effects": [
              {
                "type": "momentum",
                "value": 9,
                "note": "the base loves the toughness"
              },
              {
                "type": "scandalLevel",
                "value": 7,
                "note": "criticized as dangerously reckless"
              }
            ]
          },
          {
            "id": "b3_foreign_hostage_crisis_defer",
            "label": "Defer to the experts and say little",
            "description": "Safe but forgettable, opponent fills the vacuum",
            "effects": [
              {
                "type": "opponentMomentum",
                "value": 5,
                "note": "opponent looks bolder by comparison"
              }
            ]
          }
        ]
      },
      {
        "id": "b3_foreign_trade_shock",
        "title": "Sudden Trade War Shock",
        "category": "foreign-policy-crisis",
        "description": "A rival nation has slapped tariffs on a key industry concentrated in a swing region, and layoffs loom. Workers there are scared and looking for someone with a plan.",
        "triggerWeight": 5,
        "choices": [
          {
            "id": "b3_foreign_trade_shock_protect",
            "label": "Promise sweeping protections for the region",
            "description": "Strong lean gain there, but markets and donors get nervous",
            "effects": [
              {
                "type": "regionLean",
                "value": 10,
                "selector": "weakest",
                "note": "directly addresses the threatened workers"
              },
              {
                "type": "funds",
                "value": -200,
                "note": "spooked donors pull back"
              }
            ]
          },
          {
            "id": "b3_foreign_trade_shock_freetrade",
            "label": "Defend free trade and the long game",
            "description": "Approval with the donor class, but it stings in the hurt region",
            "effects": [
              {
                "type": "nationalApproval",
                "value": 3,
                "note": "credited as principled"
              },
              {
                "type": "funds",
                "value": 250,
                "note": "business donors reward you"
              },
              {
                "type": "regionLean",
                "value": -5,
                "selector": "weakest",
                "note": "workers feel abandoned"
              }
            ]
          }
        ]
      },
      {
        "id": "b3_wildcard_oppo_dossier",
        "title": "An Anonymous Dossier Lands",
        "category": "wildcard",
        "description": "A plain envelope arrives containing unverified but explosive allegations about your opponent. Using it could be devastating, but if the sourcing falls apart it lands on you.",
        "triggerWeight": 7,
        "choices": [
          {
            "id": "b3_wildcard_oppo_dossier_leak",
            "label": "Leak it to a friendly reporter",
            "description": "High-variance: big damage to the opponent, real blowback risk to you",
            "effects": [
              {
                "type": "opponentScandal",
                "value": 14,
                "note": "allegations dominate coverage"
              },
              {
                "type": "opponentMomentum",
                "value": -6,
                "note": "opponent thrown off message"
              },
              {
                "type": "scandalLevel",
                "value": 9,
                "note": "fingerprints traced back to you"
              }
            ]
          },
          {
            "id": "b3_wildcard_oppo_dossier_verify",
            "label": "Hand it to your oppo team to verify first",
            "description": "Slower and costlier, but cleaner if it pans out",
            "effects": [
              {
                "type": "funds",
                "value": -120,
                "note": "investigators on retainer"
              },
              {
                "type": "opponentScandal",
                "value": 6,
                "note": "only the verifiable parts surface"
              }
            ]
          },
          {
            "id": "b3_wildcard_oppo_dossier_burn",
            "label": "Burn it and walk away",
            "description": "Clean hands, modest approval if it ever comes out you declined",
            "effects": [
              {
                "type": "nationalApproval",
                "value": 2,
                "note": "integrity quietly pays off"
              }
            ]
          }
        ]
      },
      {
        "id": "b3_wildcard_running_mate_flap",
        "title": "Running Mate Goes Off-Script",
        "category": "wildcard",
        "description": "Your running mate gave an unscripted interview that is generating headlines. Half the team thinks it was refreshingly honest, the other half is in damage-control mode.",
        "triggerWeight": 5,
        "choices": [
          {
            "id": "b3_wildcard_running_mate_flap_defend",
            "label": "Publicly back them, no apology",
            "description": "Buzz and momentum, but you absorb the controversy",
            "effects": [
              {
                "type": "mediaBuzz",
                "value": 9,
                "note": "loyalty story"
              },
              {
                "type": "momentum",
                "value": 4,
                "note": "base energized by the candor"
              },
              {
                "type": "scandalLevel",
                "value": 5,
                "note": "you now own the remarks"
              }
            ]
          },
          {
            "id": "b3_wildcard_running_mate_flap_walkback",
            "label": "Quietly walk it back and clarify",
            "description": "Limits the damage, but looks like a stumble",
            "effects": [
              {
                "type": "scandalLevel",
                "value": -2,
                "note": "tamped down quickly"
              },
              {
                "type": "momentum",
                "value": -3,
                "note": "ticket looks shaky"
              }
            ]
          }
        ]
      },
      {
        "id": "b3_ground_union_endorsement",
        "title": "Major Union Offers Its Field Operation",
        "category": "ground-game-boost",
        "description": "A powerful labor union wants to endorse you and lend its battle-tested field staff. They will move bodies in droves, but they expect policy commitments and will own a piece of your message.",
        "triggerWeight": 7,
        "choices": [
          {
            "id": "b3_ground_union_endorsement_accept",
            "label": "Accept the full endorsement and field army",
            "description": "Huge volunteer and ground gains, costs you some independent-minded voters",
            "effects": [
              {
                "type": "volunteers",
                "value": 10,
                "note": "union field operation deployed"
              },
              {
                "type": "regionLean",
                "value": 6,
                "selector": "mostVotes",
                "note": "organized labor turns out the big state"
              },
              {
                "type": "nationalApproval",
                "value": -2,
                "note": "tagged as captured by special interests"
              }
            ]
          },
          {
            "id": "b3_ground_union_endorsement_armslength",
            "label": "Take the endorsement, keep distance on policy",
            "description": "Modest help with no strings, but the union holds back its A-team",
            "effects": [
              {
                "type": "volunteers",
                "value": 4,
                "note": "limited staff loaned"
              },
              {
                "type": "mediaBuzz",
                "value": 3,
                "note": "endorsement covered"
              }
            ]
          },
          {
            "id": "b3_ground_union_endorsement_decline",
            "label": "Politely decline to stay independent",
            "description": "Preserve your brand, gain approval, but pass on the ground muscle",
            "effects": [
              {
                "type": "nationalApproval",
                "value": 4,
                "note": "praised as your own person"
              }
            ]
          }
        ]
      },
      {
        "id": "b3_ground_campus_chapters",
        "title": "Campus Chapters Catch Fire",
        "category": "ground-game-boost",
        "description": "Student volunteer chapters are sprouting on campuses nationwide. They are cheap, tireless, and idealistic, but they want a candidate who will show up and take a few bold stances.",
        "triggerWeight": 6,
        "choices": [
          {
            "id": "b3_ground_campus_chapters_invest",
            "label": "Send staff to formalize the chapters",
            "description": "Strong, durable volunteer growth for a bit of cash and time",
            "effects": [
              {
                "type": "volunteers",
                "value": 7,
                "note": "campus organizers trained up"
              },
              {
                "type": "funds",
                "value": -90,
                "note": "organizing materials and travel"
              }
            ]
          },
          {
            "id": "b3_ground_campus_chapters_rally",
            "label": "Headline a big campus rally",
            "description": "Volunteers plus a buzz and momentum spike, small gaffe risk",
            "effects": [
              {
                "type": "volunteers",
                "value": 4,
                "note": "rally signs up new bodies"
              },
              {
                "type": "momentum",
                "value": 6,
                "note": "youth energy surge"
              },
              {
                "type": "mediaBuzz",
                "value": 5,
                "note": "viral crowd shots"
              },
              {
                "type": "scandalLevel",
                "value": 3,
                "note": "an edgy applause line backfires"
              }
            ]
          }
        ]
      }
    ],
    // MODDABLE causal-network model — read by src/engine.js as Data.network.
    // Edit issues, voter segments, their size (share of electorate), baseLean
    // (starting tilt: +player / -opponent) and the signed issue->segment weights;
    // the simulation, the "Push an Issue" lever and the Network view all follow
    // from this data with no engine changes. Add a segment or issue and it just
    // works. issueWeightK scales how hard issues move segment support.
    "network": {
      "issueWeightK": 0.3,
      "issues": [
        { "id": "economy", "name": "The Economy" },
        { "id": "culture", "name": "Culture War" },
        { "id": "healthcare", "name": "Healthcare" },
        { "id": "immigration", "name": "Immigration" },
        { "id": "climate", "name": "Climate" }
      ],
      "segments": [
        { "id": "union_halls",       "name": "Union Halls",       "size": 0.16, "baseLean":  10, "w": { "economy": 0.8, "healthcare": 0.5, "culture": -0.2, "immigration": 0.1, "climate": 0.2 } },
        { "id": "suburban_strivers", "name": "Suburban Strivers", "size": 0.22, "baseLean":   0, "w": { "economy": 0.6, "healthcare": 0.3, "culture": -0.3, "immigration": -0.2, "climate": 0.2 } },
        { "id": "faith_family",      "name": "Faith & Family",    "size": 0.16, "baseLean": -12, "w": { "culture": 0.7, "economy": 0.3, "immigration": 0.4, "climate": -0.2 } },
        { "id": "very_online",       "name": "The Very Online",   "size": 0.12, "baseLean":   6, "w": { "culture": 0.5, "climate": 0.5, "economy": 0.1, "healthcare": 0.2 } },
        { "id": "diner_regulars",    "name": "Diner Regulars",    "size": 0.20, "baseLean":  -4, "w": { "economy": 0.7, "immigration": 0.3, "culture": 0.1, "climate": -0.3 } },
        { "id": "megadonors",        "name": "Megadonors",        "size": 0.04, "baseLean":   0, "w": { "economy": 0.9, "climate": -0.4 } }
      ]
    }
  };
});
