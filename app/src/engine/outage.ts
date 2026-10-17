/*
 * The agent outage: on the day the player hacks GeneralAI, every agent service is down until the
 * next morning (AGENT_OUTAGE in config).
 */
import type { GameState } from './state';
import { AGENT_OUTAGE } from './config';

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
