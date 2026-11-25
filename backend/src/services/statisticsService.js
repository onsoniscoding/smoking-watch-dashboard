import { db } from '../database/db.js'

export function getStatistics() {
  const detections = db.data.detections

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date())

  const todayDetections = detections.filter((item) => {
    const eventDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date(item.timestamp))

    return eventDate === today
  })

  const cameraCounts = {}
  const eventTypeCounts = {}
  const hourlyCounts = {}
  let gatePassedCount = 0

  for (const item of detections) {
    const camLabel = item.camera_name || item.camera_id
    cameraCounts[camLabel] = (cameraCounts[camLabel] || 0) + 1
    eventTypeCounts[item.event_type] = (eventTypeCounts[item.event_type] || 0) + 1

    if (item.smoke_mandatory_gate === true) {
      gatePassedCount += 1
    }

    const hourStr = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Bangkok',
      hour: '2-digit',
      hour12: false
    }).format(new Date(item.timestamp))
    const key = `${hourStr}:00`
    hourlyCounts[key] = (hourlyCounts[key] || 0) + 1
  }

  return {
    total_detections: detections.length,
    today_detections: todayDetections.length,
    gate_passed_count: gatePassedCount,
    gate_failed_count: Math.max(0, detections.length - gatePassedCount),
    camera_counts: cameraCounts,
    event_type_counts: eventTypeCounts,
    hourly_counts: hourlyCounts
  }
}
