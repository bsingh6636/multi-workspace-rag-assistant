import { MESSAGE_COLUMNS, orderToolCalls, supabase, type MessageRow } from '../db';
import { applyCitationGuard } from './citations';
import { config } from '../config';
import { describeAiError } from './gemini';
import { generate, SafetyBlockedError } from './llm';
import {
  blockedReply,
  buildContents,
  buildSystemPrompt,
  describeNow,
  isBlockedReply,
  listAbilities,
  safeTimeZone,
  type HistoryMessage,
} from './prompt';
import { retrieve } from './retrieve';
import { runToolLoop } from './toolLoop';
import { inProgress } from './recovery';
import { executeToolCall, toolAbilities, toolDeclarations, type ToolContext } from './tools';

const HISTORY_LIMIT = 10;

// Produces the answer for one user message and writes it into the (already
// created, status 'pending') assistant row. Used by both "send" and "retry".
// On any failure the row becomes 'failed' with a short reason, and the user's
// message (saved earlier) is untouched (hard rule 9). It only throws if even
// that write fails; then the row is still 'pending', and the next message list
// marks it failed because it's no longer in progress (recovery.ts).
export async function answer(input: AnswerInput): Promise<AnswerResult> {
  inProgress.answers.add(input.assistantMessageId);
  try {
    return await answerUntracked(input);
  } finally {
    inProgress.answers.delete(input.assistantMessageId);
  }
}

// workspaceDeleted: the user confirmed delete_workspace in this turn. The
// workspace, this chat and `message` are gone (message was never saved); the
// client switches to `next`.
export type AnswerResult = {
  message: MessageRow;
  workspaceDeleted: { deletedName: string; next: { id: string; name: string }; created: boolean } | null;
};

type AnswerInput = {
  workspaceId: string;
  chatId: string;
  userMessage: MessageRow;
  assistantMessageId: string;
  timeZone?: string; // the browser's IANA time zone, only used for "today"
};

async function answerUntracked(input: AnswerInput): Promise<AnswerResult> {
  const started = Date.now();
  const question = input.userMessage.content ?? '';
  // Tools that succeeded this turn. If the safety filter then blocks the reply,
  // the answer still says what was done (prompt.ts blockedReply).
  const toolsRun: string[] = [];

  try {
    const history = await loadHistory(input.chatId, input.userMessage.created_at);

    // Scoped retrieval; zero kept chunks still goes on to the LLM.
    const { chunks, retrieval } = await retrieve(input.workspaceId, question);

    // The LLM is always called with tools attached (hard rule 7). The context
    // the tools get comes from the server, never from the model.
    const last = history.at(-1);
    const ctx: ToolContext = {
      workspaceId: input.workspaceId,
      chatId: input.chatId,
      messageId: input.assistantMessageId,
      userMessage: question,
      previousAnswer: last?.role === 'assistant' ? last.content : null,
      previousAnswerId: last?.role === 'assistant' ? (last.id ?? null) : null,
      chunkLabels: chunks.map((c) => c.label),
      posts: {},
      deletion: { state: 'none' },
    };
    const abilities = listAbilities(toolAbilities);
    const llm = await runToolLoop({
      systemInstruction: buildSystemPrompt(describeNow(safeTimeZone(input.timeZone)), abilities),
      contents: buildContents(history, chunks, question),
      tools: toolDeclarations,
      maxRounds: config.MAX_TOOL_ITERATIONS,
      generate,
      execute: async (call, rejectReason) => {
        // Calls after a confirmed delete in the same reply would hit a deleted workspace.
        if (ctx.deletion.state === 'deleted') rejectReason = 'The workspace was deleted';
        const outcome = await executeToolCall(call, ctx, rejectReason);
        if ('result' in outcome) toolsRun.push(call.name ?? '');
        return outcome;
      },
      stop: () => ctx.deletion.state === 'deleted',
    });

    // Deleted: the chat and this message row went with the workspace, so
    // there's nothing to update. The reply only travels back in the response.
    if (ctx.deletion.state === 'deleted') {
      const { deletedName, next, created } = ctx.deletion;
      return {
        message: {
          id: input.assistantMessageId,
          chat_id: input.chatId,
          workspace_id: input.workspaceId,
          role: 'assistant',
          content: `Deleted the workspace "${deletedName}" and everything in it.`,
          citations: [],
          retrieval: null,
          status: 'done',
          error: null,
          tokens_in: llm.tokensIn,
          tokens_out: llm.tokensOut,
          latency_ms: Date.now() - started,
          created_at: new Date().toISOString(),
        },
        workspaceDeleted: { deletedName, next, created },
      };
    }

    // Step 1 of delete_workspace: the reply is the server's fixed question,
    // whatever the model wrote, so the user sees exactly what a yes will do.
    if (ctx.deletion.state === 'asked') {
      return saved(
        await updateMessage(input.assistantMessageId, {
          status: 'done',
          content: ctx.deletion.question,
          citations: [],
          retrieval,
          error: null,
          tokens_in: llm.tokensIn,
          tokens_out: llm.tokensOut,
          latency_ms: Date.now() - started,
        }),
      );
    }

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

    return saved(await updateMessage(input.assistantMessageId, {
      status: 'done',
      content: guarded.text,
      citations: guarded.citations,
      retrieval,
      error: null,
      tokens_in: llm.tokensIn,
      tokens_out: llm.tokensOut,
      latency_ms: Date.now() - started,
    }));
  } catch (err) {
    // Gemini's safety filter blocked the question or the reply. That's an
    // answer, not a failure: Retry would be blocked again.
    if (err instanceof SafetyBlockedError) {
      console.warn(
        `Answer ${input.assistantMessageId} blocked by the safety filter (${[err.reason, ...err.categories].join(', ')})`,
      );
      return saved(
        await updateMessage(input.assistantMessageId, {
          status: 'done',
          content: blockedReply(toolsRun),
          citations: [],
          error: null,
          latency_ms: Date.now() - started,
        }),
      );
    }
    const message = describeAiError(err, 'AI service') || 'Something went wrong while answering. Please try again.';
    console.error(
      `Answer failed for message ${input.assistantMessageId}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return saved(
      await updateMessage(input.assistantMessageId, {
        status: 'failed',
        error: message,
        latency_ms: Date.now() - started,
      }),
    );
  }
}

const saved = (message: MessageRow): AnswerResult => ({ message, workspaceDeleted: null });

// The last few finished messages before this question, oldest first.
// Pending and failed rows are skipped.
async function loadHistory(chatId: string, before: string): Promise<HistoryMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, role, content')
    .eq('chat_id', chatId)
    .eq('status', 'done')
    .in('role', ['user', 'assistant'])
    .lt('created_at', before)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) throw error;

  const history = (data as { id: string; role: 'user' | 'assistant'; content: string | null }[])
    .filter((m) => m.content)
    .map((m) => ({ id: m.id, role: m.role, content: m.content! }))
    .reverse();
  return dropBlockedTurns(history);
}

// A question the safety filter blocked would be sent again with every later
// message in this chat and block those too. So a blocked answer and the user
// message before it are left out of the history.
export function dropBlockedTurns(history: HistoryMessage[]): HistoryMessage[] {
  const kept: HistoryMessage[] = [];
  for (const m of history) {
    if (m.role === 'assistant' && isBlockedReply(m.content)) {
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
