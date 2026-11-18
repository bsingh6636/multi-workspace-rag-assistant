// Creates (or refreshes) the demo account:
//   A – Falcon : falcon.md, falcon-launch-runbook.md
//   B – Other  : employee-handbook.md, office-wifi-and-it.md, injection.txt
//
//   SEED_EMAIL=demo@example.com SEED_PASSWORD=… npm run seed
//
// Safe to re-run: workspaces are upserted, and a document that's already there
// is skipped by its content hash (nothing is embedded again). The password comes
// from the environment, so it's never committed, and it's never printed.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { supabase } from '../db';
import { ingestDocument } from '../services/ingest';

const SEED_DIR = path.resolve(__dirname, '../../../seed'); // the repo's /seed, from src/ or dist/

const WORKSPACES = [
  { name: 'A – Falcon', files: ['falcon.md', 'falcon-launch-runbook.md'] },
  { name: 'B – Other', files: ['employee-handbook.md', 'office-wifi-and-it.md', 'injection.txt'] },
];

const envSchema = z.object({
  SEED_EMAIL: z.email(),
  SEED_PASSWORD: z.string().min(8),
});

async function main() {
  const env = envSchema.safeParse(process.env);
  if (!env.success) {
    const names = env.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Set ${names} (an email, and a password of at least 8 characters)`);
  }
  const { SEED_EMAIL: email, SEED_PASSWORD: password } = env.data;

  const userId = await upsertUser(email, password);
  console.log(`Demo user ready: ${email}`);

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true });
  if (profileError) throw profileError;

  const workspaceIds: string[] = [];
  for (const ws of WORKSPACES) {
    const id = await upsertWorkspace(userId, ws.name);
    workspaceIds.push(id);
    console.log(`\n${ws.name}`);

    for (const filename of ws.files) {
      const buffer = await readFile(path.join(SEED_DIR, filename));
      // The same function an upload goes through, so seeded docs are chunked and embedded the same way.
      const { document, duplicate } = await ingestDocument(id, { originalname: filename, buffer });
      const outcome = duplicate
        ? 'already there'
        : document.status === 'ready'
          ? `added, ${document.chunk_count} chunk${document.chunk_count === 1 ? '' : 's'}`
          : `failed: ${document.error}`;
      console.log(`  ${filename}: ${outcome}`);
    }
  }

  // Open the demo on workspace A.
  const { error } = await supabase.from('profiles').update({ last_workspace_id: workspaceIds[0] }).eq('id', userId);
  if (error) throw error;
  console.log('\nDone. Sign in with the seed email and password.');
}

// Creates the user, or finds the existing one and resets its password, so the
// password in the environment is always the one that works.
async function upsertUser(email: string, password: string): Promise<string> {
  const created = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (!created.error) return created.data.user.id;
  if (created.error.code !== 'email_exists') throw created.error;

  const existing = await findUserByEmail(email);
  if (!existing) throw new Error(`Supabase says ${email} exists, but it wasn't found`);
  const { error } = await supabase.auth.admin.updateUserById(existing, { password, email_confirm: true });
  if (error) throw error;
  return existing;
}

async function findUserByEmail(email: string): Promise<string | null> {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (user) return user.id;
    if (data.users.length < 1000) return null;
  }
}

async function upsertWorkspace(userId: string, name: string): Promise<string> {
  const { error } = await supabase
    .from('workspaces')
    .upsert({ user_id: userId, name }, { onConflict: 'user_id,name', ignoreDuplicates: true });
  if (error) throw error;

  const { data, error: selectError } = await supabase
    .from('workspaces')
    .select('id')
    .eq('user_id', userId)
    .eq('name', name)
    .single();
  if (selectError) throw selectError;
  return data.id;
}

main().catch((err) => {
  console.error('Seed failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
