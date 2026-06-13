import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDb, addAuditLog } from '../database.js'

const router = Router()

function checkConflicts(db: ReturnType<typeof getDb>, expertId: string, institutionId: string, date: string, time: string, location: string, excludeId?: string): string | null {
  let sql = `SELECT id FROM schedule WHERE status != 'expired' AND scheduled_date = ? AND scheduled_time = ? AND id != ?`
  const params: unknown[] = [date, time, excludeId || '']

  const expertConflict = db.prepare(
    `SELECT id FROM schedule WHERE status != 'expired' AND expert_id = ? AND scheduled_date = ? AND scheduled_time = ? AND id != ?`,
  ).get(expertId, date, time, excludeId || '')
  if (expertConflict) return '该专家在此时段已有排程'

  const instConflict = db.prepare(
    `SELECT id FROM schedule WHERE status != 'expired' AND institution_id = ? AND scheduled_date = ? AND scheduled_time = ? AND id != ?`,
  ).get(institutionId, date, time, excludeId || '')
  if (instConflict) return '该机构在此时段已有排程'

  const locConflict = db.prepare(
    `SELECT id FROM schedule WHERE status != 'expired' AND location = ? AND scheduled_date = ? AND scheduled_time = ? AND id != ?`,
  ).get(location, date, time, excludeId || '')
  if (locConflict) return '该地点在此时段已被占用'

  return null
}

