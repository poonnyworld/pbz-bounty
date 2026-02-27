import dotenv from 'dotenv';
import { Client, GatewayIntentBits } from 'discord.js';
import { connectDB } from './utils/connectDB';
import * as interactionCreateEvent from './events/interactionCreate';
import { BountyService } from './services/BountyService';
import { UserInteractionService } from './services/UserInteractionService';

dotenv.config();

console.log('[HonorBot Bounty] Starting...');

// Bounty Board only uses buttons and modals – no message content. Guilds is enough; no privileged intents needed.
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const bountyService = new BountyService();
const userInteractionService = new UserInteractionService();

client.once('ready', async () => {
  console.log(`[HonorBot Bounty] Logged in as ${client.user?.tag}!`);

  console.log('[HonorBot Bounty] Initializing UserInteractionService (Bounty Board)...');
  userInteractionService.start(client);

  const { serviceRegistry } = await import('./services/ServiceRegistry');
  serviceRegistry.setBountyService(bountyService);
  console.log('[HonorBot Bounty] BountyService registered.');

  await new Promise(resolve => setTimeout(resolve, 2000));
});

process.on('SIGINT', () => {
  console.log('\n[HonorBot Bounty] Shutting down...');
  userInteractionService.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[HonorBot Bounty] Shutting down...');
  userInteractionService.stop();
  process.exit(0);
});

client.on(interactionCreateEvent.name, interactionCreateEvent.execute);

connectDB().catch((error) => {
  console.error('[HonorBot Bounty] Failed to connect to MongoDB:', error);
});

client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error('[HonorBot Bounty] Failed to login:', error);
  process.exit(1);
});
