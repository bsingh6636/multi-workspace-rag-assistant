import { supabase, type MessageRow } from '../db';
import { applyCitationGuard } from './citations';
import { describeAiError } from './gemini';
import { generate } from './llm';
import { buildContents, buildSystemPrompt, type HistoryMessage } from './prompt';
import { retrieve } from './retrieve';

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
}): Promise<MessageRow> {
  const started = Date.now();
  const question = input.userMessage.content ?? '';

  try {
    const history = await loadHistory(input.chatId, input.userMessage.created_at);

    // Scoped retrieval; zero kept chunks still goes on to the LLM.
    const { chunks, retrieval } = await retrieve(input.workspaceId, question);

    const llm = await generate({
      systemInstruction: buildSystemPrompt(today()),
      contents: buildContents(history, chunks, question),
    });

    // Part 4: toolCalled becomes true when a tool ran in this turn.
    const guarded = applyCitationGuard({ answer: llm.text, chunks, userMessage: question, toolCalled: false });
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

  return (data as { role: 'user' | 'assistant'; content: string | null }[])
    .filter((m) => m.content)
    .map((m) => ({ role: m.role, content: m.content! }))
    .reverse();
}

async function updateMessage(id: string, fields: Partial<MessageRow>): Promise<MessageRow> {
  const { data, error } = await supabase.from('messages').update(fields).eq('id', id).select('*').single<MessageRow>();
  if (error) throw error;
  return data;
}

// YYYY-MM-DD in UTC. Lets the model resolve "Friday" or "tomorrow".
function today(): string {
  return new Date().toISOString().slice(0, 10);
}
