import {
  Events,
  Interaction,
  ButtonInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ForumChannel,
} from 'discord.js';
import mongoose from 'mongoose';
import { MONGODB_CONNECTED } from '../utils/connectDB';
import { serviceRegistry } from '../services/ServiceRegistry';

export const name = Events.InteractionCreate;

export async function execute(interaction: Interaction): Promise<void> {
  if (interaction.isButton()) {
    if (interaction.customId === 'bounty_create_button') {
      await handleBountyCreateButton(interaction);
      return;
    }
    if (interaction.customId === 'bounty_my_list_button') {
      await handleBountyMyListButton(interaction);
      return;
    }
    if (interaction.customId.startsWith('bounty_done_')) {
      await handleBountyDoneButton(interaction);
      return;
    }
    if (interaction.customId.startsWith('bounty_request_admin_')) {
      await handleBountyRequestAdminButton(interaction);
      return;
    }
    if (interaction.customId.startsWith('bounty_admin_awarded_')) {
      await handleBountyAdminAwardedButton(interaction);
      return;
    }
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'bounty_create_modal') {
      await handleBountyCreateModal(interaction);
      return;
    }
  }
}

async function handleBountyCreateButton(interaction: ButtonInteraction): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId('bounty_create_modal')
    .setTitle('🎯 Create Bounty');

  const titleInput = new TextInputBuilder()
    .setCustomId('bounty_title')
    .setLabel('Topic / Question')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. Easter egg location in Phantom Blade')
    .setRequired(true)
    .setMaxLength(100)
    .setMinLength(1);

  const maxBounty = serviceRegistry.getBountyService()?.getMaxBountyPerRequest() ?? 100;
  const amountInput = new TextInputBuilder()
    .setCustomId('bounty_amount')
    .setLabel(`Bounty (Honor Points, max ${maxBounty})`)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 10')
    .setRequired(true)
    .setMaxLength(4)
    .setMinLength(1);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(amountInput)
  );
  await interaction.showModal(modal);
}

