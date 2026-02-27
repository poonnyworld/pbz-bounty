import { Client, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Message } from 'discord.js';

/**
 * Bounty Board only: sets up the Bounty Hub channel with Create Bounty + Check My Bounties buttons.
 */
export class UserInteractionService {
  private client: Client | null = null;
  private buttonMessageIds: Map<string, string> = new Map(); // channelId -> messageId

  public start(client: Client): void {
    this.client = client;
    console.log('[UserInteractionService] Initializing Bounty Board...');

    if (client.isReady()) {
      this.setupAllButtons(client).catch((error) => {
        console.error('[UserInteractionService] ❌ Error in initial button setup:', error);
      });
    } else {
      client.once('ready', () => {
        this.setupAllButtons(client).catch((error) => {
          console.error('[UserInteractionService] ❌ Error in initial button setup:', error);
        });
      });
    }

    setInterval(() => {
      if (client.isReady()) {
        this.setupAllButtons(client).catch((error) => {
          console.error('[UserInteractionService] ❌ Error in periodic button setup:', error);
        });
      }
    }, 3 * 60 * 1000);
  }

  private async setupAllButtons(client: Client): Promise<void> {
    console.log('[UserInteractionService] Setting up Bounty Board buttons...');
    await this.setupBountyCreateChannel(client);
  }

  /**
   * Setup Bounty Board Hub channel: one message with "Create Bounty" + "Check My Bounties" buttons.
   */
  private async setupBountyCreateChannel(client: Client): Promise<void> {
    const channelId = process.env.BOUNTY_HUB_CHANNEL_ID;
    if (!channelId || !/^\d{17,19}$/.test(channelId)) {
      console.log('[UserInteractionService] BOUNTY_HUB_CHANNEL_ID not set or invalid, skipping Bounty Board.');
      return;
    }
    if (!client.isReady()) return;

    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased() || channel.isThread()) {
        console.error('[UserInteractionService] ❌ Bounty Board Hub channel not found or not text:', channelId);
        return;
      }
      const textChannel = channel as TextChannel;
      const botMember = await textChannel.guild.members.fetch(client.user!.id);
      const perms = textChannel.permissionsFor(botMember);
      if (!perms?.has('SendMessages') || !perms?.has('ViewChannel')) {
        console.error('[UserInteractionService] ❌ Bot lacks permissions in BOUNTY_HUB_CHANNEL_ID:', channelId);
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x8b0000)
        .setTitle('🎯 Bounty Board')
        .setDescription(
          'Create a request and set a bounty in Honor Points. When someone answers and you\'re satisfied, press **Done** or **Notify Admin** so an admin can award points to the responder.\n\n' +
          '**Rules:**\n' +
          '• Points are deducted when you create a request (escrow).\n' +
          '• Use **Check My Bounties** to see your list and press **Done** when you\'ve received an answer.'
        )
        .setFooter({ text: 'Use the buttons below!' })
        .setTimestamp();

      const createBtn = new ButtonBuilder()
        .setCustomId('bounty_create_button')
        .setLabel('Create Bounty')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎯');
      const myListBtn = new ButtonBuilder()
        .setCustomId('bounty_my_list_button')
        .setLabel('Check My Bounties')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📋');
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(createBtn, myListBtn);

      const storedMessageId = this.buttonMessageIds.get(channelId);
      let msg: Message | null = null;
      if (storedMessageId) {
        try {
          const m = await textChannel.messages.fetch(storedMessageId);
          if (m?.author.id === client.user?.id) msg = m;
          else this.buttonMessageIds.delete(channelId);
        } catch {
          this.buttonMessageIds.delete(channelId);
        }
      }
      if (!msg) {
        const messages = await textChannel.messages.fetch({ limit: 30 });
        for (const [, m] of messages) {
          if (m.author.id !== client.user?.id || !m.components.length) continue;
          const hasBounty = m.components.some(r => (r as any).components?.some((c: any) => c.customId === 'bounty_create_button'));
          if (hasBounty) {
            msg = m;
            this.buttonMessageIds.set(channelId, m.id);
            break;
          }
        }
      }
      if (msg) {
        await msg.edit({ embeds: [embed], components: [row] });
        console.log('[UserInteractionService] ✓ Bounty Board Hub channel buttons updated');
      } else {
        const sent = await textChannel.send({ embeds: [embed], components: [row] });
        this.buttonMessageIds.set(channelId, sent.id);
        console.log('[UserInteractionService] ✓ Bounty Board Hub channel buttons sent');
      }
    } catch (error) {
      console.error('[UserInteractionService] ❌ Error setting up Bounty Board Hub channel:', error);
    }
  }

  public stop(): void {
    console.log('[UserInteractionService] Stopping...');
    this.buttonMessageIds.clear();
  }
}
