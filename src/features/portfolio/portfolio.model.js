import mongoose from 'mongoose'

const blogPostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  date: { type: Date, default: Date.now }
})

const portfolioProjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  githubUrl: { type: String, default: '' },
  demoUrl: { type: String, default: '' },
  stars: { type: Number, default: 0 }
})

const inboxMessageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  message: { type: String, required: true },
  date: { type: Date, default: Date.now }
})

const portfolioSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    theme: { type: String, default: 'dark' }, // dark, light, cyberpunk, neo_brutalist
    sectionsOrder: {
      type: [String],
      default: ['hero', 'about', 'projects', 'skills', 'blog', 'contact']
    },
    visibleSections: {
      type: [String],
      default: ['hero', 'about', 'projects', 'skills', 'blog', 'contact']
    },
    aboutText: { type: String, default: '' },
    githubUsername: { type: String, default: '' },
    linkedinUrl: { type: String, default: '' },
    twitterUrl: { type: String, default: '' },
    projectsList: [portfolioProjectSchema],
    blogPosts: [blogPostSchema],
    messages: [inboxMessageSchema],
    isDeployed: { type: Boolean, default: false },
    deployedUrl: { type: String, default: '' }
  },
  { timestamps: true }
)

export default mongoose.model('Portfolio', portfolioSchema)
