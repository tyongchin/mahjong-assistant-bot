export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    console.log("Incoming:", request.method, url.pathname);

    if (request.method === "GET") {
      return new Response("ok", { status: 200 });
    }

    if (request.method !== "POST" || url.pathname !== "/telegram/webhook") {
      return new Response("Not found", { status: 404 });
    }

    // Verify secret (if you set one)
    const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    console.log("Secret header present:", !!secret);
    if (env.TELEGRAM_WEBHOOK_SECRET && secret !== env.TELEGRAM_WEBHOOK_SECRET) {
      console.log("Secret mismatch!");
      return new Response("Forbidden", { status: 403 });
    }

    const update = await request.json();
    console.log("Update keys:", Object.keys(update));

    // Handle both message and callback_query etc.
    const chatId =
      update?.message?.chat?.id ??
      update?.callback_query?.message?.chat?.id ??
      update?.edited_message?.chat?.id;

    const text =
      update?.message?.text ??
      update?.callback_query?.data ??
      update?.edited_message?.text;

    console.log("chatId:", chatId, "text:", text);

    if (!chatId) {
      console.log("No chatId found (not a normal message update).");
      return new Response("ok", { status: 200 });
    }

    // Call Telegram API and log response
    const resp = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: "Worker received your message ✅" }),
    });

    const body = await resp.text();
    console.log("Telegram sendMessage status:", resp.status);
    console.log("Telegram sendMessage body:", body);

    return new Response("ok", { status: 200 });
  },
};
