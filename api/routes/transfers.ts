import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import {
  getDb,
  addAuditLog,
  createMaterialTransfer,
  confirmMaterialTransfer,
  addStatusChangeLog,
  checkScheduleBlockers,
  adjustDeadline,
} from '../database.js'

const router = Router()

router.get('/applications/:id/material-transfers', (req: Request, res: Response): void => {
  const db = getDb()
  const { transfer_type, transfer_status } = req.query

  let sql = `SELECT mt.*, a.case_no, a.applicant_name, m.material_name, m.material_type
    FROM material_transfer mt
    JOIN application a ON mt.application_id = a.id
    JOIN material m ON mt.material_id = m.id
    WHERE mt.application_id = ?`
  const params: unknown[] = [req.params.id]

  if (transfer_type) {
    sql += ' AND mt.transfer_type = ?'
    params.push(transfer_type)
  }
  if (transfer_status) {
    sql += ' AND mt.transfer_status = ?'
    params.push(transfer_status)
  }

  sql += ' ORDER BY mt.created_at DESC'

  const transfers = db.prepare(sql).all(...params)
  res.json({ success: true, data: transfers })
})

router.post('/applications/:id/material-transfers', (req: Request, res: Response): void => {
  const {
    material_id,
    transfer_type,
    from_party,
    from_party_role,
    to_party,
    to_party_role,
    sealed,
    electronic_sign,
    placeholder_status,
    remark,
    operator_name,
    operator_role,
  } = req.body

  if (!material_id || !transfer_type || !from_party || !to_party || !operator_name) {
    res.status(400).json({ success: false, error: '缺少必填字段', code: 'MISSING_FIELDS' })
    return
  }

  const db = getDb()

  const transfer = createMaterialTransfer(
    db,
    material_id,
    req.params.id,
    transfer_type,
    from_party,
    from_party_role || 'applicant',
    to_party,
    to_party_role || 'institution',
    sealed || false,
    electronic_sign || false,
    placeholder_status || 'pending',
    remark,
  )

  addAuditLog(
    db,
    req.params.id,
    'material_transfer_create',
    operator_name,
    operator_role || 'admin',
    `创建材料流转记录: ${transfer_type}，材料ID: ${material_id}`,
  )

  res.status(201).json({ success: true, data: transfer })
})

router.put('/material-transfers/:id/confirm', (req: Request, res: Response): void => {
  const { receiver_name, receiver_role, remark } = req.body
  if (!receiver_name) {
    res.status(400).json({ success: false, error: '缺少签收人', code: 'MISSING_FIELDS' })
    return
  }

  const db = getDb()
  const transfer = db.prepare('SELECT * FROM material_transfer WHERE id = ?').get(req.params.id) as any
  if (!transfer) {
    res.status(404).json({ success: false, error: '流转记录不存在', code: 'NOT_FOUND' })
    return
  }

  if (transfer.transfer_status === 'received') {
    res.status(400).json({ success: false, error: '材料已签收，无法重复签收', code: 'ALREADY_RECEIVED' })
    return
  }

  const updated = confirmMaterialTransfer(db, req.params.id, receiver_name, receiver_role || 'institution', remark)

  addAuditLog(
    db,
    transfer.application_id,
    'material_transfer_confirm',
    receiver_name,
    receiver_role || 'institution',
    `材料签收确认: ${transfer.transfer_type}，材料ID: ${transfer.material_id}`,
  )

  res.json({ success: true, data: updated })
})

router.get('/material-transfers', (req: Request, res: Response): void => {
  const db = getDb()
  const { transfer_type, transfer_status, application_id } = req.query

  let sql = `SELECT mt.*, a.case_no, a.applicant_name, m.material_name, m.material_type
    FROM material_transfer mt
    JOIN application a ON mt.application_id = a.id
    JOIN material m ON mt.material_id = m.id
    WHERE 1=1`
  const params: unknown[] = []

  if (transfer_type) {
    sql += ' AND mt.transfer_type = ?'
    params.push(transfer_type)
  }
  if (transfer_status) {
    sql += ' AND mt.transfer_status = ?'
    params.push(transfer_status)
  }
  if (application_id) {
    sql += ' AND mt.application_id = ?'
    params.push(application_id)
  }

  sql += ' ORDER BY mt.created_at DESC'

  const transfers = db.prepare(sql).all(...params)
  res.json({ success: true, data: transfers })
})

router.get('/schedule-invalidations', (req: Request, res: Response): void => {
  const db = getDb()
  const { invalidation_type, application_id, supervisor_approval } = req.query

  let sql = `SELECT si.*, a.case_no, a.applicant_name, s.schedule_date, s.start_time, s.expert_name
    FROM schedule_invalidation si
    JOIN application a ON si.application_id = a.id
    JOIN schedule s ON si.schedule_id = s.id
    WHERE 1=1`
  const params: unknown[] = []

  if (invalidation_type) {
    sql += ' AND si.invalidation_type = ?'
    params.push(invalidation_type)
  }
  if (application_id) {
    sql += ' AND si.application_id = ?'
    params.push(application_id)
  }
  if (supervisor_approval !== undefined) {
    sql += ' AND si.supervisor_approval = ?'
    params.push(supervisor_approval ? 1 : 0)
  }

  sql += ' ORDER BY si.created_at DESC'

  const invalidations = db.prepare(sql).all(...params)
  res.json({ success: true, data: invalidations })
})

