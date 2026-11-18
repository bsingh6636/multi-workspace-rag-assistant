-- Schema for the multi-workspace assistant. Spec: docs/DESIGN.md §1.
--
-- DEV ONLY: this file drops and recreates every app table, so running it
-- wipes all app data. Run it in the Supabase SQL editor, then run match_chunks.sql.

create extension if not exists vector;

drop table if exists tool_calls, tasks, messages, chats, chunks, documents, profiles, workspaces cascade;

-- A user owns many workspaces. Everything else hangs off a workspace.
create table workspaces (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 80),
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);

-- One row per user. Remembers the workspace they were last in.
create table profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  last_workspace_id  uuid references workspaces(id) on delete set null,
  created_at         timestamptz not null default now()
);

create table documents (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  filename      text not null,
  content_hash  text not null,                -- sha256 of the extracted text
  status        text not null default 'processing'
                check (status in ('processing', 'ready', 'failed')),
  error         text,
  chunk_count   int not null default 0,
  created_at    timestamptz not null default now(),
  unique (workspace_id, content_hash)         -- idempotent re-uploads
);

-- THE single shared vector store. Every row carries its workspace_id,
-- and retrieval filters on it inside the vector query (match_chunks.sql).
create table chunks (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  document_id   uuid not null references documents(id) on delete cascade,
  chunk_index   int not null,
  content       text not null,
  section       text,                         -- nearest heading or "page N"
  embedding     vector(768) not null,
  created_at    timestamptz not null default now()
);
-- Deliberately no HNSW/IVFFlat index on embedding: an exact scan filtered by
-- workspace_id is fast at this size and never loses recall (DESIGN §7).

create table chats (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  title         text,                         -- first ~60 chars of the first question
  created_at    timestamptz not null default now()
);

create table messages (
  id            uuid primary key default gen_random_uuid(),
  chat_id       uuid not null references chats(id) on delete cascade,
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  role          text not null check (role in ('user', 'assistant', 'tool')),
  content       text,
  citations     jsonb not null default '[]',  -- [{chunk_id, document_id, filename, section, similarity}]
  retrieval     jsonb,                        -- debug: {workspace_id, chunks, threshold, hit}
  status        text not null default 'done'
                check (status in ('pending', 'done', 'failed')),
  error         text,
  tokens_in     int,
  tokens_out    int,
  latency_ms    int,
  created_at    timestamptz not null default now()
);

-- Side effect of the save_task tool.
create table tasks (
  id                     uuid primary key default gen_random_uuid(),
  workspace_id           uuid not null references workspaces(id) on delete cascade,
  title                  text not null,
  due_date               date,
  done_at                timestamptz,          -- null = open; set when marked done
  created_by_message_id  uuid references messages(id) on delete set null,
  created_at             timestamptz not null default now()
);

-- Every tool call the model asks for, including unknown tools and bad args.
create table tool_calls (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  chat_id       uuid references chats(id) on delete cascade,
  message_id    uuid references messages(id) on delete set null,
  tool_name     text not null,                -- as the model sent it, even if unknown
  args          jsonb,
  status        text not null
                check (status in ('success', 'invalid_args', 'unknown_tool', 'error')),
  result        jsonb,
  error         text,
  latency_ms    int,
  created_at    timestamptz not null default now()
);

-- Indexes for the columns we filter on.
create index workspaces_user_id_idx     on workspaces (user_id);
create index documents_workspace_id_idx on documents (workspace_id, created_at desc);
create index chunks_workspace_id_idx    on chunks (workspace_id);
create index chunks_document_id_idx     on chunks (document_id);
create index chats_workspace_id_idx     on chats (workspace_id, created_at desc);
create index messages_chat_id_idx       on messages (chat_id, created_at);
create index tasks_workspace_id_idx     on tasks (workspace_id, created_at desc);
create index tool_calls_workspace_idx   on tool_calls (workspace_id, created_at desc);

-- RLS on with no policies: the browser's anon key can read nothing.
-- Only the server, using the service-role key (which bypasses RLS), reaches
-- the data, and it checks ownership itself with requireWorkspace().
alter table workspaces enable row level security;
alter table profiles   enable row level security;
alter table documents  enable row level security;
alter table chunks     enable row level security;
alter table chats      enable row level security;
alter table messages   enable row level security;
alter table tasks      enable row level security;
alter table tool_calls enable row level security;
