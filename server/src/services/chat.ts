import { MESSAGE_COLUMNS, orderToolCalls, supabase, type MessageRow } from '../db';
import { applyCitationGuard } from './citations';
import { config } from '../config';
import { describeAiError } from './gemini';
import { generate, SafetyBlockedError } from './llm';
import {
  BLOCKED_REPLY,
  buildContents,
  buildSystemPrompt,
  describeNow,
  listAbilities,
  safeTimeZone,
  type HistoryMessage,
} from './prompt';
import { retrieve } from './retrieve';
import { runToolLoop } from './toolLoop';
import { executeToolCall, toolAbilities, toolDeclarations } from './tools';

const HISTORY_LIMIT = 10;

// Produces the answer for one user message and writes it into the (already
// created, status 'pending') assistant row. Used by both "send" and "retry".
// It never throws: on any failure the row becomes 'failed' with a short reason,
// and the user's message (saved earlier) is untouched (hard rule 9).
export async function answer(input: {
  workspaceId: string;
  chatId: string;
  userMessage: MessageRow;
  assistantMessageId: string;
  timeZone?: string; // the browser's IANA time zone, only used for "today"
}): Promise<MessageRow> {
  const started = Date.now();
  const question = input.userMessage.content ?? '';

  try {
    const history = await loadHistory(input.chatId, input.userMessage.created_at);

    // Scoped retrieval; zero kept chunks still goes on to the LLM.
    const { chunks, retrieval } = await retrieve(input.workspaceId, question);

    // The LLM is always called with tools attached (hard rule 7). The context
    // the tools get comes from the server, never from the model.
    const ctx = {
      workspaceId: input.workspaceId,
      chatId: input.chatId,
      messageId: input.assistantMessageId,
      userMessage: question,
      chunkLabels: chunks.map((c) => c.label),
    };
    const abilities = listAbilities(toolAbilities);
    const llm = await runToolLoop({
      systemInstruction: buildSystemPrompt(describeNow(safeTimeZone(input.timeZone)), abilities),
      contents: buildContents(history, chunks, question),
      tools: toolDeclarations,
      maxRounds: config.MAX_TOOL_ITERATIONS,
      generate,
      execute: (call, rejectReason) => executeToolCall(call, ctx, rejectReason),
    });

    // A turn that called a tool was an action, so it doesn't need a citation.
    const guarded = applyCitationGuard({
      answer: llm.text,
      chunks,
      userMessage: question,
      toolCalled: llm.toolCalled,
      toolText: llm.toolCalls.map((call) => JSON.stringify(call.args ?? {})).join('\n'),
      abilities,
    });
    retrieval.hit = guarded.citations.length > 0;

    return await updateMessage(input.assistantMessageId, {
      status: 'done',
      content: guarded.text,
      citations: guarded.citations,
      retrieval,
      error: null,
      tokens_in: llm.tokensIn,
      tokens_out: llm.tokensOut,
      latency_ms: Date.now() - started,
    });
  } catch (err) {
    // Gemini's safety filter blocked the question or the reply. That's an
    // answer, not a failure: Retry would be blocked again.
    if (err instanceof SafetyBlockedError) {
      console.warn(`Answer ${input.assistantMessageId} blocked by the safety filter (${err.reason})`);
      return await updateMessage(input.assistantMessageId, {
        status: 'done',
        content: BLOCKED_REPLY,
        citations: [],
        error: null,
        latency_ms: Date.now() - started,
      });
    }
    const message = describeAiError(err, 'AI service') || 'Something went wrong while answering. Please try again.';
    console.error(
      `Answer failed for message ${input.assistantMessageId}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return await updateMessage(input.assistantMessageId, {
      status: 'failed',
      error: message,
      latency_ms: Date.now() - started,
    });
  }
}

// The last few finished messages before this question, oldest first.
// Pending and failed rows are skipped.
async function loadHistory(chatId: string, before: string): Promise<HistoryMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('role, content')
    .eq('chat_id', chatId)
    .eq('status', 'done')
    .in('role', ['user', 'assistant'])
    .lt('created_at', before)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) throw error;

  const history = (data as { role: 'user' | 'assistant'; content: string | null }[])
    .filter((m) => m.content)
    .map((m) => ({ role: m.role, content: m.content! }))
    .reverse();
  return dropBlockedTurns(history);
}

// A question the safety filter blocked would be sent again with every later
// message in this chat and block those too. So a blocked answer and the user
// message before it are left out of the history.
export function dropBlockedTurns(history: HistoryMessage[]): HistoryMessage[] {
  const kept: HistoryMessage[] = [];
  for (const m of history) {
    if (m.role === 'assistant' && m.content === BLOCKED_REPLY) {
      if (kept.at(-1)?.role === 'user') kept.pop();
      continue;
    }
    kept.push(m);
  }
  return kept;
}

async function updateMessage(id: string, fields: Partial<MessageRow>): Promise<MessageRow> {
  const { data, error } = await supabase
    .from('messages')
    .update(fields)
    .eq('id', id)
    .select(MESSAGE_COLUMNS)
    .order(...orderToolCalls)
    .single<MessageRow>();
  if (error) throw error;
  return data;
}
