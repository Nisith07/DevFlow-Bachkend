import Portfolio from './portfolio.model.js'

export async function getPortfolio(req, res, next) {
  try {
    const owner = req.user._id
    let portfolio = await Portfolio.findOne({ owner })

    if (!portfolio) {
      portfolio = await Portfolio.create({
        owner,
        theme: 'dark',
        sectionsOrder: ['hero', 'about', 'projects', 'skills', 'blog', 'contact'],
        visibleSections: ['hero', 'about', 'projects', 'skills', 'blog', 'contact'],
        aboutText: 'Hi, I am a software developer interested in building premium user experiences.',
        githubUsername: req.user.name.toLowerCase().replace(/\s/g, ''),
        projectsList: [],
        blogPosts: [],
        messages: [],
        isDeployed: false,
        deployedUrl: ''
      })
    }

    const obj = portfolio.toObject()
    obj.id = portfolio._id.toString()
    return res.json({ data: obj })
  } catch (error) {
    return next(error)
  }
}

export async function savePortfolio(req, res, next) {
  try {
    const owner = req.user._id
    const updates = req.body

    const portfolio = await Portfolio.findOneAndUpdate(
      { owner },
      { $set: updates },
      { new: true, upsert: true }
    )

    const obj = portfolio.toObject()
    obj.id = portfolio._id.toString()
    return res.json({ data: obj })
  } catch (error) {
    return next(error)
  }
}

export async function addPortfolioMessage(req, res, next) {
  try {
    const owner = req.user._id
    const { name, email, message } = req.body

    if (!name || !email || !message) {
      return res.status(400).json({ message: 'Name, email, and message are required.' })
    }

    const portfolio = await Portfolio.findOne({ owner })
    if (!portfolio) {
      return res.status(404).json({ message: 'Portfolio not found.' })
    }

    portfolio.messages.push({
      name: name.trim(),
      email: email.trim(),
      message: message.trim(),
      date: new Date()
    })

    await portfolio.save()
    
    const obj = portfolio.toObject()
    obj.id = portfolio._id.toString()
    return res.json({ data: obj })
  } catch (error) {
    return next(error)
  }
}

export async function deployPortfolio(req, res, next) {
  try {
    const owner = req.user._id
    const portfolio = await Portfolio.findOne({ owner })

    if (!portfolio) {
      return res.status(404).json({ message: 'Portfolio config not found.' })
    }

    const subName = req.user.name.toLowerCase().replace(/\s+/g, '-')
    portfolio.isDeployed = true
    portfolio.deployedUrl = `https://devflow.portfolio.pub/${subName}`

    await portfolio.save()

    const obj = portfolio.toObject()
    obj.id = portfolio._id.toString()
    return res.json({ data: obj })
  } catch (error) {
    return next(error)
  }
}
