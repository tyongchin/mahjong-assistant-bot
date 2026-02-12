import type { Env } from "../types/env";

export type ResultStateStatus = "awaiting_submit";

export interface ResultStateRow {
  chat_id: string;
  session_id: number;
  status: ResultStateStatus;
  updated_at: number;
}

export async function setResultState(
  env: Env,
  chatId: string,
  sessionId: number,
  status: ResultStateStatus
): Promise<void> {
  const now = Date.now();
  await env.DB.prepare(
    `INSERT OR REPLACE INTO result_state (chat_id, session_id, status, updated_at)
     VALUES (?, ?, ?, ?)`
  )
    .bind(chatId, sessionId, status, now)
    .run();
}

export async function getResultState(env: Env, chatId: string): Promise<ResultStateRow | null> {
  const row = await env.DB.prepare(
    `SELECT chat_id, session_id, status, updated_at
     FROM result_state
     WHERE chat_id = ?
     LIMIT 1`
  )
    .bind(chatId)
    .first<ResultStateRow>();

  return row ?? null;
}

export async function clearResultState(env: Env, chatId: string): Promise<void> {
  await env.DB.prepare(`DELETE FROM result_state WHERE chat_id = ?`).bind(chatId).run();
}

export async function clearDraft(env: Env, sessionId: number): Promise<void> {
  await env.DB.prepare(`DELETE FROM result_drafts WHERE session_id = ?`).bind(sessionId).run();
}

export async function writeDraft(
  env: Env,
  sessionId: number,
  rows: Array<{ userId: string; delta: number }>
): Promise<void> {
  const now = Date.now();
  const stmts = rows.map((r) =>
    env.DB.prepare(
      `INSERT INTO result_drafts (session_id, user_id, delta, updated_at)
       VALUES (?, ?, ?, ?)`
    ).bind(sessionId, r.userId, r.delta, now)
  );

  if (stmts.length > 0) {
    await env.DB.batch(stmts);
  }
}

export interface DraftRow {
  user_id: string;
  delta: number;
}

export async function getDraft(env: Env, sessionId: number): Promise<DraftRow[]> {
  const res = await env.DB.prepare(
    `SELECT user_id, delta
     FROM result_drafts
     WHERE session_id = ?
     ORDER BY user_id ASC`
  )
    .bind(sessionId)
    .all<DraftRow>();

  return res.results ?? [];
}

export async function sumDraft(env: Env, sessionId: number): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COALESCE(SUM(delta), 0) AS s
     FROM result_drafts
     WHERE session_id = ?`
  )
    .bind(sessionId)
    .first<{ s: number }>();

  return row ? row.s : 0;
}