router.get('/applications/:id/schedule-invalidations', (req: Request, res: Response): void => {
  const db = getDb()
  const invalidations = db
    .prepare(
      `SELECT si.*, s.schedule_date, s.start_time, s.expert_name
    FROM schedule_invalidation si
    JOIN schedule s ON si.schedule_id = s.id
    WHERE si.application_id = ?
    ORDER BY si.created_at DESC`,
    )
    .all(req.params.id)
  res.json({ success: true, data: invalidations })
})

router.get('/deadline-adjustments', (req: Request, res: Response): void => {
  const db = getDb()
  const { adjustment_type, application_id, supervisor_approval } = req.query

  let sql = `SELECT da.*, a.case_no, a.applicant_name, d.deadline_type, d.deadline_date as original_deadline_date
    FROM deadline_adjustment da
    JOIN application a ON da.application_id = a.id
    JOIN deadline d ON da.deadline_id = d.id
    WHERE 1=1`
  const params: unknown[] = []

  if (adjustment_type) {
    sql += ' AND da.adjustment_type = ?'
    params.push(adjustment_type)
  }
  if (application_id) {
    sql += ' AND da.application_id = ?'
    params.push(application_id)
  }
  if (supervisor_approval !== undefined) {
    sql += ' AND da.supervisor_approval = ?'
    params.push(supervisor_approval ? 1 : 0)
  }

  sql += ' ORDER BY da.created_at DESC'

  const adjustments = db.prepare(sql).all(...params)
  res.json({ success: true, data: adjustments })
})

router.get('/applications/:id/deadline-adjustments', (req: Request, res: Response): void => {
  const db = getDb()
  const adjustments = db
    .prepare(
      `SELECT da.*, d.deadline_type, d.deadline_date as original_deadline_date
    FROM deadline_adjustment da
    JOIN deadline d ON da.deadline_id = d.id
    WHERE da.application_id = ?
    ORDER BY da.created_at DESC`,
    )
    .all(req.params.id)
  res.json({ success: true, data: adjustments })
})

router.get('/applications/:id/status-history', (req: Request, res: Response): void => {
  const db = getDb()
  const history = db
    .prepare(
      `SELECT scl.*, a.case_no
    FROM status_change_log scl
    JOIN application a ON scl.application_id = a.id
    WHERE scl.application_id = ?
    ORDER BY scl.created_at DESC`,
    )
    .all(req.params.id)
  res.json({ success: true, data: history })
})

router.get('/status-change-logs', (req: Request, res: Response): void => {
  const db = getDb()
  const { application_id, actor_role } = req.query

  let sql = `SELECT scl.*, a.case_no, a.applicant_name
    FROM status_change_log scl
    JOIN application a ON scl.application_id = a.id
    WHERE 1=1`
  const params: unknown[] = []

  if (application_id) {
    sql += ' AND scl.application_id = ?'
    params.push(application_id)
  }
  if (actor_role) {
    sql += ' AND scl.actor_role = ?'
    params.push(actor_role)
  }

  sql += ' ORDER BY scl.created_at DESC'

  const logs = db.prepare(sql).all(...params)
  res.json({ success: true, data: logs })
})

router.get('/applications/:id/schedule-blockers', (req: Request, res: Response): void => {
  const db = getDb()
  const { expert_id } = req.query

  const result = checkScheduleBlockers(db, req.params.id, expert_id as string)

  res.json({
    success: true,
    data: {
      can_schedule: !result.blocked,
      blockers: result.blockers,
      blocker_count: result.blockers.length,
    },
  })
})

router.post('/deadlines/:id/adjust', (req: Request, res: Response): void => {
  const {
    adjustment_type,
    extend_days,
    reason,
    operator_name,
    operator_role,
    supervisor_approval,
    supervisor_name,
    supervisor_note,
  } = req.body

  if (!adjustment_type || !reason || !operator_name) {
    res.status(400).json({ success: false, error: '缺少必填字段', code: 'MISSING_FIELDS' })
    return
  }

  const db = getDb()
  const deadline = db.prepare('SELECT * FROM deadline WHERE id = ?').get(req.params.id) as any
  if (!deadline) {
    res.status(404).json({ success: false, error: '期限记录不存在', code: 'NOT_FOUND' })
    return
  }

  const adjusted = adjustDeadline(
    db,
    deadline.application_id,
    deadline.deadline_type,
    adjustment_type,
    extend_days || 0,
    reason,
    operator_name,
    operator_role || 'admin',
    supervisor_approval || false,
    supervisor_name,
    supervisor_note,
  )

  addAuditLog(
    db,
    deadline.application_id,
    'deadline_adjust',
    operator_name,
    operator_role || 'admin',
    `期限调整: ${deadline.deadline_type}，类型: ${adjustment_type}，延长: ${extend_days || 0}天，原因: ${reason}`,
  )

  addStatusChangeLog(
    db,
    deadline.application_id,
    null,
    null,
    operator_name,
    operator_role || 'admin',
    `期限调整: ${deadline.deadline_type}，类型: ${adjustment_type}，延长: ${extend_days || 0}天，原因: ${reason}`,
  )

  res.json({ success: true, data: adjusted })
})

export default router
