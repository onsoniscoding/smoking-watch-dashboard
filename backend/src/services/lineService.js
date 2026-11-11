
export async function sendLineText(message) {
  if (process.env.LINE_ENABLED !== 'true') {
    throw new Error('LINE notifications are disabled')
  }

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const targetId = process.env.LINE_TARGET_ID

  if (!token || !targetId) {
    throw new Error('LINE token or target ID is missing')
  }

  const response = await fetch(
    'https://api.line.me/v2/bot/message/push',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        to: targetId,
        messages: [
          {
            type: 'text',
            text: message
          }
        ]
      })
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`LINE API error: ${errorText}`)
  }

  return {
    success: true,
    message: 'LINE message sent successfully'
  }
}
