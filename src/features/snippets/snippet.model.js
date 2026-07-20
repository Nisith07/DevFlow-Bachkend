import mongoose from 'mongoose'

const snippetSchema = new mongoose.Schema(
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
      maxlength: 200
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: ''
    },
    code: {
      type: String,
      required: true,
      maxlength: 20000
    },
    language: {
      type: String,
      trim: true,
      default: 'javascript',
      index: true
    },
    category: {
      type: String,
      trim: true,
      default: 'Utility',
      index: true
    },
    isFavorite: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  { timestamps: true }
)

// Compound index for querying user's snippets
snippetSchema.index({ owner: 1, isFavorite: -1, updatedAt: -1 })

export default mongoose.model('Snippet', snippetSchema)