async function handleBountyCreateModal(interaction: any): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    if (mongoose.connection.readyState !== MONGODB_CONNECTED) {
      await interaction.editReply({ content: '❌ Database is not available. Try again later.' });
      return;
    }

    const title = interaction.fields.getTextInputValue('bounty_title')?.trim() || '';
    const amountStr = interaction.fields.getTextInputValue('bounty_amount')?.trim() || '';
    if (!title) {
      await interaction.editReply({ content: '❌ Please enter a topic/question.' });
      return;
    }
    const amount = parseInt(amountStr, 10);
    if (!Number.isFinite(amount) || amount < 1) {
      await interaction.editReply({ content: '❌ Bounty must be a positive number.' });
      return;
    }

    const bountyService = serviceRegistry.getBountyService();
    if (!bountyService) {
      await interaction.editReply({ content: '❌ Bounty feature is not available.' });
      return;
    }

    const guild = interaction.guild;
    if (!guild) {
      await interaction.editReply({ content: '❌ This must be used in a server.' });
      return;
    }

    const forumId = process.env.BOUNTY_FORUM_CHANNEL_ID;
    const showcaseId = process.env.BOUNTY_SHOWCASE_CHANNEL_ID;
    const adminId = process.env.BOUNTY_ADMIN_CHANNEL_ID;
    if (!forumId || !showcaseId || !adminId) {
      await interaction.editReply({ content: '❌ Bounty channels (Forum, Showcase, Admin) are not configured.' });
      return;
    }

    const forumCh = await guild.channels.fetch(forumId);
    if (!forumCh || forumCh.type !== ChannelType.GuildForum) {
      await interaction.editReply({ content: '❌ Bounty forum channel not found.' });
      return;
    }
    const forumChannel = forumCh as ForumChannel;

    const newThread = await forumChannel.threads.create({
      name: title.slice(0, 100),
      message: { content: '\u200b' },
    });
    const threadId = newThread.id;

    const result = await bountyService.createBounty(
      interaction.user.id,
      interaction.user.username,
      title,
      amount,
      threadId,
      guild.id,
      forumChannel.id
    );

    if (!result.success) {
      await newThread.delete().catch(() => {});
      await interaction.editReply({ content: `❌ ${result.error}` });
      return;
    }

    const requestAdminBtn = new ButtonBuilder()
      .setCustomId(`bounty_request_admin_${threadId}`)
      .setLabel('Notify Admin')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📢');
    const threadEmbed = new EmbedBuilder()
      .setColor(0x8b0000)
      .setTitle('🎯 Bounty')
      .setDescription(
        `**${interaction.user.username}** is offering **${amount}** Honor Points for a helpful answer.\n\n` +
        `Reply below. When you're satisfied with an answer, click **Notify Admin** so an admin can award the points to the responder.`
      )
      .setFooter({ text: `${amount} ⚔️ • Only the bounty creator can notify admin` })
      .setTimestamp();
    await newThread.send({ content: '\u200b', embeds: [threadEmbed], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(requestAdminBtn)] });

    const threadUrl = `https://discord.com/channels/${guild.id}/${threadId}`;
    const showcaseEmbed = buildShowcaseEmbed(result.bounty!, false);
    const linkBtn = new ButtonBuilder()
      .setLabel('Answer & Hunt Points')
      .setStyle(ButtonStyle.Link)
      .setURL(threadUrl);
    const showcaseChannel = await guild.channels.fetch(showcaseId);
    if (showcaseChannel?.isTextBased()) {
      const showcaseMsg = await (showcaseChannel as any).send({
        embeds: [showcaseEmbed],
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(linkBtn)],
      });
      await bountyService.setShowcaseMessageId(threadId, showcaseMsg.id);
    }

    const adminEmbed = buildAdminCardEmbed(result.bounty!, threadUrl);
    const adminAwardedBtn = new ButtonBuilder()
      .setCustomId(`bounty_admin_awarded_${threadId}`)
      .setLabel('Points Awarded')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅');
    const adminChannel = await guild.channels.fetch(adminId);
    if (adminChannel?.isTextBased()) {
      const adminMsg = await (adminChannel as any).send({
        embeds: [adminEmbed],
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(adminAwardedBtn)],
      });
      await bountyService.setAdminCardMessageId(threadId, adminMsg.id);
    }

    await interaction.editReply({
      content: `✅ Bounty created! **${amount}** points are held in escrow. See the Forum thread and Showcase channel.`,
    });
  } catch (error) {
    console.error('[Bounty] Error creating bounty:', error);
    await interaction.editReply({ content: '❌ Failed to create bounty. Please try again.' }).catch(() => {});
  }
}

function buildShowcaseEmbed(bounty: any, isCompleted: boolean): EmbedBuilder {
  const color = 0x8B4513;
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(isCompleted ? `✓ ${bounty.title}` : `WANTED · ${bounty.title}`)
    .setDescription(isCompleted ? '**This bounty has been completed.**' : `**${bounty.bountyAmount}** Honor Points`)
    .addFields(
      { name: 'Topic', value: bounty.title || '\u200b', inline: false },
      { name: 'Bounty', value: `${bounty.bountyAmount} ⚔️`, inline: true },
      { name: 'Creator', value: bounty.requesterUsername || '\u200b', inline: true }
    )
    .setFooter({ text: isCompleted ? 'Completed' : 'Open for answers' })
    .setTimestamp(bounty.createdAt);
}

function buildAdminCardEmbed(bounty: any, threadUrl: string): EmbedBuilder {
  const statusText =
    bounty.status === 'open'
      ? 'No answer yet'
      : bounty.status === 'answered_waiting_admin'
        ? 'Answered — waiting for admin to award'
        : bounty.status === 'awarded'
          ? 'Points awarded'
          : bounty.status;
  return new EmbedBuilder()
    .setColor(0x8b0000)
    .setTitle(`Bounty: ${bounty.title}`)
    .setDescription(`[Open thread](${threadUrl})`)
    .addFields(
      { name: 'Amount', value: `${bounty.bountyAmount} ⚔️`, inline: true },
      { name: 'Creator', value: bounty.requesterUsername || '\u200b', inline: true },
      { name: 'Status', value: statusText, inline: false }
    )
    .setFooter({ text: `Thread: ${bounty.threadId}` })
    .setTimestamp();
}

