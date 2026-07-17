import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      trim: true,
      default: '',
    },
    type: {
      type: String,
      enum: ['info', 'success', 'warning', 'error'],
      default: 'info',
    },
    link: {
      type: String,
      trim: true,
      default: '',
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
)

export default mongoose.model('Notification', notificationSchema)
