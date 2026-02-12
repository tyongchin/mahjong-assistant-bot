# 🀄 Mahjong Assistant Bot

A Telegram group bot for managing live Mahjong sessions with friends.

Built with:
- Cloudflare Workers (TypeScript)
- Cloudflare D1 (SQLite)
- Telegram Bot API (Webhook mode)

---

# 🎴 Core Session Commands

### Start & Manage Sessions

- `/newgame [title]`  
  Start a new Mahjong session (optional title supported)

- `/endgame`  
  Prints the result submission template  
  (Session only closes on `/resultfinalize`)

- `/join`  
  Join active session

- `/leave`  
  Leave active session

- `/status`  
  Show current tables and players

- `/shuffletables`  
  Shuffle seating randomly (does NOT persist new order)

---

# 👥 Player Management

### Add / Remove Players

- `/add <username>`  
  Add a Telegram user to session

- `/remove <username>`  
  Remove a Telegram user from session

---

### Guest Players (Virtual Players)

- `/guestadd <name>`  
  Add a dummy guest player (not in Telegram group)

- `/guestremove <name>`  
  Remove guest player

Guests:
- Participate in settlement
- Do NOT affect leaderboard
- Are stored as virtual players

---

# 🧾 Results Flow

### Step 1 — Prepare

- `/endgame`  
  Prints result submission template  
  Safe to call multiple times  

---

### Step 2 — Submit Results

- `/resultsubmit`
```
/resultsubmit
alice 12
bob -8
charlie -4
david 0
```

Rules:
- Integers only
- `+` optional
- Totals should sum to 0
- Can resubmit anytime
- Neutral players allowed

---

### Step 3 — Finalize

- `/resultfinalize`

On finalize:
- Auto-balances missing/extra money proportionally
- Computes minimum transfers
- Applies leaderboard points
- Clears draft
- Ends session

---

# 🏆 Leaderboard System

- `/leaderboard`  
  Display group leaderboard

### Points Rules

- Winners: +1
- Losers: -1
- Top winner(s): +1 bonus (ties supported)
- Top loser(s): -1 penalty (ties supported)
- Neutral players logged (for decay tracking)

---

# 📉 Decay System

Weekly cron job:

- If player inactive for 30+ days → -1 point
- Decay resets timer
- Warn players 1 week before decay
- Runs automatically via Cloudflare Cron

---

# 🔧 Admin Commands

Admins =  
- Telegram group owner  
- IDs in `BOT_ADMIN_IDS` env variable  

### Commands

- `/setpoints <username> <value>`  
  Set leaderboard points manually

- `/removefromlb <username>`  
  Remove user from leaderboard

---

# 🏗 Architecture

```
src/
  commands/
  db/
  leaderboard/
  settlement/
  utils/
  worker.ts
```

### Key Components

- `worker.ts` → Telegram webhook entry
- `commands/` → Bot commands
- `db/` → D1 queries
- `settlement/` → Min transfer algorithm
- `leaderboard/` → Points + decay logic
- `cron` handler → Weekly decay

---

# 🗄 Database Tables

- `sessions`
- `session_players`
- `players`
- `result_drafts`
- `leaderboard`
- `leaderboard_log`

Everything is isolated per Telegram group (`chat_id`).

---

# 🚀 Deployment

### wrangler.toml

```toml
name = "mahjong-assistant-bot"
main = "src/worker.ts"
compatibility_date = "2026-02-10"

[[d1_databases]]
binding = "DB"
database_name = "mahjong_assistant_bot"
database_id = "YOUR_DB_ID"

[triggers]
crons = ["0 0 * * 0"] # Weekly

[vars]
ADMIN_USER_IDS = "TELEGRAM_ADMIN_ID"
```

---

### Deploy

```bash
npx wrangler deploy
```

---

### Set Webhook

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook" \
  -d "url=https://your-worker-url/telegram/webhook" \
  -d "secret_token=<YOUR_SECRET>"
```

---

# 🛡 Environment Variables

In Cloudflare Workers → Settings → Variables:

| Variable | Type | Purpose |
|-----------|------|---------|
| TELEGRAM_BOT_TOKEN | Secret | Bot token |
| TELEGRAM_WEBHOOK_SECRET | Secret | Webhook verification |
| BOT_ADMIN_IDS | Text | Array of admin user IDs |

Example:
```json
["123456789"]
```

---

# 📌 Design Principles

- Per-group isolation
- Fully serverless
- No external backend
- Guests supported
- Settlement minimizes transfers
- Leaderboard logs every session
- Neutral players tracked for decay

---

# 🔮 Future Ideas

- Seasonal reset system
- Stats dashboard
- Export leaderboard
- Inline buttons UI
- Performance analytics

---

# 🀄 Built For Live Mahjong Nights
Lightweight. Persistent. Fair. Automatic.
