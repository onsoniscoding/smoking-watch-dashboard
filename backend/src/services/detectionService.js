import { db } from '../database/db.js'

export async function createDetection(event) {
  const existing = db.data.detections.find(
    (item) => item.event_id === event.event_id
  )

  if (existing) {
    return {
      duplicate: true,
      detection: existing
    }
  }

  const detection = {
    event_id: event.event_id,
    timestamp: event.timestamp,
    event_type: event.event_type,
    confidence: Number(event.confidence),
    camera_id: event.camera_id,
    camera_name: event.camera_name || event.camera_id,
    face_blurred: event.face_blurred,
    smoke_mandatory_gate: event.smoke_mandatory_gate,

    // Backend จะยังไม่เปิดเผย URL ภาพหลักฐาน
    // จนกว่าจะตรวจสอบกระบวนการเบลอใบหน้าได้
    evidence_url: null,
    evidence_review_required: Boolean(event.evidence_url),

    notification_status:
      event.smoke_mandatory_gate === true
        ? 'pending'
        : 'skipped',

    received_at: new Date().toISOString()
  }

  db.data.detections.unshift(detection)

  await db.write()

  return {
    duplicate: false,
    detection
  }
}

export function getDetections(filters = {}) {
  let results = [...db.data.detections]

  if (filters.camera_id) {
    results = results.filter(
      (item) => item.camera_id === filters.camera_id
    )
  }

  if (filters.event_type) {
    results = results.filter(
      (item) => item.event_type === filters.event_type
    )
  }

  const limit = filters.limit || 100

  return results.slice(0, limit)
}

export function getDetectionById(eventId) {
  return db.data.detections.find(
    (item) => item.event_id === eventId
  )
}
