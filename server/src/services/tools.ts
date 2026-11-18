import type { FunctionCall, Tool } from '@google/genai';
import { z } from 'zod';
import { config } from '../config';
import { supabase } from '../db';
import { citationLabels } from './citations';
import { stripCitationLabels } from './prompt';

// Set by the server for every call, never taken from the model's arguments
// (hard rules 1 and 5). No tool schema even has a workspace_id field.
export type ToolContext = {
  workspaceId: string;
  chatId: string;
  messageId: string; // the assistant message this turn is producing
  userMessage: string; // the question this turn answers
  chunkLabels: string[]; // the [cN] labels of the chunks in this turn's prompt
};

// A Discord post must come from somewhere: chunks from this turn's documents
// (cited with [cN]), or the user's own words in this message. Otherwise the
// model has invented it, copied it from an older message, or posted a
// "not found" note or our own NONE FOUND marker (all seen in testing).
// Returns why the post is refused, or null if it may go out.
export function discordSourceError(summary: string, ctx: Pick<ToolContext, 'userMessage' | 'chunkLabels'>): string | null {
  if (citationLabels(summary).some((label) => ctx.chunkLabels.includes(label))) return null;

  // Dictated: every word of the post is in the user's message (case and
  // punctuation don't matter, but no word may be added).
  const said = new Set(words(ctx.userMessage));
  const posted = words(stripCitationLabels(summary));
  if (posted.length > 0 && posted.every((word) => said.has(word))) return null;

  return (
    "Not posted: the text must be the user's own words from their latest message, " +
    'or a summary of the documents with [cN] labels. Ask the user what to post.'
  );
}

