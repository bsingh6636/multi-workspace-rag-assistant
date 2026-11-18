import type { Citation } from '../db';
import { ASK_WHAT_TO_POST, CANT_DO, cantDoReply, REFUSAL } from './prompt';
import type { RetrievedChunk } from './retrieve';

// A citation group: [c1], [c1, c3] or [c1,c3]. Adjacent groups ([c1][c2]) are
// matched one at a time.
const CITATION_GROUP = /\[(c\d+(?:\s*,\s*c\d+)*)\]/g;

// Every [cN] label in a text, in order ("[c1, c3] … [c2]" → c1, c3, c2).
export function citationLabels(text: string): string[] {
  return [...text.matchAll(CITATION_GROUP)].flatMap(([, inner]) => inner.split(',').map((label) => label.trim()));
}

// Messages that don't need a source: greetings, thanks, goodbyes and questions
// about the assistant itself. The WHOLE message must be one of these (after an
// optional greeting), so "hi, what is the Falcon code?" and "what can you tell
// me about Falcon?" still need a citation.
//
// Matching is on the letters only ("hi , who are yo u" → "hiwhoareyou"), so
// spacing, punctuation and a split word don't matter. That's why the patterns
// below have no spaces.
const GREETING = /^(hi|hello|hey|yo|goodmorning|goodafternoon|goodevening)(there|everyone|assistant|again)?/;
// Who the user may be asking about: "you", "u", "this chat", "the model"…
const ASSISTANT = '(you|u|thischat|thisassistant|thisbot|thisapp|themodel|theassistant|thebot|thechat)';
// Word stems, so a typo like "abilitiles" still matches. At most 6 more letters,
// so the stem can't swallow other words ("ability of the Falcon team …").
const ABILITIES = '(abilit[a-z]{0,6}|capabilit[a-z]{0,6}|skills?|features?|tools?|powers?)';

const SMALL_TALK = [
  // thanks so much, ok, bye…
  /^(thanks|thankyou|thx|ty|cheers|ok|okay|cool|great|nice|bye|goodbye|seeyou|help)(there|again|somuch|alot|everyone|assistant)?$/,
  // who are you / what are u
  /^(who|what)are(you|u)$/,
  // what can you do / what does this chat do
  new RegExp(`^what(can|does|do)${ASSISTANT}do(forme)?$`),
  // what do you have / what do u ha (sent cut off) / what does this chat offer
  new RegExp(`^what(do|does)${ASSISTANT}(have|hav|ha|got|offer)$`),
  // how can you help (me)
  /^how(can|could|do)(you|u)help(me)?$/,
  // what abilities do you have / which tools can the model use
  new RegExp(`^(what|which)${ABILITIES}(do|does|can)${ASSISTANT}(have|do|use|offer)$`),
  // what are your abilities
  new RegExp(`^whatare(your|ur)${ABILITIES}$`),
];

export function isSmallTalk(message: string): boolean {
  const letters = message.toLowerCase().replace(/[^a-z]/g, '');
  if (!letters) return false;
  // "hi, who are you" → "whoareyou"; a greeting alone leaves "".
  const rest = letters.replace(GREETING, '');
  return rest === '' || SMALL_TALK.some((pattern) => pattern.test(rest));
}

// Does the answer start with one of the fixed replies? Case, the curly
// apostrophe (’) and the fixed reply's final "." don't matter.
function startsWithFixed(answer: string, fixed: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/’/g, "'");
  return norm(answer).startsWith(norm(fixed).replace(/[.?!]$/, ''));
}

export type GuardResult = {
  text: string;
  citations: Citation[];
};

// Runs in code after the LLM answers (DESIGN §4), so refusals don't depend on
// the model following the prompt:
//   1. Labels that weren't in this prompt are invented: strip them.
//   2. Valid labels become citations (in order of first use), also those the
//      model used in tool arguments: a Discord summary written from chunks
//      [c1][c2] makes those chunks sources of this turn, even if the reply
//      itself only says "Posted it".
//   3. No valid citation, and the model gave one of the fixed replies ("I can't
//      do that.", "What should I post to Discord? …") → the fixed text, built
//      here, so nothing the model added after it gets through.
//   4. No valid citation + no tool called + not small talk → fixed refusal.
export function applyCitationGuard(input: {
  answer: string;
  chunks: RetrievedChunk[];
  userMessage: string;
  toolCalled: boolean;
  toolText?: string; // the turn's tool-call arguments, as text
  abilities: string[]; // for the "I can't do that." reply
}): GuardResult {
  const byLabel = new Map(input.chunks.map((c) => [c.label, c]));
  const used: string[] = [];

  const text = input.answer
    .replace(CITATION_GROUP, (_group, inner: string) => {
      const valid = inner
        .split(',')
        .map((label) => label.trim())
        .filter((label) => byLabel.has(label));
      for (const label of valid) if (!used.includes(label)) used.push(label);
      return valid.map((label) => `[${label}]`).join('');
    })
    // Tidy the gap left where an invented label was removed ("7731 ." → "7731.").
    .replace(/[ \t]+([.,;:!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  for (const label of citationLabels(input.toolText ?? '')) {
    if (byLabel.has(label) && !used.includes(label)) used.push(label);
  }

  const citations: Citation[] = used.map((label) => {
    const c = byLabel.get(label)!;
    return {
      label,
      chunk_id: c.chunk_id,
      document_id: c.document_id,
      filename: c.filename,
      section: c.section,
      similarity: Number(c.similarity.toFixed(4)),
    };
  });

  if (citations.length === 0 && startsWithFixed(text, CANT_DO)) {
    return { text: cantDoReply(input.abilities), citations: [] };
  }
  if (citations.length === 0 && startsWithFixed(text, ASK_WHAT_TO_POST)) {
    return { text: ASK_WHAT_TO_POST, citations: [] };
  }
  if (citations.length === 0 && !input.toolCalled && !isSmallTalk(input.userMessage)) {
    return { text: REFUSAL, citations: [] };
  }
  return { text, citations };
}