router.post('/:id/schedule', (req: Request, res: Response): void => {
  const { expert_id, institution_id, scheduled_date, scheduled_time, location, is_urgent, urgent_reason, creator_name } = req.body
  if (!expert_id || !institution_id || !scheduled_date || !scheduled_time || !location || !creator_name) {
    res.status(400).json({ success: false, error: '缺少必填字段', code: 'MISSING_FIELDS' })
    return
  }

  if (is_urgent && !urgent_reason) {
    res.status(400).json({ success: false, error: '加急排程必须提供加急原因', code: 'URGENT_REASON_REQUIRED' })
    return
  }

  const db = getDb()
  const app = db.prepare('SELECT * FROM application WHERE id = ?').get(req.params.id) as any
  if (!app) {
    res.status(404).json({ success: false, error: '申请不存在', code: 'NOT_FOUND' })
    return
  }

  const validStatuses = ['fee_pending', 'accepted', 'scheduled', 'in_progress']
  if (!validStatuses.includes(app.status)) {
    res.status(400).json({ success: false, error: '当前状态不可排程', code: 'INVALID_STATUS' })
    return
  }

  const materials = db.prepare('SELECT * FROM material WHERE application_id = ?').all(req.params.id) as any[]
  const allApproved = materials.length > 0 && materials.every((m) => m.status === 'approved')
  if (!allApproved) {
    res.status(400).json({ success: false, error: '材料未全部审核通过，无法排程', code: 'MATERIAL_INCOMPLETE' })
    return
  }

  const fee = db.prepare('SELECT * FROM fee WHERE application_id = ?').get(req.params.id) as any
  if (!fee || fee.status !== 'paid') {
    res.status(402).json({ success: false, error: '费用未缴纳，无法排程', code: 'FEE_UNPAID' })
    return
  }

  const expert = db.prepare('SELECT * FROM expert WHERE id = ?').get(expert_id) as any
  if (expert) {
    const conflicts: string[] = JSON.parse(expert.conflict_case_nos || '[]')
    if (conflicts.includes(app.case_no)) {
      res.status(409).json({ success: false, error: '该专家与本案存在利益冲突', code: 'EXPERT_CONFLICT' })
      return
    }
  }

  const inst = db.prepare('SELECT * FROM institution WHERE id = ?').get(institution_id) as any
  if (inst && inst.current_load >= inst.max_capacity) {
    res.status(409).json({ success: false, error: '机构已达最大容量', code: 'CAPACITY_EXCEEDED' })
    return
  }

  const conflict = checkConflicts(db, expert_id, institution_id, scheduled_date, scheduled_time, location)
  if (conflict) {
    res.status(409).json({ success: false, error: conflict, code: 'SCHEDULE_CONFLICT' })
    return
  }

  const id = uuidv4()
  db.prepare(
    `INSERT INTO schedule (id, application_id, expert_id, institution_id, scheduled_date, scheduled_time, location, status, is_urgent, urgent_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, req.params.id, expert_id, institution_id, scheduled_date, scheduled_time, location, 'pending', is_urgent ? 1 : 0, urgent_reason || null)

  db.prepare('UPDATE application SET status = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run('scheduled', req.params.id)

  addAuditLog(db, req.params.id, 'schedule', creator_name, 'admin', `排程确定: ${scheduled_date} ${scheduled_time} ${location}`)

  const schedule = db.prepare('SELECT * FROM schedule WHERE id = ?').get(id)
  res.status(201).json({ success: true, data: schedule })
})

router.put('/schedules/:id', (req: Request, res: Response): void => {
  const { scheduled_date, scheduled_time, location, rescheduler_name } = req.body
  if (!scheduled_date || !scheduled_time || !location || !rescheduler_name) {
    res.status(400).json({ success: false, error: '缺少必填字段', code: 'MISSING_FIELDS' })
    return
  }

  const db = getDb()
  const schedule = db.prepare('SELECT * FROM schedule WHERE id = ?').get(req.params.id) as any
  if (!schedule) {
    res.status(404).json({ success: false, error: '排程不存在', code: 'NOT_FOUND' })
    return
  }

  if (schedule.status === 'expired' || schedule.status === 'completed') {
    res.status(400).json({ success: false, error: '排程已过期或已完成，无法更改', code: 'INVALID_STATUS' })
    return
  }

  const conflict = checkConflicts(db, schedule.expert_id, schedule.institution_id, scheduled_date, scheduled_time, location, req.params.id)
  if (conflict) {
    res.status(409).json({ success: false, error: conflict, code: 'SCHEDULE_CONFLICT' })
    return
  }

  db.prepare(
    'UPDATE schedule SET scheduled_date = ?, scheduled_time = ?, location = ?, reschedule_count = reschedule_count + 1 WHERE id = ?',
  ).run(scheduled_date, scheduled_time, location, req.params.id)

  addAuditLog(db, schedule.application_id, 'reschedule', rescheduler_name, 'admin', `排程更改: ${scheduled_date} ${scheduled_time} ${location}`)

  const updated = db.prepare('SELECT * FROM schedule WHERE id = ?').get(req.params.id)
  res.json({ success: true, data: updated })
})

router.get('/schedules', (req: Request, res: Response): void => {
  const db = getDb()
  const { status, expert_id, institution_id } = req.query

  let sql = `SELECT s.*, a.case_no, a.applicant_name, a.appraisal_type, e.name as expert_name
    FROM schedule s
    JOIN application a ON s.application_id = a.id
    JOIN expert e ON s.expert_id = e.id
    WHERE 1=1`
  const params: unknown[] = []

  if (status) {
    sql += ' AND s.status = ?'
    params.push(status)
  }
  if (expert_id) {
    sql += ' AND s.expert_id = ?'
    params.push(expert_id)
  }
  if (institution_id) {
    sql += ' AND s.institution_id = ?'
    params.push(institution_id)
  }

  sql += ' ORDER BY s.scheduled_date ASC, s.scheduled_time ASC'

  const schedules = db.prepare(sql).all(...params)
  res.json({ success: true, data: schedules })
})

router.get('/schedules/conflicts', (req: Request, res: Response): void => {
  const { expert_id, institution_id, date, time, location } = req.query
  const db = getDb()

  const conflicts: { type: string; message: string }[] = []

  if (expert_id && date && time) {
    const row = db.prepare(
      `SELECT id FROM schedule WHERE status != 'expired' AND expert_id = ? AND scheduled_date = ? AND scheduled_time = ?`,
    ).get(expert_id as string, date as string, time as string)
    if (row) conflicts.push({ type: 'expert', message: '该专家在此时段已有排程' })
  }

  if (institution_id && date && time) {
    const row = db.prepare(
      `SELECT id FROM schedule WHERE status != 'expired' AND institution_id = ? AND scheduled_date = ? AND scheduled_time = ?`,
    ).get(institution_id as string, date as string, time as string)
    if (row) conflicts.push({ type: 'institution', message: '该机构在此时段已有排程' })
  }

  if (location && date && time) {
    const row = db.prepare(
      `SELECT id FROM schedule WHERE status != 'expired' AND location = ? AND scheduled_date = ? AND scheduled_time = ?`,
    ).get(location as string, date as string, time as string)
    if (row) conflicts.push({ type: 'location', message: '该地点在此时段已被占用' })
  }

  res.json({ success: true, data: { has_conflicts: conflicts.length > 0, conflicts } })
})

router.post('/:id/urgent', (req: Request, res: Response): void => {
  const { urgent_reason, requester_name } = req.body
  if (!urgent_reason || !requester_name) {
    res.status(400).json({ success: false, error: '缺少加急原因或申请人', code: 'MISSING_FIELDS' })
    return
  }

  const db = getDb()
  const app = db.prepare('SELECT * FROM application WHERE id = ?').get(req.params.id) as any
  if (!app) {
    res.status(404).json({ success: false, error: '申请不存在', code: 'NOT_FOUND' })
    return
  }

  if (app.status !== 'accepted' && app.status !== 'scheduled') {
    res.status(400).json({ success: false, error: '当前状态不可申请加急', code: 'INVALID_STATUS' })
    return
  }

  db.prepare('UPDATE schedule SET is_urgent = 1, urgent_reason = ? WHERE application_id = ? AND status != \'expired\'')
    .run(urgent_reason, req.params.id)

  addAuditLog(db, req.params.id, 'urgent_request', requester_name, 'applicant', `申请加急排程: ${urgent_reason}`)

  res.json({ success: true, data: { message: '加急申请已提交' } })
})

router.put('/urgents/:id/approve', (req: Request, res: Response): void => {
  const { approver_name, approver_note } = req.body
  if (!approver_name) {
    res.status(400).json({ success: false, error: '缺少审批人', code: 'MISSING_FIELDS' })
    return
  }

  const db = getDb()
  const schedule = db.prepare('SELECT * FROM schedule WHERE id = ?').get(req.params.id) as any
  if (!schedule) {
    res.status(404).json({ success: false, error: '排程不存在', code: 'NOT_FOUND' })
    return
  }

  if (!schedule.is_urgent) {
    res.status(400).json({ success: false, error: '该排程非加急申请', code: 'NOT_URGENT' })
    return
  }

  addAuditLog(db, schedule.application_id, 'urgent_approve', approver_name, 'admin', `加急排程已批准${approver_note ? ': ' + approver_note : ''}`)

  res.json({ success: true, data: { message: '加急已批准' } })
})

export default router
