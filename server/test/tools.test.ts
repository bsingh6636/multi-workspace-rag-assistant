import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { FunctionCall } from '@google/genai';
import type { LlmRequest, LlmResult } from '../src/services/llm';
import { buildSystemPrompt, describeNow, listAbilities, safeTimeZone } from '../src/services/prompt';
import { MAX_CALLS_PER_ROUND, runToolLoop } from '../src/services/toolLoop';
import { blockReasonOf } from '../src/services/llm';
import { dropBlockedTurns } from '../src/services/chat';
import { BLOCKED_REPLY, blockedReply } from '../src/services/prompt';
import {
  discordSourceError,
  executeToolCall,
  TOOL_NAMES,
  toolAbilities,
  toolDeclarations,
  type ToolCallLog,
} from '../src/services/tools';

const ctx = {
  workspaceId: 'ws-1',
  chatId: 'chat-1',
  messageId: 'msg-1',
  userMessage: 'Save a task',
  chunkLabels: ['c1', 'c2'],
};

// Runs one call with a fake log, so no database is touched (these paths stop
// before a tool's run()).
async function execute(call: FunctionCall, rejectReason?: string) {
  const logs: ToolCallLog[] = [];
  const response = await executeToolCall(call, ctx, rejectReason, async (row) => {
    logs.push(row);
  });
  assert.equal(logs.length, 1, 'every call is logged exactly once');
  return { response, log: logs[0] };
}

describe('tool declarations', () => {
  test('declare exactly the four allowed tools (no delete tool, on purpose)', () => {
    const names = toolDeclarations[0].functionDeclarations!.map((d) => d.name);
    assert.deepEqual(names, ['save_task', 'list_tasks', 'complete_task', 'send_discord_summary']);
  });

  test('no tool takes a workspace_id, and extra arguments are not allowed', () => {
    for (const d of toolDeclarations[0].functionDeclarations!) {
      const schema = d.parametersJsonSchema as { properties: object; additionalProperties: boolean };
      assert.ok(!('workspace_id' in schema.properties), d.name);
      assert.equal(schema.additionalProperties, false, d.name);
      assert.ok(!('$schema' in schema), d.name);
    }
  });

  test('every tool has an ability line, and the "what can you do" list shows them all', () => {
    assert.equal(toolAbilities.length, TOOL_NAMES.length);
    const prompt = buildSystemPrompt('Wednesday, 2026-11-18 (UTC)', listAbilities(toolAbilities));
    for (const ability of toolAbilities) {
      assert.ok(ability.trim().length > 0);
      assert.ok(prompt.includes(`- ${ability}`), ability);
    }
    assert.ok(prompt.includes("answer questions from this workspace's documents"));
  });
});