async function handleBountyMyListButton(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const bountyService = serviceRegistry.getBountyService();
    if (!bountyService) {
      await interaction.editReply({ content: '❌ Bounty feature is not available.' });
      return;
    }
    const list = await bountyService.getBountiesByRequester(interaction.user.id);
    const openOrWaiting = list.filter(b => b.status === 'open' || b.status === 'answered_waiting_admin');
    if (openOrWaiting.length === 0) {
      await interaction.editReply({
        content: 'You have no open bounties. Check Forum / Showcase for the full list.',
      });
      return;
    }
    const lines = openOrWaiting.slice(0, 15).map(b => {
      const status = b.status === 'open' ? 'Waiting for answer' : 'Waiting for admin to award';
      return `• **${b.title}** — ${b.bountyAmount} ⚔️ — ${status}`;
    });
    const embed = new EmbedBuilder()
      .setColor(0x8b0000)
      .setTitle('Your Bounties')
      .setDescription(lines.join('\n'))
      .setFooter({ text: 'Press the button below to mark as Done when you\'ve received a satisfactory answer.' })
      .setTimestamp();
    const buttons = openOrWaiting.slice(0, 5).map(b =>
      new ButtonBuilder()
        .setCustomId(`bounty_done_${b.threadId}`)
        .setLabel(b.title.slice(0, 80))
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('✅')
    );
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
    await interaction.editReply({
      embeds: [embed],
      components: [row],
    });
  } catch (error) {
    console.error('[Bounty] Error my list:', error);
    await interaction.editReply({ content: '❌ Could not load list.' }).catch(() => {});
  }
}

async function handleBountyDoneButton(interaction: ButtonInteraction): Promise<void> {
  const threadId = interaction.customId.replace(/^bounty_done_/, '');
  if (!threadId) return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const bountyService = serviceRegistry.getBountyService();
    if (!bountyService) {
      await interaction.editReply({ content: '❌ Bounty feature is not available.' });
      return;
    }
    const bounty = await bountyService.getBountyByThreadId(threadId);
    if (!bounty) {
      await interaction.editReply({ content: '❌ Bounty not found.' });
      return;
    }
    if (bounty.requesterUserId !== interaction.user.id) {
      await interaction.editReply({ content: '❌ Only the creator of this bounty can use this.' });
      return;
    }
    if (bounty.status !== 'open') {
      await interaction.editReply({ content: '✅ This status was already updated.' });
      return;
    }
    await bountyService.updateStatus(threadId, 'answered_waiting_admin');
    const guild = interaction.guild;
    const adminId = process.env.BOUNTY_ADMIN_CHANNEL_ID;
    if (guild && adminId && bounty.adminCardMessageId) {
      const adminCh = await guild.channels.fetch(adminId);
      if (adminCh?.isTextBased()) {
        const msg = await (adminCh as any).messages.fetch(bounty.adminCardMessageId).catch(() => null);
        if (msg) {
          const updated = await bountyService.getBountyByThreadId(threadId);
          const threadUrl = `https://discord.com/channels/${guild.id}/${threadId}`;
          await msg.edit({
            embeds: [buildAdminCardEmbed(updated!, threadUrl)],
            components: msg.components,
          });
        }
      }
    }
    await interaction.editReply({ content: '✅ Saved. An admin will award points to the responder.' });
  } catch (error) {
    console.error('[Bounty] Error done:', error);
    await interaction.editReply({ content: '❌ Could not update.' }).catch(() => {});
  }
}

