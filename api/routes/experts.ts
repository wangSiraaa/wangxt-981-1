import { Router, type Request, type Response } from 'express'
import { getDb } from '../database.js'

const router = Router()

router.get('/experts', (req: Request, res: Response): void => {
  const db = getDb()
  const { institution_id, qualification } = req.query

  let sql = 'SELECT e.*, i.name as institution_name FROM expert e JOIN institution i ON e.institution_id = i.id WHERE 1=1'
  const params: unknown[] = []

  if (institution_id) {
    sql += ' AND e.institution_id = ?'
    params.push(institution_id)
  }
  if (qualification) {
    sql += ' AND e.qualification LIKE ?'
    params.push(`%${qualification}%`)
  }

  const experts = db.prepare(sql).all(...params)
  res.json({ success: true, data: experts })
})

router.get('/experts/conflicts', (req: Request, res: Response): void => {
  const { expert_id, case_no } = req.query

  if (!case_no) {
    res.status(400).json({ success: false, error: '缺少案件编号', code: 'MISSING_FIELDS' })
    return
  }

  const db = getDb()

  if (expert_id) {
    const expert = db.prepare('SELECT * FROM expert WHERE id = ?').get(expert_id as string) as any
    if (!expert) {
      res.status(404).json({ success: false, error: '专家不存在', code: 'NOT_FOUND' })
      return
    }
    const conflicts: string[] = JSON.parse(expert.conflict_case_nos || '[]')
    const hasConflict = conflicts.includes(case_no as string)
    const conflictRecords = db.prepare('SELECT * FROM expert_conflict WHERE expert_id = ? AND case_no = ?')
      .all(expert_id as string, case_no as string)
    res.json({
      success: true,
      data: {
        expert_id,
        expert_name: expert.name,
        case_no,
        has_conflict: hasConflict,
        conflict_details: conflictRecords,
      },
    })
  } else {
    const experts = db.prepare('SELECT * FROM expert').all() as any[]
    const conflictedExperts = experts.filter((e) => {
      const conflicts: string[] = JSON.parse(e.conflict_case_nos || '[]')
      return conflicts.includes(case_no as string)
    }).map((e) => ({
      expert_id: e.id,
      expert_name: e.name,
      case_no,
      has_conflict: true,
      conflict_details: db.prepare('SELECT * FROM expert_conflict WHERE expert_id = ? AND case_no = ?')
        .all(e.id, case_no as string),
    }))
    res.json({
      success: true,
      data: {
        case_no,
        has_conflict: conflictedExperts.length > 0,
        conflicts: conflictedExperts,
      },
    })
  }
})

export default router
