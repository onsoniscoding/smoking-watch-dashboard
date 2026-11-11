
import api from './api'

export async function fetchStatistics() {
  const response = await api.get('/statistics')
  return response.data
}

export async function fetchSystemStatus() {
  const response = await api.get('/system/status')
  return response.data
}
