
import { Router } from 'express'

import {
  receiveDetection,
  listDetections,
  getDetection
} from '../controllers/detectionController.js'

const router = Router()

function verifyAiKey(req, res, next) {
  const expectedKey = process.env.AI_WEBHOOK_KEY

  // อนุญาตเฉพาะตอนพัฒนาในเครื่องที่ยังไม่ได้ตั้ง Key
  if (!expectedKey) {
    return next()
  }

  const providedKey = req.get('x-api-key')

  if (providedKey !== expectedKey) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized AI webhook request'
    })
  }

  next()
}

router.post('/webhook/detection', verifyAiKey, receiveDetection)
router.get('/detections', listDetections)
router.get('/detections/:eventId', getDetection)

export default router