async function handleBountyRequestAdminButton(interaction: ButtonInteraction): Promise<void> {
  const threadId = interaction.customId.replace(/^bounty_request_admin_/, '');
  if (!threadId) return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const bountyService = serviceRegistry.getBountyService();
    if (!bountyService) {
      await interaction.editReply({ content: '❌ Bounty feature is not available.' });
      return;
    }
    const bounty = await bountyService.getBountyByThreadId(threadId);
    if (!bounty) {
      await interaction.editReply({ content: '❌ Bounty not found.' });
      return;
    }
    if (bounty.requesterUserId !== interaction.user.id) {
      await interaction.editReply({ content: '❌ Only the creator of this bounty can notify admin.' });
      return;
    }
    if (bounty.status !== 'open') {
      await interaction.editReply({ content: '✅ Admin already notified. Waiting for admin to award points.' });
      return;
    }
    await bountyService.updateStatus(threadId, 'answered_waiting_admin');
    const guild = interaction.guild;
    const adminId = process.env.BOUNTY_ADMIN_CHANNEL_ID;
    if (guild && adminId && bounty.adminCardMessageId) {
      const adminCh = await guild.channels.fetch(adminId);
      if (adminCh?.isTextBased()) {
        const msg = await (adminCh as any).messages.fetch(bounty.adminCardMessageId).catch(() => null);
        if (msg) {
          const updated = await bountyService.getBountyByThreadId(threadId);
          const threadUrl = `https://discord.com/channels/${guild.id}/${threadId}`;
          await msg.edit({
            embeds: [buildAdminCardEmbed(updated!, threadUrl)],
            components: msg.components,
          });
        }
      }
    }
    await interaction.editReply({ content: '✅ Admin notified. Waiting for admin to award points to the responder.' });
  } catch (error) {
    console.error('[Bounty] Error request admin:', error);
    await interaction.editReply({ content: '❌ Could not notify.' }).catch(() => {});
  }
}

async function handleBountyAdminAwardedButton(interaction: ButtonInteraction): Promise<void> {
  const threadId = interaction.customId.replace(/^bounty_admin_awarded_/, '');
  if (!threadId) return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const hasAdmin = interaction.member && (interaction.member.permissions as any)?.has?.(PermissionFlagsBits.Administrator);
    if (!hasAdmin) {
      await interaction.editReply({ content: '❌ Only admins can use this.' });
      return;
    }
    const bountyService = serviceRegistry.getBountyService();
    if (!bountyService) {
      await interaction.editReply({ content: '❌ Bounty feature is not available.' });
      return;
    }
    const bounty = await bountyService.getBountyByThreadId(threadId);
    if (!bounty) {
      await interaction.editReply({ content: '❌ Bounty not found.' });
      return;
    }
    if (bounty.status === 'awarded') {
      await interaction.editReply({ content: '✅ Already marked as awarded.' });
      return;
    }
    await bountyService.updateStatus(threadId, 'awarded');
    const guild = interaction.guild;
    const adminId = process.env.BOUNTY_ADMIN_CHANNEL_ID;
    const showcaseId = process.env.BOUNTY_SHOWCASE_CHANNEL_ID;
    const threadUrl = `https://discord.com/channels/${guild?.id ?? ''}/${threadId}`;

    if (guild && adminId && bounty.adminCardMessageId) {
      const adminCh = await guild.channels.fetch(adminId);
      if (adminCh?.isTextBased()) {
        const msg = await (adminCh as any).messages.fetch(bounty.adminCardMessageId).catch(() => null);
        if (msg) {
          const updated = await bountyService.getBountyByThreadId(threadId);
          await msg.edit({
            embeds: [buildAdminCardEmbed(updated!, threadUrl)],
            components: [],
          });
        }
      }
    }
    if (guild && showcaseId && bounty.showcaseMessageId) {
      const showcaseCh = await guild.channels.fetch(showcaseId);
      if (showcaseCh?.isTextBased()) {
        const msg = await (showcaseCh as any).messages.fetch(bounty.showcaseMessageId).catch(() => null);
        if (msg) {
          const updated = await bountyService.getBountyByThreadId(threadId);
          await msg.edit({
            embeds: [buildShowcaseEmbed(updated!, true)],
            components: [],
          });
        }
      }
    }
    await interaction.editReply({ content: '✅ Marked as awarded. Showcase card updated to "Completed".' });
  } catch (error) {
    console.error('[Bounty] Error admin awarded:', error);
    await interaction.editReply({ content: '❌ Could not update.' }).catch(() => {});
  }
}