describe('executeToolCall', () => {
  test('an unknown tool is refused and logged as unknown_tool', async () => {
    const { response, log } = await execute({ name: 'delete_everything', args: {} });
    assert.match(String(response.error), /Unknown tool "delete_everything"/);
    assert.equal(log.status, 'unknown_tool');
    assert.equal(log.tool_name, 'delete_everything');
    assert.equal(log.workspace_id, 'ws-1');
    assert.equal(log.message_id, 'msg-1');
  });

  test('inherited object keys are not tools', async () => {
    for (const name of ['toString', '__proto__', 'constructor']) {
      const { log } = await execute({ name, args: {} });
      assert.equal(log.status, 'unknown_tool', name);
    }
  });

  test('a call with no name is logged as unknown', async () => {
    const { log } = await execute({ args: {} });
    assert.equal(log.status, 'unknown_tool');
    assert.equal(log.tool_name, '(missing)');
  });

  test('an impossible date is invalid_args, with the raw args logged', async () => {
    const args = { title: 'Pay rent', due_date: '2026-02-30' };
    const { response, log } = await execute({ name: 'save_task', args });
    assert.equal(log.status, 'invalid_args');
    assert.deepEqual(log.args, args);
    assert.match(String(response.error), /due_date/);
  });

  test('a relative date is invalid_args (the model must send YYYY-MM-DD)', async () => {
    const { log } = await execute({ name: 'save_task', args: { title: 'Call vendor', due_date: 'tomorrow' } });
    assert.equal(log.status, 'invalid_args');
  });

  test('a workspace_id argument from the model is rejected, not used', async () => {
    const { log } = await execute({ name: 'save_task', args: { title: 'x', workspace_id: 'someone-elses' } });
    assert.equal(log.status, 'invalid_args');
    assert.equal(log.workspace_id, 'ws-1');
  });

  test('a blank title and an out-of-range limit are invalid_args', async () => {
    assert.equal((await execute({ name: 'save_task', args: { title: '   ' } })).log.status, 'invalid_args');
    assert.equal((await execute({ name: 'list_tasks', args: { limit: 500 } })).log.status, 'invalid_args');
    assert.equal((await execute({ name: 'send_discord_summary', args: {} })).log.status, 'invalid_args');
  });

  test('complete_task needs a real uuid and takes no workspace_id', async () => {
    const id = '0a8a5a93-980e-4a3d-9a69-b1bc940d0146';
    assert.equal((await execute({ name: 'complete_task', args: {} })).log.status, 'invalid_args');
    assert.equal((await execute({ name: 'complete_task', args: { task_id: 'Call vendor' } })).log.status, 'invalid_args');
    const { log } = await execute({ name: 'complete_task', args: { task_id: id, workspace_id: 'someone-elses' } });
    assert.equal(log.status, 'invalid_args');
    assert.equal(log.workspace_id, 'ws-1');
  });

  test('there is no delete tool: a delete_task call is an unknown tool', async () => {
    const { log } = await execute({ name: 'delete_task', args: { task_id: 'x' } });
    assert.equal(log.status, 'unknown_tool');
  });

  test('a rejected call is logged as error and not run', async () => {
    const { response, log } = await execute({ name: 'save_task', args: { title: 'x' } }, 'Too many tool calls');
    assert.equal(log.status, 'error');
    assert.deepEqual(response, { error: 'Too many tool calls' });
  });
});

// A fake model: returns the scripted replies in order and records each request.
function fakeModel(replies: Partial<LlmResult>[]) {
  const requests: LlmRequest[] = [];
  const generate = async (req: LlmRequest): Promise<LlmResult> => {
    requests.push({ ...req, contents: [...req.contents] });
    const reply = replies[requests.length - 1];
    assert.ok(reply, 'model called more times than scripted');
    const functionCalls = reply.functionCalls ?? [];
    return {
      content: { role: 'model', parts: functionCalls.map((functionCall) => ({ functionCall })) },
      text: '',
      functionCalls,
      model: 'fake-model',
      tokensIn: 10,
      tokensOut: 2,
      ...reply,
    };
  };
  return { generate, requests };
}

function fakeExecutor() {
  const calls: { call: FunctionCall; rejectReason?: string }[] = [];
  const execute = async (call: FunctionCall, rejectReason?: string) => {
    calls.push({ call, rejectReason });
    return rejectReason ? { error: rejectReason } : { result: { ok: true } };
  };
  return { execute, calls };
}

const base = { systemInstruction: 'rules', contents: [{ role: 'user', parts: [{ text: 'hi' }] }], tools: [] };

