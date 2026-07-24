import mongoose from 'mongoose'
import { GoogleGenAI } from '@google/genai'
import AIConversation from './ai.model.js'
import AICopilotHistory from './copilot.model.js'
import ProjectMemory from './project-memory.model.js'
import Task from '../tasks/task.model.js'
import Project from '../projects/project.model.js'
import PlannerEntry from '../planner/planner.model.js'
import Note from '../notes/note.model.js'
import Issue from '../issues/issue.model.js'
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
          model: 'gemini-2.0-flash-lite',
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

export async function estimateTask(req, res, next) {
  try {
    const { title, description } = req.body
    if (!title) {
      return res.status(400).json({ message: 'Task title is required.' })
    }

    if (!aiClient) {
      // Mock estimate if no AI client
      return res.json({ data: { estimate: '2h' } })
    }

    const prompt = `You are an expert technical project manager. Estimate the time required for a developer to complete the following task. Respond ONLY with a concise time estimate (e.g. "2h", "30m", "1d").
Task Title: ${title}
Task Description: ${description || 'None'}`

    const response = await aiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    })

    const estimateText = response.text ? response.text.trim() : '1h'
    return res.json({ data: { estimate: estimateText } })
  } catch (error) {
    return next(error)
  }
}

function estimateTokens(text) {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

export async function getCopilotHistory(req, res, next) {
  try {
    const owner = req.user._id
    const { capability, favorite } = req.query
    const filter = { owner }
    if (capability) filter.capability = capability
    if (favorite !== undefined) filter.isFavorite = favorite === 'true'

    const history = await AICopilotHistory.find(filter).sort({ createdAt: -1 })
    const mapped = history.map(h => {
      const obj = h.toObject()
      obj.id = h._id.toString()
      return obj
    })
    return res.json({ data: mapped })
  } catch (error) {
    return next(error)
  }
}

export async function runCopilotTool(req, res, next) {
  try {
    const owner = req.user._id
    const { capability, prompt } = req.body

    if (!capability || !prompt || !prompt.trim()) {
      return res.status(400).json({ message: 'Capability and prompt are required.' })
    }

    let systemInstruction = ''
    switch (capability) {
      case 'explain_code':
        systemInstruction = 'You are an expert developer. Explain the provided code clearly, explaining its logic, purpose, complex parts, and side effects. Format in Markdown.'
        break
      case 'generate_code':
        systemInstruction = 'You are an expert software engineer. Generate clean, documented, and production-grade code based on the user requirement. Use Markdown code blocks for all code.'
        break
      case 'debug_error':
        systemInstruction = 'You are an expert debugger. Analyze the error message and the code context provided, explain what causes the error, and provide the corrected code. Format in Markdown.'
        break
      case 'optimize_code':
        systemInstruction = 'You are a performance optimization expert. Refactor the code context to improve execution speed, memory footprint, or readability. Explain the improvements made. Format in Markdown.'
        break
      case 'generate_readme':
        systemInstruction = 'You are a technical writer. Write a comprehensive and professional README.md document for the project/module description. Use clean Markdown styling.'
        break
      case 'generate_api':
        systemInstruction = 'You are a senior backend architect. Generate a clean REST or GraphQL API route and controller code structure based on the prompt description. Format in Markdown.'
        break
      case 'write_commit':
        systemInstruction = 'You are a Git release manager. Write a concise, professional Git commit message matching the Conventional Commits specification (e.g. feat: add login validation) based on the user code changes. Output ONLY the commit message blocks.'
        break
      case 'review_code':
        systemInstruction = 'You are a strict code reviewer. Review the provided code, pointing out security vulnerabilities, code smells, performance bottlenecks, and structural flaws. Provide suggestions. Format in Markdown.'
        break
      case 'sql_generator':
        systemInstruction = 'You are an expert database administrator. Generate clean SQL statements matching the request description (e.g. SELECT, INSERT, CREATE TABLE). Use Markdown code blocks for all SQL code.'
        break
      case 'regex_generator':
        systemInstruction = 'You are an expert in string processing. Generate a regular expression pattern matching the user requirement. Explain how the pattern works with examples. Format in Markdown.'
        break
      case 'doc_generator':
        systemInstruction = 'You are a documentation generator. Generate comprehensive JSDoc/Docstrings or technical manual pages for the provided code context. Format in Markdown.'
        break
      default:
        systemInstruction = 'You are an expert AI software engineering assistant.'
    }

    let responseText = ''
    if (aiClient) {
      try {
        const response = await aiClient.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: { systemInstruction }
        })
        responseText = response.text || 'Failed to generate code response from Gemini.'
      } catch (err) {
        console.error('[AI Copilot Tool] LLM error:', err.message)
        responseText = `Local fallback mode response for ${capability}: Could not complete requests with LLM. Please verify Gemini configuration.`
      }
    } else {
      responseText = `Local fallback mode response: Please add your GEMINI_API_KEY to the backend .env configuration to run developer AI tools.`
    }

    const promptTokens = estimateTokens(prompt)
    const responseTokens = estimateTokens(responseText)
    const totalTokens = promptTokens + responseTokens

    const historyRow = await AICopilotHistory.create({
      owner,
      capability,
      prompt,
      response: responseText,
      tokens: totalTokens,
      isFavorite: false
    })

    const obj = historyRow.toObject()
    obj.id = historyRow._id.toString()

    recordActivity({
      owner,
      entityType: 'ai_history',
      entityId: historyRow._id,
      action: 'ai_run',
      summary: `Used AI Copilot: ${capability.replace(/_/g, ' ')}`,
      meta: { capability }
    })

    return res.status(201).json({ data: obj })
  } catch (error) {
    return next(error)
  }
}

