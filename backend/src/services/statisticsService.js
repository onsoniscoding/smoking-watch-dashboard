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

  for (const item of detections) {
    cameraCounts[item.camera_id] =
      (cameraCounts[item.camera_id] || 0) + 1
  }

  const eventTypeCounts = {}

  for (const item of detections) {
    eventTypeCounts[item.event_type] =
      (eventTypeCounts[item.event_type] || 0) + 1
  }

  return {
    total_detections: detections.length,
    today_detections: todayDetections.length,
    camera_counts: cameraCounts,
    event_type_counts: eventTypeCounts
  }
}
