/**
 * The dilemma deck — weekly choice events, authored as pure data (Democracy-style: each one is a
 * trade-off between things you want, never a free lunch). Risks are seeded rolls mitigated by a
 * candidate attribute, so the same dilemma plays differently for different builds.
 */
import type { DilemmaDef } from '../../engine/campaign/dilemmas'

const USD = (d: number): number => Math.round(d * 100)

export const DILEMMAS: readonly DilemmaDef[] = [
  {
    id: 'debate_invite',
    title: 'The Debate Invitation',
    prompt:
      'The local station wants a televised debate. Your opponent already said yes. An empty podium makes its own headlines.',
    weight: 1.4,
    minWeek: 2,
    options: [
      {
        id: 'accept',
        label: 'Take the stage',
        blurb: 'Big exposure either way. Charisma decides whether it becomes a highlight reel or a blooper reel.',
        consequence: {
          effects: [
            { channel: 'nameRecognition', target: 'self', magnitude: 0.4, rampDurationDays: 2, decayHalfLifeDays: 28 },
            { channel: 'favorability', target: 'self', magnitude: 0.05, rampDurationDays: 2, decayHalfLifeDays: 21, tone: 0.4 },
          ],
        },
        risk: {
          chance: 0.55,
          mitigatedBy: 'charisma',
          onFail: {
            effects: [
              { channel: 'favorability', target: 'self', magnitude: -0.08, rampDurationDays: 2, decayHalfLifeDays: 18, tone: -0.5 },
            ],
          },
          failText: 'You froze on the follow-up. The clip is everywhere.',
        },
        resultText: 'You held the stage. Clips of your closer are doing numbers.',
      },
      {
        id: 'decline',
        label: 'Decline politely',
        blurb: 'No risk — and your opponent gets the airtime to themselves.',
        consequence: {
          effects: [
            { channel: 'nameRecognition', target: 'opponent', magnitude: 0.3, rampDurationDays: 2, decayHalfLifeDays: 25 },
          ],
        },
        resultText: 'You skipped the debate. Your opponent enjoyed the free airtime.',
      },
    ],
    defaultOptionId: 'decline',
  },
  {
    id: 'old_column',
    title: 'The Old Op-Ed',
    prompt:
      'A blogger unearths a spicy column you wrote years ago. It reads badly out of context — and worse in context.',
    weight: 1.2,
    options: [
      {
        id: 'own_it',
        label: 'Own it',
        blurb: 'Apologize on camera. Takes the sting out, costs some shine.',
        consequence: {
          scandal: { target: 'self', amount: 0.06 },
          effects: [
            { channel: 'favorability', target: 'self', magnitude: 0.03, rampDurationDays: 3, decayHalfLifeDays: 20, tone: 0.3 },
          ],
        },
        resultText: 'You owned it before it owned you. The story died by Friday.',
      },
      {
        id: 'deny',
        label: 'Call it a smear',
        blurb: 'Deny everything and hope no one checks the archive. Integrity keeps the receipts buried.',
        consequence: {},
        risk: {
          chance: 0.65,
          mitigatedBy: 'integrity',
          onFail: { scandal: { target: 'self', amount: 0.18 } },
          failText: 'The archive checked out. "CANDIDATE LIED" leads the evening news.',
        },
        resultText: 'The denial held. Nobody found the microfiche.',
      },
    ],
    defaultOptionId: 'own_it',
  },
  {
    id: 'megadonor',
    title: 'The Quiet Lunch',
    prompt:
      'A developer with business before the county offers a very large check and asks only for "a friend in office."',
    weight: 1.1,
    options: [
      {
        id: 'take_it',
        label: 'Take the check',
        blurb: 'A war chest doesn’t ask where money sleeps. Reporters do.',
        consequence: { cashDelta: USD(60_000) },
        risk: {
          chance: 0.45,
          mitigatedBy: 'competence',
          onFail: { scandal: { target: 'self', amount: 0.15 } },
          failText: 'The donation hit the filings the same week his permit did. Ouch.',
        },
        resultText: 'The check cleared quietly. For now, anyway.',
      },
      {
        id: 'refuse',
        label: 'Refuse — loudly',
        blurb: 'Turn it into a purity story.',
        consequence: {
          effects: [
            { channel: 'favorability', target: 'self', magnitude: 0.05, rampDurationDays: 3, decayHalfLifeDays: 24, tone: 0.6 },
          ],
        },
        resultText: '"The candidate who said no" plays well on the doorsteps.',
      },
    ],
    defaultOptionId: 'refuse',
  },
  {
    id: 'union_endorsement',
    title: 'The Union Hall',
    prompt:
      'The trades council offers its endorsement and its phone banks — if you commit, publicly and in writing, to their tax-and-spend plank.',
    weight: 1.1,
    options: [
      {
        id: 'sign',
        label: 'Sign the pledge',
        blurb: 'Their turnout machine becomes yours. Your platform moves whether you like it or not.',
        consequence: {
          positionShifts: [{ issueId: 'taxes_spending', delta: 0.3 }],
          effects: [
            { channel: 'turnout', target: 'self', magnitude: 0.02, rampDurationDays: 7, decayHalfLifeDays: null },
            { channel: 'favorability', target: 'self', magnitude: 0.04, rampDurationDays: 3, decayHalfLifeDays: 30, tone: 0.5 },
          ],
        },
        resultText: 'Ink dry, phone banks warm. Your tax position just moved left.',
      },
      {
        id: 'pass',
        label: 'Stay unbought',
        blurb: 'Keep the platform yours.',
        consequence: {},
        resultText: 'No pledge, no phone banks. Your platform stays your own.',
      },
    ],
    defaultOptionId: 'pass',
  },
  {
    id: 'opp_gaffe',
    title: 'The Hot Mic',
    prompt:
      'Your opponent got caught insulting half the district on a hot mic. The clip is radioactive. How hard do you swing?',
    weight: 1.2,
    minWeek: 3,
    options: [
      {
        id: 'pounce',
        label: 'Cut an ad tonight',
        blurb: 'Maximum damage while it’s hot — going negative always splashes back a little.',
        consequence: {
          cashDelta: USD(-8_000),
          effects: [
            { channel: 'favorability', target: 'opponent', magnitude: -0.12, rampDurationDays: 3, decayHalfLifeDays: 21, tone: -0.7 },
            { channel: 'favorability', target: 'self', magnitude: -0.02, rampDurationDays: 3, decayHalfLifeDays: 14, tone: -0.7 },
          ],
        },
        resultText: 'The ad ran before their apology did. Brutal.',
      },
      {
        id: 'classy',
        label: 'Take the high road',
        blurb: 'Let the clip do its own work and pocket the contrast.',
        consequence: {
          effects: [
            { channel: 'favorability', target: 'opponent', magnitude: -0.05, rampDurationDays: 4, decayHalfLifeDays: 18, tone: -0.3 },
            { channel: 'favorability', target: 'self', magnitude: 0.04, rampDurationDays: 4, decayHalfLifeDays: 24, tone: 0.6 },
          ],
        },
        resultText: '"I’ll let the voters judge" — dignified, and devastating.',
      },
    ],
    defaultOptionId: 'classy',
  },
  {
    id: 'viral_moment',
    title: 'The Clip',
    prompt:
      'A volunteer filmed you helping push a stalled school bus out of an intersection. It’s blowing up. Lean in, or stay on message?',
    weight: 1.0,
    options: [
      {
        id: 'lean_in',
        label: 'Ride the wave',
        blurb: 'Morning shows, memes, the lot. Huge exposure, thin substance.',
        consequence: {
          effects: [
            { channel: 'nameRecognition', target: 'self', magnitude: 0.55, rampDurationDays: 3, decayHalfLifeDays: 18 },
          ],
        },
        resultText: 'You did the morning shows. Everyone knows the bus candidate now.',
      },
      {
        id: 'on_message',
        label: 'Stay on message',
        blurb: 'A smaller, steadier warm glow.',
        consequence: {
          effects: [
            { channel: 'favorability', target: 'self', magnitude: 0.05, rampDurationDays: 4, decayHalfLifeDays: 30, tone: 0.6 },
          ],
        },
        resultText: 'No victory lap — and voters noticed that too.',
      },
    ],
    defaultOptionId: 'on_message',
  },
  {
    id: 'heckler',
    title: 'The Town Hall Heckler',
    prompt:
      'Ten minutes into your town hall, a heckler with a following starts filming. Security looks at you. The room looks at you.',
    weight: 1.0,
    minWeek: 2,
    options: [
      {
        id: 'engage',
        label: 'Work the room',
        blurb: 'Turn the moment. Charisma makes it a mic-drop; without it, a meltdown.',
        consequence: {},
        risk: {
          chance: 0.6,
          mitigatedBy: 'charisma',
          onFail: {
            effects: [
              { channel: 'favorability', target: 'self', magnitude: -0.06, rampDurationDays: 2, decayHalfLifeDays: 16, tone: -0.4 },
            ],
          },
          failText: 'You lost your temper on camera. The supercut is unkind.',
        },
        resultText: 'You let him talk, then took him apart politely. The room stood up.',
      },
      {
        id: 'ignore',
        label: 'Have him escorted out',
        blurb: 'Clean, quick, and a little cold.',
        consequence: {
          effects: [
            { channel: 'favorability', target: 'self', magnitude: -0.02, rampDurationDays: 2, decayHalfLifeDays: 12, tone: -0.2 },
          ],
        },
        resultText: 'Security walked him out. The moment passed, mostly.',
      },
    ],
    defaultOptionId: 'ignore',
  },
  {
    id: 'national_party',
    title: 'The Call from Washington',
    prompt:
      'The national committee offers serious money — if you adopt their national platform lines on healthcare and climate. Word for word.',
    weight: 1.0,
    minWeek: 2,
    options: [
      {
        id: 'take_money',
        label: 'Take the package',
        blurb: 'Money now, message discipline forever.',
        consequence: {
          cashDelta: USD(45_000),
          positionShifts: [
            { issueId: 'healthcare', delta: 0.25 },
            { issueId: 'climate_energy', delta: 0.25 },
          ],
        },
        resultText: 'The wire hit. So did the talking points memo.',
      },
      {
        id: 'stay_local',
        label: 'Run your own race',
        blurb: 'Keep the platform local and pocket the independence story.',
        consequence: {
          effects: [
            { channel: 'favorability', target: 'self', magnitude: 0.04, rampDurationDays: 4, decayHalfLifeDays: 26, tone: 0.5 },
          ],
        },
        resultText: '"Nobody in Washington writes my speeches." Good line. Cheaper than it sounds.',
      },
    ],
    defaultOptionId: 'stay_local',
  },
  {
    id: 'oppo_dossier',
    title: 'The Manila Envelope',
    prompt:
      'An unmarked envelope of genuine, damaging oppo research on your opponent lands with your campaign. Nobody saw who left it.',
    weight: 0.9,
    minWeek: 3,
    options: [
      {
        id: 'leak',
        label: 'Leak it',
        blurb: 'Devastating if it sticks. Career-ending if it traces back.',
        consequence: {
          scandal: { target: 'opponent', amount: 0.15 },
        },
        risk: {
          chance: 0.4,
          mitigatedBy: 'competence',
          onFail: { scandal: { target: 'self', amount: 0.12 } },
          failText: 'A reporter traced the leak to your comms shop. Now it’s YOUR scandal too.',
        },
        resultText: 'The story ran under someone else’s byline. Their week just got very bad.',
      },
      {
        id: 'shred',
        label: 'Shred it',
        blurb: 'Sleep well. Win or lose.',
        consequence: {
          effects: [
            { channel: 'favorability', target: 'self', magnitude: 0.02, rampDurationDays: 5, decayHalfLifeDays: 30, tone: 0.3 },
          ],
        },
        resultText: 'The shredder ate well. Somehow, the press heard you passed — respect.',
      },
    ],
    defaultOptionId: 'shred',
  },
  {
    id: 'volunteer_surge',
    title: 'The Saturday Surge',
    prompt:
      'Sixty new volunteers showed up at HQ this morning. Your field director can burn them out this week or build them into something.',
    weight: 0.9,
    minWeek: 2,
    options: [
      {
        id: 'blitz',
        label: 'Blitz this week',
        blurb: 'An extra action this week while the energy is hot.',
        consequence: { apDelta: 1 },
        resultText: 'Clipboards for everyone. The week suddenly has more hours in it.',
      },
      {
        id: 'build',
        label: 'Train them properly',
        blurb: 'A slower payoff: a lasting turnout operation.',
        consequence: {
          effects: [
            { channel: 'turnout', target: 'self', magnitude: 0.015, rampDurationDays: 14, decayHalfLifeDays: null },
          ],
        },
        resultText: 'Two weekends of training now, a machine on election day.',
      },
    ],
    defaultOptionId: 'blitz',
  },
  {
    id: 'local_paper',
    title: 'The Editorial Board',
    prompt:
      'The county paper offers a sit-down before making its endorsement. Ninety unscripted minutes with people who’ve read your filings.',
    weight: 1.0,
    minWeek: 2,
    options: [
      {
        id: 'sit_down',
        label: 'Take the meeting',
        blurb: 'Competence carries the room; bluffing does not.',
        consequence: {
          effects: [
            { channel: 'favorability', target: 'self', magnitude: 0.06, rampDurationDays: 4, decayHalfLifeDays: 30, tone: 0.5 },
          ],
        },
        risk: {
          chance: 0.5,
          mitigatedBy: 'competence',
          onFail: {
            effects: [
              { channel: 'favorability', target: 'self', magnitude: -0.07, rampDurationDays: 3, decayHalfLifeDays: 20, tone: -0.4 },
            ],
          },
          failText: 'They asked about the budget line you hadn’t read. The endorsement went elsewhere — pointedly.',
        },
        resultText: 'The endorsement ran Sunday, above the fold.',
      },
      {
        id: 'skip',
        label: 'Send regrets',
        blurb: 'No endorsement, no ambush.',
        consequence: {},
        resultText: 'The paper endorsed no one, with a paragraph about candidates "too busy for scrutiny."',
      },
    ],
    defaultOptionId: 'skip',
  },
  {
    id: 'gas_spike',
    title: 'Pain at the Pump',
    prompt:
      'Gas jumped forty cents overnight and every microphone in the district wants your plan by Friday.',
    weight: 1.0,
    minWeek: 3,
    options: [
      {
        id: 'populist',
        label: 'Demand a tax holiday',
        blurb: 'Crowd-pleaser now; your taxes position edges right and the wonks groan.',
        consequence: {
          positionShifts: [{ issueId: 'taxes_spending', delta: -0.15 }],
          effects: [
            { channel: 'favorability', target: 'self', magnitude: 0.05, rampDurationDays: 3, decayHalfLifeDays: 18, tone: 0.4 },
          ],
        },
        resultText: '"Suspend the gas tax NOW" — the chyron writes itself.',
      },
      {
        id: 'wonk',
        label: 'Explain the supply curve',
        blurb: 'Honest, detailed, and only lands if you can actually explain it.',
        consequence: {},
        risk: {
          chance: 0.5,
          mitigatedBy: 'competence',
          onFail: {
            effects: [
              { channel: 'favorability', target: 'self', magnitude: -0.04, rampDurationDays: 3, decayHalfLifeDays: 15, tone: -0.3 },
            ],
          },
          failText: 'The whiteboard segment did not survive contact with the internet.',
        },
        resultText: 'Your explainer clip got called "refreshingly honest" — and got shared.',
      },
    ],
    defaultOptionId: 'populist',
  },

  {
    id: 'debate_prep_leak',
    title: 'The Prep Book Leak',
    prompt: 'A volunteer photographed your debate prep binder — including the mock answers where you were brutally honest about your own weaknesses. It could leak any day.',
    weight: 1.0,
    minWeek: 4,
    options: [
      {
        id: 'preempt',
        label: 'Publish it yourself',
        blurb: 'Radical transparency. Own the self-criticism before someone else frames it.',
        consequence: {
          effects: [
            { channel: 'favorability', target: 'self', magnitude: 0.05, rampDurationDays: 3, decayHalfLifeDays: 24, tone: 0.5 },
            { channel: 'nameRecognition', target: 'self', magnitude: 0.2, rampDurationDays: 3, decayHalfLifeDays: 20 },
          ],
        },
        resultText: '"The candidate who grades their own homework" — the framing worked.',
      },
      {
        id: 'sit_tight',
        label: 'Sit tight',
        blurb: 'Maybe it never surfaces. Competence keeps the circle tight.',
        consequence: {},
        risk: {
          chance: 0.5,
          mitigatedBy: 'competence',
          onFail: { scandal: { target: 'self', amount: 0.1 } },
          failText: 'It leaked, annotated. Your own words led the news cycle for a week.',
        },
        resultText: 'The binder stayed buried. Exhale.',
      },
    ],
    defaultOptionId: 'sit_tight',
  },
  {
    id: 'church_invite',
    title: 'The Pulpit Invitation',
    prompt: 'The county\u2019s biggest congregation invites you to speak Sunday. Their members vote — and their pastor expects deference on the social issues.',
    weight: 1.0,
    minWeek: 2,
    options: [
      {
        id: 'speak',
        label: 'Take the pulpit',
        blurb: 'Real turnout energy — and your social positions drift traditional in the telling.',
        consequence: {
          positionShifts: [{ issueId: 'social_culture', delta: -0.15 }],
          effects: [
            { channel: 'turnout', target: 'self', magnitude: 0.015, rampDurationDays: 7, decayHalfLifeDays: null },
            { channel: 'favorability', target: 'self', magnitude: 0.04, rampDurationDays: 3, decayHalfLifeDays: 24, tone: 0.5 },
          ],
        },
        resultText: 'Standing room only. The amen corner is now your phone bank.',
      },
      {
        id: 'decline_politely',
        label: 'Send a warm letter instead',
        blurb: 'Keep the platform clean; lose the room.',
        consequence: {},
        resultText: 'The letter was read aloud. Politely.',
      },
    ],
    defaultOptionId: 'decline_politely',
  },
  {
    id: 'factory_closure',
    title: 'The Plant Closes',
    prompt: 'The district\u2019s second-biggest employer just announced 800 layoffs. Every camera in the state is at the gates, waiting for someone to blame.',
    weight: 1.1,
    minWeek: 3,
    options: [
      {
        id: 'blame_trade',
        label: 'Blame the trade deals',
        blurb: 'Red meat for working-class voters; your tax position drifts populist.',
        consequence: {
          positionShifts: [{ issueId: 'taxes_spending', delta: -0.1 }],
          effects: [
            { channel: 'favorability', target: 'self', magnitude: 0.06, rampDurationDays: 3, decayHalfLifeDays: 20, tone: 0.4 },
          ],
        },
        resultText: 'The gate speech led every broadcast. The base loved it.',
      },
      {
        id: 'retraining_plan',
        label: 'Announce a retraining plan',
        blurb: 'Substance over heat — lands only if you can defend the details.',
        consequence: {
          effects: [
            { channel: 'favorability', target: 'self', magnitude: 0.05, rampDurationDays: 4, decayHalfLifeDays: 28, tone: 0.5 },
          ],
        },
        risk: {
          chance: 0.45,
          mitigatedBy: 'competence',
          onFail: {
            effects: [
              { channel: 'favorability', target: 'self', magnitude: -0.05, rampDurationDays: 3, decayHalfLifeDays: 18, tone: -0.4 },
            ],
          },
          failText: 'The plan\u2019s numbers didn\u2019t add up on air. "Candidate math" trended.',
        },
        resultText: 'Wonky, credible, and quietly devastating to your opponent\u2019s soundbite.',
      },
    ],
    defaultOptionId: 'blame_trade',
  },
  {
    id: 'endorse_me_back',
    title: 'The Mayor\u2019s Price',
    prompt: 'The most popular mayor in the district offers his endorsement — if your campaign quietly covers his outstanding legal bills.',
    weight: 0.9,
    minWeek: 3,
    options: [
      {
        id: 'pay',
        label: 'Pay the bills',
        blurb: 'His machine is real. So is the paper trail.',
        consequence: {
          cashDelta: -2500000,
          effects: [
            { channel: 'favorability', target: 'self', magnitude: 0.07, rampDurationDays: 4, decayHalfLifeDays: 30, tone: 0.5 },
            { channel: 'turnout', target: 'self', magnitude: 0.01, rampDurationDays: 7, decayHalfLifeDays: null },
          ],
        },
        risk: {
          chance: 0.35,
          mitigatedBy: 'competence',
          onFail: { scandal: { target: 'self', amount: 0.2 } },
          failText: 'The payment surfaced in his disclosure filings. "BOUGHT AND PAID FOR."',
        },
        resultText: 'His people are your people now. Nobody asks why.',
      },
      {
        id: 'walk_away',
        label: 'Walk away',
        blurb: 'Endorsements you buy own you.',
        consequence: {},
        resultText: 'He endorsed nobody — then said your name with a shrug on live radio. Could\u2019ve been worse.',
      },
    ],
    defaultOptionId: 'walk_away',
  },
  {
    id: 'deepfake_attack',
    title: 'The Fake Clip',
    prompt: 'A convincing AI-generated clip of you \u201cconfessing\u201d to fraud is spreading through group chats. It\u2019s fake. It\u2019s working.',
    weight: 0.9,
    minWeek: 4,
    options: [
      {
        id: 'flood_zone',
        label: 'Flood the zone with the debunk',
        blurb: 'Spend to make the correction louder than the lie.',
        consequence: {
          cashDelta: -1500000,
          effects: [
            { channel: 'favorability', target: 'self', magnitude: 0.03, rampDurationDays: 2, decayHalfLifeDays: 15, tone: 0.3 },
            { channel: 'nameRecognition', target: 'self', magnitude: 0.15, rampDurationDays: 2, decayHalfLifeDays: 15 },
          ],
        },
        resultText: 'The debunk out-traveled the fake by Friday. Expensive, but dead.',
      },
      {
        id: 'ignore_it',
        label: 'Don\u2019t dignify it',
        blurb: 'Amplifying a lie can feed it — or it dies on its own. Integrity buys the benefit of the doubt.',
        consequence: {},
        risk: {
          chance: 0.5,
          mitigatedBy: 'integrity',
          onFail: { scandal: { target: 'self', amount: 0.12 } },
          failText: 'Silence read as guilt. The clip hit the local news re-cut as "unanswered questions."',
        },
        resultText: 'It burned out in the group chats. Your shrug aged well.',
      },
    ],
    defaultOptionId: 'flood_zone',
  },
  {
    id: 'family_time',
    title: 'The Empty Chair',
    prompt: 'You have missed every family dinner for a month. Your spouse asks for one unplugged weekend — the same weekend as the county fair, the best retail politics of the season.',
    weight: 0.8,
    minWeek: 4,
    options: [
      {
        id: 'go_home',
        label: 'Take the weekend',
        blurb: 'Miss the fair. Come back human.',
        consequence: {
          apDelta: -1,
          effects: [
            { channel: 'favorability', target: 'self', magnitude: 0.03, rampDurationDays: 7, decayHalfLifeDays: 40, tone: 0.6 },
          ],
        },
        resultText: 'No cameras, no clipboards. Monday-you campaigns better for it.',
      },
      {
        id: 'work_the_fair',
        label: 'Work the fair',
        blurb: 'Funnel cake, handshakes, and one more quiet dinner table.',
        consequence: {
          effects: [
            { channel: 'nameRecognition', target: 'self', magnitude: 0.25, rampDurationDays: 3, decayHalfLifeDays: 25 },
          ],
        },
        resultText: 'Four hundred handshakes. One cold dinner plate in the fridge.',
      },
    ],
    defaultOptionId: 'work_the_fair',
  },
  {
    id: 'rival_scandal_tip',
    title: 'The Courthouse Tip',
    prompt: 'A clerk hints there\u2019s a sealed settlement involving your opponent. Digging it out means public-records requests with your campaign\u2019s name on them.',
    weight: 0.9,
    minWeek: 5,
    options: [
      {
        id: 'dig',
        label: 'File the requests',
        blurb: 'If it\u2019s real, it\u2019s a bombshell. If it\u2019s nothing, you\u2019re the ghoul who went digging.',
        consequence: {},
        risk: {
          chance: 0.45,
          mitigatedBy: 'competence',
          onFail: {
            effects: [
              { channel: 'favorability', target: 'self', magnitude: -0.04, rampDurationDays: 3, decayHalfLifeDays: 18, tone: -0.4 },
            ],
          },
          failText: 'The file was a zoning dispute. "Candidate digs through rival\u2019s trash" wrote itself.',
        },
        resultText: 'It was real. The settlement story broke with your fingerprints nowhere on it.',
      },
      {
        id: 'pass_tip',
        label: 'Tip a reporter anonymously',
        blurb: 'Slower, safer, deniable.',
        consequence: {
          scandal: { target: 'opponent', amount: 0.08 },
        },
        resultText: 'Three weeks later, someone else\u2019s byline did your work.',
      },
    ],
    defaultOptionId: 'pass_tip',
  },
  {
    id: 'bus_breakdown',
    title: 'The Breakdown',
    prompt: 'Your campaign bus died on the interstate, live-streamed by a passing supporter. You\u2019re stranded three hours from tonight\u2019s event with two hundred people waiting.',
    weight: 0.8,
    minWeek: 2,
    options: [
      {
        id: 'hitchhike',
        label: 'Ride with the tow-truck driver',
        blurb: 'Show up greasy and late — with the best story of the cycle. Charisma sells it.',
        consequence: {},
        risk: {
          chance: 0.4,
          mitigatedBy: 'charisma',
          onFail: {
            effects: [
              { channel: 'favorability', target: 'self', magnitude: -0.03, rampDurationDays: 2, decayHalfLifeDays: 12, tone: -0.2 },
            ],
          },
          failText: 'The "regular folks" bit read as staged. The tow driver\u2019s deadpan interview didn\u2019t help.',
        },
        resultText: 'You arrived in a tow truck to a standing ovation. The clip did numbers.',
      },
      {
        id: 'cancel',
        label: 'Cancel and refund the pizza',
        blurb: 'Safe, forgettable, a wasted evening.',
        consequence: {
          effects: [
            { channel: 'nameRecognition', target: 'self', magnitude: -0.05, rampDurationDays: 2, decayHalfLifeDays: 10 },
          ],
        },
        resultText: 'Two hundred people went home. A few of them stayed home for good.',
      },
    ],
    defaultOptionId: 'cancel',
  },
  {
    id: 'primary_ghost',
    title: 'The Write-In Whisper',
    prompt: 'A disgruntled former official is telling donors she might launch a write-in campaign aimed squarely at your base. She wants a meeting.',
    weight: 0.8,
    minWeek: 5,
    options: [
      {
        id: 'give_role',
        label: 'Offer her a campaign role',
        blurb: 'Inside the tent. Costs payroll and a little pride.',
        consequence: {
          cashDelta: -1000000,
          effects: [
            { channel: 'turnout', target: 'self', magnitude: 0.01, rampDurationDays: 7, decayHalfLifeDays: null },
          ],
        },
        resultText: 'She\u2019s now your "senior advisor for community engagement." The whisper died.',
      },
      {
        id: 'call_bluff',
        label: 'Call the bluff',
        blurb: 'She probably can\u2019t fund it. Probably.',
        consequence: {},
        risk: {
          chance: 0.35,
          onFail: {
            effects: [
              { channel: 'favorability', target: 'self', magnitude: -0.05, rampDurationDays: 5, decayHalfLifeDays: 25, tone: -0.3 },
            ],
          },
          failText: 'She launched. Every vote she takes is one of yours.',
        },
        resultText: 'No filing ever came. The meeting request quietly expired.',
      },
    ],
    defaultOptionId: 'call_bluff',
  },
  {
    id: 'weather_disaster',
    title: 'The Flood',
    prompt: 'Flash floods hit three towns in the district overnight. Campaigning through it looks ghoulish; vanishing looks worse.',
    weight: 1.0,
    minWeek: 3,
    options: [
      {
        id: 'boots_on',
        label: 'Suspend the campaign and volunteer',
        blurb: 'Sandbags, not soundbites. Costs a week of momentum; buys something better.',
        consequence: {
          apDelta: -1,
          effects: [
            { channel: 'favorability', target: 'self', magnitude: 0.08, rampDurationDays: 5, decayHalfLifeDays: 35, tone: 0.8 },
          ],
        },
        resultText: 'No press release. Someone photographed you anyway. It mattered.',
      },
      {
        id: 'photo_op',
        label: 'One visit, cameras invited',
        blurb: 'Compassion with a call time. Efficient — if it doesn\u2019t look staged.',
        consequence: {},
        risk: {
          chance: 0.5,
          mitigatedBy: 'charisma',
          onFail: {
            effects: [
              { channel: 'favorability', target: 'self', magnitude: -0.06, rampDurationDays: 3, decayHalfLifeDays: 20, tone: -0.5 },
            ],
          },
          failText: 'You handed a shovel BACK to a volunteer when the cameras left. Someone filmed that too.',
        },
        resultText: 'The visit read as sincere, and the evening news was kind.',
      },
    ],
    defaultOptionId: 'boots_on',
  },
] as const

export function getDilemma(id: string): DilemmaDef | undefined {
  return DILEMMAS.find((d) => d.id === id)
}
