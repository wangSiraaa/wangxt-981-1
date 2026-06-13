import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDb, addAuditLog } from '../database.js'

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
  const { approver_name, approver_note } = req.body
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
    db.prepare('UPDATE withdrawal_request SET status = ?, approver_note = ?, schedule_expired = ? WHERE id = ?')
      .run('approved', approver_note || null, 1, req.params.id)

    db.prepare('UPDATE application SET status = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run('withdrawn', withdrawal.application_id)

    db.prepare('UPDATE schedule SET status = \'expired\' WHERE application_id = ? AND status != \'completed\'')
      .run(withdrawal.application_id)

    db.prepare('UPDATE deadline SET status = \'expired\' WHERE application_id = ? AND status = \'active\'')
      .run(withdrawal.application_id)

    if (withdrawal.refund_required) {
      const fee = db.prepare('SELECT * FROM fee WHERE application_id = ?').get(withdrawal.application_id) as any
      if (fee && fee.status === 'paid') {
        db.prepare('UPDATE fee SET status = ?, refund_amount = ?, refund_reason = ? WHERE id = ?')
          .run('refunded', fee.amount, '委托人撤回申请，全额退款', fee.id)
      }
    }

    if (app && app.institution_id) {
      db.prepare('UPDATE institution SET current_load = CASE WHEN current_load > 0 THEN current_load - 1 ELSE 0 END WHERE id = ?')
        .run(app.institution_id)
    }

    addAuditLog(db, withdrawal.application_id, 'withdraw_approve', approver_name, 'admin', `撤回已批准${approver_note ? ': ' + approver_note : ''}`)
  })

  transaction()

  const updated = db.prepare('SELECT * FROM withdrawal_request WHERE id = ?').get(req.params.id)
  res.json({ success: true, data: updated })
})

export default router
