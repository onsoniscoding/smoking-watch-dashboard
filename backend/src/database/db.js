import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import { fileURLToPath } from 'node:url'

const databasePath = fileURLToPath(
  new URL('./db.json', import.meta.url)
)

const adapter = new JSONFile(databasePath)

const defaultData = {
  detections: [],
  system: {
    status: 'offline',
    last_heartbeat: null
  }
}

export const db = new Low(adapter, defaultData)

export async function initDatabase() {
  await db.read()

  db.data ||= structuredClone(defaultData)
  db.data.detections ||= []
  db.data.system ||= {
    status: 'offline',
    last_heartbeat: null
  }

  await db.write()

  console.log('Database connected successfully')
}
