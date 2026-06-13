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
  `)

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
