import { getStatistics } from '../services/statisticsService.js'

export function getStatisticsData(req, res) {
  return res.json({
    success: true,
    data: getStatistics()
  })
}
