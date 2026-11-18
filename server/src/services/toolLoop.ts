import type { Content, FunctionCall, Part, Tool } from '@google/genai';
import type { GeminiKey } from './gemini';
import type { LlmRequest, LlmResult } from './llm';

// More calls than this in one reply aren't run (they get an error instead),
// so one runaway reply can't, say, post to Discord 40 times.
export const MAX_CALLS_PER_ROUND = 5;

export type LoopResult = {
  text: string;
  toolCalled: boolean; // the model asked for at least one tool this turn (any outcome)
  toolCalls: FunctionCall[]; // every call the model asked for, in order
  model: string;
  tokensIn: number;
  tokensOut: number;
};

// The tool loop (DESIGN §5). Pure: the model call and the tool executor are
// passed in, so tests can drive it with fakes.
//
//   round 1..maxRounds: ask the model (tools attached).
//     text only      → that's the answer.
//     function calls → send back the model's turn as received, then one
//                      functionResponse per call, and ask again.
//   rounds used up    → one last call with tools switched off, so it must answer in text.
export async function runToolLoop(input: {
  systemInstruction: string;
  contents: Content[];
  tools: Tool[];
  maxRounds: number;
  generate: (req: LlmRequest) => Promise<LlmResult>;
  // Runs (or, with rejectReason, refuses and logs) one call. Returns what the model sees.
  execute: (call: FunctionCall, rejectReason?: string) => Promise<Record<string, unknown>>;
  // Checked after each round of calls: true ends the turn with no text (the
  // caller writes the answer). Used when delete_workspace removed the chat itself.
  stop?: () => boolean;
}): Promise<LoopResult> {
  const contents = [...input.contents];
  let model: string | undefined; // pinned after the first reply…
  let key: GeminiKey | undefined; // …together with the API key it ran on
  const toolCalls: FunctionCall[] = [];
  let tokensIn = 0;
  let tokensOut = 0;

  for (let round = 0; ; round++) {
    const lastRound = round === input.maxRounds;
    const reply = await input.generate({
      systemInstruction: input.systemInstruction,
      contents,
      tools: input.tools,
      toolMode: lastRound ? 'NONE' : 'AUTO',
      // One model (and key) for the whole turn: thought signatures belong to the model that wrote them.
      model,
      key,
    });
    model = reply.model;
    key = reply.key;
    tokensIn += reply.tokensIn ?? 0;
    tokensOut += reply.tokensOut ?? 0;

    if (reply.functionCalls.length === 0 || lastRound) {
      // Calls in the forced last reply (tools off) aren't run, but every call
      // the model asks for is logged (hard rule 4). They don't count as "a tool
      // was called" for the citation guard: nothing ran.
      for (const call of reply.functionCalls) {
        await input.execute(call, 'No more tool calls this turn: answer in text');
      }
      if (!reply.text) throw new Error('The model returned no text answer');
      return { text: reply.text, toolCalled: toolCalls.length > 0, toolCalls, model, tokensIn, tokensOut };
    }

    toolCalls.push(...reply.functionCalls);
    contents.push(reply.content);

    const responses: Part[] = [];
    for (const [i, call] of reply.functionCalls.entries()) {
      const rejectReason =
        i < MAX_CALLS_PER_ROUND ? undefined : `Too many tool calls in one reply (max ${MAX_CALLS_PER_ROUND})`;
      const response = await input.execute(call, rejectReason);
      responses.push({ functionResponse: { id: call.id, name: call.name, response } });
    }
    if (input.stop?.()) return { text: '', toolCalled: true, toolCalls, model, tokensIn, tokensOut };
    contents.push({ role: 'user', parts: responses });
  }
}
