import {
  createDetection,
  getDetections,
  getDetectionById
} from '../services/detectionService.js'

export async function receiveDetection(req, res) {
  const event = req.body

  const requiredFields = [
    'event_id',
    'timestamp',
    'event_type',
    'confidence',
    'camera_id',
    'face_blurred',
    'smoke_mandatory_gate'
  ]

  const missingFields = requiredFields.filter(
    (field) => event?.[field] === undefined ||
      event?.[field] === null ||
      event?.[field] === ''
  )

  if (missingFields.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields',
      missing_fields: missingFields
    })
  }

  if (Number.isNaN(Date.parse(event.timestamp))) {
    return res.status(400).json({
      success: false,
      message: 'Invalid timestamp'
    })
  }

  const confidence = Number(event.confidence)

  if (
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 1
  ) {
    return res.status(400).json({
      success: false,
      message: 'Confidence must be between 0 and 1'
    })
  }

  if (
    typeof event.face_blurred !== 'boolean' ||
    typeof event.smoke_mandatory_gate !== 'boolean'
  ) {
    return res.status(400).json({
      success: false,
      message: 'Boolean fields have invalid values'
    })
  }

  if (
    typeof event.event_type !== 'string' ||
    typeof event.camera_id !== 'string'
  ) {
    return res.status(400).json({
      success: false,
      message: 'event_type and camera_id must be text'
    })
  }

  const result = await createDetection(event)

  if (result.duplicate) {
    return res.status(200).json({
      success: true,
      duplicate: true,
      message: 'This event has already been recorded',
      data: result.detection
    })
  }

  return res.status(201).json({
    success: true,
    message: 'Detection event saved successfully',
    data: result.detection
  })
}

export function listDetections(req, res) {
  const requestedLimit = Number(req.query.limit) || 100

  const filters = {
    limit: Math.min(Math.max(requestedLimit, 1), 500),
    camera_id: req.query.camera_id,
    event_type: req.query.event_type
  }

  const detections = getDetections(filters)

  return res.json({
    success: true,
    total: detections.length,
    data: detections
  })
}

export function getDetection(req, res) {
  const detection = getDetectionById(req.params.eventId)

  if (!detection) {
    return res.status(404).json({
      success: false,
      message: 'Detection event not found'
    })
  }

  return res.json({
    success: true,
    data: detection
  })
}
