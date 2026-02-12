import type { ExecutionContext, ScheduledEvent } from "@cloudflare/workers-types";

import type { Env } from "./types/env";
import type { TgUpdate } from "./types/telegram";

import { parseCommand, makeDisplayName } from "./utils/parse";
import { sendMessage } from "./telegram/api";
import { runDecay } from "./leaderboard/decay";
import { upsertPlayer } from "./db/players";

import { cmdNewGame } from "./commands/newgame";
import { cmdEndGame } from "./commands/endgame";
import { cmdJoin } from "./commands/join";
import { cmdLeave } from "./commands/leave";
import { cmdStatus } from "./commands/status";
import { cmdAdd } from "./commands/add";
import { cmdRemove } from "./commands/remove";
import { cmdShuffleTables } from "./commands/shuffletables";
import { cmdResultSubmit } from "./commands/resultsubmit";
import { cmdResultFinalize } from "./commands/resultfinalize";
import { cmdSetPoints } from "./commands/admin/setpoints";
import { cmdLeaderboard } from "./commands/leaderboard";
import { cmdGuestAdd } from "./commands/guestadd";
import { cmdGuestRemove } from "./commands/guestremove";
import { cmdRemoveFromLb } from "./commands/admin/removefromlb";

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

        // Register player in the database
        await upsertPlayer(
            env,
            String(msg.from.id),
            msg.from.username ?? null,
            makeDisplayName(msg.from)
        );

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

        let reply: string | string[] | null = null;

        try {
            switch (command) {
            case "newgame":
                reply = await cmdNewGame(env, chatId, userId, text);
                break;
            case "endgame":
                reply = await cmdEndGame(env, chatId);
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
            case "add":
                reply = await cmdAdd(env, chatId, text);
                break;
            case "remove":
                reply = await cmdRemove(env, chatId, text);
                break;
            case "shuffletables":
                reply = await cmdShuffleTables(env, chatId);
                break;
            case "resultsubmit":
                reply = await cmdResultSubmit(env, chatId, text);
                break;
            case "resultfinalize":
                reply = await cmdResultFinalize(env, chatId);
                break;
            case "leaderboard":
                reply = await cmdLeaderboard(env, chatId);
                break;
            case "guestadd":
                reply = await cmdGuestAdd(env, chatId, text);
                break;
            case "guestremove":
                reply = await cmdGuestRemove(env, chatId, text);
                break;
            // Admin commands
            case "setpoints":
                reply = await cmdSetPoints(env, chatId, userId, text);
                break;
            case "removefromlb":
                reply = await cmdRemoveFromLb(env, chatId, userId, text);
                break;
            default:
                reply = null;
                break;
            }
        } catch (e) {
            console.log("Command error:", e);
            reply = "Something went wrong 😵‍💫";
        }
        
        if (reply !== null) {
            ctx.waitUntil(
                (async () => {
                if (Array.isArray(reply)) {
                    for (const r of reply) {
                    await sendMessage(env, msg.chat.id, r);
                    }
                } else {
                    await sendMessage(env, msg.chat.id, reply);
                }
                })()
            );
        }
        return new Response("ok", { status: 200 });
    },

    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
        ctx.waitUntil(runDecay(env));
    }
};
