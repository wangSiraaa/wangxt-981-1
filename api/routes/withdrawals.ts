import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import {
  getDb,
  addAuditLog,
  addStatusChangeLog,
  invalidateSchedule,
  addFeeTransaction,
  expireAllDeadlines,
} from '../database.js'

const router = Router()

router.get('/withdrawals', (req: Request, res: Response): void => {
  const db = getDb()
  const { status, application_id } = req.query

  let sql = `SELECT w.*, a.case_no, a.applicant_name, a.appraisal_type, a.status as application_status
    FROM withdrawal_request w
    JOIN application a ON w.application_id = a.id
    WHERE 1=1`
  const params: unknown[] = []

  if (status) {
    sql += ' AND w.status = ?'
    params.push(status)
  }
  if (application_id) {
    sql += ' AND w.application_id = ?'
    params.push(application_id)
  }

  sql += ' ORDER BY w.created_at DESC'

  const withdrawals = db.prepare(sql).all(...params)
  res.json({ success: true, data: withdrawals })
})

router.post('/:id/withdraw', (req: Request, res: Response): void => {
  const { reason, withdrawer_name } = req.body
  if (!reason || !withdrawer_name) {
    res.status(400).json({ success: false, error: '缺少撤回原因或申请人', code: 'MISSING_FIELDS' })
    return
  }

  const db = getDb()
  const app = db.prepare('SELECT * FROM application WHERE id = ?').get(req.params.id) as any
  if (!app) {
    res.status(404).json({ success: false, error: '申请不存在', code: 'NOT_FOUND' })
    return
  }

  if (app.status === 'completed') {
    res.status(403).json({ success: false, error: '已完成的鉴定不可撤回', code: 'COMPLETED_CANNOT_WITHDRAW' })
    return
  }

  if (app.status === 'withdrawn') {
    res.status(400).json({ success: false, error: '申请已撤回', code: 'ALREADY_WITHDRAWN' })
    return
  }

  const existingWithdrawal = db.prepare('SELECT id FROM withdrawal_request WHERE application_id = ? AND status = ?').get(req.params.id, 'pending')
  if (existingWithdrawal) {
    res.status(409).json({ success: false, error: '已有待审批的撤回请求', code: 'WITHDRAWAL_PENDING' })
    return
  }

  const fee = db.prepare('SELECT * FROM fee WHERE application_id = ?').get(req.params.id) as any
  const refundRequired = fee && fee.status === 'paid' ? 1 : 0

  const id = uuidv4()
  db.prepare(
    `INSERT INTO withdrawal_request (id, application_id, reason, status, refund_required) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, req.params.id, reason, 'pending', refundRequired)

  addAuditLog(db, req.params.id, 'withdraw_request', withdrawer_name, 'applicant', `申请撤回: ${reason}`)

  const withdrawal = db.prepare('SELECT * FROM withdrawal_request WHERE id = ?').get(id)
  res.status(201).json({ success: true, data: withdrawal })
})

router.put('/withdrawals/:id/approve', (req: Request, res: Response): void => {
  const { approver_name, approver_note, supervisor_name, supervisor_note } = req.body
  if (!approver_name) {
    res.status(400).json({ success: false, error: '缺少审批人', code: 'MISSING_FIELDS' })
    return
  }

  const db = getDb()
  const withdrawal = db.prepare('SELECT * FROM withdrawal_request WHERE id = ?').get(req.params.id) as any
  if (!withdrawal) {
    res.status(404).json({ success: false, error: '撤回请求不存在', code: 'NOT_FOUND' })
    return
  }

  if (withdrawal.status !== 'pending') {
    res.status(400).json({ success: false, error: '撤回请求已处理', code: 'ALREADY_PROCESSED' })
    return
  }

  const app = db.prepare('SELECT * FROM application WHERE id = ?').get(withdrawal.application_id) as any
  if (app && app.status === 'completed') {
    res.status(403).json({ success: false, error: '已完成的鉴定不可撤回', code: 'COMPLETED_CANNOT_WITHDRAW' })
    return
  }

  const transaction = db.transaction(() => {
    const oldStatus = app.status
    db.prepare(
      'UPDATE application SET last_status = ?, status = ?, updated_at = datetime(\'now\') WHERE id = ?',
    ).run(oldStatus, 'withdrawn', withdrawal.application_id)

    const pendingSchedules = db
      .prepare(
        `SELECT * FROM schedule WHERE application_id = ? AND status != 'completed' AND status != 'expired'`,
      )
      .all(withdrawal.application_id) as any[]

    for (const sched of pendingSchedules) {
      invalidateSchedule(
        db,
        sched.id,
        withdrawal.application_id,
        'withdrawal',
        `申请撤回，${approver_note || '主管审批同意撤回'}`,
        approver_name,
        'admin',
        true,
        supervisor_name || approver_name,
        approver_note,
      )
    }

    expireAllDeadlines(
      db,
      withdrawal.application_id,
      `申请撤回${approver_note ? '：' + approver_note : ''}，所有期限已终止`,
      approver_name,
      'supervisor',
    )

    let refundAmount = 0
    let refundProcessed = false
    if (withdrawal.refund_required) {
      const fee = db.prepare('SELECT * FROM fee WHERE application_id = ?').get(withdrawal.application_id) as any
      if (fee && fee.status === 'paid') {
        refundAmount = fee.amount
        db.prepare(
          'UPDATE fee SET status = ?, refund_status = ?, refund_amount = ?, refund_reason = ?, refund_approved = ?, refund_approver = ?, refund_approved_at = datetime(\'now\'), refund_approval_note = ? WHERE id = ?',
        ).run(
          'refunded',
          'completed',
          refundAmount,
          '委托人撤回申请，全额退款',
          1,
          supervisor_name || approver_name,
          approver_note || '撤回审批通过，全额退款',
          fee.id,
        )

        addFeeTransaction(
          db,
          fee.id,
          withdrawal.application_id,
          'refund',
          refundAmount,
          approver_name,
          'admin',
          'bank_transfer',
          `REF-${Date.now()}`,
          '委托人撤回申请，全额退款',
          true,
          supervisor_name || approver_name,
          approver_note,
        )
        refundProcessed = true
      }
    }

    let invalidationCount = 0
    if (app && app.institution_id) {
      const activeSchedules = db
        .prepare(
          `SELECT COUNT(*) as cnt FROM schedule WHERE application_id = ? AND institution_id = ? AND status != 'completed' AND status != 'expired'`,
        )
        .get(withdrawal.application_id, app.institution_id) as { cnt: number }
      invalidationCount = activeSchedules.cnt

      if (invalidationCount > 0) {
        db.prepare(
          'UPDATE institution SET current_load = CASE WHEN current_load >= ? THEN current_load - ? ELSE 0 END WHERE id = ?',
        ).run(invalidationCount, invalidationCount, app.institution_id)
      }
    }

    db.prepare(
      'UPDATE withdrawal_request SET status = ?, approver_note = ?, schedule_expired = ?, supervisor_approved = ?, supervisor_name = ?, supervisor_approved_at = datetime(\'now\'), refund_processed = ?, schedule_invalidated = ? WHERE id = ?',
    ).run(
      'approved',
      approver_note || null,
      invalidationCount > 0 ? 1 : 0,
      1,
      supervisor_name || approver_name,
      refundProcessed ? 1 : 0,
      pendingSchedules.length > 0 ? 1 : 0,
      req.params.id,
    )

    addStatusChangeLog(
      db,
      withdrawal.application_id,
      oldStatus,
      'withdrawn',
      approver_name,
      'supervisor',
      `撤回申请已批准${approver_note ? `：${approver_note}` : ''}，已生成${pendingSchedules.length}条排期失效记录，释放机构容量${invalidationCount}${refundProcessed ? `，退款¥${refundAmount}已处理` : ''}，所有期限已终止`,
    )

    addAuditLog(
      db,
      withdrawal.application_id,
      'withdraw_approve',
      approver_name,
      'supervisor',
      `撤回已批准${approver_note ? ': ' + approver_note : ''}，排期失效${pendingSchedules.length}条，容量释放${invalidationCount}${refundProcessed ? `，退款¥${refundAmount}` : ''}`,
    )
  })

  transaction()

  const updated = db.prepare('SELECT * FROM withdrawal_request WHERE id = ?').get(req.params.id)
  res.json({ success: true, data: updated })
})

export default router