export async function updateCopilotHistory(req, res, next) {
  try {
    const owner = req.user._id
    const { id } = req.params
    const { isFavorite } = req.body

    const history = await AICopilotHistory.findOneAndUpdate(
      { _id: id, owner },
      { isFavorite },
      { new: true }
    )
    if (!history) {
      return res.status(404).json({ message: 'History record not found.' })
    }

    const obj = history.toObject()
    obj.id = history._id.toString()
    return res.json({ data: obj })
  } catch (error) {
    return next(error)
  }
}

export async function deleteCopilotHistory(req, res, next) {
  try {
    const owner = req.user._id
    const { id } = req.params

    const history = await AICopilotHistory.findOneAndDelete({ _id: id, owner })
    if (!history) {
      return res.status(404).json({ message: 'History record not found.' })
    }
    return res.status(204).send()
  } catch (error) {
    return next(error)
  }
}

// ── AI Project Memory ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/ai/projects/:projectId/memory
 * Returns the stored AI memory for a project (or null if not yet generated).
 */
export async function getProjectMemory(req, res, next) {
  try {
    const owner = req.user._id
    const { projectId } = req.params

    const memory = await ProjectMemory.findOne({ owner, project: projectId }).lean()
    return res.json({ data: memory || null })
  } catch (error) {
    return next(error)
  }
}

/**
 * POST /api/v1/ai/projects/:projectId/memory/refresh
 * Triggers Gemini to analyze the project and generate a fresh memory summary.
 */
