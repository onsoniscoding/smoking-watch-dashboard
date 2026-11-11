
import { sendLineText } from '../services/lineService.js'

export async function sendTestNotification(req, res) {
  const message = req.body?.message

  if (
    typeof message !== 'string' ||
    message.trim().length === 0
  ) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a message'
    })
  }

  try {
    const result = await sendLineText(message.trim())

    return res.json(result)
  } catch (error) {
    console.error('LINE notification failed:', error.message)

    return res.status(500).json({
      success: false,
      message: 'LINE notification failed',
      error: error.message
    })
  }
}
