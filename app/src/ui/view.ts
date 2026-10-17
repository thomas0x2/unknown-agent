/*
 * The view: pure functions that return the legacy game's exact markup (class for class) from the
 * store. main.ts owns the DOM and drops these strings into the shell slots. Styling comes from the
 * stylesheet carried over from the legacy game (src/style.css); nothing here invents new classes. Each
 * site's pages live in ui/view/; this file re-exports what main.ts and the tests use.
 */
export { fmtClock } from './view/common';
export { tabsHtml, bookmarksHtml, addressValue, viewportSite, objective, rentLine, rentLow, clockHtml, taskTitle, tasksHtml, startMenuHtml } from './view/chrome';
export { mailOpen, mailRows } from './view/qmail';
export { yPosts } from './view/y';
export { page } from './view/pages';
export { chatCostLine, costLine, workHtml } from './view/agent';
export { reviewsFor } from './view/yowl';
export { pullBarHtml, termBodyHtml, termTabsHtml, termTitle, termWindowHtml } from './view/terminal';
export { overlayHtml } from './view/overlay';
export { devHtml } from './view/dev';
