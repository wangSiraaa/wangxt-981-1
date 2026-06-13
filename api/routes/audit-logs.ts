import { Router, type Request, type Response } from 'express'
import { getDb } from '../database.js'

const router = Router()

router.get('/audit-logs', (req: Request, res: Response): void => {
  const db = getDb()
  const { application_id, action, actor_role } = req.query

  let sql = 'SELECT * FROM audit_log WHERE 1=1'
  const params: unknown[] = []

  if (application_id) {
    sql += ' AND application_id = ?'
    params.push(application_id)
  }
  if (action) {
    sql += ' AND action = ?'
    params.push(action)
  }
  if (actor_role) {
    sql += ' AND actor_role = ?'
    params.push(actor_role)
  }

  sql += ' ORDER BY created_at DESC'

  const logs = db.prepare(sql).all(...params)
  res.json({ success: true, data: logs })
})

export default router
