import Snippet from './snippet.model.js'

export async function getSnippets(req, res, next) {
  try {
    const owner = req.user._id
    const { category, language, favorite, search } = req.query

    const filter = { owner }

    if (category) filter.category = category
    if (language) filter.language = language
    if (favorite !== undefined) filter.isFavorite = favorite === 'true'

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } }
      ]
    }

    const snippets = await Snippet.find(filter).sort({ isFavorite: -1, updatedAt: -1 })
    
    const mapped = snippets.map(s => {
      const obj = s.toObject()
      obj.id = s._id.toString()
      return obj
    })

    return res.json({ data: mapped })
  } catch (error) {
    return next(error)
  }
}

export async function createSnippet(req, res, next) {
  try {
    const owner = req.user._id
    const { title, description, code, language, category, isFavorite } = req.body

    if (!title || !code) {
      return res.status(400).json({ message: 'Title and code are required.' })
    }

    const snippet = await Snippet.create({
      owner,
      title: title.trim(),
      description: description || '',
      code,
      language: language || 'javascript',
      category: category || 'Utility',
      isFavorite: !!isFavorite
    })

    const obj = snippet.toObject()
    obj.id = snippet._id.toString()
    return res.status(201).json({ data: obj })
  } catch (error) {
    return next(error)
  }
}

export async function updateSnippet(req, res, next) {
  try {
    const owner = req.user._id
    const { id } = req.params
    const { title, description, code, language, category, isFavorite } = req.body

    const snippet = await Snippet.findOne({ _id: id, owner })
    if (!snippet) {
      return res.status(404).json({ message: 'Snippet not found.' })
    }

    if (title !== undefined) snippet.title = title.trim()
    if (description !== undefined) snippet.description = description
    if (code !== undefined) snippet.code = code
    if (language !== undefined) snippet.language = language
    if (category !== undefined) snippet.category = category
    if (isFavorite !== undefined) snippet.isFavorite = !!isFavorite

    await snippet.save()

    const obj = snippet.toObject()
    obj.id = snippet._id.toString()
    return res.json({ data: obj })
  } catch (error) {
    return next(error)
  }
}

export async function deleteSnippet(req, res, next) {
  try {
    const owner = req.user._id
    const { id } = req.params

    const snippet = await Snippet.findOneAndDelete({ _id: id, owner })
    if (!snippet) {
      return res.status(404).json({ message: 'Snippet not found.' })
    }

    return res.status(204).send()
  } catch (error) {
    return next(error)
  }
}

export async function toggleFavoriteSnippet(req, res, next) {
  try {
    const owner = req.user._id
    const { id } = req.params

    const snippet = await Snippet.findOne({ _id: id, owner })
    if (!snippet) {
      return res.status(404).json({ message: 'Snippet not found.' })
    }

    snippet.isFavorite = !snippet.isFavorite
    await snippet.save()

    const obj = snippet.toObject()
    obj.id = snippet._id.toString()
    return res.json({ data: obj })
  } catch (error) {
    return next(error)
  }
}
