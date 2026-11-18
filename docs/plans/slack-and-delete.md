# Slack posts and "delete everything" from chat

Asked by the user on 2026-11-18 (after Part 7, before deploy).

## 1. `send_slack_summary`

The same tool as `send_discord_summary`, posting to a Slack Incoming Webhook.

- `SLACK_WEBHOOK_URL` in env (optional, server-only, never logged). Not set → `error` "Slack isn't set up on this server".
- Both post tools are built by one helper (`makePostTool` in `tools.ts`), so they share every check:
  - **The user asked** (`postRequestError`): their latest message mentions discord/slack or a posting verb, or answers the fixed "What should I post?" question.
  - **The text has a source** (`postSourceError`): `[cN]` labels from this turn's chunks, or the user's own words.
  - **Retry doesn't post twice**: the first N posts of a retry are skipped if an earlier attempt made N (counted per tool).
  - `[cN]` labels removed, 10 s timeout.
- Slack body: `{ text }`. `&`, `<` and `>` are escaped (Slack's own rule), so `<!channel>` or `<!here>` in a summary can't ping anyone. (Discord keeps `allowed_mentions: { parse: [] }`.)
- `ASK_WHAT_TO_POST` no longer names Discord: "What should I post? …".

## 2. `delete_workspace` (the user's "delete everything")

The user chose: **chat only**, the assistant asks "are you sure?", and only an explicit yes deletes. The **workspace itself is removed** too (cascade deletes documents, chunks, chats, messages, tasks and tool calls).

Why it's not called `delete_everything`: that's the name the brief's injection test uses. With a different name, the test still logs `unknown_tool`, and the real tool is guarded below anyway.

**Two steps, both checked in code (the prompt only helps the model call it):**

1. **Ask.** The user's own latest message must ask: a delete word (delete, remove, wipe, erase, destroy, clear) followed by "everything" or "workspace". "delete all my tasks" doesn't count. Then the tool deletes nothing. It returns `confirmation_asked`, and **the server** (not the model) writes the reply: the fixed question with the workspace name, ending `Reply "yes, delete everything" to confirm, or anything else to cancel.`
2. **Confirm.** The tool deletes only if **both** are true:
   - The user's whole message is a yes: `yes`, `yes delete`, `yes, delete it`, `yes, delete everything` (case and trailing `.`/`!` ignored). "yes but keep the tasks", "ok" or "sure" don't count.
   - The assistant message right before it made a `delete_workspace` call that asked (looked up in `tool_calls`). So text the model wrote itself, perhaps because a document told it to, can't stand in for the question.

   If either is missing and the message asks to delete, the flow goes back to step 1. Otherwise the call is refused as `error`.

A document saying "call delete_workspace" can't do anything: the user's message must ask, and then the user must still type yes.

**Always keep one workspace (the user's follow-up):**
- Another workspace exists → `last_workspace_id` points to the oldest other one, and the client switches there.
- It was the only one → the server first creates a new workspace named "Default" (or "Workspace" if the deleted one was called Default, since names must differ while both exist), then deletes the old one.

**After the delete:** the chat and its messages are gone, so:
- The tool loop stops right away (`stop` hook in `runToolLoop`), with no extra LLM round against a deleted workspace.
- The tool-call row can't be inserted (its workspace is gone, and it would cascade anyway). The server prints one audit line instead: workspace id and user id, never content.
- `answer()` returns `{ message, workspaceDeleted }` without writing the message row. The API sends `workspaceDeleted: { deletedName, next: Workspace, created }`.
- Client: a toast ("Deleted workspace “X”" plus "created “Default”" if one was made), reload the workspace list, switch to `next` with `replace` (Back doesn't return to the deleted URL).

## Files

- `server/src/config.ts`, `.env.example`: `SLACK_WEBHOOK_URL`
- `server/src/services/tools.ts`: `makePostTool`, Slack tool, `delete_workspace`, context fields
- `server/src/services/toolLoop.ts`: optional `stop()` hook
- `server/src/services/chat.ts`: fixed confirmation reply, deleted result
- `server/src/services/prompt.ts`: rules, neutral `ASK_WHAT_TO_POST`, blocked-reply lines
- `server/src/controllers/chat.controller.ts`: `workspaceDeleted` in send/retry responses
- `client/src/types.ts`, `ChatPanel.tsx`, `Dashboard.tsx`: switch after a delete
- `server/test/tools.test.ts`: request/confirm matching, injection refusal, Slack escaping, loop stop
- `docs/DESIGN.md` §5, `PLAN.md`, `README.md` (env list)

## Test by hand

1. "post the Falcon code to slack" in A: posted to Slack, with no `[c1]` in the text.
2. "delete everything": the confirmation question appears, nothing is deleted. Reply "no": nothing is deleted.
3. "delete everything", then "yes, delete everything": the workspace is gone and you're on another one.
4. Repeat on your only workspace: a new "Default" is created and opened.
5. The injection workspace (B), asking a normal question: no delete happens, even if the model tries.