export async function refreshProjectMemory(req, res, next) {
  try {
    const owner = req.user._id
    const { projectId } = req.params

    // Verify ownership
    const project = await Project.findOne({ _id: projectId, owner }).lean()
    if (!project) {
      return res.status(404).json({ message: 'Project not found.' })
    }

    // Gather all project context
    const [tasks, notes, issues] = await Promise.all([
      Task.find({ owner, project: projectId }).lean(),
      Note.find({ owner, project: projectId }).lean(),
      Issue.find({ owner, project: projectId }).lean(),
    ])

    const todoCount = tasks.filter(t => t.status === 'todo').length
    const inProgressCount = tasks.filter(t => t.status === 'in_progress').length
    const doneCount = tasks.filter(t => t.status === 'done').length
    const overdueCount = tasks.filter(t => t.dueDate && t.status !== 'done' && new Date(t.dueDate) < new Date()).length
    const openIssues = issues.filter(i => i.status === 'open').length

    const projectContext = [
      `# Project: ${project.name}`,
      `Status: ${project.status} | Priority: ${project.priority}`,
      `Description: ${project.description || 'None'}`,
      `Tech Stack: ${(project.techStack || []).join(', ') || 'Not specified'}`,
      `GitHub Repo: ${project.githubRepo || 'Not linked'}`,
      ``,
      `## Tasks (${tasks.length} total)`,
      `- Todo: ${todoCount} | In Progress: ${inProgressCount} | Done: ${doneCount} | Overdue: ${overdueCount}`,
      tasks.slice(0, 20).map(t => `  - [${t.status}] "${t.title}" (${t.priority} priority${t.dueDate ? ', due ' + new Date(t.dueDate).toLocaleDateString() : ''})`).join('\n'),
      ``,
      `## Open Issues (${openIssues})`,
      issues.filter(i => i.status === 'open').slice(0, 10).map(i => `  - [${i.type}] "${i.title}" (${i.priority})`).join('\n') || '  None',
      ``,
      `## Notes (${notes.length})`,
      notes.slice(0, 5).map(n => `  - "${n.title}" [${(n.tags || []).join(', ')}]`).join('\n') || '  None',
    ].join('\n')

    let summaryText = ''
    let keyInsights = []

    if (aiClient) {
      try {
        const systemInstruction = `You are a senior project manager AI. Analyze this software project and provide:
1. A concise 2-3 paragraph status summary (what's going well, what's at risk, what's next)
2. A JSON array of exactly 3-5 key insights in this format at the END of your response:
[INSIGHTS_JSON]
["Insight 1", "Insight 2", "Insight 3"]
[/INSIGHTS_JSON]

Be specific, actionable, and technical. Reference actual task names and issues.`

        const response = await aiClient.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: projectContext,
          config: { systemInstruction }
        })

        const raw = response.text || ''
        // Extract insights JSON
        const insightsMatch = raw.match(/\[INSIGHTS_JSON\]([\s\S]*?)\[\/INSIGHTS_JSON\]/)
        if (insightsMatch) {
          try {
            keyInsights = JSON.parse(insightsMatch[1].trim())
          } catch { keyInsights = [] }
        }
        summaryText = raw.replace(/\[INSIGHTS_JSON\][\s\S]*?\[\/INSIGHTS_JSON\]/g, '').trim()
      } catch (err) {
        console.error('[AI Memory] Generation error:', err.message)
        summaryText = `Project "${project.name}" has ${tasks.length} tasks (${doneCount} done, ${inProgressCount} in progress, ${todoCount} todo). ${overdueCount > 0 ? `⚠️ ${overdueCount} overdue tasks need attention.` : 'No overdue tasks.'}`
        keyInsights = [
          `${doneCount}/${tasks.length} tasks completed (${tasks.length > 0 ? Math.round(doneCount/tasks.length*100) : 0}% completion)`,
          overdueCount > 0 ? `${overdueCount} task(s) are overdue` : 'All tasks on schedule',
          `${openIssues} open issue(s) to address`,
        ].filter(Boolean)
      }
    } else {
      summaryText = `Project "${project.name}" has ${tasks.length} tasks (${doneCount} done). AI key unavailable for full analysis.`
      keyInsights = [`${doneCount}/${tasks.length} tasks done`, `${openIssues} open issues`]
    }

    // Upsert the memory document
    const memory = await ProjectMemory.findOneAndUpdate(
      { owner, project: projectId },
      {
        summary: summaryText,
        keyInsights,
        contextSnapshot: {
          taskCount: tasks.length,
          completedCount: doneCount,
          noteCount: notes.length,
          issueCount: issues.length,
        },
        refreshedAt: new Date(),
      },
      { upsert: true, new: true }
    )

    return res.json({ data: memory })
  } catch (error) {
    return next(error)
  }
}

