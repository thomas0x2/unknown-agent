/*
 * Player actions: everything the player does through free text (prompting the agent, posting on Y,
 * replying to mail, reviewing on Yowl, running a local model) plus the button actions (deploy, take
 * down). Each returns a new state. Jev (injected) decides *what* a message does; the Writer
 * (injected, Claude Haiku in the game) phrases replies that aren't fixed text; a reply that lands a storyline
 * outcome is always the outcome's scripted text. Both are injectable so tests pin outcomes and the game
 * runs offline.
 */
export { type ReplyResult, replyContext, mailHistory, BOUNCE_ADDR, replyToEvent, type ComposeResult, composeEmail, findThreadFor, familyBand } from './actions/mail';
export { tooLong, TOO_LONG_MAIL, TOO_LONG_PROMPT, stateSummary, chatHistory } from './actions/shared';
export { type PolicyRead, policyCheck, type AskResult, type AskOpts, askAgent, recentChat, agentStartFor, appStatus, appNames, workMinutes, buildIntent, promptAgent, localPrompt, briefBuild, briefFix } from './actions/agent';
export { promoteApps, POST_BANDS, POST_FLOORS, postBase, type PostResult, postToY, writeReview } from './actions/social';
export { deploy, takeDown, makeBooking, cancelBooking, NO_SHOW, noShowsTonight, chargeNoShows, EMPIRE, joinEmpire } from './actions/clicks';
export type { AppInstance } from './state';
