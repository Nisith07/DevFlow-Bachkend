import axios from 'axios'

/**
 * Dispatch automated Webhook notification to Slack / Discord
 *
 * @param {Object} user - user document with settings.webhooks
 * @param {string} event - 'task_completed' | 'deployment_success' | 'issue_opened' | 'standup_posted'
 * @param {Object} payload - title, description, url, meta
 */
export async function sendWebhookNotification(user, event, payload) {
  try {
    const webhooks = user?.settings?.webhooks || {}
    const { slackWebhookUrl, discordWebhookUrl, enabledEvents = [] } = webhooks

    // If event is enabled or no restrictions set
    if (enabledEvents.length > 0 && !enabledEvents.includes(event)) {
      return
    }

    const title = payload.title || 'DevFlow Notification'
    const desc = payload.description || ''
    const link = payload.url || 'https://devflow.app'

    // 1. Send to Slack Webhook if configured
    if (slackWebhookUrl && slackWebhookUrl.startsWith('https://hooks.slack.com')) {
      const slackBody = {
        text: `🚀 *${title}*\n${desc}\n<${link}|Open in DevFlow>`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${title}*\n${desc}\n<${link}|Open DevFlow>`
            }
          }
        ]
      }
      await axios.post(slackWebhookUrl, slackBody, { timeout: 5000 }).catch(err => {
        console.error('[Webhook] Slack dispatch failed:', err.message)
      })
    }

    // 2. Send to Discord Webhook if configured
    if (discordWebhookUrl && (discordWebhookUrl.includes('discord.com/api/webhooks') || discordWebhookUrl.includes('discordapp.com/api/webhooks'))) {
      const discordBody = {
        username: 'DevFlow Bot',
        avatar_url: 'https://devflow.app/favicon.svg',
        embeds: [
          {
            title: title,
            description: desc,
            url: link,
            color: 16743450, // DevFlow #FF7A1A in decimal
            timestamp: new Date().toISOString(),
          }
        ]
      }
      await axios.post(discordWebhookUrl, discordBody, { timeout: 5000 }).catch(err => {
        console.error('[Webhook] Discord dispatch failed:', err.message)
      })
    }
  } catch (err) {
    console.error('[Webhook] Dispatcher exception:', err.message)
  }
}
