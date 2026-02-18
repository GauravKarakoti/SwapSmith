import mongoose, { Schema, Model } from 'mongoose';

export interface IWaitlist {
  email: string;
  createdAt: Date;
}

const WaitlistSchema = new Schema<IWaitlist>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please enter a valid email address',
      ],
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  {
    timestamps: false,
  }
);

// Create index for faster queries
WaitlistSchema.index({ email: 1 });

// Prevent model recompilation in development
const Waitlist: Model<IWaitlist> =
  mongoose.models.Waitlist || mongoose.model<IWaitlist>('Waitlist', WaitlistSchema);

export default Waitlist;
