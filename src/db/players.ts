import type { Env } from "../types/env";

export async function upsertPlayer(
  env: Env,
  userId: string,
  username: string | null,
  displayName: string
): Promise<void> {
    // If they have no username, we can still store by user_id, but can't look them up by username later.
    const now = Date.now();

    if (!username) {
        await env.DB
        .prepare(`INSERT OR REPLACE INTO players (user_id, username, display_name, updated_at)
                    VALUES (?, NULL, ?, ?)`)
        .bind(userId, displayName, now)
        .run();
        return;
    }

    const uname = normalizeUsername(username);

    await env.DB
        .prepare(`INSERT OR REPLACE INTO players (user_id, username, display_name, updated_at)
                VALUES (?, ?, ?, ?)`)
        .bind(userId, uname, displayName, now)
        .run();
}

export async function getUserIdByUsername(env: Env, username: string): Promise<string | null> {
    const uname = normalizeUsername(username);

    const row = await env.DB
        .prepare(`SELECT user_id FROM players WHERE username = ? LIMIT 1`)
        .bind(uname)
        .first<{ user_id: string }>();

    return row ? row.user_id : null;
}

export function normalizeUsername(username: string): string {
    // store lowercase, without leading '@'
    return username.trim().replace(/^@+/, "").toLowerCase();
}

export async function getVirtualUserIdByName(
  env: Env,
  chatId: string,
  name: string
): Promise<string | null> {
  const uname = normalizeUsername(name);

  const row = await env.DB.prepare(
    `SELECT user_id FROM players
     WHERE owner_chat_id = ? AND is_virtual = 1 AND username = ?
     LIMIT 1`
  ).bind(chatId, uname).first<{ user_id: string }>();

  return row?.user_id ?? null;
}

export async function createOrGetVirtualPlayer(
  env: Env,
  chatId: string,
  name: string
): Promise<{ userId: string; username: string; displayName: string }> {
  const uname = normalizeUsername(name);
  const existing = await getVirtualUserIdByName(env, chatId, uname);
  if (existing) {
    return { userId: existing, username: uname, displayName: uname };
  }

  const now = Date.now();
  const userId = `guest:${crypto.randomUUID()}`; // works in Workers

  await env.DB.prepare(
    `INSERT INTO players (user_id, username, display_name, updated_at, is_virtual, owner_chat_id)
     VALUES (?, ?, ?, ?, 1, ?)`
  ).bind(userId, uname, uname, now, chatId).run();

  return { userId, username: uname, displayName: uname };
}