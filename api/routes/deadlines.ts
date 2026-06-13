import { Router, type Request, type Response } from 'express'
import { getDb } from '../database.js'

const router = Router()

router.get('/deadlines', (req: Request, res: Response): void => {
  const db = getDb()
  const { application_id, status, type } = req.query

  let sql = 'SELECT d.*, a.case_no, a.applicant_name FROM deadline d JOIN application a ON d.application_id = a.id WHERE 1=1'
  const params: unknown[] = []

  if (application_id) {
    sql += ' AND d.application_id = ?'
    params.push(application_id)
  }
  if (status) {
    sql += ' AND d.status = ?'
    params.push(status)
  }
  if (type) {
    sql += ' AND d.type = ?'
    params.push(type)
  }

  sql += ' ORDER BY d.deadline_date ASC'

  const deadlines = db.prepare(sql).all(...params)
  res.json({ success: true, data: deadlines })
})

router.get('/deadlines/warnings', (req: Request, res: Response): void => {
  const db = getDb()

  const deadlines = db.prepare(`
    SELECT d.*, a.case_no, a.applicant_name, a.appraisal_type
    FROM deadline d
    JOIN application a ON d.application_id = a.id
    WHERE d.status = 'active'
    ORDER BY d.deadline_date ASC
  `).all() as any[]

  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const warnings = deadlines.map((d) => {
    const deadlineDate = new Date(d.deadline_date)
    deadlineDate.setHours(0, 0, 0, 0)
    const diffDays = Math.ceil((deadlineDate.getTime() - now.getTime()) / 86400000)

    let level: string | null = null
    if (diffDays < 0) {
      level = 'overdue'
    } else if (diffDays <= 3) {
      level = 'warning'
    }

    return { ...d, remaining_days: diffDays, warning_level: level }
  }).filter((w) => w.warning_level !== null)

  res.json({ success: true, data: warnings })
})

export default router
