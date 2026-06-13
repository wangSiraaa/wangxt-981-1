#!/usr/bin/env node
import http from 'http';
const BASE = 'http://localhost:3001';
function req(path, opts = {}) {
  return new Promise((resolve, reject) => {
    const r = http.request(`${BASE}${path}`, { method: 'GET', ...opts, headers: { 'Content-Type': 'application/json', ...opts.headers } }, (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: { raw: d } }); } });
    }); r.on('error', reject); if (opts.body) r.write(JSON.stringify(opts.body)); r.end();
  });
}
function post(path, body) { return req(path, { method: 'POST', body }); }
function put(path, body) { return req(path, { method: 'PUT', body }); }
function get(path) { return req(path); }

async function test(name, fn) {
  process.stdout.write(`  ${name}... `);
  try { await fn(); console.log('\x1b[32m✓ PASS\x1b[0m'); return true; }
  catch (e) { console.log(`\x1b[31m✗ FAIL\x1b[0m\n    ${e.message}`); return false; }
}

async function main() {
  console.log('\n\x1b[1m=== 加急审批流程回归测试 ===\x1b[0m\n');
  let passed = 0, failed = 0;

  const createRes = await post('/api/applications', {
    case_no: 'URGENT-TEST-001', applicant_name: '张三', applicant_phone: '13800138001',
    appraisal_type: '法医临床', material_names: ['伤情鉴定委托书', '病历资料', '身份证复印件']
  });
  if (await test('创建申请', () => { if (!createRes.body.success) throw new Error(createRes.body.error); })) passed++; else failed++;
  const appId = createRes.body.data.id;

  if (await test('材料审核通过', async () => {
    const res = await put(`/api/applications/${appId}/review`, { decision: 'approve', review_note: '材料齐全', reviewer_name: '审核员' });
    if (!res.body.success) throw new Error(res.body.error);
    if (res.body.data.status !== 'reviewed') throw new Error(`状态应为reviewed，实际: ${res.body.data.status}`);
  })) passed++; else failed++;

  const instRes = await get('/api/institutions');
  const instId = instRes.body.data[0].id;

  if (await test('受理', async () => {
    const res = await put(`/api/applications/${appId}/accept`, { institution_id: instId, acceptor_name: '受理员' });
    if (!res.body.success) throw new Error(res.body.error);
  })) passed++; else failed++;

  if (await test('缴费', async () => {
    const res = await post(`/api/fees/${appId}/pay`, { payer_name: '张三' });
    if (!res.body.success) throw new Error(res.body.error);
  })) passed++; else failed++;

  const expRes = await get('/api/experts');
  const expertId = expRes.body.data[0].id;
  let scheduleId;

  if (await test('创建加急排期（带原因）', async () => {
    const res = await post(`/api/applications/${appId}/schedule`, {
      expert_id: expertId, institution_id: instId,
      scheduled_date: '2026-07-15', scheduled_time: '09:00', location: 'A101鉴定室',
      is_urgent: true, urgent_reason: '案情紧急需加急出证', creator_name: '排程员'
    });
    if (!res.body.success) throw new Error(res.body.error);
    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
    scheduleId = res.body.data.id;
  })) passed++; else failed++;

  if (await test('待审批加急列表包含该排期', async () => {
    const res = await get('/api/applications/schedules/urgents');
    if (!res.body.success) throw new Error(res.body.error);
    const found = res.body.data.find(s => s.id === scheduleId);
    if (!found) throw new Error('加急排期未出现在待审批列表中');
    if (found.case_no !== 'URGENT-TEST-001') throw new Error(`case_no不匹配: ${found.case_no}`);
    if (found.applicant_name !== '张三') throw new Error(`applicant_name不匹配: ${found.applicant_name}`);
    if (found.urgent_reason !== '案情紧急需加急出证') throw new Error(`urgent_reason不匹配: ${found.urgent_reason}`);
    if (!found.expert_name) throw new Error('expert_name缺失');
  })) passed++; else failed++;

  if (await test('批准加急审批', async () => {
    const res = await put(`/api/applications/urgents/${scheduleId}/approve`, {
      approver_name: '主管', approver_note: '同意加急'
    });
    if (!res.body.success) throw new Error(res.body.error);
    if (!res.body.data.urgent_approved) throw new Error('urgent_approved未设为1');
    if (res.body.data.urgent_approver !== '主管') throw new Error('urgent_approver不匹配');
    if (res.body.data.urgent_approve_note !== '同意加急') throw new Error('urgent_approve_note不匹配');
  })) passed++; else failed++;

  if (await test('批准后不再出现在待审批列表', async () => {
    const res = await get('/api/applications/schedules/urgents');
    if (!res.body.success) throw new Error(res.body.error);
    const found = res.body.data.find(s => s.id === scheduleId);
    if (found) throw new Error('已批准的加急排期仍出现在待审批列表中');
  })) passed++; else failed++;

  if (await test('审计日志记录加急审批', async () => {
    const res = await get(`/api/audit-logs?application_id=${appId}`);
    if (!res.body.success) throw new Error(res.body.error);
    const log = res.body.data.find(l => l.action === 'urgent_approve');
    if (!log) throw new Error('未找到urgent_approve审计记录');
    if (!log.detail.includes('加急排程已批准')) throw new Error(`detail不匹配: ${log.detail}`);
  })) passed++; else failed++;

  const createRes2 = await post('/api/applications', {
    case_no: 'URGENT-TEST-002', applicant_name: '李四', applicant_phone: '13900139002',
    appraisal_type: '物证鉴定', material_names: ['鉴定委托书', '物证照片']
  });
  const appId2 = createRes2.body.data.id;
  await put(`/api/applications/${appId2}/review`, { decision: 'approve', review_note: '通过', reviewer_name: '审核员' });
  await put(`/api/applications/${appId2}/accept`, { institution_id: instId, acceptor_name: '受理员' });
  await post(`/api/fees/${appId2}/pay`, { payer_name: '李四' });
  const expert2 = expRes.body.data[1]?.id || expertId;
  const schedRes2 = await post(`/api/applications/${appId2}/schedule`, {
    expert_id: expert2, institution_id: instId,
    scheduled_date: '2026-07-16', scheduled_time: '10:00', location: 'B202鉴定室',
    is_urgent: false, creator_name: '排程员'
  });
  const scheduleId2 = schedRes2.body.data.id;

  if (await test('对已有排期申请加急', async () => {
    const res = await post(`/api/applications/${appId2}/urgent`, {
      urgent_reason: '新发现关键证据需加急处理', requester_name: '李四'
    });
    if (!res.body.success) throw new Error(res.body.error);
  })) passed++; else failed++;

  if (await test('加急申请后出现在待审批列表', async () => {
    const res = await get('/api/applications/schedules/urgents');
    if (!res.body.success) throw new Error(res.body.error);
    const found = res.body.data.find(s => s.id === scheduleId2);
    if (!found) throw new Error('加急排期未出现在待审批列表');
    if (found.urgent_reason !== '新发现关键证据需加急处理') throw new Error(`urgent_reason不匹配: ${found.urgent_reason}`);
  })) passed++; else failed++;

  console.log(`\n=== 结果: 通过 ${passed}, 失败 ${failed} ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
