import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDb, addAuditLog } from '../database.js'

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
  const { payer_name } = req.body
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

  db.prepare('UPDATE fee SET status = ?, paid_at = datetime(\'now\'), invoice_no = ? WHERE id = ?')
    .run('paid', invoiceNo, fee.id)

  const app = db.prepare('SELECT * FROM application WHERE id = ?').get(fee.application_id) as any
  if (app && app.status === 'fee_pending') {
    db.prepare('UPDATE application SET status = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run('accepted', fee.application_id)
  }

  addAuditLog(db, fee.application_id, 'fee_pay', payer_name, 'applicant', `缴纳鉴定费用: ¥${fee.amount}`)

  const updated = db.prepare('SELECT * FROM fee WHERE id = ?').get(fee.id)
  res.json({ success: true, data: updated })
})

router.post('/fees/:appId/refund', (req: Request, res: Response): void => {
  const { refund_reason, approver_name } = req.body
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

  db.prepare('UPDATE fee SET status = ?, refund_amount = ?, refund_reason = ? WHERE id = ?')
    .run('refunded', fee.amount, refund_reason, fee.id)

  addAuditLog(db, req.params.appId, 'fee_refund', approver_name, 'admin', `退还鉴定费用: ¥${fee.amount}，原因: ${refund_reason}`)

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

export default router
