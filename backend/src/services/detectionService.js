import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { db } from '../database/db.js'
import { sendLineText } from './lineService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const evidenceDir = path.resolve(__dirname, '../../evidence')

function sanitizeFilename(eventId) {
  return String(eventId).replace(/[^a-zA-Z0-9_-]/g, '_')
}

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

  let verifiedEvidenceUrl = null
  let reviewRequired = false

  if (typeof event.evidence_base64 === 'string' && event.evidence_base64.length > 0) {
    await fs.mkdir(evidenceDir, { recursive: true })
    const cleanBase64 = event.evidence_base64.replace(/^data:image\/\w+;base64,/, '')
    const filename = `${sanitizeFilename(event.event_id)}.jpg`
    await fs.writeFile(path.join(evidenceDir, filename), Buffer.from(cleanBase64, 'base64'))
    const port = process.env.PORT || 3000
    verifiedEvidenceUrl = `http://localhost:${port}/evidence/${filename}`
  } else if (
    typeof event.evidence_url === 'string' &&
    (event.evidence_url.startsWith('http://localhost:') || event.evidence_url.startsWith('/evidence/'))
  ) {
    verifiedEvidenceUrl = event.evidence_url
  } else if (event.evidence_url) {
    reviewRequired = true
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
    detected_objects: Array.isArray(event.detected_objects) ? event.detected_objects : [],
    source: event.source || 'CiRA CORE',

    evidence_url: verifiedEvidenceUrl,
    evidence_review_required: reviewRequired,

    notification_status:
      event.smoke_mandatory_gate === true
        ? 'pending'
        : 'skipped',

    received_at: new Date().toISOString()
  }

  db.data.system.status = 'online'
  db.data.system.last_heartbeat = new Date().toISOString()

  if (detection.smoke_mandatory_gate === true && process.env.LINE_ENABLED === 'true') {
    try {
      await sendLineText(
        `[Smoke Watch Alert]\nCamera: ${detection.camera_name}\nEvent: ${detection.event_id}\nConfidence: ${(detection.confidence * 100).toFixed(1)}%`
      )
      detection.notification_status = 'sent'
    } catch {
      detection.notification_status = 'failed'
    }
  }

  db.data.detections.unshift(detection)

  await db.write()

  return {
    duplicate: false,
    detection
  }
}

export async function clearAllDetections() {
  db.data.detections = []
  await db.write()
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
