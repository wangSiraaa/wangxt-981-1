import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import {
  getDb,
  addBusinessDays,
  addAuditLog,
  calculateLegalDeadlines,
  adjustDeadline,
  adjustAllActiveDeadlines,
  addStatusChangeLog,
  createMaterialTransfer,
} from '../database.js'

const router = Router()

router.post('/', (req: Request, res: Response): void => {
  const { case_no, applicant_name, applicant_phone, appraisal_type, institution_id, material_names } = req.body
  if (!case_no || !applicant_name || !applicant_phone || !appraisal_type) {
    res.status(400).json({ success: false, error: '缺少必填字段', code: 'MISSING_FIELDS' })
    return
  }

  const db = getDb()
  const existing = db.prepare('SELECT id FROM application WHERE case_no = ?').get(case_no)
  if (existing) {
    res.status(409).json({ success: false, error: '案件编号已存在', code: 'DUPLICATE_CASE_NO' })
    return
  }

  const id = uuidv4()

  const transaction = db.transaction(() => {
    db.prepare(
      `INSERT INTO application (id, case_no, applicant_name, applicant_phone, appraisal_type, status, institution_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, case_no, applicant_name, applicant_phone, appraisal_type, 'submitted', institution_id || null)

    const names: string[] = Array.isArray(material_names) ? material_names : []
    for (const name of names) {
      if (typeof name === 'string' && name.trim()) {
        db.prepare(
          `INSERT INTO material (id, application_id, name, version, status, file_url) VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(uuidv4(), id, name.trim(), 1, 'pending', '')
      }
    }

    addAuditLog(db, id, 'create', applicant_name, 'applicant', '提交司法鉴定申请')
  })

  transaction()

  const app = db.prepare('SELECT * FROM application WHERE id = ?').get(id)
  res.status(201).json({ success: true, data: app })
})

router.get('/', (req: Request, res: Response): void => {
  const db = getDb()
  const { status, role } = req.query

  let sql = 'SELECT * FROM application WHERE 1=1'
  const params: unknown[] = []

  if (status) {
    sql += ' AND status = ?'
    params.push(status)
  }

  sql += ' ORDER BY created_at DESC'

  const apps = db.prepare(sql).all(...params)
  res.json({ success: true, data: apps })
})

router.get('/:id', (req: Request, res: Response): void => {
  const db = getDb()
  const app = db.prepare('SELECT * FROM application WHERE id = ?').get(req.params.id)
  if (!app) {
    res.status(404).json({ success: false, error: '申请不存在', code: 'NOT_FOUND' })
    return
  }

  const materials = db.prepare('SELECT * FROM material WHERE application_id = ?').all(req.params.id)
  const schedules = db.prepare('SELECT * FROM schedule WHERE application_id = ?').all(req.params.id)
  const fees = db.prepare('SELECT * FROM fee WHERE application_id = ?').all(req.params.id)
  const deadlines = db.prepare('SELECT * FROM deadline WHERE application_id = ?').all(req.params.id)

  res.json({
    success: true,
    data: { ...(app as Record<string, unknown>), materials, schedules, fees, deadlines },
  })
})

router.put('/:id/review', (req: Request, res: Response): void => {
  const { decision, review_note, reviewer_name } = req.body
  if (!decision || !reviewer_name) {
    res.status(400).json({ success: false, error: '缺少审核决定或审核人', code: 'MISSING_FIELDS' })
    return
  }

  const db = getDb()
  const app = db.prepare('SELECT * FROM application WHERE id = ?').get(req.params.id) as any
  if (!app) {
    res.status(404).json({ success: false, error: '申请不存在', code: 'NOT_FOUND' })
    return
  }

  if (app.status !== 'submitted' && app.status !== 'reviewing') {
    res.status(400).json({ success: false, error: '当前状态不可审核', code: 'INVALID_STATUS' })
    return
  }

  const oldStatus = app.status

  if (decision === 'approve') {
    const transaction = db.transaction(() => {
      db.prepare('UPDATE material SET status = ?, review_note = ? WHERE application_id = ? AND status = ?')
        .run('approved', review_note || '审核通过', req.params.id, 'pending')

      db.prepare('UPDATE application SET last_status = ?, status = ?, updated_at = datetime(\'now\') WHERE id = ?')
        .run(oldStatus, 'reviewed', req.params.id)

      const pendingMaterials = db.prepare(
        `SELECT * FROM material WHERE application_id = ? AND status = 'pending'`,
      ).all(req.params.id) as any[]
      for (const mat of pendingMaterials) {
        createMaterialTransfer(
          db,
          mat.id,
          req.params.id,
          'applicant_to_review',
          app.applicant_name,
          'applicant',
          reviewer_name,
          'reviewer',
          true,
          false,
          false,
          '材料提交审核',
        )
      }

      addStatusChangeLog(
        db,
        req.params.id,
        oldStatus,
        'reviewed',
        reviewer_name,
        'reviewer',
        '材料审核通过，待受理',
      )

      addAuditLog(db, req.params.id, 'review_approve', reviewer_name, 'reviewer', '材料审核通过')
    })
    transaction()
  } else if (decision === 'reject') {
    const newCount = app.correction_count + 1

    if (newCount > app.max_corrections) {
      const transaction = db.transaction(() => {
        db.prepare('UPDATE application SET last_status = ?, status = ?, updated_at = datetime(\'now\') WHERE id = ?')
          .run(oldStatus, 'terminated', req.params.id)

        addStatusChangeLog(
          db,
          req.params.id,
          oldStatus,
          'terminated',
          reviewer_name,
          'reviewer',
          `补正次数超过上限(${app.max_corrections})次，申请终止`,
        )

        addAuditLog(db, req.params.id, 'terminate', reviewer_name, 'reviewer', `补正次数超过上限(${app.max_corrections})，申请终止`)
      })
      transaction()
      res.json({ success: true, data: { ...app, status: 'terminated', correction_count: newCount } })
      return
    }

    const transaction = db.transaction(() => {
      db.prepare('UPDATE material SET status = ?, review_note = ? WHERE application_id = ? AND status = ?')
        .run('rejected', review_note || '请补正', req.params.id, 'pending')

      db.prepare('UPDATE application SET last_status = ?, status = ?, correction_count = ?, updated_at = datetime(\'now\') WHERE id = ?')
        .run(oldStatus, 'correction_needed', newCount, req.params.id)

      adjustAllActiveDeadlines(
        db,
        req.params.id,
        'supplement',
        5,
        `材料补正(第${newCount}次)，所有期限顺延5个工作日`,
        reviewer_name,
        'reviewer',
        false,
      )

      addStatusChangeLog(
        db,
        req.params.id,
        oldStatus,
        'correction_needed',
        reviewer_name,
        'reviewer',
        `材料审核不通过，需补正(第${newCount}次)，期限顺延5个工作日`,
      )

      addAuditLog(db, req.params.id, 'review_reject', reviewer_name, 'reviewer', `材料审核不通过，需补正(第${newCount}次)`)
    })
    transaction()
  } else {
    res.status(400).json({ success: false, error: '无效的审核决定', code: 'INVALID_DECISION' })
    return
  }

  const updated = db.prepare('SELECT * FROM application WHERE id = ?').get(req.params.id)
  res.json({ success: true, data: updated })
})

