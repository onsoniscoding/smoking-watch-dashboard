import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

import { initDatabase } from './database/db.js'
import detectionRoutes from './routes/detectionRoutes.js'
import statisticsRoutes from './routes/statisticsRoutes.js'
import systemRoutes from './routes/systemRoutes.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173'
  ]
}))

app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Smoke Watch Backend is running',
    timestamp: new Date().toISOString()
  })
})

app.use('/api', detectionRoutes)
app.use('/api', statisticsRoutes)
app.use('/api', systemRoutes)

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found'
  })
})

app.use((error, req, res, next) => {
  console.error(error)

  res.status(error.status || 500).json({
    success: false,
    message: error.status === 400
      ? 'Invalid JSON request'
      : 'Internal server error'
  })
})

async function startServer() {
  try {
    await initDatabase()

    app.listen(PORT, () => {
      console.log('----------------------------------')
      console.log('Smoke Watch Backend is running')
      console.log(`Local URL: http://localhost:${PORT}`)
      console.log(`Health: http://localhost:${PORT}/api/health`)
      console.log('----------------------------------')
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()