describe('runToolLoop', () => {
  test('a text reply is the answer, with no tool called', async () => {
    const model = fakeModel([{ text: 'Hello!' }]);
    const tools = fakeExecutor();
    const result = await runToolLoop({ ...base, maxRounds: 3, generate: model.generate, execute: tools.execute });
    assert.equal(result.text, 'Hello!');
    assert.equal(result.toolCalled, false);
    assert.equal(model.requests.length, 1);
    assert.equal(model.requests[0].toolMode, 'AUTO');
    assert.equal(tools.calls.length, 0);
  });

  test('multi-step: save, then Discord, then a text answer', async () => {
    const save = { id: 'a', name: 'save_task', args: { title: 'X' } };
    const discord = { id: 'b', name: 'send_discord_summary', args: { summary: 'X' } };
    const model = fakeModel([{ functionCalls: [save] }, { functionCalls: [discord] }, { text: 'Saved and sent.' }]);
    const tools = fakeExecutor();
    const result = await runToolLoop({ ...base, maxRounds: 3, generate: model.generate, execute: tools.execute });

    assert.equal(result.text, 'Saved and sent.');
    assert.equal(result.toolCalled, true);
    assert.deepEqual(result.toolCalls, [save, discord]);
    assert.deepEqual(
      tools.calls.map((c) => c.call.name),
      ['save_task', 'send_discord_summary'],
    );
    assert.equal(result.tokensIn, 30);
    assert.equal(result.tokensOut, 6);

    // Round 2 sees the model's own turn, then the tool result with the call's id.
    const second = model.requests[1].contents;
    assert.equal(second.length, 3);
    assert.equal(second[1].role, 'model');
    assert.deepEqual(second[1].parts![0].functionCall, save);
    assert.deepEqual(second[2].parts![0].functionResponse, { id: 'a', name: 'save_task', response: { result: { ok: true } } });

    // The first reply's model answers the rest of the turn.
    assert.equal(model.requests[0].model, undefined);
    assert.equal(model.requests[1].model, 'fake-model');
  });

  test('after maxRounds of tool calls, a last call must answer in text', async () => {
    const call = { name: 'list_tasks', args: {} };
    const model = fakeModel([
      { functionCalls: [call] },
      { functionCalls: [call] },
      { functionCalls: [call], text: 'Here are your tasks.' },
    ]);
    const tools = fakeExecutor();
    const result = await runToolLoop({ ...base, maxRounds: 2, generate: model.generate, execute: tools.execute });

    assert.equal(result.text, 'Here are your tasks.');
    assert.equal(tools.calls.length, 2, 'calls in the forced last reply are not run');
    assert.deepEqual(
      model.requests.map((r) => r.toolMode),
      ['AUTO', 'AUTO', 'NONE'],
    );
  });

  test(`only ${MAX_CALLS_PER_ROUND} calls per reply run; the rest are refused`, async () => {
    const calls = Array.from({ length: 7 }, (_, i) => ({ id: `c${i}`, name: 'send_discord_summary', args: {} }));
    const model = fakeModel([{ functionCalls: calls }, { text: 'Done.' }]);
    const tools = fakeExecutor();
    await runToolLoop({ ...base, maxRounds: 3, generate: model.generate, execute: tools.execute });

    assert.equal(tools.calls.length, 7, 'every call gets a response and a log row');
    assert.equal(tools.calls.filter((c) => c.rejectReason).length, 2);
    assert.equal(model.requests[1].contents.at(-1)!.parts!.length, 7);
  });

  test('a final reply with no text is an error', async () => {
    const model = fakeModel([{ functionCalls: [{ name: 'list_tasks', args: {} }] }, { functionCalls: [{ name: 'list_tasks', args: {} }] }]);
    const tools = fakeExecutor();
    await assert.rejects(
      runToolLoop({ ...base, maxRounds: 1, generate: model.generate, execute: tools.execute }),
      /no text answer/,
    );
  });
});

describe('today in the user time zone', () => {
  const lateEvening = new Date('2026-11-18T20:00:00Z');

  test('the date and time follow the time zone', () => {
    assert.equal(describeNow('UTC', lateEvening), 'Wednesday, 2026-11-18, 20:00 (UTC)');
    assert.equal(describeNow('Asia/Kolkata', lateEvening), 'Thursday, 2026-11-19, 01:30 (Asia/Kolkata)');
  });

  test('midnight is 00:00 on the new day, not 24:00', () => {
    const midnightInIndia = new Date('2026-11-18T18:30:00Z');
    assert.equal(describeNow('Asia/Kolkata', midnightInIndia), 'Thursday, 2026-11-19, 00:00 (Asia/Kolkata)');
  });

  test('an unknown or missing zone falls back to UTC', () => {
    assert.equal(safeTimeZone('Mars/Olympus_Mons'), 'UTC');
    assert.equal(safeTimeZone(undefined), 'UTC');
    assert.equal(safeTimeZone('Asia/Kolkata'), 'Asia/Kolkata');
  });
});