function words(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

type ToolDefinition<S extends z.ZodType> = {
  description: string; // for the model: when to call it
  // For the user: one short line in the "what can you do" answer. Every tool
  // must have one, so a new tool shows up there automatically.
  ability: string;
  // Strict: an argument the schema doesn't list (e.g. an invented workspace_id)
  // is an invalid_args error, not something silently used or dropped.
  schema: S;
  run: (args: z.infer<S>, ctx: ToolContext) => Promise<Record<string, unknown>>;
};

// Only a helper for type inference: each tool's run() gets its own schema's type.
function defineTool<S extends z.ZodType>(tool: ToolDefinition<S>) {
  return tool;
}

// An expected failure whose message is safe to show the model and store in the log.
export class ToolError extends Error {}

const saveTask = defineTool({
  description:
    'Save a task (a to-do item or reminder) in this workspace. Call it whenever the user wants something noted to do ' +
    'later, however they word it: "create/add a task", "remind me to …", "set a reminder", "add … to my to-do list", ' +
    '"don\'t let me forget …". Call it once per task when the message has several. ' +
    'It only saves the task: no alert is sent at the due time, so never promise one.',
  ability: 'save tasks and reminders, with an optional due date and time',
  schema: z.strictObject({
    title: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .describe(
        'What needs to be done, as a short phrase. If the user gave a time, end with it as a clock time, e.g. "Drink water at 21:58". There is no separate time field.',
      ),
    due_date: z.iso
      .date()
      .optional()
      .describe(
        'Due date as YYYY-MM-DD, also when the user gave only a time ("in 5 min" means today, unless it passes midnight). Leave it out if the user gave no date or time.',
      ),
  }),
  async run({ title, due_date }, ctx) {
    // Retry re-runs a whole turn. If this answer already saved the same task,
    // return it instead of saving a second copy.
    const { data: earlier, error: findError } = await supabase
      .from('tasks')
      .select('id, title, due_date')
      .eq('workspace_id', ctx.workspaceId)
      .eq('created_by_message_id', ctx.messageId);
    if (findError) throw findError;
    const same = earlier.find(
      (t) => t.title.toLowerCase() === title.toLowerCase() && t.due_date === (due_date ?? null),
    );
    if (same) return { task_id: same.id, title: same.title, due_date: same.due_date, already_saved: true };

    const { data, error } = await supabase
      .from('tasks')
      .insert({ workspace_id: ctx.workspaceId, title, due_date: due_date ?? null, created_by_message_id: ctx.messageId })
      .select('id, title, due_date')
      .single<{ id: string; title: string; due_date: string | null }>();
    if (error) throw error;
    return { task_id: data.id, title: data.title, due_date: data.due_date };
  },
});

const listTasks = defineTool({
  description:
    "List this workspace's tasks, newest first, with their due dates. Read-only. Call it for any question about " +
    'tasks or reminders: "show my tasks", "what\'s pending", "what\'s due today", "when do I need to …", "did I save …". ' +
    'Answer from its result, never from earlier messages.',
  ability: "list this workspace's tasks and their due dates",
  schema: z.strictObject({
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe('How many tasks to return, newest first (default 10). Use 50 when the user asks for all tasks.'),
  }),
  async run({ limit }, ctx) {
    const { data, error } = await supabase
      .from('tasks')
      .select('title, due_date, created_at')
      .eq('workspace_id', ctx.workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit ?? 10);
    if (error) throw error;
    return { count: data.length, tasks: data };
  },
});

const sendDiscordSummary = defineTool({
  description:
    "Post a message to the team's Discord channel right away. Call it only when the user clearly asks to send, post " +
    'or share something on Discord now; it cannot schedule a post for later.',
  ability: "post a summary to the team's Discord channel when asked",
  schema: z.strictObject({
    summary: z.string().trim().min(1).max(1800).describe(
        "The message to post, in plain text: the user's exact words, or a summary of <documents> with [cN] labels inside it",
      ),
  }),
  async run({ summary }, ctx) {
    const sourceError = discordSourceError(summary, ctx);
    if (sourceError) throw new ToolError(sourceError);

    const url = config.DISCORD_WEBHOOK_URL;
    if (!url) throw new ToolError("Discord isn't set up on this server");

    // Retry re-runs a whole turn, and the new summary text won't be identical,
    // so "already sent" means: this answer has a successful Discord call.
    const { count, error } = await supabase
      .from('tool_calls')
      .select('id', { count: 'exact', head: true })
      .eq('message_id', ctx.messageId)
      .eq('tool_name', 'send_discord_summary')
      .eq('status', 'success');
    if (error) throw error;
    if (count) return { sent: true, already_sent: true };

    // The webhook URL is a secret: it never appears in a result, error or log.
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // [cN] labels only mean something inside this prompt, so they're removed.
        // parse: [] stops "@everyone" in a summary (perhaps from a document) from pinging anyone.
        body: JSON.stringify({ content: stripCitationLabels(summary), allowed_mentions: { parse: [] } }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new ToolError("Couldn't reach Discord");
    }
    if (!res.ok) throw new ToolError(`Discord rejected the message (status ${res.status})`);
    return { sent: true };
  },
});

// The allowlist. A Map, not an object, so a name like "toString" or
// "__proto__" can't match something inherited.
const TOOLS = new Map<string, ToolDefinition<z.ZodType>>([
  ['save_task', saveTask as ToolDefinition<z.ZodType>],
  ['list_tasks', listTasks as ToolDefinition<z.ZodType>],
  ['send_discord_summary', sendDiscordSummary as ToolDefinition<z.ZodType>],
]);

export const TOOL_NAMES = [...TOOLS.keys()];

// The user-facing lines for "what can you do", in registry order.
export const toolAbilities = [...TOOLS.values()].map((tool) => tool.ability);

// What Gemini sees. Generated from the zod schemas, so validation and the
// declaration can't drift apart.
export const toolDeclarations: Tool[] = [
  {
    functionDeclarations: [...TOOLS].map(([name, tool]) => {
      const { $schema: _unused, ...parametersJsonSchema } = z.toJSONSchema(tool.schema);
      return { name, description: tool.description, parametersJsonSchema };
    }),
  },
];

export type ToolCallStatus = 'success' | 'invalid_args' | 'unknown_tool' | 'error';

export type ToolCallLog = {
  workspace_id: string;
  chat_id: string;
  message_id: string;
  tool_name: string;
  args: unknown;
  status: ToolCallStatus;
  result: Record<string, unknown> | null;
  error: string | null;
  latency_ms: number;
};

type Outcome = { status: ToolCallStatus; result?: Record<string, unknown>; error?: string };

// Checks, runs and logs one call the model asked for (DESIGN §5). Never throws:
// every outcome goes back to the model as data, so it can fix its call or explain.
// `log` is replaceable for tests.
export async function executeToolCall(
  call: FunctionCall,
  ctx: ToolContext,
  rejectReason?: string,
  log: (row: ToolCallLog) => Promise<void> = saveToolCallLog,
): Promise<Record<string, unknown>> {
  const started = Date.now();
  const name = call.name ?? '';
  const args = call.args ?? {};

  const outcome = await runCall(name, args, ctx, rejectReason);

  await log({
    workspace_id: ctx.workspaceId,
    chat_id: ctx.chatId,
    message_id: ctx.messageId,
    tool_name: name || '(missing)',
    args,
    status: outcome.status,
    result: outcome.result ?? null,
    error: outcome.error ?? null,
    latency_ms: Date.now() - started,
  });

  return outcome.status === 'success' ? { result: outcome.result } : { error: outcome.error };
}

async function runCall(name: string, args: unknown, ctx: ToolContext, rejectReason?: string): Promise<Outcome> {
  if (rejectReason) return { status: 'error', error: rejectReason };

  const tool = TOOLS.get(name);
  if (!tool) return { status: 'unknown_tool', error: `Unknown tool "${name}". Available: ${TOOL_NAMES.join(', ')}` };

  const parsed = tool.schema.safeParse(args);
  if (!parsed.success) return { status: 'invalid_args', error: z.prettifyError(parsed.error).slice(0, 500) };

  try {
    return { status: 'success', result: await tool.run(parsed.data, ctx) };
  } catch (err) {
    // ToolError messages are written for the model. Anything else (e.g. a
    // database error) is logged on the server and summarized.
    if (err instanceof ToolError) return { status: 'error', error: err.message };
    console.error(`Tool ${name} failed: ${(err as { message?: string })?.message ?? String(err)}`);
    return { status: 'error', error: 'The tool failed because of a server error' };
  }
}

// Best-effort: if the log write fails, the turn goes on. The tool's side effect
// has already happened, and failing the answer would invite a Retry that repeats it.
async function saveToolCallLog(row: ToolCallLog): Promise<void> {
  const { error } = await supabase.from('tool_calls').insert(row);
  if (error) console.error(`Couldn't log tool call ${row.tool_name}: ${error.message}`);
}
