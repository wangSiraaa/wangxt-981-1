import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import {
  getDb,
  addAuditLog,
  addFeeTransaction,
  addStatusChangeLog,
} from '../database.js'

const router = Router()

router.get('/fees', (req: Request, res: Response): void => {
  const db = getDb()
  const { status, application_id } = req.query

  let sql = `SELECT f.*, a.case_no, a.applicant_name, a.appraisal_type
    FROM fee f
    JOIN application a ON f.application_id = a.id
    WHERE 1=1`
  const params: unknown[] = []

  if (status) {
    sql += ' AND f.status = ?'
    params.push(status)
  }
  if (application_id) {
    sql += ' AND f.application_id = ?'
    params.push(application_id)
  }

  sql += ' ORDER BY f.created_at DESC'

  const fees = db.prepare(sql).all(...params)
  res.json({ success: true, data: fees })
})

router.post('/fees/:appId/pay', (req: Request, res: Response): void => {
  const { payer_name, payment_method, transaction_no, remark } = req.body
  if (!payer_name) {
    res.status(400).json({ success: false, error: '缺少缴费人', code: 'MISSING_FIELDS' })
    return
  }

  const db = getDb()
  const fee = db.prepare('SELECT * FROM fee WHERE application_id = ?').get(req.params.appId) as any
  if (!fee) {
    res.status(404).json({ success: false, error: '费用记录不存在', code: 'NOT_FOUND' })
    return
  }

  if (fee.status === 'paid') {
    res.status(400).json({ success: false, error: '费用已缴纳', code: 'ALREADY_PAID' })
    return
  }

  if (fee.status === 'refunded') {
    res.status(400).json({ success: false, error: '费用已退还，不可重复缴纳', code: 'ALREADY_REFUNDED' })
    return
  }

  const invoiceNo = `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`
  const oldStatus = fee.status

  const transaction = db.transaction(() => {
    db.prepare('UPDATE fee SET status = ?, paid_at = datetime(\'now\'), invoice_no = ? WHERE id = ?')
      .run('paid', invoiceNo, fee.id)

    addFeeTransaction(
      db,
      fee.id,
      fee.application_id,
      'pay',
      fee.amount,
      payer_name,
      'applicant',
      payment_method || 'online',
      transaction_no || uuidv4(),
      remark || '在线缴纳鉴定费用',
      false,
    )

    const app = db.prepare('SELECT * FROM application WHERE id = ?').get(fee.application_id) as any
    if (app && app.status === 'fee_pending') {
      const oldAppStatus = app.status
      db.prepare('UPDATE application SET last_status = ?, status = ?, updated_at = datetime(\'now\') WHERE id = ?')
        .run(oldAppStatus, 'accepted', fee.application_id)

      addStatusChangeLog(
        db,
        fee.application_id,
        oldAppStatus,
        'accepted',
        payer_name,
        'applicant',
        `费用缴纳完成，金额¥${fee.amount}，进入排期阶段`,
      )
    }

    addAuditLog(db, fee.application_id, 'fee_pay', payer_name, 'applicant', `缴纳鉴定费用: ¥${fee.amount}`)
  })

  transaction()

  const updated = db.prepare('SELECT * FROM fee WHERE id = ?').get(fee.id)
  res.json({ success: true, data: updated })
})

