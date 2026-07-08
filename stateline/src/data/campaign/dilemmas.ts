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
] as const

export function getDilemma(id: string): DilemmaDef | undefined {
  return DILEMMAS.find((d) => d.id === id)
}
