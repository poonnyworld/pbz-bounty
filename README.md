# HonorBot Bounty (Standalone)

Standalone Discord bot for the **Bounty Board** feature. Uses the **same MongoDB** as [honorbot-pbz](../honorbot-pbz) so Honor Points and bounties are shared.

## Setup

1. Copy `.env.example` to `.env`.
2. Set `DISCORD_TOKEN` (this bot’s token; can be a separate Discord app or the same as honorbot-pbz).
3. **สำคัญ:** ตั้งค่า `MONGO_URI` ตามที่รัน:
   - **รันบน Local (ทดสอบ):** ใช้ database แยก เช่น `mongodb://127.0.0.1:27017/honorbot_test` — ห้ามชี้ไปที่ DB จริงบน VPS
   - **รันบน VPS (ใช้งานจริง):** ใช้ DB จริง เช่น `mongodb://127.0.0.1:27017/honorbot`
4. Set Bounty channel IDs: `BOUNTY_HUB_CHANNEL_ID`, `BOUNTY_FORUM_CHANNEL_ID`, `BOUNTY_SHOWCASE_CHANNEL_ID`, `BOUNTY_ADMIN_CHANNEL_ID`.
5. Optional: `CLIENT_ID`, `GUILD_ID` for `npm run deploy` / `npm run clear-commands`.

**ป้องกันคะแนน Honor Point หาย:** อ่าน [SAFETY.md](SAFETY.md) — อย่าตั้ง `MONGO_URI` บน Local ให้ชี้ไปที่ MongoDB ของ production.

## Run

- **Dev:** `npm run dev`
- **Prod:** `npm run build` then `npm start`

### Docker

- **Build image:** `docker build -t honorbot-bounty .`
- **Run container:** `docker run --rm --env-file .env honorbot-bounty`
- **With docker-compose:** `docker compose up -d` (สร้าง image และรันในพื้นหลัง)

ถ้า MongoDB รันบน host (นอก container) ใช้ `MONGO_URI=mongodb://host.docker.internal:27017/honorbot` (Mac/Windows). บน Linux อาจต้องใช้ IP ของ host หรือ `network_mode: host` แล้วใช้ `127.0.0.1` ใน MONGO_URI.

**เมื่อรัน Docker บนเครื่อง Local:** ใช้ชื่อ DB เป็น `honorbot_test` (เช่น `.../honorbot_test`) เพื่อไม่ให้เขียนทับข้อมูลจริงบน VPS.

## Commands

This bot has **no slash commands**; everything is done via buttons in the Bounty Hub channel. Use `npm run deploy` to clear any old slash commands for this app if you reused an existing bot.

## Shared data

- **users** collection: same Honor Points as honorbot-pbz (read/write).
- **bounties** collection: same bounties; this bot is the one that manages Bounty Board when running.

Run honorbot-pbz for daily, profile, leaderboard, etc.; run this bot for Bounty Board only to avoid database overlap during local testing.

---

## Local (Mac) vs VPS (Production)

- **Local (Mac mini M4):** ทดสอบบนเครื่องตัวเอง — รัน `npm run dev` หรือ `docker compose up -d` แล้วใช้ `.env` ที่ชี้ MongoDB บนเครื่อง (เช่น `127.0.0.1` หรือ `host.docker.internal` ใน Docker).
- **VPS (ใช้งานจริง):** อัพโปรเจคขึ้น Git จากเครื่อง Local แล้วบน VPS ทำ `git pull` แล้วรันบอทบน VPS (เช่น `docker compose up -d` หรือ `npm run build && npm start`).

**บน VPS หลัง pull แล้ว:**

1. สร้าง `.env` บน VPS (ไม่ commit ไฟล์นี้ — ใช้เฉพาะบนเซิร์ฟเวอร์). ตั้งค่าให้ชี้ **Database จริง**:
   - `MONGO_URI=mongodb://mongodb:27017/honorbot` (ถ้า MongoDB เป็น service ใน Docker Compose บน VPS)
   - หรือ `MONGO_URI=mongodb://127.0.0.1:27017/honorbot` (ถ้า MongoDB รันบน VPS ตัวเดียวกัน)
   - ใส่ `DISCORD_TOKEN` และ Bounty channel IDs ให้ตรงกับ production
2. รันด้วย Docker: `docker compose up -d` หรือรันด้วย Node: `npm install && npm run build && npm start`.

---

## Push ขึ้น Git แล้ว Deploy บน VPS (ชี้ DB จริง)

1. **บนเครื่อง Local:** `git add .` → `git commit -m "..."` → `git push` (ไฟล์ `.env` จะไม่ถูก push เพราะอยู่ใน `.gitignore`)
2. **บน VPS:** `git pull` แล้วสร้างไฟล์ `.env` ขึ้นมาบน VPS เอง ใส่ค่า production รวมถึง `MONGO_URI` ที่ชี้ไปที่ MongoDB จริง (เช่น `mongodb://mongodb:27017/honorbot`)
3. รันบอทบน VPS (`docker compose up -d` หรือ `npm run build && npm start`) — ตอนนี้จะอ่าน/เขียนข้อมูล Honor Points และ Bounty จาก DB จริง