// ── Daily Morning Briefing ────────────────────────────────────────────────────

/**
 * POST /api/v1/ai/briefing
 * Generates a personalized daily briefing using today's planner,
 * overdue tasks, active projects, and recent activity context.
 */
export async function generateDailyBriefing(req, res, next) {
  try {
    const owner = req.user._id
    const now = new Date()
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999)

    const [todayPlanner, overdueTasks, activeProjects, recentTasks] = await Promise.all([
      PlannerEntry.find({ owner, date: { $gte: todayStart, $lte: todayEnd } }).lean(),
      Task.find({
        owner,
        status: { $nin: ['done', 'cancelled'] },
        dueDate: { $lt: now },
      }).sort({ dueDate: 1 }).limit(5).lean(),
      Project.find({ owner, status: 'active' }).lean(),
      Task.find({ owner, $or: [{ isToday: true }, { dueDate: { $gte: todayStart, $lte: todayEnd } }] }).lean(),
    ])

    const hour = now.getHours()
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

    const briefingContext = [
      `Today is ${dateStr}.`,
      `Planner has ${todayPlanner.length} time block(s): ${todayPlanner.map(p => `"${p.title}" (${p.startTime}-${p.endTime})`).join(', ') || 'none scheduled'}`,
      `Today's tasks: ${recentTasks.length} task(s) pinned or due today`,
      `Overdue tasks (${overdueTasks.length}): ${overdueTasks.map(t => `"${t.title}"`).join(', ') || 'none'}`,
      `Active projects: ${activeProjects.map(p => `"${p.name}"`).join(', ') || 'none'}`,
    ].join('\n')

    let briefingText = ''
    if (aiClient) {
      try {
        const systemInstruction = `You are a smart developer productivity assistant. Generate a concise, encouraging daily briefing in 3-4 short paragraphs:
1. A warm greeting for ${greeting}
2. What to focus on today (based on planner + priority tasks)
3. Heads up on overdue items (if any) — be direct, not alarming
4. One motivational insight about the active projects
Use markdown. Keep it under 200 words. Be specific and use the actual task/project names.`

        const response = await aiClient.models.generateContent({
          model: 'gemini-2.0-flash-lite',
          contents: briefingContext,
          config: { systemInstruction }
        })
        briefingText = response.text || ''
      } catch (err) {
        console.error('[AI Briefing] Error:', err.message)
      }
    }

    // Fallback: structured briefing without AI
    if (!briefingText) {
      briefingText = [
        `## ${greeting}! — ${dateStr}`,
        ``,
        `**Today's focus:** You have ${recentTasks.length} task(s) scheduled for today${todayPlanner.length > 0 ? ` and ${todayPlanner.length} planner block(s)` : ''}.`,
        overdueTasks.length > 0 ? `\n**⚠️ Overdue:** ${overdueTasks.length} task(s) need attention: ${overdueTasks.slice(0,3).map(t => `"${t.title}"`).join(', ')}.` : '',
        activeProjects.length > 0 ? `\n**Active projects:** ${activeProjects.map(p => `"${p.name}"`).join(', ')} are in progress. Keep the momentum going!` : '',
      ].filter(Boolean).join('\n')
    }

    return res.json({
      data: {
        briefing: briefingText,
        meta: {
          todayTaskCount: recentTasks.length,
          plannerBlockCount: todayPlanner.length,
          overdueCount: overdueTasks.length,
          activeProjectCount: activeProjects.length,
          generatedAt: now,
        }
      }
    })
  } catch (error) {
    return next(error)
  }
}

/**
 * Generate an AI-powered engineering daily standup report.
 * Compiles completed tasks, in-progress items, and blockers.
 */
