import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import {
  getDb,
  addAuditLog,
  checkScheduleBlockers,
  adjustDeadline,
  adjustAllActiveDeadlines,
  addStatusChangeLog,
  invalidateSchedule,
} from '../database.js'

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

  const blockerResult = checkScheduleBlockers(db, req.params.id, expert_id)
  if (blockerResult.blocked) {
    const errorMessages = blockerResult.blockers
      .filter((b) => b.severity === 'error')
      .map((b) => b.message)
    res.status(400).json({
      success: false,
      error: `排期条件不满足：${errorMessages.join('；')}`,
      code: 'SCHEDULE_BLOCKED',
      data: {
        blockers: blockerResult.blockers,
        blocker_count: blockerResult.blockers.length,
        can_schedule: false,
      },
    })
    return
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
  const oldStatus = app.status

  const transaction = db.transaction(() => {
    db.prepare(
      `INSERT INTO schedule (id, application_id, expert_id, institution_id, scheduled_date, scheduled_time, location, status, is_urgent, urgent_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, req.params.id, expert_id, institution_id, scheduled_date, scheduled_time, location, 'pending', is_urgent ? 1 : 0, urgent_reason || null)

    db.prepare('UPDATE application SET last_status = ?, status = ?, reschedule_count = reschedule_count + 1, updated_at = datetime(\'now\') WHERE id = ?')
      .run(oldStatus, 'scheduled', req.params.id)

    addStatusChangeLog(
      db,
      req.params.id,
      oldStatus,
      'scheduled',
      creator_name,
      'admin',
      `排期确定：${scheduled_date} ${scheduled_time} ${location}，鉴定人：${(db.prepare('SELECT name FROM expert WHERE id = ?').get(expert_id) as any)?.name || '未指定'}`,
    )

    addAuditLog(db, req.params.id, 'schedule', creator_name, 'admin', `排程确定: ${scheduled_date} ${scheduled_time} ${location}`)
  })

  transaction()

  const schedule = db.prepare('SELECT * FROM schedule WHERE id = ?').get(id)
  res.status(201).json({ success: true, data: schedule })
})

router.put('/schedules/:id', (req: Request, res: Response): void => {
  const { scheduled_date, scheduled_time, location, rescheduler_name, reason, supervisor_approval, supervisor_name, supervisor_note } = req.body
  if (!scheduled_date || !scheduled_time || !location || !rescheduler_name) {
    res.status(400).json({ success: false, error: '缺少必填字段', code: 'MISSING_FIELDS' })
    return
  }

  const db = getDb()
  const oldSchedule = db.prepare('SELECT * FROM schedule WHERE id = ?').get(req.params.id) as any
  if (!oldSchedule) {
    res.status(404).json({ success: false, error: '排程不存在', code: 'NOT_FOUND' })
    return
  }

  if (oldSchedule.status === 'expired' || oldSchedule.status === 'completed') {
    res.status(400).json({ success: false, error: '排程已过期或已完成，无法更改', code: 'INVALID_STATUS' })
    return
  }

  const conflict = checkConflicts(db, oldSchedule.expert_id, oldSchedule.institution_id, scheduled_date, scheduled_time, location, req.params.id)
  if (conflict) {
    res.status(409).json({ success: false, error: conflict, code: 'SCHEDULE_CONFLICT' })
    return
  }

  const app = db.prepare('SELECT * FROM application WHERE id = ?').get(oldSchedule.application_id) as any
  const oldDate = oldSchedule.scheduled_date
  const newScheduleId = uuidv4()

  const transaction = db.transaction(() => {
    invalidateSchedule(
      db,
      req.params.id,
      oldSchedule.application_id,
      'reschedule',
      reason || '机构改期',
      rescheduler_name,
      'admin',
      supervisor_approval || false,
      supervisor_name,
      supervisor_note,
    )

    db.prepare(
      `INSERT INTO schedule (id, application_id, expert_id, institution_id, scheduled_date, scheduled_time, location, status, is_urgent, urgent_reason, reschedule_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      newScheduleId,
      oldSchedule.application_id,
      oldSchedule.expert_id,
      oldSchedule.institution_id,
      scheduled_date,
      scheduled_time,
      location,
      'pending',
      oldSchedule.is_urgent,
      oldSchedule.urgent_reason,
      (oldSchedule.reschedule_count || 0) + 1,
    )

    db.prepare(
      'UPDATE application SET reschedule_count = reschedule_count + 1, updated_at = datetime(\'now\') WHERE id = ?',
    ).run(oldSchedule.application_id)

    const oldDateObj = new Date(oldDate)
    const newDateObj = new Date(scheduled_date)
    const extendDays = Math.max(0, Math.ceil((newDateObj.getTime() - oldDateObj.getTime()) / 86400000))
    if (extendDays > 0) {
      adjustDeadline(
        db,
        oldSchedule.application_id,
        'appraisal',
        'reschedule',
        extendDays,
        `机构改期，原排期${oldDate}改为${scheduled_date}，鉴定期限顺延${extendDays}天`,
        rescheduler_name,
        'admin',
        supervisor_approval || false,
        supervisor_name,
        supervisor_note,
      )
    }

    if (app) {
      addStatusChangeLog(
        db,
        oldSchedule.application_id,
        app.status,
        app.status,
        rescheduler_name,
        'admin',
        `排期改期：${oldDate} ${oldSchedule.scheduled_time} → ${scheduled_date} ${scheduled_time} ${location}${reason ? `，原因：${reason}` : ''}`,
      )
    }

    addAuditLog(db, oldSchedule.application_id, 'reschedule', rescheduler_name, 'admin', `排程更改: ${scheduled_date} ${scheduled_time} ${location}`)
  })

  transaction()

  const updated = db.prepare('SELECT * FROM schedule WHERE id = ?').get(newScheduleId)
  res.json({ success: true, data: updated, message: `旧排期已生成失效记录，新排期已创建` })
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

router.get('/schedules/urgents', (_req: Request, res: Response): void => {
  const db = getDb()
  const sql = `
    SELECT s.*, a.case_no, a.applicant_name, a.applicant_phone, a.appraisal_type, a.status as application_status, e.name as expert_name
    FROM schedule s
    JOIN application a ON s.application_id = a.id
    JOIN expert e ON s.expert_id = e.id
    WHERE s.is_urgent = 1 AND (s.urgent_approved IS NULL OR s.urgent_approved = 0) AND s.status != 'expired' AND s.status != 'completed'
    ORDER BY s.created_at DESC
  `
  const urgents = db.prepare(sql).all()
  res.json({ success: true, data: urgents })
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
  const { approver_name, approver_note, shorten_days } = req.body
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

  const app = db.prepare('SELECT * FROM application WHERE id = ?').get(schedule.application_id) as any
  const oldStatus = app?.status
  const actualShorten = Math.max(0, shorten_days || 10)

  const transaction = db.transaction(() => {
    db.prepare(
      'UPDATE schedule SET urgent_approved = 1, urgent_approver = ?, urgent_approve_note = ?, urgent_approved_at = datetime(\'now\') WHERE id = ?',
    ).run(approver_name, approver_note || null, req.params.id)

    db.prepare(
      'UPDATE application SET is_urgent = 1, urgent_approved = 1, urgent_approver = ?, urgent_approved_at = datetime(\'now\') WHERE id = ?',
    ).run(approver_name, schedule.application_id)

    adjustDeadline(
      db,
      schedule.application_id,
      'schedule',
      'urgent',
      -actualShorten,
      `加急审批通过，排期期限提前${actualShorten}个工作日`,
      approver_name,
      'supervisor',
      true,
      approver_name,
      approver_note || `加急审批通过，提前${actualShorten}天`,
    )

    adjustDeadline(
      db,
      schedule.application_id,
      'appraisal',
      'urgent',
      -Math.round(actualShorten * 0.5),
      `加急审批通过，鉴定期限提前${Math.round(actualShorten * 0.5)}个工作日`,
      approver_name,
      'supervisor',
      true,
      approver_name,
      approver_note || `加急审批通过`,
    )

    adjustDeadline(
      db,
      schedule.application_id,
      'completion',
      'urgent',
      -Math.round(actualShorten * 0.7),
      `加急审批通过，完成期限提前${Math.round(actualShorten * 0.7)}个工作日`,
      approver_name,
      'supervisor',
      true,
      approver_name,
      approver_note || `加急审批通过`,
    )

    if (oldStatus) {
      addStatusChangeLog(
        db,
        schedule.application_id,
        oldStatus,
        oldStatus,
        approver_name,
        'supervisor',
        `加急审批通过${approver_note ? '：' + approver_note : ''}，排期/鉴定/完成期限均已提前`,
      )
    }

    addAuditLog(db, schedule.application_id, 'urgent_approve', approver_name, 'admin', `加急排程已批准${approver_note ? ': ' + approver_note : ''}，各期限提前${actualShorten}-${Math.round(actualShorten * 0.7)}个工作日`)
  })

  transaction()

  const updated = db.prepare('SELECT * FROM schedule WHERE id = ?').get(req.params.id)
  res.json({ success: true, data: updated, message: `加急审批通过，排期/鉴定/完成期限已提前${actualShorten}/${Math.round(actualShorten * 0.5)}/${Math.round(actualShorten * 0.7)}天` })
})

export default router
