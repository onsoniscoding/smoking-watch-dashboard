import { db } from '../database/db.js'

export function getSystemStatus(req, res) {
  return res.json({
    success: true,
    data: db.data.system
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
