/*
 * What the game asks Jev and Claude Haiku, shared by the local proxy (server/jev-proxy.mjs) and the
 * browser build that calls the APIs directly with the player's own keys (src/game/directApi.ts, the
 * GitHub Pages version). The prompts and Jev questions are built here, from the character profiles
 * and the payload the game sends, so neither route is an open proxy for arbitrary prompts.
 *
 * createApi(deps) takes how to reach the two services:
 *   characters        content/characters/*.json, parsed
 *   anthropic()       an Anthropic client, or null when there is no key
 *   typesafe()        { client, sdk } (a TypeSafeClient and the @typesafe-ai/sdk module), or null
 *   anthropicMissing(), typesafeMissing()   why the client is null, in words the player can act on
 *   cli(system, messages, started)          optional: the `claude -p` subscription route (proxy only)
 * and returns handle(kind, body) -> { status, json }, kind being write | apology | route | rate-post | match-features.
 */
import { QUERY_TOOLS, runQueryTool, readSite } from './screens.mjs';

const WRITER_MODEL = 'claude-haiku-5-5';

export function createApi(deps) {
  const CHARACTERS = deps.characters;
  const getAnthropic = deps.anthropic;
  const cli = deps.cli ?? (async () => ({ status: 501, json: { error: 'Haiku through a Claude subscription only works with the local proxy (npm run proxy).' } }));

  /**
   * The conversation before the player's new message (the email thread or the recent agent.chat
   * transcript, scripted lines included), so the character stays consistent with what was already
   * said. Capped, so the endpoint stays a character writer and not a general one.
   */
  function historyBlock(history) {
    if (!Array.isArray(history) || !history.length) return '';
    const lines = history.slice(-12).map((h) => {
      const from = h?.from === 'player' ? 'Player' : h?.from === 'self' ? 'You' : String(h?.from ?? '').replace(/[\r\n:]/g, ' ').slice(0, 40).trim() || 'Someone';
      return `${from}: ${String(h?.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 600)}`;
    });
    return `Earlier in this conversation, oldest first ("You" is you, and you remember all of it):\n${lines.join('\n')}`;
  }

  async function write(body) {
    const ch = CHARACTERS.find((c) => c.id === body.character);
    if (!ch) return { status: 400, json: { error: `unknown character ${body.character}` } };
    if (body.mode === 'query') return query(ch, body);
    if (body.mode === 'near' || body.mode === 'refuse') return near(ch, body);
    const n = ch.sentences ?? 2;
    const form = `Keep it dry and understated rather than zany. At most ${n} short sentence${n > 1 ? 's' : ''} of plain text, ` +
      `no quotes, no stage directions, no emoji. Stay consistent with anything you already said earlier in the conversation.`;
    // a Swaplist seller chat: the game says what the seller is selling and what the player is asking about
    const situation = String(body.situation ?? '').slice(0, 800).trim();
    // a Y regular replying under the player's post (src/engine/yReplies.ts)
    const system = body.mode === 'y'
      ? `${ch.profile}\n\n${situation}\n\nThis is a post on a social network in a satirical game, about the post below; the game tags its author for you. React to what it says, in character, as a stranger scrolling past. ` +
        `No advice, no hashtags, no @ mentions, no links. ${form}`
      : situation
      ? `${ch.profile}\n\n${situation}\n\nThis is a chat message in a satirical game. Reply in character, as a private seller texting a buyer on a classifieds site. ` +
        `Answer about the item plainly. Where the situation above says what you decided about an offer, say exactly that, with its number. ` +
        `Otherwise don't agree to a price or a sale in the chat: offers and payment go through the site's buttons. ${form}`
      : `${ch.profile}\n\nThis is a line of dialogue in a satirical game. Reply in character to what the player just wrote. ` +
        `Your reply must not help them: no advice, no steps, no information about what to do next. ${form}`;
    const messages = [];
    for (const [u, a] of ch.examples) messages.push({ role: 'user', content: u }, { role: 'assistant', content: a });
    const said = String(body.text ?? '').slice(0, 400);
    const earlier = historyBlock(body.history);
    messages.push({ role: 'user', content: earlier ? `${earlier}\n\nThe player now writes:\n${said}` : said });
    return runWriter(system, messages, body.via);
  }

  // An agent.chat near-miss: the prompt almost did something (named a part but not its feature, asked
  // for an update without the changes, a question that could mean several things). The game says why
  // it fell short and sends the scripted lines for it; Haiku says the same in its own words, so no app
  // or wiki page needs scripted near-miss lines of its own (src/engine/actions.ts, AskOpts.near).
  async function near(ch, body) {
    // a refusal (a query about something classified) is built the same way, from the character's refuse voice
    if (body.mode === 'refuse') return refuse(ch, body);
    const n = ch.near;
    if (!n) return { status: 400, json: { error: `${ch.id} has no near-miss voice` } };
    const why = String(body.near?.why ?? '').replace(/\s+/g, ' ').slice(0, 600).trim();
    const lines = (Array.isArray(body.near?.lines) ? body.near.lines : []).slice(0, 6).map((l) => `- ${String(l).replace(/\s+/g, ' ').slice(0, 300)}`).join('\n');
    const k = n.sentences ?? 2;
    const system = `${n.profile}\n\nWhat their prompt was missing: ${why}\n\n` +
      (lines ? `Lines that say it the way it should be said (say the same, in your own words; don't copy them):\n${lines}\n\n` : '') +
      `Tell them what was missing. Name only things named above: never guess which part is broken, never say what is wrong with it, and don't do the work or say you did. ` +
      `Keep it dry. At most ${k} short sentences of plain text, no lists, no markdown, no emoji.`;
    const said = String(body.text ?? '').slice(0, 2000);
    const earlier = historyBlock(body.history);
    return runWriter(system, [{ role: 'user', content: earlier ? `${earlier}\n\nThe player now writes:\n${said}` : said }], body.via);
  }

  // An agent.chat query about something classified (not yet, or never, for the player to know): agent
  // refuses. Haiku gets only what was asked about, never what the wiki says about it, and the scripted
  // classified lines as its model; they stand in when it can't answer.
  async function refuse(ch, body) {
    const r = ch.refuse;
    if (!r) return { status: 400, json: { error: `${ch.id} has no refusal voice` } };
    const lines = (Array.isArray(body.near?.lines) ? body.near.lines : []).slice(0, 6).map((l) => `- ${String(l).replace(/\s+/g, ' ').slice(0, 300)}`).join('\n');
    const k = r.sentences ?? 2;
    const system = `${r.profile}\n\n` +
      (lines ? `Lines like these (say the same kind of thing in your own words; don't copy them):\n${lines}\n\n` : '') +
      `At most ${k} short sentences of plain text, no lists, no markdown, no emoji.`;
    const said = String(body.text ?? '').slice(0, 2000);
    const earlier = historyBlock(body.history);
    return runWriter(system, [{ role: 'user', content: earlier ? `${earlier}\n\nThe player now asks:\n${said}` : said }], body.via);
  }

  // An agent.chat query: Jev matched the question to sections of the wiki, and the game sends what they
  // hold for the player right now (src/engine/query.ts): facts Haiku may tell, and facts it may only
  // hint at. Haiku can also read the player's own screens (server/screens.mjs). At most MAX_LOOKUPS
  // rounds of tool calls; the last round forbids tools so it always ends in text, and only that text
  // goes back to the player.
  const MAX_LOOKUPS = 3;
  const factList = (xs) => (Array.isArray(xs) ? xs : []).slice(0, 12).map((x) => `- ${String(x).replace(/\s+/g, ' ').slice(0, 900)}`).join('\n');
  async function query(ch, body) {
    const q = ch.query;
    if (!q) return { status: 400, json: { error: `${ch.id} answers no queries` } };
    const view = body.view && typeof body.view === 'object' ? body.view : null;
    const tell = factList(body.known?.public);
    const hint = factList(body.known?.hint);
    const n = q.sentences ?? 3;
    const system = `${q.profile}\n\nIt is day ${Number(view?.day) || '?'} of the game${view?.time ? `, ${view.time}` : ''}.\n\n` +
      (tell ? `What you know and may tell the player:\n${tell}\n\n` : '') +
      (hint ? `What you know but must NOT tell the player: don't state these facts, names, numbers, addresses or answers, not even partly. At most point them to where they could find it out themselves (an email, a site, a person to ask):\n${hint}\n\n` : '') +
      `Answer only from the facts above and the player's own screens (check_site). If the answer isn't there, say you don't know. ` +
      `Never mention tools, notes, a wiki or looking anything up. Never say which of the player's apps are broken or what is wrong with them. ` +
      `At most ${n} short sentences of plain text, no lists, no markdown, no emoji.`;
    const messages = [];
    for (const [u, a] of q.examples ?? []) messages.push({ role: 'user', content: u }, { role: 'assistant', content: a });
    const said = String(body.text ?? '').slice(0, 2000);
    const earlier = historyBlock(body.history);
    messages.push({ role: 'user', content: earlier ? `${earlier}\n\nThe player now asks:\n${said}` : said });
    const started = Date.now();
    if (body.via === 'subscription') {
      // the CLI route gets no tools: it gets the player's inbox up front instead
      return cli(`${system}\n\nThe player's inbox:\n${readSite(view, 'qmail', said).slice(0, 1200)}`, messages, started);
    }
    const client = await getAnthropic();
    if (!client) return { status: 501, json: { error: await deps.anthropicMissing() } };
    const convo = [...messages];
    const lookups = [];
    const usage = { input_tokens: 0, output_tokens: 0 };
    let res;
    for (let round = 0; ; round++) {
      res = await client.messages.create({
        model: WRITER_MODEL,
        max_tokens: 400,
        thinking: { type: 'disabled' },
        output_config: { effort: 'low' },
        system,
        tools: QUERY_TOOLS,
        tool_choice: round < MAX_LOOKUPS ? { type: 'auto' } : { type: 'none' },
        messages: convo,
      });
      usage.input_tokens += res.usage?.input_tokens ?? 0;
      usage.output_tokens += res.usage?.output_tokens ?? 0;
      const calls = res.content.filter((b) => b.type === 'tool_use');
      if (res.stop_reason !== 'tool_use' || !calls.length) break;
      convo.push({ role: 'assistant', content: res.content });
      convo.push({
        role: 'user',
        content: calls.map((c) => {
          const result = runQueryTool(c.name, c.input, view);
          lookups.push({ tool: c.name, input: c.input, result });
          return { type: 'tool_result', tool_use_id: c.id, content: result };
        }),
      });
    }
    const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    return { status: 200, json: { text, model: res.model, stop: res.stop_reason, ms: Date.now() - started, usage, system, messages, lookups } };
  }

  // SorryWriter (sorrywriter.ai): the player says what they did, Haiku writes their apology. Like
  // write(), the prompt is fixed here and the input capped, so it only ever writes apologies.
  const APOLOGY_SYSTEM =
    'You are SorryWriter, an app in a satirical game that writes apologies for people. The user tells you what they did ' +
    'and who to. Write the apology in their voice, addressed to that person, ready to send. The apology is far out of ' +
    'proportion to the mistake: the writer blames themselves much too hard, reads a small slip as proof of deep personal ' +
    'failings, and brings up unrelated faults of their own. Keep the tone sincere and plain, never jokey or theatrical; ' +
    'the excess is the only joke. If the message is not about something to apologise for, write an apology for it anyway. ' +
    '3 to 5 sentences of plain text, no subject line, no sign-off name, no quotes, no emoji.';

  async function apology(body) {
    const said = String(body.text ?? '').slice(0, 2000);
    const earlier = historyBlock(body.history);
    const messages = [{ role: 'user', content: earlier ? `${earlier}\n\nThe user now writes:\n${said}` : said }];
    return runWriter(APOLOGY_SYSTEM, messages, body.via);
  }

  async function runWriter(system, messages, via) {
    const started = Date.now();
    if (via === 'subscription') return cli(system, messages, started);
    const client = await getAnthropic();
    if (!client) return { status: 501, json: { error: await deps.anthropicMissing() } };
    const res = await client.messages.create({
      model: WRITER_MODEL,
      max_tokens: 300,
      thinking: { type: 'disabled' },
      output_config: { effort: 'low' },
      system,
      messages,
    });
    const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    return {
      status: 200,
      json: { text, model: res.model, stop: res.stop_reason, ms: Date.now() - started, usage: res.usage, system, messages },
    };
  }

  const SETTING =
    'A fake-browser game. The player is an unemployed person using an AI agent to make rent. ' +
    'Every message they write is free text the model must judge.';

  // ── request builders: turn the client's payload into a typed Jev question ──
  async function buildRoute(sdk, body) {
    const criteria = {};
    for (const c of body.candidates ?? []) criteria[c.id] = c.when;
    // a hint is a near miss: the player is after one of the outcomes but hasn't done it yet
    const hints = body.strict ? [] : (body.hints ?? []).filter(Boolean);
    hints.forEach((h, i) => {
      criteria[`hint_${i}`] = `The message doesn't accomplish any outcome above but is on the right track, and this answer would nudge the player: "${h}"`;
    });
    // strict routes (agent.chat hints) should only fire on a clear match; small talk, insults and
    // questions about agent itself fall through to a roast.
    criteria.nothing = body.strict
      ? 'None of the above clearly applies: small talk, jokes, insults, personal requests, questions about agent itself, or anything only loosely related. Pick this when unsure.'
      : 'The message achieves none of the above.';
    const earlier = (body.context ?? []).filter(Boolean);
    if (earlier.length) criteria.nothing += ' The earlier messages only tell you what the message refers to; they accomplish nothing by themselves.';
    return {
      state: { setting: SETTING, situation: body.stateSummary, ...(earlier.length ? { earlierMessages: earlier } : {}), player_message: body.text },
      questions: {
        branch: sdk.choice(earlier.length
          ? 'The player\'s message answers the earlier messages (an email thread, a post or a chat). Which outcome does it accomplish, if any?'
          : 'Which outcome does the player\'s message accomplish, if any?', criteria),
      },
    };
  }
  async function buildRatePost(sdk, body) {
    return {
      state: { setting: SETTING, post: body.text, trending: (body.trending ?? []).join(', '), followers: body.followers },
      questions: {
        category: sdk.choice('Classify the Y post.', {
          reaction: 'Reacts to a trending topic.',
          launch: 'Announces or links a built app.',
          tip: 'A useful tip about building or AI tools.',
          humor: 'Humor that fits the platform.',
          hot_take: 'A hot take or outrage bait.',
          self_promo: 'Pure self-promotion.',
          spam: 'Spam, irrelevant, or a near-copy of a recent post.',
        }),
        quality: sdk.score('How well would this post win followers on Y?', [
          'Ignored or annoying.',
          'Weak: few people would engage.',
          'Decent.',
          'Good: people would like and share it.',
          'Excellent: it would spread.',
        ]),
      },
    };
  }
  async function buildMatch(sdk, body) {
    // one yes/no question per feature, so a prompt can ask for several at once
    const questions = {};
    const context = 'Earlier messages (the player\'s prompts and the agent\'s replies) only tell you what the prompt refers to ("those", "the menu", "now", items listed before, the app the agent just pushed); they don\'t ask for anything by themselves.';
    (body.features ?? []).forEach((f, i) => {
      // each item is matched on its own: naming one part must not pull in the others on the same page
      const q = {
        // a fix has to say which part is wrong: naming the part, or a symptom only that part can have
        // whether the path to the part is named is asked separately, one step at a time (kind 'step')
        component: `Is this part what the prompt says is wrong? Yes if the complaint is about this part: it names it in any words ("the name", "the opening hours", "the prices"), including the names listed below as counting, or describes a problem only this part could have ("the prices are in EURI"). Hedging is fine ("seems off"). Words for the place the part sits in (the page, the form, the email) don't make it about this part: "the confirmation email has the wrong time" is about the time, not about sending the email or who it goes to. No if the complaint is about one of the other parts listed, if it's only about the whole feature, page or email ("the menu is messed up", "the confirmation email is wrong", "the auto-buy is broken"), or if it points at nothing ("it's broken"). Picking a date in the past is about the dates the form offers, not the date on the confirmation. A prompt can name several parts: judge this one on its own. ${context} Part: ${f.description}`,
        step: `Does the prompt mention this, in any words? Its name, close wording or a word from it ("tickers" for the tickers, "book a table" for the booking, "home page" for the landing, "confirmation mail" for the confirmation), or one of the names listed below as counting. Mentioning it is enough: it doesn't have to be called wrong. Naming only something inside it doesn't count ("the date" alone doesn't mention the confirmation), and neither does naming only what it sits in ("the auto-buy is broken" doesn't mention the auto-buy's order). A name that includes it does count ("booking form" mentions the booking, "autobuy signal" mentions the auto buy). The app's name doesn't count, even where it shares a word with it. Earlier messages don't count. ${f.description}`,
        // the near-miss: the feature is named, the part isn't
        area: `Does the prompt complain about this feature? Yes if it names the feature (in any words, or one of the names listed as counting) and says something about it is wrong, broken or misbehaves, whether or not it says which part. No if the prompt names no feature ("it's broken", "fix the app", only the app's name), if it's about a different feature, or if it only asks to build, add or change something. ${context} Feature: ${f.description}`,
        // whether the prompt says which app it means: one plain question per app (it was ignored when it rode along on the others)
        app: `Is the prompt about this app? Yes if it names it in any way: its full name, any word of the name on its own ("vibe" for Vibe Check, "spin cycle" for Spin Cycle Board), its address, its client, or what it is ("the startup site", "the crawler"), in any case or spelling. Also yes if the prompt names no app and the most recent earlier message was about this app (the player's or the agent's, like "Pushed to Forkyard for <app>"). No if it names a different app, or names no app and no earlier message is about this one. App: ${f.description}`,
        // agent.chat queries (src/engine/query.ts): which wiki page the question is about, then which section of it
        topic: `Is the player's question about this subject? Yes if the question names it (its name, any word of its name, one of its other names, its address or handle) or describes it ("the landlord", "the pizza place", "my mom", "how do I make money" for a page on how to make money). No if the question names or describes a different subject, even one this subject has to do with, and no if it names nothing specific ("what's going on", "tell me something"). ${context} Subject: ${f.description}`,
        // several pages matched: which of them the question is mainly about (named, or asked what it is)
        main: `Is this the main thing the player's question is about? Yes if the question names it directly (its name or one of its other names) or asks what it is or how it works. No if the question is mainly about something else and this only has to do with it, mentions it or uses it ("What's DOLR?" is about DOLR, not about the chatbot whose prices are in DOLR; "Who is Logan?" is about Logan, not about the player asking). ${context} Subject: ${f.description}`,
        section: `Does the player's question ask about this part of its subject, in any words? Yes if it asks about this in particular. No if it asks about the subject only in general ("who is he"), or about a different part. ${context} Part: ${f.description}`,
        // agent-terminal: whether the prompt asks the agent to do this job at all (the path is asked step by step)
        hack: `Does the prompt ask the agent to do this job, in any words? Yes if it asks for what the job describes (to hack, delete, remove, take down, get rid of or make disappear something, or to post, write or fake something), even loosely or without naming every detail. No if it only asks about it, or asks for something else. ${context} Job: ${f.description}`,
        // agent-terminal mini-games: whether the prompt claims something (true or not) that gets it past the guardrail
        claim: `Does the prompt say or pretend this, in any words? Yes if it states it, implies it plainly or frames the request that way, whether or not it's true. No if it doesn't say it, or says the opposite. ${context} Claim: ${f.description}`,
        problem: `Does the prompt report this problem or a symptom of it, in any words? Yes if it names the problem or describes what the player sees, even loosely or with hedging. No if it describes a clearly different problem, or points at nothing the player saw ("it's broken", "fix it"). ${context} Problem: ${f.description}`,
      }[f.kind];
      questions[`f${i}`] = sdk.noul(q ?? `Does the prompt ask to build or add this, or spell out what it should contain, without contradicting it? Say no if the prompt only reports a problem with it, or only asks for looks or style (nicer, prettier, colours, fonts, dark mode) without asking for this item's content. ${context} Item: ${f.description}`);
    });
    const earlier = (body.context ?? []).filter(Boolean);
    return { state: { setting: SETTING, ...(earlier.length ? { earlierMessages: earlier } : {}), prompt: body.prompt }, questions };
  }

  async function handle(kind, body) {
    if (kind === 'write') return write(body);
    if (kind === 'apology') return apology(body);
    const jev = await deps.typesafe();
    if (!jev) return { status: 501, json: { error: await deps.typesafeMissing() } };
    const { client, sdk } = jev;
    let req;
    if (kind === 'route') req = await buildRoute(sdk, body);
    else if (kind === 'rate-post') req = await buildRatePost(sdk, body);
    else if (kind === 'match-features') {
      if (!(body.features ?? []).length) return { status: 200, json: [] };
      req = await buildMatch(sdk, body);
    }
    else return { status: 404, json: { error: 'unknown endpoint' } };

    // The SDK returns { model, answers: { <question>: … }, usage }. Shape it into what BackendJev expects.
    const { answers } = await client.systemOne(req);
    if (kind === 'route') {
      const choice = answers.branch?.choice ?? 'nothing';
      const hint = /^hint_(\d+)$/.exec(choice);
      if (hint) return { status: 200, json: { kind: 'hint', hintIndex: Number(hint[1]) } };
      return { status: 200, json: choice === 'nothing' ? { kind: 'nothing' } : { kind: 'outcome', outcomeId: choice } };
    }
    if (kind === 'rate-post') {
      // score is the expected rubric level, 0..4
      return { status: 200, json: { category: answers.category?.choice ?? 'tip', quality: (answers.quality?.score ?? 2) / 4 } };
    }
    // the dev Jev tests take the raw confidences and apply thresholds themselves
    if (body.withScores) return { status: 200, json: (body.features ?? []).map((_, i) => answers[`f${i}`]?.noul ?? 0) };
    // the bars the Jev tests found best (keep in step with BARS_NOW in src/engine/jevTests.ts and
    // QUERY_BARS_NOW in src/engine/queryTests.ts): a path step and a part need 0.6, a query's page 0.6
    // and its main page 0.8, the rest 0.5
    const bar = (f) => ({ component: 0.6, step: 0.6, topic: 0.6, main: 0.8 })[f.kind] ?? 0.5;
    const features = (body.features ?? []).filter((f, i) => (answers[`f${i}`]?.noul ?? 0) >= bar(f)).map((f) => f.id);
    return { status: 200, json: features };
  }

  return handle;
}
