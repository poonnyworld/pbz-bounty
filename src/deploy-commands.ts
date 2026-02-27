import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

// Bounty Board bot is button-only; no slash commands. Deploy empty list to guild/global.
const commands: any[] = [];

(async () => {
  try {
    const token = process.env.DISCORD_TOKEN;
    const clientId = process.env.CLIENT_ID;
    const guildId = process.env.GUILD_ID;

    if (!token) {
      throw new Error('DISCORD_TOKEN is not defined in environment variables');
    }
    if (!clientId) {
      throw new Error('CLIENT_ID is not defined in environment variables');
    }

    const rest = new REST().setToken(token);

    console.log('[Deploy] Bounty bot has no slash commands; clearing any existing commands.');

    if (guildId && /^\d{17,19}$/.test(guildId) && guildId !== 'your_guild_id_here') {
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: [] }
      );
      console.log('[Deploy] Cleared guild commands.');
    }

    await rest.put(
      Routes.applicationCommands(clientId),
      { body: [] }
    );
    console.log('[Deploy] Cleared global commands. Done.');
  } catch (error) {
    console.error('[Deploy] Error:', error);
    process.exit(1);
  }
})();
