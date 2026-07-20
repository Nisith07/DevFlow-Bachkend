import mongoose from 'mongoose'

const integrationSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    github: {
      token: { type: String, default: '' },
      connected: { type: Boolean, default: false }
    },
    google: {
      connected: { type: Boolean, default: false }
    },
    slack: {
      webhookUrl: { type: String, default: '' },
      channel: { type: String, default: '' },
      connected: { type: Boolean, default: false }
    },
    discord: {
      webhookUrl: { type: String, default: '' },
      connected: { type: Boolean, default: false }
    },
    notion: {
      apiToken: { type: String, default: '' },
      connected: { type: Boolean, default: false }
    },
    jira: {
      serverUrl: { type: String, default: '' },
      apiToken: { type: String, default: '' },
      connected: { type: Boolean, default: false }
    },
    vercel: {
      apiToken: { type: String, default: '' },
      projectId: { type: String, default: '' },
      connected: { type: Boolean, default: false }
    },
    render: {
      apiToken: { type: String, default: '' },
      serviceId: { type: String, default: '' },
      connected: { type: Boolean, default: false }
    },
    mongoAtlas: {
      connectionString: { type: String, default: '' },
      connected: { type: Boolean, default: false }
    }
  },
  { timestamps: true }
)

export default mongoose.model('Integration', integrationSchema)
