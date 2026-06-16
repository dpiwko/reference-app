const express = require('express')
const { Pool } = require('pg')
const cors = require('cors')
const client = require('prom-client')

const app = express()
const PORT = process.env.PORT || 3000

const register = new client.Registry()
client.collectDefaultMetrics({ register })

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
})

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
})

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
})

async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS items (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    const { rowCount } = await pool.query('SELECT COUNT(*) FROM items')
    if (parseInt(rowCount) === 0 || true) {
      const count = await pool.query('SELECT COUNT(*) FROM items')
      if (count.rows[0].count === '0') {
        await pool.query(`
          INSERT INTO items (name, description) VALUES
          ('Item Alpha', 'First reference item'),
          ('Item Beta', 'Second reference item'),
          ('Item Gamma', 'Third reference item')
        `)
      }
    }
    console.log('✅ Database initialized')
  } catch (err) {
    console.error('❌ DB init error:', err.message)
  }
}

app.use(cors())
app.use(express.json())

app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer()
  res.on('finish', () => {
    const labels = {
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode,
    }
    end(labels)
    httpRequestsTotal.inc(labels)
  })
  next()
})

app.get('/health', async (req, res) => {
  const dbStatus = await pool.query('SELECT 1').then(() => 'ok').catch(() => 'error')
  const status = dbStatus === 'ok' ? 200 : 503

  res.status(status).json({
    status: dbStatus === 'ok' ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    checks: {
      database: dbStatus,
      uptime: process.uptime(),
    },
  })
})

app.get('/items', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM items ORDER BY created_at DESC')
    res.json({ items: result.rows, count: result.rows.length })
  } catch (err) {
    res.status(500).json({ error: 'Database error', message: err.message })
  }
})

app.post('/items', async (req, res) => {
  const { name, description } = req.body
  if (!name) return res.status(400).json({ error: 'Name is required' })
  try {
    const result = await pool.query(
      'INSERT INTO items (name, description) VALUES ($1, $2) RETURNING *',
      [name, description || '']
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Database error', message: err.message })
  }
})

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType)
  res.end(await register.metrics())
})

app.listen(PORT, async () => {
  console.log(`🚀 Backend running on port ${PORT}`)
  await initDB()
})

module.exports = app 
