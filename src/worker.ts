import type { Env } from "./types/env";
import type { TgUpdate } from "./types/telegram";

import { parseCommand, makeDisplayName } from "./utils/parse";
import { sendMessage } from "./telegram/api";

import { cmdNewGame } from "./commands/newgame";
import { cmdJoin } from "./commands/join";
import { cmdLeave } from "./commands/leave";
import { cmdStatus } from "./commands/status";

import type { ExecutionContext } from "@cloudflare/workers-types";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET") return new Response("ok", { status: 200 });
    if (request.method !== "POST" || url.pathname !== "/telegram/webhook") {
      return new Response("Not found", { status: 404 });
    }

    const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (env.TELEGRAM_WEBHOOK_SECRET && secret !== env.TELEGRAM_WEBHOOK_SECRET) {
      return new Response("Forbidden", { status: 403 });
    }

    const update = (await request.json()) as TgUpdate;
    const msg = update.message ?? update.edited_message;
    if (!msg || !msg.chat || !msg.from || typeof msg.text !== "string") {
      return new Response("ok", { status: 200 });
    }

    if (msg.chat.type !== "group" && msg.chat.type !== "supergroup") {
      ctx.waitUntil(sendMessage(env, msg.chat.id, "Please add me to a group to use sessions 🙂"));
      return new Response("ok", { status: 200 });
    }

    const text = msg.text.trim();
    if (!text.startsWith("/")) return new Response("ok", { status: 200 });

    const { command } = parseCommand(text);

    const chatId = String(msg.chat.id);
    const userId = String(msg.from.id);
    const username = msg.from.username ? String(msg.from.username) : null;
    const displayName = makeDisplayName(msg.from);

    let reply: string;

    try {
      switch (command) {
        case "newgame":
          reply = await cmdNewGame(env, chatId, userId);
          break;
        case "join":
          reply = await cmdJoin(env, chatId, userId, username, displayName);
          break;
        case "leave":
          reply = await cmdLeave(env, chatId, userId);
          break;
        case "status":
          reply = await cmdStatus(env, chatId);
          break;
        default:
          reply =
            "Commands:\n" +
            "/newgame - start a session\n" +
            "/join - join session\n" +
            "/leave - leave session\n" +
            "/status - show current players";
      }
    } catch (e) {
      console.log("Command error:", e);
      reply = "Something went wrong 😵‍💫";
    }

    ctx.waitUntil(sendMessage(env, msg.chat.id, reply));
    return new Response("ok", { status: 200 });
  },
};
