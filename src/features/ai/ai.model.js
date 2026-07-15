import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema({
  sender: {
    type: String,
    enum: ['user', 'assistant'],
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

const aiConversationSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      trim: true,
      default: 'New Chat Session',
    },
    messages: [messageSchema],
  },
  { timestamps: true }
)

aiConversationSchema.index({ owner: 1, updatedAt: -1 })

export default mongoose.model('AIConversation', aiConversationSchema)