describe('Discord post source check', () => {
  const turn = (userMessage: string, chunkLabels: string[] = []) => ({ userMessage, chunkLabels });

  test('a summary citing a chunk from this prompt may be posted', () => {
    const summary = "Brijesh's last working day at Vedak was in September 2026 [c2].";
    assert.equal(discordSourceError(summary, turn('send brijesh last working day to discord', ['c1', 'c2'])), null);
  });

  test("the user's own words may be posted (case and punctuation don't matter)", () => {
    assert.equal(discordSourceError('Those were test message, ignore.', turn('send that those were test message ignore')), null);
    assert.equal(discordSourceError('wtf', turn('send wtf to discord')), null);
  });

  // Every case below was posted in the user's manual test on 2026-11-18.
  for (const [summary, userMessage, chunkLabels] of [
    ['Hello from the workspace', 'send message to discord', []],
    ["The workspace documents do not mention Brijesh's last working day (LWD).", 'send brijesh lwd in discord .', ['c1', 'c2']],
    ['brijesh last working day', 'can u send discord message', []],
    ['NONE FOUND', 'send above as message', []],
    ['A summary citing a chunk that was not in this prompt [c9].', 'post the summary', ['c1']],
  ] as const) {
    test(`refuses "${summary}" for "${userMessage}"`, () => {
      assert.match(String(discordSourceError(summary, turn(userMessage, [...chunkLabels]))), /^Not posted/);
    });
  }

  test('a refused post is logged as an error and nothing is sent', async () => {
    const { response, log } = await execute({ name: 'send_discord_summary', args: { summary: 'NONE FOUND' } });
    assert.match(String(response.error), /^Not posted/);
    assert.equal(log.status, 'error');
  });
});

describe('safety filter', () => {
  test('a blocked prompt or reply is detected; a normal stop is not', () => {
    assert.equal(blockReasonOf({ promptFeedback: { blockReason: 'SAFETY' as never } }), 'SAFETY');
    assert.equal(blockReasonOf({ candidates: [{ finishReason: 'PROHIBITED_CONTENT' as never }] }), 'PROHIBITED_CONTENT');
    assert.equal(blockReasonOf({ candidates: [{ finishReason: 'STOP' as never }] }), null);
    assert.equal(blockReasonOf({}), null);
  });

  test('a blocked turn and its question are left out of later history', () => {
    const history = [
      { role: 'user' as const, content: 'hello' },
      { role: 'assistant' as const, content: 'Hi!' },
      { role: 'user' as const, content: '(abusive text)' },
      { role: 'assistant' as const, content: BLOCKED_REPLY },
      { role: 'user' as const, content: 'what can you do' },
    ];
    assert.deepEqual(dropBlockedTurns(history), [history[0], history[1], history[4]]);
  });

  test('a reply blocked after a tool worked says what was done', () => {
    assert.equal(blockedReply([]), BLOCKED_REPLY);
    assert.equal(blockedReply(['unknown_thing']), BLOCKED_REPLY);
    const text = blockedReply(['list_tasks', 'list_tasks']);
    assert.equal(
      text,
      'Your tasks were loaded, but the content filter blocked my reply. You can see the result in the Tasks or Tool calls tab.',
    );
    assert.match(blockedReply(['list_tasks', 'complete_task']), /^Your tasks were loaded\. The task was marked done, but/);
  });

  test('that longer blocked reply is left out of later history too', () => {
    const history = [
      { role: 'user' as const, content: 'list all tasks' },
      { role: 'assistant' as const, content: blockedReply(['list_tasks']) },
      { role: 'user' as const, content: 'thanks' },
    ];
    assert.deepEqual(dropBlockedTurns(history), [history[2]]);
  });
});
