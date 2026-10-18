/*
 * Outages. The agent outage: on the day the player hacks GeneralAI, every agent service is down until
 * the next morning (AGENT_OUTAGE in config). The Forkyard outage: on day 8 a group uses agent-2 to
 * break into Forkyard, which is down for the rest of the day (FORKYARD_OUTAGE).
 */
import type { GameState } from './state';
import { AGENT_OUTAGE, FORKYARD_OUTAGE } from './config';

/** agent is down: today is the day GeneralAI was hacked. */
export function agentDown(s: GameState): boolean {
  return s.flagDays[AGENT_OUTAGE.flag] === s.values.day;
}

/** What agent.chat shows instead of a reply while it's down. Not billed. */
export const OUTAGE_CHAT = [
  "agent is unavailable right now. We're aware of the issue and working on a fix. You have not been billed for this message.",
  "Something went wrong on our end. agent couldn't be reached. You have not been billed for this message. Status: investigating.",
  "agent is temporarily unavailable. Your message was not sent and you have not been billed. We apologize for the inconvenience.",
];

/** What agent-terminal prints instead of a reply while it's down. Not billed. */
export const OUTAGE_TERM = 'error: could not reach api.generalai.com (503 Service Unavailable). prompt not sent, not billed.';

/** Today is the day Forkyard was hacked: nothing pays, strikes or is billed for hosting tonight. */
export const forkyardOutageDay = (s: GameState): boolean => s.values.day === FORKYARD_OUTAGE.day;

/** Forkyard is down right now: no sign-in, no pushes, every deployed app offline. */
export const forkyardDown = (s: GameState): boolean => forkyardOutageDay(s) && s.clockMin >= FORKYARD_OUTAGE.from;

/** What agent says to a build or fix while Forkyard is down. Billed like any reply. */
export const FORKYARD_DOWN = [
  "I can't reach Forkyard. Sign-in times out and every push is refused, so nothing I build today can go anywhere. I'll try again once their server is back.",
  "Forkyard isn't responding. I can write the code, but there's no server to push it to. Try again once Forkyard is back up.",
  "I tried. Forkyard's server can't be reached: no sign-in, no pushes, no deploys. This one isn't on your prompt.",
];
