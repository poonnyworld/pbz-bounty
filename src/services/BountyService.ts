import { User } from '../models/User';
import { Bounty, IBounty } from '../models/Bounty';
import { isHonorPointsApiEnabled, getBalance, deduct, add } from './HonorPointsApiClient';

const BOUNTY_MAX_POINTS_DEFAULT = 100;
const BOUNTY_MIN_POINTS = 1;
const AWARD_COOLDOWN_HOURS = 24;

export interface CreateBountyResult {
  success: boolean;
  error?: string;
  bounty?: IBounty;
}

export interface AwardBountyResult {
  success: boolean;
  error?: string;
}

export class BountyService {
  /**
   * Max bounty points per thread (from env or default).
   */
  public getMaxBountyPerRequest(): number {
    const raw = process.env.BOUNTY_MAX_POINTS;
    if (raw === undefined || raw === '') return BOUNTY_MAX_POINTS_DEFAULT;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1) return BOUNTY_MAX_POINTS_DEFAULT;
    return n;
  }

  /**
   * Create a bounty: deduct points from requester (escrow) and save Bounty.
   */
  public async createBounty(
    requesterUserId: string,
    requesterUsername: string,
    title: string,
    amount: number,
    threadId: string,
    guildId: string,
    channelId: string
  ): Promise<CreateBountyResult> {
    const maxBounty = this.getMaxBountyPerRequest();
    if (amount < BOUNTY_MIN_POINTS) {
      return { success: false, error: `Bounty must be at least ${BOUNTY_MIN_POINTS} point(s).` };
    }
    if (amount > maxBounty) {
      return { success: false, error: `Bounty cannot exceed ${maxBounty} points per request.` };
    }

    if (isHonorPointsApiEnabled()) {
      const balance = await getBalance(requesterUserId);
      if (balance < amount) {
        return {
          success: false,
          error: `Insufficient honor points. You have ${balance}, need ${amount}.`,
        };
      }
      const result = await deduct(requesterUserId, amount);
      if (!result.success) {
        return { success: false, error: result.error ?? 'Failed to deduct points.' };
      }
    } else {
      const user = await User.findOne({ userId: requesterUserId });
      if (!user) {
        return { success: false, error: 'User not found. Please use the bot in a server first.' };
      }
      if (user.honorPoints < amount) {
        return {
          success: false,
          error: `Insufficient honor points. You have ${user.honorPoints}, need ${amount}.`,
        };
      }
      user.honorPoints -= amount;
      await user.save();
    }

    const bounty = await Bounty.create({
      threadId,
      guildId,
      channelId,
      title: title || 'Bounty',
      requesterUserId,
      requesterUsername,
      bountyAmount: amount,
      status: 'open',
    });

    return { success: true, bounty };
  }

  /**
   * Get bounty by thread ID.
   */
  public async getBountyByThreadId(threadId: string): Promise<IBounty | null> {
    return Bounty.findOne({ threadId }).exec();
  }

  /**
   * Get all bounties created by a user (for "My Bounties" list).
   */
  public async getBountiesByRequester(userId: string): Promise<IBounty[]> {
    return Bounty.find({ requesterUserId: userId }).sort({ createdAt: -1 }).exec();
  }

  /**
   * Set showcase message ID for a bounty (card in BOUNTY_SHOWCASE_CHANNEL_ID).
   */
  public async setShowcaseMessageId(threadId: string, messageId: string): Promise<IBounty | null> {
    const bounty = await Bounty.findOneAndUpdate(
      { threadId },
      { showcaseMessageId: messageId },
      { new: true }
    ).exec();
    return bounty ?? null;
  }

  /**
   * Set admin card message ID for a bounty (card in BOUNTY_ADMIN_CHANNEL_ID).
   */
  public async setAdminCardMessageId(threadId: string, messageId: string): Promise<IBounty | null> {
    const bounty = await Bounty.findOneAndUpdate(
      { threadId },
      { adminCardMessageId: messageId },
      { new: true }
    ).exec();
    return bounty ?? null;
  }

  /**
   * Update bounty status (e.g. answered_waiting_admin, awarded). Does not transfer points.
   */
  public async updateStatus(threadId: string, status: IBounty['status']): Promise<{ success: boolean; error?: string }> {
    const bounty = await Bounty.findOne({ threadId }).exec();
    if (!bounty) return { success: false, error: 'Bounty not found.' };
    if (status === 'awarded') {
      bounty.awardedAt = new Date();
    }
    bounty.status = status;
    await bounty.save();
    return { success: true };
  }

  /**
   * Check if requester has awarded recipient in the last AWARD_COOLDOWN_HOURS (anti-abuse).
   */
  public async canAwardTo(requesterUserId: string, recipientUserId: string): Promise<{ allowed: boolean; reason?: string }> {
    const since = new Date(Date.now() - AWARD_COOLDOWN_HOURS * 60 * 60 * 1000);
    const recent = await Bounty.countDocuments({
      requesterUserId,
      awardedToUserId: recipientUserId,
      status: 'awarded',
      awardedAt: { $gte: since },
    });
    if (recent > 0) {
      return {
        allowed: false,
        reason: `You can only award the same user once per ${AWARD_COOLDOWN_HOURS} hours (anti-abuse).`,
      };
    }
    return { allowed: true };
  }

  /**
   * Award bounty to recipient: add points to recipient, update Bounty to awarded.
   */
  public async awardBounty(
    threadId: string,
    recipientUserId: string,
    requesterUserId: string
  ): Promise<AwardBountyResult> {
    const bounty = await Bounty.findOne({ threadId }).exec();
    if (!bounty) {
      return { success: false, error: 'Bounty not found for this thread.' };
    }
    if (bounty.status !== 'open') {
      return { success: false, error: 'This bounty is already closed.' };
    }
    if (bounty.requesterUserId !== requesterUserId) {
      return { success: false, error: 'Only the bounty creator can award the reward.' };
    }
    if (bounty.requesterUserId === recipientUserId) {
      return { success: false, error: 'You cannot award the bounty to yourself.' };
    }

    const cooldown = await this.canAwardTo(requesterUserId, recipientUserId);
    if (!cooldown.allowed) {
      return { success: false, error: cooldown.reason };
    }

    if (isHonorPointsApiEnabled()) {
      const result = await add(recipientUserId, bounty.bountyAmount, 'Unknown');
      if (!result.success) {
        return { success: false, error: result.error ?? 'Failed to award points.' };
      }
    } else {
      let recipient = await User.findOne({ userId: recipientUserId });
      if (!recipient) {
        recipient = await User.create({
          userId: recipientUserId,
          username: 'Unknown',
          honorPoints: 0,
          lastMessageDate: new Date(),
          dailyPoints: 0,
          lastMessagePointsReset: new Date(),
          dailyMessageCount: 0,
          lastDailyReset: new Date(0),
          dailyCheckinStreak: 0,
          lastCheckinDate: new Date(0),
          dailyLuckyDrawCount: 0,
          lastLuckyDrawDate: new Date(0),
        });
      }
      recipient.honorPoints += bounty.bountyAmount;
      await recipient.save();
    }

    bounty.status = 'awarded';
    bounty.awardedToUserId = recipientUserId;
    bounty.awardedAt = new Date();
    await bounty.save();

    return { success: true };
  }
}
