# HonorBot Bounty

> Standalone Discord bot for the **Bounty Board** feature. Shares the same MongoDB and Honor Points as the main Honor Bot — one economy, two bots.

[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-ISC-green.svg)](LICENSE)

---

## Overview

| Item | Description |
|------|--------------|
| **Purpose** | Bounty Board only: create bounties, escrow Honor Points, award points to responders. |
| **Database** | Same `users` (Honor Points) and `bounties` collections as the main bot — single source of truth. |
| **Interaction** | Buttons and modals only; no slash commands. |

Run the main Honor Bot for daily check-in, profile, leaderboard, etc.; run **HonorBot Bounty** for Bounty Board only. Ideal for separating concerns or avoiding DB conflicts during local development. In multi-stack deployment, run **honor-points-service (Stack 1)** first so MongoDB and the Honor Points API are available.

---

## Prerequisites

- **Node.js** 18+
- **MongoDB** (local, Docker, or Atlas)
- **Discord** bot token and channel IDs for Bounty Hub, Forum, Showcase, and Admin

---

## Setup

### 1. Clone and install

```bash
git clone <your-repo-url>
cd honorbot-bounty
npm install
```

### 2. Environment variables

Copy the example env and edit:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_TOKEN` | Yes | Your bot token. |
| `MONGO_URI` | Yes | MongoDB connection string. See [Database safety](#database-safety) below. |
| `BOUNTY_HUB_CHANNEL_ID` | Yes | Channel for "Create Bounty" / "Check My Bounties" buttons. |
| `BOUNTY_FORUM_CHANNEL_ID` | Yes | Forum channel for bounty threads. |
| `BOUNTY_SHOWCASE_CHANNEL_ID` | Yes | Channel for bounty cards. |
| `BOUNTY_ADMIN_CHANNEL_ID` | Yes | Admin channel for awarding points. |
| `BOUNTY_MAX_POINTS` | No | Max points per bounty (default: 100). |
| `CLIENT_ID` / `GUILD_ID` | No | For deploy/clear slash commands (this bot is button-only). |

### 3. Database safety

**Avoid pointing local runs at production data.** Use different database names:

| Environment | `MONGO_URI` example |
|-------------|----------------------|
| **Local (development)** | `mongodb://127.0.0.1:27017/honorbot_test` — use a **test** DB name. |
| **Production (VPS)** | `mongodb://mongodb:27017/honorbot` or your real MongoDB URL. |

- Never use the production `MONGO_URI` in your local `.env` when testing.
- See [SAFETY.md](SAFETY.md) for a full checklist.

---

## Run

### Development

```bash
npm run dev
```

### Production (built)

```bash
npm run build
npm start
```

### Docker

| Command | Description |
|---------|-------------|
| `docker build -t honorbot-bounty .` | Build image. |
| `docker run --rm --env-file .env honorbot-bounty` | Run container with env file. |
| `docker compose up -d` | Build and run in background (uses `docker-compose.yml`). |

**MongoDB from host (Mac/Windows):**  
Use `MONGO_URI=mongodb://host.docker.internal:27017/honorbot` (or `/honorbot_test` for local testing).  
On Linux you may need the host IP or `network_mode: host`.

---

## Deployment (Git → VPS)

1. **Local:** Commit and push. `.env` is in `.gitignore` and will not be pushed.
   ```bash
   git add .
   git commit -m "Your message"
   git push
   ```

2. **VPS:** Pull, then create `.env` on the server with production values:
   - `MONGO_URI` → your real MongoDB (e.g. `mongodb://mongodb:27017/honorbot`)
   - Optional: `HONOR_POINTS_API_URL`, `HONOR_POINTS_API_KEY` to use the central Honor Points API; `BOTS_LOGGER_URL`, `BOTS_LOGGER_API_KEY` for action logging.
   - `DISCORD_TOKEN` and all Bounty channel IDs

3. **Run on VPS:**
   ```bash
   docker compose up -d
   ```
   or:
   ```bash
   npm install && npm run build && npm start
   ```

The bot will then read and write Honor Points and bounties in the production database.

---

## Shared data

| Collection | Usage |
|------------|--------|
| `users` | Same Honor Points as the main bot (balance check, deduct on create bounty, add on award). |
| `bounties` | Bounty threads and status; this bot is the sole manager when running. |

---

## Commands and interactions

This bot has **no slash commands**. All interaction is via:

- **Bounty Hub:** "Create Bounty" and "Check My Bounties" buttons.
- **Modals:** Topic and amount when creating a bounty.
- **Thread / Admin:** "Notify Admin", "Done", "Points Awarded" buttons.

If you reuse an existing Discord app that had slash commands, run `npm run deploy` once to clear them (script deploys an empty command list).

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Run with nodemon (development). |
| `npm run build` | Compile TypeScript to `dist/`. |
| `npm start` | Run `dist/index.js`. |
| `npm run deploy` | Register slash commands (empty for this bot). |
| `npm run clear-commands` | Clear guild/global commands. |
