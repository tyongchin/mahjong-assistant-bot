import type { D1Database } from "@cloudflare/workers-types";

export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  DB: D1Database;
}
