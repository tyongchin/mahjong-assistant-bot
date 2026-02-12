import type { Env } from "../types/env";

export interface SessionPlayerRow {
  user_id: string;
  username: string | null;
  display_name: string | null;
  joined_at: number;
  table_no: number | null;
  seat_no: number | null;
}

export async function getActiveSession(env: Env, chatId: string) {
  return await env.DB.prepare(
    `SELECT id, title
     FROM sessions
     WHERE chat_id = ? AND status = 'active'
     LIMIT 1`
  )
    .bind(chatId)
    .first<{ id: number; title: string | null }>();
}

export async function getActiveSessionId(
  env: Env, 
  chatId: string
): Promise<number | null> {
  const row = await env.DB
    .prepare("SELECT id FROM sessions WHERE chat_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1")
    .bind(chatId)
    .first<{ id: number }>();

  return row ? row.id : null;
}

export async function createSession(
  env: Env,
  chatId: string,
  userId: string,
  title: string | null
): Promise<number> {
  const now = Date.now();

  const res = await env.DB.prepare(
    `INSERT INTO sessions (chat_id, status, created_by, created_at, title)
     VALUES (?, 'active', ?, ?, ?)`
  )
    .bind(chatId, userId, now, title)
    .run();

  return res.meta.last_row_id as number;
}

export async function addPlayerToSession(
  env: Env,
  sessionId: number,
  userId: string,
  username: string | null,
  displayName: string
): Promise<void> {
  const now = Date.now();

  // How many players already in session?
  const existingCount = await countPlayers(env, sessionId);

  const tableNo = Math.floor(existingCount / 4) + 1;
  const seatNo = (existingCount % 4) + 1;

  await env.DB
    .prepare(
      `INSERT OR IGNORE INTO session_players
       (session_id, user_id, username, display_name, joined_at, table_no, seat_no)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(sessionId, userId, username, displayName, now, tableNo, seatNo)
    .run();
}


export async function removePlayerFromSession(
  env: Env, sessionId: 
  number, 
  userId: string
): Promise<number> {
  const res = await env.DB
    .prepare("DELETE FROM session_players WHERE session_id = ? AND user_id = ?")
    .bind(sessionId, userId)
    .run();

  return (res as any)?.meta?.changes ?? 0;
}

export async function listPlayers(
  env: Env, 
  sessionId: number
): Promise<SessionPlayerRow[]> {
  const res = await env.DB
    .prepare(
      `SELECT user_id, username, display_name, joined_at, table_no, seat_no
       FROM session_players
       WHERE session_id = ?
       ORDER BY joined_at ASC`
    )
    .bind(sessionId)
    .all<SessionPlayerRow>();

  return res.results ?? [];
}


export async function countPlayers(
  env: Env, 
  sessionId: number
): Promise<number> {
  const row = await env.DB
    .prepare(`SELECT COUNT(*) AS c FROM session_players WHERE session_id = ?`)
    .bind(sessionId)
    .first<{ c: number }>();

  return row ? row.c : 0;
}
