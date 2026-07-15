import mongoose from 'mongoose'
import { GoogleGenAI } from '@google/genai'
import AIConversation from './ai.model.js'
import Task from '../tasks/task.model.js'
import Project from '../projects/project.model.js'
import PlannerEntry from '../planner/planner.model.js'
import Note from '../notes/note.model.js'
import { recordActivity } from '../activity/activity.controller.js'

// Initialize Gen AI client if API key is present
let aiClient = null
if (process.env.GEMINI_API_KEY) {
  try {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  } catch (err) {
    console.error('[AI] Failed to initialize GoogleGenAI client:', err.message)
  }
}

/**
 * Fetch all workspace context for the user and format as clean Markdown.
 */
async function getWorkspaceContext(owner) {
  const [tasks, projects, planner, notes] = await Promise.all([
    Task.find({ owner }).lean(),
    Project.find({ owner }).lean(),
    PlannerEntry.find({ owner, date: { $gte: new Date(new Date().setHours(0,0,0,0)) } }).lean(),
    Note.find({ owner }).lean(),
  ])

  let ctx = '# DevFlow User Workspace Context\n\n'

  ctx += '## Projects\n'
  if (projects.length === 0) ctx += 'No projects found.\n'
  else {
    projects.forEach((p) => {
      ctx += `- Name: "${p.name}", ID: ${p._id}, Status: ${p.status}, Description: "${p.description || ''}"\n`
    })
  }

  ctx += '\n## Tasks\n'
  if (tasks.length === 0) ctx += 'No tasks found.\n'
  else {
    tasks.forEach((t) => {
      const proj = projects.find((p) => p._id.toString() === t.project?.toString())
      const projName = proj ? proj.name : 'None'
      ctx += `- Title: "${t.title}", ID: ${t._id}, Status: ${t.status}, Priority: ${t.priority}, Due: ${t.dueDate ? t.dueDate.toISOString().split('T')[0] : 'None'}, Project: "${projName}" (ID: ${t.project || 'None'}), Pin to Today: ${t.isToday}\n`
    })
  }

  ctx += '\n## Planner Entries (Today/Future)\n'
  if (planner.length === 0) ctx += 'No planner time blocks scheduled.\n'
  else {
    planner.forEach((pl) => {
      ctx += `- Title: "${pl.title || 'Task Link'}", Time: ${pl.startTime}-${pl.endTime}, Done: ${pl.done}\n`
    })
  }

  ctx += '\n## Notes\n'
  if (notes.length === 0) ctx += 'No notes found.\n'
  else {
    notes.forEach((n) => {
      ctx += `- Title: "${n.title}", Tags: [${(n.tags || []).join(', ')}]\n`
    })
  }

  return ctx
}

/**
 * Rule-based fallback responses in case Gemini API key is missing or errors out.
 */
function getFallbackResponse(text, context) {
  const query = text.toLowerCase()
  if (query.includes('plan my week') || query.includes('weekly plan')) {
    return `Here is a weekly plan suggestions based on your workspace context. (Note: Gemini API key is not configured, running in local fallback mode):
- **Focus Areas**: Work on outstanding high/urgent priority tasks.
- **Planner Action**: Schedule time blocks in Daily Planner for tasks due soon.
- **Projects**: Keep active projects updated.`
  }
  if (query.includes('subtask') || query.includes('break project')) {
    return `Based on your projects (Local fallback mode):
- Select a project from the left or sidebar.
- Create specific tasks inside that project using the Tasks page.`
  }
  if (query.includes('progress') || query.includes('summarize today')) {
    return `Today's Summary (Local fallback mode):
- Check the Daily Summary dashboard panel for complete status counts of tasks and planner entries.`
  }
  if (query.includes('priority') || query.includes('priority suggestions')) {
    return `Priority Recommendations (Local fallback mode):
- Review tasks due within the next 48 hours and mark them as High or Urgent.
- Non-critical backlog tasks can stay at Low/Medium.`
  }
  return `I am your DevFlow AI Assistant. I can help you plan your week, summarize progress, suggest priorities, and create tasks from natural language. 
To get full AI responses, please add \`GEMINI_API_KEY\` to your backend \`.env\` file.`
}

/**
 * Action executor: parses the assistant response for special instructions
 * like |||ACTION:{"type":"create_task",...}||| and commits them to MongoDB.
 */
async function executeAssistantActions(text, owner) {
  const regex = /\|\|\|ACTION:({.*?})\|\|\|/g
  let match
  const actionsExecuted = []

  while ((match = regex.exec(text)) !== null) {
    try {
      const action = JSON.parse(match[1])
      if (action.type === 'create_task') {
        const payload = action.payload
        const task = await Task.create({
          owner,
          title: payload.title,
          priority: payload.priority || 'none',
          status: 'todo',
          dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
          isToday: !!payload.isToday,
          project: payload.project ? new mongoose.Types.ObjectId(payload.project) : undefined,
        })
        actionsExecuted.push(`Created task "${task.title}"`)
        recordActivity({
          owner,
          entityType: 'task',
          entityId: task._id,
          action: 'task_created',
          summary: `Created task "${task.title}" via AI Assistant`,
        })
      } else if (action.type === 'create_planner') {
        const payload = action.payload
        const todayStr = new Date().toLocaleDateString('en-CA')
        const midnight = new Date(todayStr)
        midnight.setUTCHours(0, 0, 0, 0)

        const planner = await PlannerEntry.create({
          owner,
          date: midnight,
          title: payload.title,
          startTime: payload.startTime || '09:00',
          endTime: payload.endTime || '10:00',
          done: false,
        })
        actionsExecuted.push(`Scheduled planner block "${planner.title}"`)
        recordActivity({
          owner,
          entityType: 'planner',
          entityId: planner._id,
          action: 'planner_created',
          summary: `Scheduled "${planner.title}" (${planner.startTime}-${planner.endTime}) via AI Assistant`,
        })
      }
    } catch (err) {
      console.error('[AI] Action execution failed:', err.message)
    }
  }
  return actionsExecuted
}

