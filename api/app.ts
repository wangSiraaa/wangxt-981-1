import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import fs from 'fs'
import { fileURLToPath } from 'url'
import authRoutes from './routes/auth.js'
import applicationRoutes from './routes/applications.js'
import materialRoutes from './routes/materials.js'
import scheduleRoutes from './routes/schedules.js'
import withdrawalRoutes from './routes/withdrawals.js'
import feeRoutes from './routes/fees.js'
import deadlineRoutes from './routes/deadlines.js'
import auditLogRoutes from './routes/audit-logs.js'
import expertRoutes from './routes/experts.js'
import institutionRoutes from './routes/institutions.js'
import { initDatabase, getDb } from './database.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')
const DIST_DIR = path.join(ROOT_DIR, 'dist')
const PUBLIC_DIR = path.join(ROOT_DIR, 'public')

dotenv.config()

initDatabase()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.get('/api/health', (_req: Request, res: Response): void => {
  res.status(200).json({ success: true, message: 'ok' })
})

app.get('/api/stats', (_req: Request, res: Response): void => {
  const db = getDb()
  const total = (db.prepare('SELECT COUNT(*) as count FROM application').get() as { count: number }).count
  const pendingReview = (db.prepare("SELECT COUNT(*) as count FROM application WHERE status IN ('submitted','reviewing','correction_needed','corrected','fee_pending')").get() as { count: number }).count
  const upcomingSchedules = (db.prepare("SELECT COUNT(*) as count FROM schedule WHERE status IN ('pending','confirmed')").get() as { count: number }).count
  const activeWarnings = (db.prepare("SELECT COUNT(*) as count FROM deadline WHERE status = 'active' AND deadline_date <= date('now', '+3 days')").get() as { count: number }).count
  res.json({
    success: true,
    data: { total, pendingReview, upcomingSchedules, activeWarnings },
  })
})

app.use('/api/auth', authRoutes)
app.use('/api/applications', scheduleRoutes)
app.use('/api/applications', withdrawalRoutes)
app.use('/api/applications', materialRoutes)
app.use('/api/applications', applicationRoutes)
app.use('/api', feeRoutes)
app.use('/api', deadlineRoutes)
app.use('/api', auditLogRoutes)
app.use('/api', expertRoutes)
app.use('/api', institutionRoutes)

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR, { maxAge: '1h', index: 'index.html' }))
  if (fs.existsSync(PUBLIC_DIR)) {
    app.use(express.static(PUBLIC_DIR, { maxAge: '1h' }))
  }
} else if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR))
}

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Error]', error.message)
  res.status(500).json({ success: false, error: 'Server internal error' })
})

app.use((req: Request, res: Response) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ success: false, error: 'API not found' })
    return
  }
  if (fs.existsSync(DIST_DIR)) {
    res.sendFile(path.join(DIST_DIR, 'index.html'))
  } else {
    res.status(404).json({ success: false, error: 'Not found' })
  }
})

export default app
