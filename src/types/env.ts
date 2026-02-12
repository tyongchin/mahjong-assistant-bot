import type { D1Database } from "@cloudflare/workers-types";

export interface Env {
    DB: D1Database;
    TELEGRAM_BOT_TOKEN: string;
    TELEGRAM_WEBHOOK_SECRET?: string;
    ADMIN_USER_IDS?: string;
}