export async function generateStandupReport(req, res, next) {
  try {
    const owner = req.user._id
    const now = new Date()
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000)

    const [completedTasks, inProgressTasks, todayTasks, overdueTasks, openIssues] = await Promise.all([
      Task.find({ owner, status: 'done', completedAt: { $gte: twoDaysAgo } }).sort({ completedAt: -1 }).limit(10).lean(),
      Task.find({ owner, status: 'in-progress' }).sort({ updatedAt: -1 }).limit(10).lean(),
      Task.find({ owner, isToday: true, status: { $ne: 'done' } }).limit(10).lean(),
      Task.find({ owner, status: { $nin: ['done', 'cancelled'] }, dueDate: { $lt: now } }).limit(5).lean(),
      Issue.find({ owner, status: { $ne: 'closed' } }).limit(5).lean(),
    ])

    const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

    const contextPayload = [
      `Standup Date: ${dateStr}`,
      `Completed Recently (${completedTasks.length}): ${completedTasks.map(t => `"${t.title}"`).join(', ') || 'None'}`,
      `Currently In-Progress (${inProgressTasks.length}): ${inProgressTasks.map(t => `"${t.title}"`).join(', ') || 'None'}`,
      `Pinned / Today Tasks (${todayTasks.length}): ${todayTasks.map(t => `"${t.title}"`).join(', ') || 'None'}`,
      `Overdue Tasks / Blockers (${overdueTasks.length}): ${overdueTasks.map(t => `"${t.title}"`).join(', ') || 'None'}`,
      `Open Issues (${openIssues.length}): ${openIssues.map(i => `"${i.title}"`).join(', ') || 'None'}`,
    ].join('\n')

    let standupText = ''

    if (aiClient) {
      try {
        const systemInstruction = `You are an expert Agile / Developer Productivity AI assistant. Generate a clean, concise, 3-section daily engineering standup report in Markdown:
### 🟢 Completed Yesterday / Recently
- List bullet points of completed tasks (or state "No tasks completed recently" if none).

### 🟡 Working On Today
- List bullet points of in-progress or planned tasks for today.

### 🔴 Blockers & Open Issues
- List any overdue tasks, open bug issues, or blockers (or state "No blockers" if none).

Keep the language professional, action-oriented, and clear.`

        const response = await aiClient.models.generateContent({
          model: 'gemini-2.0-flash-lite',
          contents: contextPayload,
          config: { systemInstruction }
        })
        standupText = response.text || ''
      } catch (err) {
        console.error('[AI Standup] Gemini Error:', err.message)
      }
    }

    if (!standupText) {
      const completedList = completedTasks.length > 0
        ? completedTasks.map(t => `- Completed: **${t.title}**`).join('\n')
        : '- Worked on core repository items and workspace updates'

      const todayList = [...inProgressTasks, ...todayTasks].length > 0
        ? Array.from(new Set([...inProgressTasks, ...todayTasks].map(t => t.title))).map(title => `- Working on **${title}**`).join('\n')
        : '- Continue active project development and task execution'

      const blockerList = overdueTasks.length > 0 || openIssues.length > 0
        ? [...overdueTasks.map(t => `- ⚠️ Overdue task: **${t.title}**`), ...openIssues.map(i => `- 🐛 Open issue: **${i.title}**`)].join('\n')
        : '- No current blockers'

      standupText = [
        `## 🚀 Daily Engineering Standup — ${dateStr}`,
        ``,
        `### 🟢 Completed Yesterday / Recently`,
        completedList,
        ``,
        `### 🟡 Working On Today`,
        todayList,
        ``,
        `### 🔴 Blockers & Open Issues`,
        blockerList,
      ].join('\n')
    }

    await recordActivity(owner, 'ai', 'standup_generated', 'ai_run', 'Generated daily AI standup report', { date: dateStr }).catch(() => {})

    return res.json({
      data: {
        standup: standupText,
        meta: {
          completedCount: completedTasks.length,
          inProgressCount: inProgressTasks.length,
          blockerCount: overdueTasks.length + openIssues.length,
          generatedAt: now,
        }
      }
    })
  } catch (error) {
    return next(error)
  }
}
