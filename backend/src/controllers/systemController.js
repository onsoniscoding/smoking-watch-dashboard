import { db } from '../database/db.js'

const HEARTBEAT_TIMEOUT_MS = 35000

export function getSystemStatus(req, res) {
  const lastHb = db.data.system?.last_heartbeat
  const lastMs = lastHb ? Date.parse(lastHb) : NaN
  const isFresh = Number.isFinite(lastMs) && (Date.now() - lastMs) <= HEARTBEAT_TIMEOUT_MS

  return res.json({
    success: true,
    data: {
      ...db.data.system,
      status: isFresh ? 'online' : 'standby'
    }
  })
}

export async function receiveHeartbeat(req, res) {
  db.data.system.status = 'online'
  db.data.system.last_heartbeat = new Date().toISOString()

  await db.write()

  return res.json({
    success: true,
    message: 'Heartbeat received',
    data: db.data.system
  })
}
