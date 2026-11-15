// Registers the Telegram webhook and the command menu.
//   TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... node scripts/telegram-webhook.mjs https://your.domain
// Use --delete to remove the webhook (e.g. before switching to long polling).
const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const arg = process.argv[2];
if (!token) {
  console.error("Set TELEGRAM_BOT_TOKEN");
  process.exit(1);
}
const call = async (method, body) => {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) {
    console.error(`${method} failed: ${json.description}`);
    process.exit(1);
  }
  return json.result;
};

if (arg === "--delete") {
  await call("deleteWebhook", {});
  console.log("Webhook removed");
  process.exit(0);
}
if (!arg || !/^https:\/\//.test(arg)) {
  console.error("Usage: node scripts/telegram-webhook.mjs https://your.domain   (HTTPS is required by Telegram)");
  process.exit(1);
}
if (!secret || secret.length < 16 || !/^[A-Za-z0-9_-]+$/.test(secret)) {
  console.error("Set TELEGRAM_WEBHOOK_SECRET: 16+ characters from A-Z a-z 0-9 _ -");
  process.exit(1);
}
await call("setWebhook", {
  url: `${arg.replace(/\/$/, "")}/api/telegram/webhook`,
  secret_token: secret,
  allowed_updates: ["message", "callback_query", "my_chat_member"],
});
await call("setMyCommands", { commands: [{ command: "list", description: "Мої відстеження" }, { command: "help", description: "Як це працює" }] });
await call("setMyCommands", { commands: [{ command: "list", description: "My trackers" }, { command: "help", description: "How it works" }], language_code: "en" });
console.log(`Webhook set to ${arg}/api/telegram/webhook`);
