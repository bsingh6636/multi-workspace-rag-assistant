import type { Citation } from '../db';
import { REFUSAL } from './prompt';
import type { RetrievedChunk } from './retrieve';

// A citation group: [c1], [c1, c3] or [c1,c3]. Adjacent groups ([c1][c2]) are
// matched one at a time.
const CITATION_GROUP = /\[(c\d+(?:\s*,\s*c\d+)*)\]/g;

// Messages that don't need a source: greetings, thanks, goodbyes and questions
// about the assistant itself. The WHOLE message must be one of these (plus a few
// filler words and punctuation), so "hi, what is the Falcon code?" still needs
// a citation.
const SMALL_TALK =
  /^\s*(hi|hello|hey|yo|good (morning|afternoon|evening)|thanks|thank you|thx|ty|cheers|ok|okay|cool|great|nice|bye|goodbye|see you|who are you|what are you|what can you do|how can you help( me)?|help)( there| again| so much| a lot| everyone| assistant)?[\s!.?,]*$/i;

export function isSmallTalk(message: string): boolean {
  return SMALL_TALK.test(message);
}

export type GuardResult = {
  text: string;
  citations: Citation[];
};

// Runs in code after the LLM answers (DESIGN §4), so refusals don't depend on
// the model following the prompt:
//   1. Labels that weren't in this prompt are invented: strip them.
//   2. Valid labels become citations (in order of first use).
//   3. No valid citation + no tool called + not small talk → fixed refusal.
export function applyCitationGuard(input: {
  answer: string;
  chunks: RetrievedChunk[];
  userMessage: string;
  toolCalled: boolean;
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

  if (citations.length === 0 && !input.toolCalled && !isSmallTalk(input.userMessage)) {
    return { text: REFUSAL, citations: [] };
  }
  return { text, citations };
}
