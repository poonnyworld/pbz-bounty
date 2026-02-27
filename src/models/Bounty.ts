import mongoose, { Document, Schema } from 'mongoose';

export type BountyStatus = 'open' | 'answered_waiting_admin' | 'awarded' | 'cancelled';

export interface IBounty extends Document {
  threadId: string;
  guildId: string;
  channelId: string;
  title: string;
  requesterUserId: string;
  requesterUsername: string;
  bountyAmount: number;
  status: BountyStatus;
  showcaseMessageId?: string;
  adminCardMessageId?: string;
  awardedToUserId?: string;
  awardedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const BountySchema: Schema = new Schema(
  {
    threadId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    guildId: {
      type: String,
      required: true,
      index: true,
    },
    channelId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      default: '',
    },
    requesterUserId: {
      type: String,
      required: true,
      index: true,
    },
    requesterUsername: {
      type: String,
      required: true,
    },
    bountyAmount: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ['open', 'answered_waiting_admin', 'awarded', 'cancelled'],
      default: 'open',
      index: true,
    },
    showcaseMessageId: {
      type: String,
      default: null,
    },
    adminCardMessageId: {
      type: String,
      default: null,
    },
    awardedToUserId: {
      type: String,
      default: null,
    },
    awardedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const Bounty = mongoose.model<IBounty>('Bounty', BountySchema);
