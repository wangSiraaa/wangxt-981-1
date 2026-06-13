import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDb, addAuditLog } from '../database.js'

const router = Router()

router.post('/:id/materials', (req: Request, res: Response): void => {
  const { materials, uploader_name } = req.body
  if (!materials || !Array.isArray(materials) || materials.length === 0 || !uploader_name) {
    res.status(400).json({ success: false, error: '缺少必填字段', code: 'MISSING_FIELDS' })
    return
  }

  const db = getDb()
  const app = db.prepare('SELECT * FROM application WHERE id = ?').get(req.params.id) as any
  if (!app) {
    res.status(404).json({ success: false, error: '申请不存在', code: 'NOT_FOUND' })
    return
  }

  if (app.status !== 'submitted' && app.status !== 'correction_needed' && app.status !== 'reviewing') {
    res.status(400).json({ success: false, error: '当前状态不可上传材料', code: 'INVALID_STATUS' })
    return
  }

  const insertedMaterials: any[] = []

  const transaction = db.transaction(() => {
    for (const mat of materials) {
      const { name, file_url } = mat
      if (!name || !file_url) continue

      const existing = db.prepare('SELECT * FROM material WHERE application_id = ? AND name = ? ORDER BY version DESC LIMIT 1')
        .get(req.params.id, name) as any

      let version = 1
      if (existing) {
        version = existing.version + 1
      }

      const id = uuidv4()
      db.prepare(
        `INSERT INTO material (id, application_id, name, version, status, file_url) VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(id, req.params.id, name, version, 'pending', file_url)

      const material = db.prepare('SELECT * FROM material WHERE id = ?').get(id)
      insertedMaterials.push(material)

      addAuditLog(db, req.params.id, 'material_upload', uploader_name, 'applicant', `上传材料: ${name} v${version}`)
    }

    if (app.status === 'correction_needed') {
      db.prepare('UPDATE application SET status = ?, updated_at = datetime(\'now\') WHERE id = ?')
        .run('reviewing', req.params.id)
    }
  })

  transaction()

  res.status(201).json({ success: true, data: insertedMaterials })
})

router.put('/materials/:id/sign', (req: Request, res: Response): void => {
  const { signer_name } = req.body
  if (!signer_name) {
    res.status(400).json({ success: false, error: '缺少签名人', code: 'MISSING_FIELDS' })
    return
  }

  const db = getDb()
  const material = db.prepare('SELECT * FROM material WHERE id = ?').get(req.params.id) as any
  if (!material) {
    res.status(404).json({ success: false, error: '材料不存在', code: 'NOT_FOUND' })
    return
  }

  if (material.sign_off_status === 'signed') {
    res.status(400).json({ success: false, error: '材料已签署', code: 'ALREADY_SIGNED' })
    return
  }

  db.prepare('UPDATE material SET sign_off_status = ?, sign_off_at = datetime(\'now\') WHERE id = ?')
    .run('signed', req.params.id)

  addAuditLog(db, material.application_id, 'material_sign', signer_name, 'reviewer', `材料签署: ${material.name}`)

  const updated = db.prepare('SELECT * FROM material WHERE id = ?').get(req.params.id)
  res.json({ success: true, data: updated })
})

router.put('/materials/:id/seal', (req: Request, res: Response): void => {
  const { sealer_name } = req.body
  if (!sealer_name) {
    res.status(400).json({ success: false, error: '缺少盖章人', code: 'MISSING_FIELDS' })
    return
  }

  const db = getDb()
  const material = db.prepare('SELECT * FROM material WHERE id = ?').get(req.params.id) as any
  if (!material) {
    res.status(404).json({ success: false, error: '材料不存在', code: 'NOT_FOUND' })
    return
  }

  if (material.sealed) {
    res.status(400).json({ success: false, error: '材料已盖章', code: 'ALREADY_SEALED' })
    return
  }

  if (material.sign_off_status !== 'signed') {
    res.status(400).json({ success: false, error: '材料尚未签署，无法盖章', code: 'NOT_SIGNED' })
    return
  }

  db.prepare('UPDATE material SET sealed = 1 WHERE id = ?').run(req.params.id)

  addAuditLog(db, material.application_id, 'material_seal', sealer_name, 'admin', `材料盖章: ${material.name}`)

  const updated = db.prepare('SELECT * FROM material WHERE id = ?').get(req.params.id)
  res.json({ success: true, data: updated })
})

export default router
