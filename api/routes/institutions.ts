import { Router, type Request, type Response } from 'express'
import { getDb } from '../database.js'

const router = Router()

router.get('/institutions', (req: Request, res: Response): void => {
  const db = getDb()
  const institutions = db.prepare(`
    SELECT i.*,
      (SELECT COUNT(*) FROM application a WHERE a.institution_id = i.id AND a.status NOT IN ('withdrawn', 'terminated', 'completed')) as active_cases,
      (SELECT COUNT(*) FROM schedule s WHERE s.institution_id = i.id AND s.status = 'pending') as pending_schedules
    FROM institution i
    ORDER BY i.name
  `).all()

  const result = institutions.map((inst: any) => ({
    ...inst,
    available_capacity: inst.max_capacity - inst.current_load,
  }))

  res.json({ success: true, data: result })
})

export default router
