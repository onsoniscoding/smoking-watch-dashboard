import { Router } from 'express'
import { getStatisticsData } from '../controllers/statisticsController.js'

const router = Router()

router.get('/statistics', getStatisticsData)

export default router