// ── Controller Handlers ────────────────────────────────────────────────────────

export async function getConversations(req, res, next) {
  try {
    const owner = req.user._id
    const conversations = await AIConversation.find({ owner }).sort({ updatedAt: -1 })
    const mapped = conversations.map((c) => ({
      id: c._id.toString(),
      title: c.title,
      updatedAt: c.updatedAt,
      messageCount: c.messages.length,
    }))
    return res.json({ data: mapped })
  } catch (error) {
    return next(error)
  }
}

export async function createConversation(req, res, next) {
  try {
    const owner = req.user._id
    const { title } = req.body
    const conversation = await AIConversation.create({
      owner,
      title: title?.trim() || 'New Chat Session',
      messages: [],
    })
    return res.status(201).json({
      data: {
        id: conversation._id.toString(),
        title: conversation.title,
        messages: [],
      },
    })
  } catch (error) {
    return next(error)
  }
}

export async function getConversation(req, res, next) {
  try {
    const owner = req.user._id
    const { id } = req.params

    const conversation = await AIConversation.findOne({ _id: id, owner })
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found.' })
    }

    const obj = conversation.toObject()
    obj.id = conversation._id.toString()
    return res.json({ data: obj })
  } catch (error) {
    return next(error)
  }
}

export async function deleteConversation(req, res, next) {
  try {
    const owner = req.user._id
    const { id } = req.params

    const conversation = await AIConversation.findOneAndDelete({ _id: id, owner })
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found.' })
    }
    return res.status(204).send()
  } catch (error) {
    return next(error)
  }
}

export async function postMessage(req, res, next) {
  try {
    const owner = req.user._id
    const { id } = req.params
    const { text } = req.body

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ message: 'Message text is required.' })
    }

    const conversation = await AIConversation.findOne({ _id: id, owner })
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found.' })
    }

    // 1. Save user message
    conversation.messages.push({ sender: 'user', text: text.trim() })

    // 2. Fetch context
    const context = await getWorkspaceContext(owner)

    // 3. Request LLM completion
    let assistantText = ''
    if (aiClient) {
      try {
        const systemInstruction = `You are the DevFlow Productivity AI Assistant. 
You have access to the user's workspace context (projects, tasks, notes, planner entries). 
Always refer to the user's projects and tasks by name when they ask you questions.

Capabilities:
1. Plan my week: Recommend a logical breakdown of tasks across Mon-Fri.
2. Break project into subtasks: Suggest subtasks for a project.
3. Summarize today's progress: Outline completed items and active goals.
4. Suggest task priorities: Identify urgent tasks due soon.
5. Generate productivity reports: Provide analytical insights.
6. Create tasks/planner blocks from natural language: If the user requests to create or schedule a task or block, you can do so by appending the special action JSON block at the absolute end of your response:
   - To create a task: |||ACTION:{"type":"create_task","payload":{"title":"Task Name","priority":"high","isToday":true,"dueDate":"YYYY-MM-DD","project":"optional_project_id"}}|||
   - To add a planner time block for today: |||ACTION:{"type":"create_planner","payload":{"title":"Standup","startTime":"09:00","endTime":"09:30"}}|||

Ensure your response is in markdown. If actions are generated, write the action JSON string exactly as shown above.`

        const contents = [
          { role: 'user', parts: [{ text: `${context}\n\nUser request: ${text}` }] }
        ]

        const response = await aiClient.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents,
          config: {
            systemInstruction,
          }
        })
        assistantText = response.text || 'Sorry, I encountered an issue processing your request.'
      } catch (err) {
        console.error('[AI] LLM generation error:', err.message)
        assistantText = getFallbackResponse(text, context)
      }
    } else {
      assistantText = getFallbackResponse(text, context)
    }

    // 4. Execute assistant actions in database if parsed
    const executed = await executeAssistantActions(assistantText, owner)
    if (executed.length > 0) {
      assistantText += `\n\n*System Actions Executed:* ${executed.join(', ')}.`
      // Clean action blocks out of display message so user doesn't see raw string
      assistantText = assistantText.replace(/\|\|\|ACTION:({.*?})\|\|\|/g, '')
    }

    // 5. Save assistant response
    conversation.messages.push({ sender: 'assistant', text: assistantText })
    
    // Auto-summarize first message as conversation title
    if (conversation.title === 'New Chat Session' && conversation.messages.length === 2) {
      conversation.title = text.trim().slice(0, 40) + (text.length > 40 ? '...' : '')
    }

    await conversation.save()

    const obj = conversation.toObject()
    obj.id = conversation._id.toString()
    return res.json({ data: obj })
  } catch (error) {
    return next(error)
  }
}