router.put('/:id/accept', (req: Request, res: Response): void => {
  const { institution_id, acceptor_name } = req.body
  if (!institution_id || !acceptor_name) {
    res.status(400).json({ success: false, error: '缺少受理机构或受理人', code: 'MISSING_FIELDS' })
    return
  }

  const db = getDb()
  const app = db.prepare('SELECT * FROM application WHERE id = ?').get(req.params.id) as any
  if (!app) {
    res.status(404).json({ success: false, error: '申请不存在', code: 'NOT_FOUND' })
    return
  }

  const materials = db.prepare('SELECT * FROM material WHERE application_id = ?').all(req.params.id) as any[]
  const allApproved = materials.length > 0 && materials.every((m) => m.status === 'approved')
  if (!allApproved) {
    res.status(400).json({ success: false, error: '存在未通过审核的材料，无法受理', code: 'MATERIAL_INCOMPLETE' })
    return
  }

  if (app.status !== 'reviewed') {
    res.status(400).json({ success: false, error: '当前状态不可受理', code: 'INVALID_STATUS' })
    return
  }

  const inst = db.prepare('SELECT * FROM institution WHERE id = ?').get(institution_id) as any
  if (inst && inst.current_load >= inst.max_capacity) {
    res.status(409).json({ success: false, error: '机构已达最大容量', code: 'CAPACITY_EXCEEDED' })
    return
  }

  const now = new Date().toISOString().slice(0, 10)
  const oldStatus = app.status

  const transaction = db.transaction(() => {
    db.prepare('UPDATE application SET last_status = ?, status = ?, institution_id = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(oldStatus, 'fee_pending', institution_id, req.params.id)

    if (inst) {
      db.prepare('UPDATE institution SET current_load = current_load + 1 WHERE id = ?').run(institution_id)
    }

    calculateLegalDeadlines(db, req.params.id, now)

    const baseFee = { '法医临床鉴定': 3000, '文书物证鉴定': 2000, '痕迹物证鉴定': 2500, '声像资料鉴定': 2500 }[app.appraisal_type] || 2000
    db.prepare('INSERT INTO fee (id, application_id, amount, status) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), req.params.id, baseFee, 'unpaid')

    const approvedMaterials = db.prepare(
      `SELECT * FROM material WHERE application_id = ? AND status = 'approved'`,
    ).all(req.params.id) as any[]
    for (const mat of approvedMaterials) {
      createMaterialTransfer(
        db,
        mat.id,
        req.params.id,
        'review_to_institution',
        acceptor_name,
        'admin',
        `${inst?.name || '鉴定机构'}`,
        'institution',
        true,
        true,
        true,
        '受理后材料密封移交鉴定机构',
      )
    }

    addStatusChangeLog(
      db,
      req.params.id,
      oldStatus,
      'fee_pending',
      acceptor_name,
      'admin',
      `窗口受理，分配至${inst?.name || '鉴定机构'}`,
    )

    addAuditLog(db, req.params.id, 'accept', acceptor_name, 'admin', '受理案件')
  })

  transaction()

  const updated = db.prepare('SELECT * FROM application WHERE id = ?').get(req.params.id)
  res.json({ success: true, data: updated })
})

export default router
