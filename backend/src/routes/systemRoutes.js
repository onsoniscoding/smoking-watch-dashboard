
import { Router } from 'express'

import {
  getSystemStatus,
  receiveHeartbeat
} from '../controllers/systemController.js'

import {
  sendTestNotification
} from '../controllers/lineController.js'

const router = Router()

router.get('/system/status', getSystemStatus)
router.post('/system/heartbeat', receiveHeartbeat)

router.post('/notifications/test', sendTestNotification)

export default router
