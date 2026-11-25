import api from './api'

export async function fetchDetections(params = {}) {
  const response = await api.get('/detections', { params })
  return response.data
}

export async function fetchDetectionById(eventId) {
  const response = await api.get(`/detections/${eventId}`)
  return response.data
}

export async function clearDemoDetections() {
  const response = await api.delete('/detections/reset')
  return response.data
}

export async function reviewDetection(eventId, action) {
  const response = await api.patch(`/detections/${encodeURIComponent(eventId)}/review`, { action })
  return response.data
}
