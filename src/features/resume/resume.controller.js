import Resume from './resume.model.js'
import { GoogleGenAI } from '@google/genai'

let aiClient = null
if (process.env.GEMINI_API_KEY) {
  try {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  } catch (err) {
    console.error('[Resume AI] Failed to initialize GoogleGenAI:', err.message)
  }
}

export async function getResume(req, res, next) {
  try {
    const owner = req.user._id
    let resume = await Resume.findOne({ owner })
    
    // Create an empty default resume if none exists yet
    if (!resume) {
      resume = await Resume.create({
        owner,
        personalInfo: {
          name: req.user.name,
          email: req.user.email,
          title: '',
          phone: '',
          website: '',
          github: '',
          linkedin: '',
          summary: ''
        },
        experience: [],
        education: [],
        skills: [],
        projects: [],
        template: 'classic'
      })
    }

    const obj = resume.toObject()
    obj.id = resume._id.toString()
    return res.json({ data: obj })
  } catch (error) {
    return next(error)
  }
}

export async function saveResume(req, res, next) {
  try {
    const owner = req.user._id
    const updates = req.body

    const resume = await Resume.findOneAndUpdate(
      { owner },
      { $set: updates },
      { new: true, upsert: true }
    )

    const obj = resume.toObject()
    obj.id = resume._id.toString()
    return res.json({ data: obj })
  } catch (error) {
    return next(error)
  }
}

export async function aiImproveResume(req, res, next) {
  try {
    const { text } = req.body
    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Text to improve is required.' })
    }

    let improvement = ''
    if (aiClient) {
      try {
        const prompt = `You are an expert resume writer and ATS optimization specialist. 
Improve the following resume description block to make it more professional, metric-driven, action-oriented, and compatible with modern ATS scanners.
Keep it short and format as bullet points where appropriate.

Original text:
"${text}"`

        const response = await aiClient.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        })
        improvement = response.text ? response.text.trim() : 'Failed to generate improvements.'
      } catch (err) {
        improvement = `Local fallback optimization: Focus on key technical skills, mention concrete metrics, and begin bullet points with action verbs (e.g. "Architected", "Spearheaded", "Optimized").`
      }
    } else {
      improvement = `Gemini key is missing. Fallback advice: Refactor text using action verbs, bullet points, and mention concrete percentages or metrics (e.g., "Improved load speed by 30%").`
    }

    return res.json({ data: { improvement } })
  } catch (error) {
    return next(error)
  }
}

export async function aiSkillsSuggestions(req, res, next) {
  try {
    const { title, summary } = req.body
    
    let skills = []
    if (aiClient && title) {
      try {
        const prompt = `You are a technical recruiter. Based on this job title: "${title}" and professional summary: "${summary || ''}", suggest a clean list of 8 key developer skills/technologies. Return ONLY a comma-separated list of skills (e.g. "React, Node.js, TypeScript").`
        const response = await aiClient.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        })
        const text = response.text ? response.text.trim() : ''
        skills = text.split(',').map(s => s.trim()).filter(Boolean)
      } catch (err) {
        skills = ['JavaScript', 'HTML5', 'CSS3', 'React', 'Node.js', 'Git']
      }
    } else {
      skills = ['JavaScript', 'React', 'Node.js', 'CSS3', 'Git', 'REST API']
    }

    return res.json({ data: { skills } })
  } catch (error) {
    return next(error)
  }
}

export async function importLinkedIn(req, res, next) {
  try {
    const { rawText } = req.body
    if (!rawText || !rawText.trim()) {
      return res.status(400).json({ message: 'LinkedIn raw profile text is required.' })
    }

    let parsedResume = null
    if (aiClient) {
      try {
        const prompt = `You are an expert data parser. Parse the following raw LinkedIn profile text or resume and map it exactly into this JSON format:
{
  "personalInfo": { "name": "...", "title": "...", "email": "...", "phone": "...", "website": "...", "github": "...", "linkedin": "...", "summary": "..." },
  "experience": [{ "company": "...", "position": "...", "location": "...", "startDate": "...", "endDate": "...", "current": false, "description": "..." }],
  "education": [{ "institution": "...", "degree": "...", "fieldOfStudy": "...", "startDate": "...", "endDate": "...", "description": "..." }],
  "skills": ["...", "..."],
  "projects": [{ "name": "...", "description": "...", "technologies": ["...", "..."], "url": "..." }]
}
Respond ONLY with the raw JSON code matching the schema above.

Raw Text:
"${rawText}"`

        const response = await aiClient.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        })
        const text = response.text ? response.text.trim() : ''
        const jsonMatch = text.match(/{\s*[\s\S]*}/)
        if (jsonMatch) {
          parsedResume = JSON.parse(jsonMatch[0])
        }
      } catch (err) {
        console.error('LinkedIn parsing error:', err.message)
      }
    }

    if (!parsedResume) {
      // Mock fallback parsing data if LLM is not loaded or fails
      parsedResume = {
        personalInfo: { name: req.user.name, email: req.user.email, title: 'Software Engineer', phone: '', website: '', github: '', linkedin: '', summary: 'Experienced software developer skilled in building web solutions.' },
        experience: [{ company: 'Acme Corp', position: 'Developer', location: 'Remote', startDate: '2024', endDate: 'Present', current: true, description: 'Built React dashboard products.' }],
        education: [{ institution: 'State University', degree: 'Bachelor', fieldOfStudy: 'Computer Science', startDate: '2020', endDate: '2024', description: '' }],
        skills: ['JavaScript', 'React', 'HTML', 'CSS'],
        projects: []
      }
    }

    return res.json({ data: parsedResume })
  } catch (error) {
    return next(error)
  }
}