router.post('/fees/:appId/refund', (req: Request, res: Response): void => {
  const { refund_reason, approver_name, refund_amount, supervisor_approval, supervisor_name, supervisor_note, payment_method, transaction_no } = req.body
  if (!refund_reason || !approver_name) {
    res.status(400).json({ success: false, error: '缺少退款原因或审批人', code: 'MISSING_FIELDS' })
    return
  }

  const db = getDb()
  const fee = db.prepare('SELECT * FROM fee WHERE application_id = ?').get(req.params.appId) as any
  if (!fee) {
    res.status(404).json({ success: false, error: '费用记录不存在', code: 'NOT_FOUND' })
    return
  }

  if (fee.status !== 'paid') {
    res.status(400).json({ success: false, error: '费用未缴纳，无法退款', code: 'NOT_PAID' })
    return
  }

  const actualRefundAmount = refund_amount || fee.amount
  if (actualRefundAmount > fee.amount) {
    res.status(400).json({ success: false, error: '退款金额不能超过已缴金额', code: 'REFUND_EXCEEDED' })
    return
  }

  const oldStatus = fee.status

  const transaction = db.transaction(() => {
    db.prepare(
      'UPDATE fee SET status = ?, refund_status = ?, refund_amount = ?, refund_reason = ?, refund_approved = ?, refund_approver = ?, refund_approved_at = datetime(\'now\'), refund_approval_note = ? WHERE id = ?',
    ).run(
      'refunded',
      'completed',
      actualRefundAmount,
      refund_reason,
      supervisor_approval ? 1 : 0,
      supervisor_name || approver_name,
      supervisor_note || refund_reason,
      fee.id,
    )

    addFeeTransaction(
      db,
      fee.id,
      fee.application_id,
      'refund',
      actualRefundAmount,
      approver_name,
      'admin',
      payment_method || 'bank_transfer',
      transaction_no || `REF-${Date.now()}`,
      refund_reason,
      supervisor_approval || false,
      supervisor_name,
      supervisor_note,
    )

    const app = db.prepare('SELECT * FROM application WHERE id = ?').get(fee.application_id) as any
    if (app && app.status !== 'withdrawn' && app.status !== 'completed') {
      addStatusChangeLog(
        db,
        fee.application_id,
        app.status,
        app.status,
        approver_name,
        'admin',
        `费用退款：¥${actualRefundAmount}，原因：${refund_reason}`,
      )
    }

    addAuditLog(db, req.params.appId, 'fee_refund', approver_name, 'admin', `退还鉴定费用: ¥${actualRefundAmount}，原因: ${refund_reason}`)
  })

  transaction()

  const updated = db.prepare('SELECT * FROM fee WHERE id = ?').get(fee.id)
  res.json({ success: true, data: updated })
})

router.get('/fees/:appId/invoice', (req: Request, res: Response): void => {
  const db = getDb()
  const fee = db.prepare('SELECT * FROM fee WHERE application_id = ?').get(req.params.appId) as any
  if (!fee) {
    res.status(404).json({ success: false, error: '费用记录不存在', code: 'NOT_FOUND' })
    return
  }

  if (fee.status !== 'paid') {
    res.status(400).json({ success: false, error: '费用未缴纳，无发票', code: 'NO_INVOICE' })
    return
  }

  const app = db.prepare('SELECT * FROM application WHERE id = ?').get(req.params.appId) as any

  res.json({
    success: true,
    data: {
      invoice_no: fee.invoice_no,
      applicant_name: app?.applicant_name,
      amount: fee.amount,
      paid_at: fee.paid_at,
      appraisal_type: app?.appraisal_type,
      case_no: app?.case_no,
    },
  })
})

router.get('/fees/:appId/transactions', (req: Request, res: Response): void => {
  const db = getDb()
  const { status, transaction_type } = req.query

  let sql = `SELECT ft.*, a.case_no, a.applicant_name, a.appraisal_type
    FROM fee_transaction ft
    JOIN application a ON ft.application_id = a.id
    WHERE ft.application_id = ?`
  const params: unknown[] = [req.params.appId]

  if (status) {
    sql += ' AND ft.status = ?'
    params.push(status)
  }
  if (transaction_type) {
    sql += ' AND ft.transaction_type = ?'
    params.push(transaction_type)
  }

  sql += ' ORDER BY ft.created_at DESC'

  const transactions = db.prepare(sql).all(...params)
  res.json({ success: true, data: transactions })
})

router.get('/fee-transactions', (req: Request, res: Response): void => {
  const db = getDb()
  const { status, transaction_type, application_id } = req.query

  let sql = `SELECT ft.*, a.case_no, a.applicant_name, a.appraisal_type
    FROM fee_transaction ft
    JOIN application a ON ft.application_id = a.id
    WHERE 1=1`
  const params: unknown[] = []

  if (status) {
    sql += ' AND ft.status = ?'
    params.push(status)
  }
  if (transaction_type) {
    sql += ' AND ft.transaction_type = ?'
    params.push(transaction_type)
  }
  if (application_id) {
    sql += ' AND ft.application_id = ?'
    params.push(application_id)
  }

  sql += ' ORDER BY ft.created_at DESC'

  const transactions = db.prepare(sql).all(...params)
  res.json({ success: true, data: transactions })
})

export default router
