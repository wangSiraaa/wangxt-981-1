import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DB_PATH = path.join(__dirname, 'judicial.db')

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
  }
  return db
}

export function initDatabase(): void {
  const db = getDb()

  db.exec(`
    CREATE TABLE IF NOT EXISTS institution (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      max_capacity INTEGER NOT NULL DEFAULT 10,
      current_load INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expert (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      qualification TEXT NOT NULL,
      institution_id TEXT NOT NULL REFERENCES institution(id),
      conflict_case_nos TEXT DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS application (
      id TEXT PRIMARY KEY,
      case_no TEXT NOT NULL UNIQUE,
      applicant_name TEXT NOT NULL,
      applicant_phone TEXT NOT NULL,
      appraisal_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      correction_count INTEGER NOT NULL DEFAULT 0,
      max_corrections INTEGER NOT NULL DEFAULT 3,
      institution_id TEXT REFERENCES institution(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS material (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL REFERENCES application(id),
      name TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'pending',
      file_url TEXT,
      uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
      review_note TEXT,
      sealed INTEGER NOT NULL DEFAULT 0,
      sign_off_status TEXT NOT NULL DEFAULT 'unsigned',
      sign_off_at TEXT
    );

    CREATE TABLE IF NOT EXISTS schedule (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL REFERENCES application(id),
      expert_id TEXT NOT NULL REFERENCES expert(id),
      institution_id TEXT NOT NULL REFERENCES institution(id),
      scheduled_date TEXT NOT NULL,
      scheduled_time TEXT NOT NULL,
      location TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      is_urgent INTEGER NOT NULL DEFAULT 0,
      urgent_reason TEXT,
      reschedule_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fee (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL REFERENCES application(id),
      amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'unpaid',
      paid_at TEXT,
      refund_amount REAL DEFAULT 0,
      refund_reason TEXT,
      invoice_no TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS deadline (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL REFERENCES application(id),
      type TEXT NOT NULL,
      base_date TEXT NOT NULL,
      deadline_date TEXT NOT NULL,
      holiday_extended INTEGER NOT NULL DEFAULT 0,
      extended_days INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS withdrawal_request (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL REFERENCES application(id),
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      approver_note TEXT,
      refund_required INTEGER NOT NULL DEFAULT 0,
      schedule_expired INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL REFERENCES application(id),
      action TEXT NOT NULL,
      actor TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      detail TEXT NOT NULL,
      immutable INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expert_conflict (
      id TEXT PRIMARY KEY,
      expert_id TEXT NOT NULL REFERENCES expert(id),
      case_no TEXT NOT NULL,
      conflict_type TEXT NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS holiday (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fee_transaction (
      id TEXT PRIMARY KEY,
      fee_id TEXT NOT NULL REFERENCES fee(id),
      application_id TEXT NOT NULL REFERENCES application(id),
      transaction_type TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT,
      transaction_no TEXT,
      status TEXT NOT NULL DEFAULT 'completed',
      operator_name TEXT NOT NULL,
      operator_role TEXT NOT NULL,
      remark TEXT,
      supervisor_approval INTEGER NOT NULL DEFAULT 0,
      supervisor_name TEXT,
      supervisor_approval_note TEXT,
      supervisor_approved_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS schedule_invalidation (
      id TEXT PRIMARY KEY,
      schedule_id TEXT NOT NULL REFERENCES schedule(id),
      application_id TEXT NOT NULL REFERENCES application(id),
      invalidation_type TEXT NOT NULL,
      reason TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      operator_role TEXT NOT NULL,
      supervisor_approval INTEGER NOT NULL DEFAULT 0,
      supervisor_name TEXT,
      supervisor_approval_note TEXT,
      supervisor_approved_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS material_transfer (
      id TEXT PRIMARY KEY,
      material_id TEXT NOT NULL REFERENCES material(id),
      application_id TEXT NOT NULL REFERENCES application(id),
      transfer_type TEXT NOT NULL,
      from_party TEXT NOT NULL,
      from_party_role TEXT NOT NULL,
      to_party TEXT NOT NULL,
      to_party_role TEXT NOT NULL,
      sealed INTEGER NOT NULL DEFAULT 0,
      seal_time TEXT,
      seal_operator TEXT,
      electronic_sign INTEGER NOT NULL DEFAULT 0,
      sign_time TEXT,
      sign_operator TEXT,
      placeholder_status TEXT NOT NULL DEFAULT 'pending',
      transfer_status TEXT NOT NULL DEFAULT 'in_transit',
      received_at TEXT,
      remark TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS deadline_adjustment (
      id TEXT PRIMARY KEY,
      deadline_id TEXT NOT NULL REFERENCES deadline(id),
      application_id TEXT NOT NULL REFERENCES application(id),
      adjustment_type TEXT NOT NULL,
      original_deadline TEXT NOT NULL,
      new_deadline TEXT NOT NULL,
      extended_days INTEGER NOT NULL DEFAULT 0,
      reason TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      operator_role TEXT NOT NULL,
      supervisor_approval INTEGER NOT NULL DEFAULT 0,
      supervisor_name TEXT,
      supervisor_approval_note TEXT,
      supervisor_approved_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expert_qualification (
      id TEXT PRIMARY KEY,
      expert_id TEXT NOT NULL REFERENCES expert(id),
      qualification_type TEXT NOT NULL,
      qualification_code TEXT,
      valid_from TEXT NOT NULL,
      valid_to TEXT,
      issuing_authority TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS status_change_log (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL REFERENCES application(id),
      old_status TEXT,
      new_status TEXT,
      actor TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  try { db.prepare('ALTER TABLE schedule ADD COLUMN urgent_approved INTEGER NOT NULL DEFAULT 0').run() } catch (_e) { /* ignore */ }
  try { db.prepare('ALTER TABLE schedule ADD COLUMN urgent_approver TEXT').run() } catch (_e) { /* ignore */ }
  try { db.prepare('ALTER TABLE schedule ADD COLUMN urgent_approve_note TEXT').run() } catch (_e) { /* ignore */ }
  try { db.prepare('ALTER TABLE schedule ADD COLUMN urgent_approved_at TEXT').run() } catch (_e) { /* ignore */ }

  try { db.prepare('ALTER TABLE application ADD COLUMN is_urgent INTEGER NOT NULL DEFAULT 0').run() } catch (_e) { /* ignore */ }
  try { db.prepare('ALTER TABLE application ADD COLUMN urgent_reason TEXT').run() } catch (_e) { /* ignore */ }
  try { db.prepare('ALTER TABLE application ADD COLUMN urgent_approved INTEGER NOT NULL DEFAULT 0').run() } catch (_e) { /* ignore */ }
  try { db.prepare('ALTER TABLE application ADD COLUMN urgent_approver TEXT').run() } catch (_e) { /* ignore */ }
  try { db.prepare('ALTER TABLE application ADD COLUMN urgent_approved_at TEXT').run() } catch (_e) { /* ignore */ }
  try { db.prepare('ALTER TABLE application ADD COLUMN reschedule_count INTEGER NOT NULL DEFAULT 0').run() } catch (_e) { /* ignore */ }
  try { db.prepare('ALTER TABLE application ADD COLUMN last_status TEXT').run() } catch (_e) { /* ignore */ }

  try { db.prepare('ALTER TABLE deadline ADD COLUMN original_deadline TEXT').run() } catch (_e) { /* ignore */ }
  try { db.prepare('ALTER TABLE deadline ADD COLUMN adjustment_reason TEXT').run() } catch (_e) { /* ignore */ }
  try { db.prepare('ALTER TABLE deadline ADD COLUMN affected_by TEXT').run() } catch (_e) { /* ignore */ }

  try { db.prepare('ALTER TABLE fee ADD COLUMN refund_status TEXT').run() } catch (_e) { /* ignore */ }
  try { db.prepare('ALTER TABLE fee ADD COLUMN refund_approved INTEGER NOT NULL DEFAULT 0').run() } catch (_e) { /* ignore */ }
  try { db.prepare('ALTER TABLE fee ADD COLUMN refund_approver TEXT').run() } catch (_e) { /* ignore */ }
  try { db.prepare('ALTER TABLE fee ADD COLUMN refund_approved_at TEXT').run() } catch (_e) { /* ignore */ }
  try { db.prepare('ALTER TABLE fee ADD COLUMN refund_approval_note TEXT').run() } catch (_e) { /* ignore */ }

  try { db.prepare('ALTER TABLE expert ADD COLUMN qualification_valid INTEGER NOT NULL DEFAULT 1').run() } catch (_e) { /* ignore */ }
  try { db.prepare('ALTER TABLE expert ADD COLUMN status TEXT NOT NULL DEFAULT \'active\'').run() } catch (_e) { /* ignore */ }

  try { db.prepare('ALTER TABLE material ADD COLUMN transfer_id TEXT').run() } catch (_e) { /* ignore */ }
  try { db.prepare('ALTER TABLE material ADD COLUMN placeholder INTEGER NOT NULL DEFAULT 0').run() } catch (_e) { /* ignore */ }
  try { db.prepare('ALTER TABLE material ADD COLUMN placeholder_time TEXT').run() } catch (_e) { /* ignore */ }
  try { db.prepare('ALTER TABLE material ADD COLUMN placeholder_operator TEXT').run() } catch (_e) { /* ignore */ }

  try { db.prepare('ALTER TABLE withdrawal_request ADD COLUMN supervisor_approved INTEGER NOT NULL DEFAULT 0').run() } catch (_e) { /* ignore */ }
  try { db.prepare('ALTER TABLE withdrawal_request ADD COLUMN supervisor_name TEXT').run() } catch (_e) { /* ignore */ }
  try { db.prepare('ALTER TABLE withdrawal_request ADD COLUMN supervisor_approved_at TEXT').run() } catch (_e) { /* ignore */ }
  try { db.prepare('ALTER TABLE withdrawal_request ADD COLUMN refund_processed INTEGER NOT NULL DEFAULT 0').run() } catch (_e) { /* ignore */ }
  try { db.prepare('ALTER TABLE withdrawal_request ADD COLUMN schedule_invalidated INTEGER NOT NULL DEFAULT 0').run() } catch (_e) { /* ignore */ }

  seedData(db)
}

function seedData(db: Database.Database): void {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM institution').get() as { cnt: number }
  if (count.cnt > 0) return

  const insert = db.transaction(() => {
    const inst1Id = uuidv4()
    const inst2Id = uuidv4()

    db.prepare(`INSERT INTO institution (id, name, max_capacity, current_load) VALUES (?, ?, ?, ?)`)
      .run(inst1Id, '公正司法鉴定中心', 5, 2)
    db.prepare(`INSERT INTO institution (id, name, max_capacity, current_load) VALUES (?, ?, ?, ?)`)
      .run(inst2Id, '明鉴司法鉴定所', 3, 1)

    const exp1Id = uuidv4()
    const exp2Id = uuidv4()
    const exp3Id = uuidv4()
    const exp4Id = uuidv4()

    db.prepare(`INSERT INTO expert (id, name, qualification, institution_id, conflict_case_nos) VALUES (?, ?, ?, ?, ?)`)
      .run(exp1Id, '张法医', '法医临床鉴定', inst1Id, '[]')
    db.prepare(`INSERT INTO expert (id, name, qualification, institution_id, conflict_case_nos) VALUES (?, ?, ?, ?, ?)`)
      .run(exp2Id, '李痕检', '痕迹物证鉴定', inst1Id, JSON.stringify(['CASE-2026-001']))
    db.prepare(`INSERT INTO expert (id, name, qualification, institution_id, conflict_case_nos) VALUES (?, ?, ?, ?, ?)`)
      .run(exp3Id, '王文书', '文书物证鉴定', inst2Id, '[]')
    db.prepare(`INSERT INTO expert (id, name, qualification, institution_id, conflict_case_nos) VALUES (?, ?, ?, ?, ?)`)
      .run(exp4Id, '赵声像', '声像资料鉴定', inst2Id, '[]')

    db.prepare(`INSERT INTO expert_conflict (id, expert_id, case_no, conflict_type, description) VALUES (?, ?, ?, ?, ?)`)
      .run(uuidv4(), exp2Id, 'CASE-2026-001', '利益冲突', '专家与案件当事人存在亲属关系')

    const holidays = [
      { id: uuidv4(), date: '2026-01-01', name: '元旦' },
      { id: uuidv4(), date: '2026-01-29', name: '春节' },
      { id: uuidv4(), date: '2026-01-30', name: '春节' },
      { id: uuidv4(), date: '2026-05-01', name: '劳动节' },
      { id: uuidv4(), date: '2026-10-01', name: '国庆节' },
    ]
    const insertHoliday = db.prepare(`INSERT INTO holiday (id, date, name) VALUES (?, ?, ?)`)
    for (const h of holidays) {
      insertHoliday.run(h.id, h.date, h.name)
    }

    const app1Id = uuidv4()
    const app2Id = uuidv4()
    const app3Id = uuidv4()
    const app4Id = uuidv4()
    const app5Id = uuidv4()
    const app6Id = uuidv4()

    db.prepare(`INSERT INTO application (id, case_no, applicant_name, applicant_phone, appraisal_type, status, correction_count, max_corrections, institution_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(app1Id, 'CASE-2026-001', '陈先生', '13800138001', '法医临床鉴定', 'submitted', 0, 3, inst1Id)
    db.prepare(`INSERT INTO application (id, case_no, applicant_name, applicant_phone, appraisal_type, status, correction_count, max_corrections, institution_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(app2Id, 'CASE-2026-002', '王女士', '13800138002', '文书物证鉴定', 'correction_needed', 1, 3, inst2Id)
    db.prepare(`INSERT INTO application (id, case_no, applicant_name, applicant_phone, appraisal_type, status, correction_count, max_corrections, institution_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(app3Id, 'CASE-2026-003', '刘先生', '13800138003', '痕迹物证鉴定', 'fee_pending', 0, 3, inst1Id)
    db.prepare(`INSERT INTO application (id, case_no, applicant_name, applicant_phone, appraisal_type, status, correction_count, max_corrections, institution_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(app4Id, 'CASE-2026-004', '赵先生', '13800138004', '声像资料鉴定', 'scheduled', 0, 3, inst2Id)
    db.prepare(`INSERT INTO application (id, case_no, applicant_name, applicant_phone, appraisal_type, status, correction_count, max_corrections, institution_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(app5Id, 'CASE-2026-005', '孙女士', '13800138005', '法医临床鉴定', 'completed', 0, 3, inst1Id)
    db.prepare(`INSERT INTO application (id, case_no, applicant_name, applicant_phone, appraisal_type, status, correction_count, max_corrections, institution_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(app6Id, 'CASE-2026-006', '周先生', '13800138006', '文书物证鉴定', 'withdrawn', 0, 3, inst2Id)

    db.prepare(`INSERT INTO material (id, application_id, name, version, status, file_url, sealed, sign_off_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(uuidv4(), app1Id, '委托书', 1, 'pending', '/uploads/case1/doc1.pdf', 0, 'unsigned')
    db.prepare(`INSERT INTO material (id, application_id, name, version, status, file_url, sealed, sign_off_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(uuidv4(), app1Id, '身份证明', 1, 'pending', '/uploads/case1/doc2.pdf', 0, 'unsigned')

    db.prepare(`INSERT INTO material (id, application_id, name, version, status, file_url, review_note, sealed, sign_off_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(uuidv4(), app2Id, '委托书', 1, 'rejected', '/uploads/case2/doc1.pdf', '签名不清晰，请重新提交', 0, 'unsigned')
    db.prepare(`INSERT INTO material (id, application_id, name, version, status, file_url, sealed, sign_off_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(uuidv4(), app2Id, '身份证明', 1, 'approved', '/uploads/case2/doc2.pdf', 0, 'signed')

    db.prepare(`INSERT INTO material (id, application_id, name, version, status, file_url, sealed, sign_off_status, sign_off_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(uuidv4(), app3Id, '委托书', 1, 'approved', '/uploads/case3/doc1.pdf', 1, 'signed', '2026-06-01T10:00:00')
    db.prepare(`INSERT INTO material (id, application_id, name, version, status, file_url, sealed, sign_off_status, sign_off_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(uuidv4(), app3Id, '身份证明', 1, 'approved', '/uploads/case3/doc2.pdf', 1, 'signed', '2026-06-01T10:05:00')

    db.prepare(`INSERT INTO material (id, application_id, name, version, status, file_url, sealed, sign_off_status, sign_off_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(uuidv4(), app4Id, '委托书', 1, 'approved', '/uploads/case4/doc1.pdf', 1, 'signed', '2026-05-20T09:00:00')
    db.prepare(`INSERT INTO material (id, application_id, name, version, status, file_url, sealed, sign_off_status, sign_off_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(uuidv4(), app4Id, '检材样本', 1, 'approved', '/uploads/case4/doc2.pdf', 1, 'signed', '2026-05-20T09:10:00')

    db.prepare(`INSERT INTO material (id, application_id, name, version, status, file_url, sealed, sign_off_status, sign_off_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(uuidv4(), app5Id, '委托书', 1, 'approved', '/uploads/case5/doc1.pdf', 1, 'signed', '2026-04-01T08:00:00')

    db.prepare(`INSERT INTO schedule (id, application_id, expert_id, institution_id, scheduled_date, scheduled_time, location, status, is_urgent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(uuidv4(), app4Id, exp4Id, inst2Id, '2026-06-15', '09:00', '明鉴司法鉴定所201室', 'pending', 0)
    db.prepare(`INSERT INTO schedule (id, application_id, expert_id, institution_id, scheduled_date, scheduled_time, location, status, is_urgent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(uuidv4(), app5Id, exp1Id, inst1Id, '2026-04-10', '14:00', '公正司法鉴定中心实验室A', 'completed', 0)

    db.prepare(`INSERT INTO fee (id, application_id, amount, status) VALUES (?, ?, ?, ?)`)
      .run(uuidv4(), app3Id, 3000, 'unpaid')
    db.prepare(`INSERT INTO fee (id, application_id, amount, status, paid_at, invoice_no) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(uuidv4(), app4Id, 2500, 'paid', '2026-05-21T10:00:00', 'INV-2026-004')
    db.prepare(`INSERT INTO fee (id, application_id, amount, status) VALUES (?, ?, ?, ?)`)
      .run(uuidv4(), app5Id, 4000, 'paid')
    db.prepare(`INSERT INTO fee (id, application_id, amount, status, refund_amount, refund_reason) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(uuidv4(), app6Id, 2000, 'refunded', 2000, '委托人撤回申请')

    db.prepare(`INSERT INTO deadline (id, application_id, type, base_date, deadline_date, holiday_extended, extended_days, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(uuidv4(), app3Id, 'review', '2026-06-01', '2026-06-06', 0, 0, 'active')
    db.prepare(`INSERT INTO deadline (id, application_id, type, base_date, deadline_date, holiday_extended, extended_days, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(uuidv4(), app3Id, 'schedule', '2026-06-01', '2026-06-11', 0, 0, 'active')
    db.prepare(`INSERT INTO deadline (id, application_id, type, base_date, deadline_date, holiday_extended, extended_days, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(uuidv4(), app3Id, 'appraisal', '2026-06-01', '2026-07-01', 0, 0, 'active')
    db.prepare(`INSERT INTO deadline (id, application_id, type, base_date, deadline_date, holiday_extended, extended_days, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(uuidv4(), app3Id, 'completion', '2026-06-01', '2026-07-31', 0, 0, 'active')

    db.prepare(`INSERT INTO deadline (id, application_id, type, base_date, deadline_date, holiday_extended, extended_days, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(uuidv4(), app4Id, 'review', '2026-05-20', '2026-05-25', 0, 0, 'completed')
    db.prepare(`INSERT INTO deadline (id, application_id, type, base_date, deadline_date, holiday_extended, extended_days, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(uuidv4(), app4Id, 'schedule', '2026-05-20', '2026-05-30', 0, 0, 'completed')
    db.prepare(`INSERT INTO deadline (id, application_id, type, base_date, deadline_date, holiday_extended, extended_days, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(uuidv4(), app4Id, 'appraisal', '2026-05-20', '2026-06-19', 0, 0, 'active')
    db.prepare(`INSERT INTO deadline (id, application_id, type, base_date, deadline_date, holiday_extended, extended_days, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(uuidv4(), app4Id, 'completion', '2026-05-20', '2026-07-19', 0, 0, 'active')

    const insertAudit = db.prepare(`INSERT INTO audit_log (id, application_id, action, actor, actor_role, detail) VALUES (?, ?, ?, ?, ?, ?)`)
    insertAudit.run(uuidv4(), app1Id, 'create', '陈先生', 'applicant', '提交司法鉴定申请')
    insertAudit.run(uuidv4(), app2Id, 'create', '王女士', 'applicant', '提交司法鉴定申请')
    insertAudit.run(uuidv4(), app2Id, 'review', '张审查员', 'reviewer', '材料审核不通过，需补正')
    insertAudit.run(uuidv4(), app3Id, 'create', '刘先生', 'applicant', '提交司法鉴定申请')
    insertAudit.run(uuidv4(), app3Id, 'review', '张审查员', 'reviewer', '材料审核通过')
    insertAudit.run(uuidv4(), app3Id, 'accept', '李主任', 'admin', '受理案件，分配至公正司法鉴定中心')
    insertAudit.run(uuidv4(), app4Id, 'create', '赵先生', 'applicant', '提交司法鉴定申请')
    insertAudit.run(uuidv4(), app4Id, 'accept', '李主任', 'admin', '受理案件，分配至明鉴司法鉴定所')
    insertAudit.run(uuidv4(), app4Id, 'schedule', '赵声像', 'expert', '排程确定：2026-06-15 09:00')
    insertAudit.run(uuidv4(), app5Id, 'create', '孙女士', 'applicant', '提交司法鉴定申请')
    insertAudit.run(uuidv4(), app5Id, 'complete', '张法医', 'expert', '鉴定完成，出具鉴定意见书')
    insertAudit.run(uuidv4(), app6Id, 'create', '周先生', 'applicant', '提交司法鉴定申请')
    insertAudit.run(uuidv4(), app6Id, 'withdraw', '周先生', 'applicant', '申请撤回鉴定')
    insertAudit.run(uuidv4(), app6Id, 'withdraw_approve', '李主任', 'admin', '同意撤回，费用退还')

    db.prepare(`INSERT INTO withdrawal_request (id, application_id, reason, status, approver_note, refund_required, schedule_expired) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(uuidv4(), app6Id, '个人原因无法继续配合鉴定', 'approved', '同意撤回', 1, 1)
  })

  insert()
}

export function isHoliday(db: Database.Database, date: string): boolean {
  const row = db.prepare('SELECT id FROM holiday WHERE date = ?').get(date)
  return !!row
}

export function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr)
  const day = d.getDay()
  return day === 0 || day === 6
}

export function addBusinessDays(db: Database.Database, baseDate: string, days: number): string {
  let current = new Date(baseDate)
  let added = 0
  while (added < days) {
    current.setDate(current.getDate() + 1)
    const dateStr = current.toISOString().slice(0, 10)
    if (!isWeekend(dateStr) && !isHoliday(db, dateStr)) {
      added++
    }
  }
  let resultStr = current.toISOString().slice(0, 10)
  while (isWeekend(resultStr) || isHoliday(db, resultStr)) {
    current.setDate(current.getDate() + 1)
    resultStr = current.toISOString().slice(0, 10)
  }
  return resultStr
}

export function addAuditLog(
  db: Database.Database,
  applicationId: string,
  action: string,
  actor: string,
  actorRole: string,
  detail: string,
): void {
  db.prepare(
    `INSERT INTO audit_log (id, application_id, action, actor, actor_role, detail) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(uuidv4(), applicationId, action, actor, actorRole, detail)
}

export function calculateLegalDeadlines(
  db: Database.Database,
  applicationId: string,
  baseDate: string,
): void {
  const deadlineTypes = [
    { type: 'material_correction', days: 5, description: '材料补正期限' },
    { type: 'fee_payment', days: 7, description: '费用缴纳期限' },
    { type: 'review', days: 5, description: '审核期限' },
    { type: 'schedule', days: 15, description: '排期期限' },
    { type: 'appraisal', days: 30, description: '鉴定期限' },
    { type: 'completion', days: 60, description: '完成期限' },
  ]

  const insertDeadline = db.prepare(
    `INSERT INTO deadline (id, application_id, type, base_date, deadline_date, holiday_extended, extended_days, status, original_deadline, adjustment_reason, affected_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )

  for (const dl of deadlineTypes) {
    const deadlineDate = addBusinessDays(db, baseDate, dl.days)
    const raw = new Date(baseDate)
    raw.setDate(raw.getDate() + dl.days)
    const rawDeadline = raw.toISOString().slice(0, 10)
    const extended = deadlineDate !== rawDeadline ? 1 : 0
    const extDays = extended
      ? Math.round((new Date(deadlineDate).getTime() - new Date(rawDeadline).getTime()) / 86400000)
      : 0

    insertDeadline.run(
      uuidv4(),
      applicationId,
      dl.type,
      baseDate,
      deadlineDate,
      extended,
      extDays,
      'active',
      deadlineDate,
      `受理后生成${dl.description}，法定${dl.days}个工作日`,
      'accept',
    )
  }
}

export function adjustDeadline(
  db: Database.Database,
  applicationId: string,
  deadlineType: string,
  adjustmentType: string,
  extendDays: number,
  reason: string,
  operatorName: string,
  operatorRole: string,
  supervisorApproval: boolean = false,
  supervisorName?: string,
  supervisorNote?: string,
): any[] {
  const deadlines = db
    .prepare(`SELECT * FROM deadline WHERE application_id = ? AND type = ? AND status = 'active'`)
    .all(applicationId, deadlineType) as any[]
  const adjustments: any[] = []

  if (deadlines.length === 0) return adjustments

  for (const deadline of deadlines) {
    const originalDeadline = deadline.deadline_date
    let newDeadline: string
    let actualExtendDays: number

    if (extendDays < 0) {
      const absDays = Math.abs(extendDays)
      const d = new Date(originalDeadline)
      let subtracted = 0
      while (subtracted < absDays) {
        d.setDate(d.getDate() - 1)
        const dateStr = d.toISOString().slice(0, 10)
        if (!isWeekend(dateStr) && !isHoliday(db, dateStr)) {
          subtracted++
        }
      }
      while (isWeekend(d.toISOString().slice(0, 10)) || isHoliday(db, d.toISOString().slice(0, 10))) {
        d.setDate(d.getDate() - 1)
      }
      newDeadline = d.toISOString().slice(0, 10)
      actualExtendDays = Math.round(
        (new Date(newDeadline).getTime() - new Date(originalDeadline).getTime()) / 86400000,
      )
    } else {
      newDeadline = addBusinessDays(db, originalDeadline, extendDays)
      actualExtendDays = Math.round(
        (new Date(newDeadline).getTime() - new Date(originalDeadline).getTime()) / 86400000,
      )
    }

    db.prepare(
      `UPDATE deadline SET deadline_date = ?, extended_days = extended_days + ?, adjustment_reason = ?, affected_by = ?, status = 'active' WHERE id = ?`,
    ).run(newDeadline, actualExtendDays, reason, adjustmentType, deadline.id)

    const adjId = uuidv4()
    db.prepare(
      `INSERT INTO deadline_adjustment (id, deadline_id, application_id, adjustment_type, original_deadline, new_deadline, extended_days, reason, operator_name, operator_role, supervisor_approval, supervisor_name, supervisor_approval_note, supervisor_approved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      adjId,
      deadline.id,
      applicationId,
      adjustmentType,
      originalDeadline,
      newDeadline,
      actualExtendDays,
      reason,
      operatorName,
      operatorRole,
      supervisorApproval ? 1 : 0,
      supervisorName || null,
      supervisorNote || null,
      supervisorApproval ? new Date().toISOString() : null,
    )

    const direction = actualExtendDays >= 0 ? '顺延' : '提前'
    addAuditLog(
      db,
      applicationId,
      'deadline_adjust',
      operatorName,
      operatorRole,
      `${reason}：原期限${originalDeadline}，新期限${newDeadline}，${direction}${Math.abs(actualExtendDays)}天`,
    )
    adjustments.push(db.prepare(`SELECT * FROM deadline_adjustment WHERE id = ?`).get(adjId))
  }
  return adjustments
}

export function adjustAllActiveDeadlines(
  db: Database.Database,
  applicationId: string,
  adjustmentType: string,
  extendDays: number,
  reason: string,
  operatorName: string,
  operatorRole: string,
  supervisorApproval: boolean = false,
  supervisorName?: string,
  supervisorNote?: string,
): void {
  const deadlines = db
    .prepare(`SELECT type FROM deadline WHERE application_id = ? AND status = 'active'`)
    .all(applicationId) as any[]

  for (const dl of deadlines) {
    adjustDeadline(
      db,
      applicationId,
      dl.type,
      adjustmentType,
      extendDays,
      reason,
      operatorName,
      operatorRole,
      supervisorApproval,
      supervisorName,
      supervisorNote,
    )
  }
}

export function expireAllDeadlines(
  db: Database.Database,
  applicationId: string,
  reason: string,
  operatorName: string,
  operatorRole: string,
): void {
  const updated = db
    .prepare(
      `UPDATE deadline SET status = 'expired', adjustment_reason = ? WHERE application_id = ? AND status = 'active'`,
    )
    .run(reason, applicationId)

  addAuditLog(
    db,
    applicationId,
    'deadline_expire',
    operatorName,
    operatorRole,
    `所有期限已置为已过期：${reason}`,
  )
}

export interface ScheduleBlocker {
  blocker_type: string
  code: string
  message: string
  severity: 'error' | 'warning'
}

export function checkScheduleBlockers(
  db: Database.Database,
  applicationId: string,
  expertId: string,
): { blocked: boolean; blockers: ScheduleBlocker[] } {
  const blockers: ScheduleBlocker[] = []
  const app = db.prepare(`SELECT * FROM application WHERE id = ?`).get(applicationId) as any

  if (!app) {
    return {
      blocked: true,
      blockers: [{ blocker_type: 'material', code: 'APP_NOT_FOUND', message: '申请不存在', severity: 'error' }],
    }
  }

  if (app.correction_count >= app.max_corrections) {
    blockers.push({
      blocker_type: 'correction',
      code: 'CORRECTION_LIMIT_EXCEEDED',
      message: `补正次数已达上限(${app.max_corrections}次)，需主管审批后方可排期`,
      severity: 'error',
    })
  }

  const materials = db
    .prepare(`SELECT * FROM material WHERE application_id = ?`)
    .all(applicationId) as any[]
  const allApproved = materials.length > 0 && materials.every((m) => m.status === 'approved')
  if (!allApproved) {
    const rejected = materials.filter((m) => m.status === 'rejected').length
    const pending = materials.filter((m) => m.status === 'pending').length
    blockers.push({
      blocker_type: 'material',
      code: 'MATERIAL_NOT_APPROVED',
      message: `材料审核未完成：待审核${pending}份，已驳回${rejected}份`,
      severity: 'error',
    })
  }

  const fee = db.prepare(`SELECT * FROM fee WHERE application_id = ?`).get(applicationId) as any
  if (!fee) {
    blockers.push({
      blocker_type: 'fee',
      code: 'FEE_NOT_CREATED',
      message: '费用记录未生成，请先受理案件',
      severity: 'error',
    })
  } else if (fee.status !== 'paid') {
    const statusLabels: Record<string, string> = {
      unpaid: '未缴费',
      refunding: '退款中',
      refunded: '已退款',
      overdue: '已逾期',
    }
    blockers.push({
      blocker_type: 'fee',
      code: 'FEE_NOT_PAID',
      message: `鉴定费用状态：${statusLabels[fee.status] || fee.status}，需完成缴费后方可排期`,
      severity: 'error',
    })
  }

  const expert = db.prepare(`SELECT * FROM expert WHERE id = ?`).get(expertId) as any
  if (!expert) {
    blockers.push({
      blocker_type: 'expert',
      code: 'EXPERT_NOT_FOUND',
      message: '指定的鉴定人不存在',
      severity: 'error',
    })
  } else {
    const conflicts: string[] = JSON.parse(expert.conflict_case_nos || '[]')
    if (conflicts.includes(app.case_no)) {
      const conflictDetail = db
        .prepare(`SELECT * FROM expert_conflict WHERE expert_id = ? AND case_no = ?`)
        .get(expertId, app.case_no) as any
      blockers.push({
        blocker_type: 'expert',
        code: 'EXPERT_RECUSAL_REQUIRED',
        message: `鉴定人回避：与本案存在${conflictDetail?.conflict_type || '利益冲突'}${conflictDetail?.description ? ' - ' + conflictDetail.description : ''}`,
        severity: 'error',
      })
    }

    if (expert.status !== 'active') {
      blockers.push({
        blocker_type: 'qualification',
        code: 'EXPERT_STATUS_INACTIVE',
        message: `鉴定人状态：${expert.status === 'suspended' ? '已停用' : expert.status === 'expired' ? '资质过期' : '不可用'}，无法参与排期`,
        severity: 'error',
      })
    } else if (expert.qualification_valid === 0) {
      blockers.push({
        blocker_type: 'qualification',
        code: 'EXPERT_QUALIFICATION_INVALID',
        message: '鉴定人执业资质无效，无法参与排期',
        severity: 'error',
      })
    }

    const qualMatch = db
      .prepare(
        `SELECT * FROM expert_qualification WHERE expert_id = ? AND status = 'active'`,
      )
      .all(expertId) as any[]

    const appraisalType = app.appraisal_type.replace(/鉴定$/g, '')
    const matched = qualMatch.some((q) => {
      const qType = q.qualification_type.replace(/鉴定$/g, '')
      return appraisalType.includes(qType) || qType.includes(appraisalType) || q.qualification_type === app.appraisal_type
    })

    if (!matched && qualMatch.length > 0) {
      const expertQuals = qualMatch.map((q) => q.qualification_type).join('、')
      blockers.push({
        blocker_type: 'qualification',
        code: 'EXPERT_QUALIFICATION_MISMATCH',
        message: `鉴定人资质不匹配：鉴定类型需要【${app.appraisal_type}】，该鉴定人持有资质：【${expertQuals}】`,
        severity: 'error',
      })
    } else if (qualMatch.length === 0) {
      blockers.push({
        blocker_type: 'qualification',
        code: 'EXPERT_NO_QUALIFICATION',
        message: `该鉴定人尚未登记任何执业资质`,
        severity: 'warning',
      })
    }

    const today = new Date().toISOString().slice(0, 10)
    const expiredQuals = qualMatch.filter(
      (q) => q.valid_to && q.valid_to < today,
    )
    if (expiredQuals.length > 0) {
      blockers.push({
        blocker_type: 'qualification',
        code: 'EXPERT_QUALIFICATION_EXPIRED',
        message: `该鉴定人有${expiredQuals.length}项资质已过期`,
        severity: 'warning',
      })
    }
  }

  const errorBlockers = blockers.filter((b) => b.severity === 'error')
  return { blocked: errorBlockers.length > 0, blockers }
}

export function addFeeTransaction(
  db: Database.Database,
  feeId: string,
  applicationId: string,
  transactionType: string,
  amount: number,
  operatorName: string,
  operatorRole: string,
  paymentMethod?: string,
  transactionNo?: string,
  remark?: string,
  supervisorApproval: boolean = false,
  supervisorName?: string,
  supervisorNote?: string,
): string {
  const id = uuidv4()
  db.prepare(
    `INSERT INTO fee_transaction (id, fee_id, application_id, transaction_type, amount, payment_method, transaction_no, status, operator_name, operator_role, remark, supervisor_approval, supervisor_name, supervisor_approval_note, supervisor_approved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    feeId,
    applicationId,
    transactionType,
    amount,
    paymentMethod || null,
    transactionNo || null,
    'completed',
    operatorName,
    operatorRole,
    remark || null,
    supervisorApproval ? 1 : 0,
    supervisorName || null,
    supervisorNote || null,
    supervisorApproval ? new Date().toISOString() : null,
  )

  addAuditLog(
    db,
    applicationId,
    `fee_${transactionType}`,
    operatorName,
    operatorRole,
    `${remark || transactionType}：金额¥${amount}`,
  )

  return id
}

export function invalidateSchedule(
  db: Database.Database,
  scheduleId: string,
  applicationId: string,
  invalidationType: string,
  reason: string,
  operatorName: string,
  operatorRole: string,
  supervisorApproval: boolean = false,
  supervisorName?: string,
  supervisorNote?: string,
): any {
  const id = uuidv4()
  db.prepare(
    `INSERT INTO schedule_invalidation (id, schedule_id, application_id, invalidation_type, reason, operator_name, operator_role, supervisor_approval, supervisor_name, supervisor_approval_note, supervisor_approved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    scheduleId,
    applicationId,
    invalidationType,
    reason,
    operatorName,
    operatorRole,
    supervisorApproval ? 1 : 0,
    supervisorName || null,
    supervisorNote || null,
    supervisorApproval ? new Date().toISOString() : null,
  )

  db.prepare(`UPDATE schedule SET status = 'expired' WHERE id = ?`).run(scheduleId)

  addAuditLog(
    db,
    applicationId,
    'schedule_invalidate',
    operatorName,
    operatorRole,
    `${reason}：排期已失效，失效记录已生成`,
  )

  return db.prepare(`SELECT * FROM schedule_invalidation WHERE id = ?`).get(id)
}

export function createMaterialTransfer(
  db: Database.Database,
  materialId: string,
  applicationId: string,
  transferType: string,
  fromParty: string,
  fromPartyRole: string,
  toParty: string,
  toPartyRole: string,
  sealed: boolean = false,
  electronicSign: boolean = false,
  placeholder: boolean = false,
  remark?: string,
): any {
  const id = uuidv4()
  const now = new Date().toISOString()

  db.prepare(
    `INSERT INTO material_transfer (id, material_id, application_id, transfer_type, from_party, from_party_role, to_party, to_party_role, sealed, seal_time, seal_operator, electronic_sign, sign_time, sign_operator, placeholder_status, transfer_status, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    materialId,
    applicationId,
    transferType,
    fromParty,
    fromPartyRole,
    toParty,
    toPartyRole,
    sealed ? 1 : 0,
    sealed ? now : null,
    sealed ? fromParty : null,
    electronicSign ? 1 : 0,
    electronicSign ? now : null,
    electronicSign ? fromParty : null,
    placeholder ? 'placed' : 'pending',
    'in_transit',
    remark || null,
  )

  db.prepare(
    `UPDATE material SET transfer_id = ?, placeholder = ?, placeholder_time = ?, placeholder_operator = ? WHERE id = ?`,
  ).run(id, placeholder ? 1 : 0, placeholder ? now : null, placeholder ? fromParty : null, materialId)

  addAuditLog(
    db,
    applicationId,
    'material_transfer',
    fromParty,
    fromPartyRole,
    `材料${transferType}：${fromParty}→${toParty}${sealed ? '，已密封' : ''}${electronicSign ? '，已电子签收' : ''}${placeholder ? '，已占位' : ''}`,
  )

  return db.prepare(`SELECT * FROM material_transfer WHERE id = ?`).get(id)
}

export function confirmMaterialTransfer(
  db: Database.Database,
  transferId: string,
  receiverName: string,
  receiverRole: string,
  remark?: string,
): any {
  const now = new Date().toISOString()
  db.prepare(
    `UPDATE material_transfer SET transfer_status = 'completed', received_at = ?, remark = COALESCE(?, remark) WHERE id = ?`,
  ).run(now, remark || null, transferId)

  const transfer = db
    .prepare(`SELECT * FROM material_transfer WHERE id = ?`)
    .get(transferId) as any
  if (transfer) {
    addAuditLog(
      db,
      transfer.application_id,
      'material_received',
      receiverName,
      receiverRole,
      `材料已签收：${transfer.transfer_type}${remark ? '，' + remark : ''}`,
    )
  }
  return transfer
}

export function addStatusChangeLog(
  db: Database.Database,
  applicationId: string,
  oldStatus: string | undefined | null,
  newStatus: string | undefined | null,
  actor: string,
  actorRole: string,
  reason: string,
): any {
  const statusLabels: Record<string, string> = {
    draft: '草稿',
    submitted: '已提交',
    reviewing: '审核中',
    reviewed: '已审核',
    correction_needed: '需补正',
    under_review: '审核中',
    material_correction: '补正材料',
    accepted: '已受理',
    fee_pending: '待缴费',
    scheduled: '已排期',
    in_appraisal: '鉴定中',
    completed: '已完成',
    withdrawn: '已撤回',
    rejected: '已驳回',
    terminated: '已终止',
  }

  const oldLabel = oldStatus ? statusLabels[oldStatus] || oldStatus : '(无)'
  const newLabel = newStatus ? statusLabels[newStatus] || newStatus : '(无)'
  const detail = `状态变更：${oldLabel} → ${newLabel}，原因：${reason}`

  const id = uuidv4()
  db.prepare(
    `INSERT INTO status_change_log (id, application_id, old_status, new_status, actor, actor_role, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
  ).run(id, applicationId, oldStatus || null, newStatus || null, actor, actorRole, reason)

  addAuditLog(db, applicationId, 'status_change', actor, actorRole, detail)

  return db.prepare(`SELECT * FROM status_change_log WHERE id = ?`).get(id)
}

export function getDeadlineDays(deadlineDate: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const deadline = new Date(deadlineDate)
  deadline.setHours(0, 0, 0, 0)
  return Math.ceil((deadline.getTime() - now.getTime()) / 86400000)
}

export function getDeadlineWarningLevel(remainingDays: number): string {
  if (remainingDays < 0) return 'overdue'
  if (remainingDays <= 3) return 'urgent'
  if (remainingDays <= 7) return 'warning'
  return 'normal'
}
