import type { Env } from "../../types/env";
import { getUserIdByUsername } from "../../db/players";
import { isAuthorized } from "../../telegram/api";

export async function cmdRemoveFromLb(
  env: Env,
  chatId: string,
  callerUserId: string,
  rawText: string
): Promise<string> 
{
    const authorized = await isAuthorized(env, chatId, callerUserId);
    if (!authorized) {
        return "Only group owners/admins can use this command.";
    }

    const targetRaw = rawText.trim();
    if (!targetRaw) {
        return "Usage: /removefromlb @username";
    }

    const username = targetRaw.startsWith("@") ? targetRaw.slice(1) : targetRaw;
    const userId = await getUserIdByUsername(env, username);
    if (!userId) {
        return `Unknown user ${username}. (Bot must have seen them before.)`;
    }
    const result = await env.DB.prepare(
        `DELETE FROM leaderboard WHERE chat_id = ? AND user_id = ?`
    )
    .bind(chatId, userId)
    .run(); 

    if (result.meta.changes && result.meta.changes > 0) {
        return `✅ Removed ${username} from the leaderboard.`;
    } 
    else {
        return `${username} was not on the leaderboard.`;
    }   
}