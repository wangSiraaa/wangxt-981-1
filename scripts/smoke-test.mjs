#!/usr/bin/env node
import http from 'http';

const BASE_URL = 'http://localhost:3001';

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${BASE_URL}${path}`, { method: 'GET', ...options, headers: { 'Content-Type': 'application/json', ...options.headers } }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const body = JSON.parse(data);
          resolve({ status: res.statusCode || 0, body });
        } catch (e) {
          resolve({ status: res.statusCode || 0, body: { raw: data } });
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

async function test(name, fn) {
  process.stdout.write(`\n  Testing: ${name}... `);
  try {
    await fn();
    console.log('\x1b[32m✓ PASS\x1b[0m');
    return true;
  } catch (e) {
    console.log(`\x1b[31m✗ FAIL\x1b[0m`);
    console.log(`    Error: ${e.message}`);
    return false;
  }
}

async function smokeTest() {
  console.log('\n\x1b[1m=== 司法鉴定预约系统 - 冒烟测试 ===\x1b[0m\n');
  console.log(`Base URL: ${BASE_URL}\n`);

  let passed = 0;
  let failed = 0;

  // === 基础接口测试 ===
  if (await test('健康检查', async () => {
    const res = await request('/api/health');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.body.success) throw new Error('Expected success: true');
  })) passed++; else failed++;

  if (await test('统计数据接口', async () => {
    const res = await request('/api/stats');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.body.success) throw new Error('Expected success: true');
    if (typeof res.body.data.total !== 'number') throw new Error('Missing total stat');
  })) passed++; else failed++;

  // === 数据查询测试 ===
  let appId = null;
  if (await test('申请列表查询', async () => {
    const res = await request('/api/applications');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!Array.isArray(res.body.data)) throw new Error('Expected array data');
    if (res.body.data.length > 0) appId = res.body.data[0].id;
  })) passed++; else failed++;

  if (appId && await test('申请详情查询', async () => {
    const res = await request(`/api/applications/${appId}`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.body.data) throw new Error('Missing application data');
  })) passed++; else failed++;

  if (await test('专家列表查询', async () => {
    const res = await request('/api/experts');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!Array.isArray(res.body.data)) throw new Error('Expected array data');
  })) passed++; else failed++;

  if (await test('机构列表查询', async () => {
    const res = await request('/api/institutions');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!Array.isArray(res.body.data)) throw new Error('Expected array data');
  })) passed++; else failed++;

  if (await test('排期列表查询', async () => {
    const res = await request('/api/applications/schedules');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!Array.isArray(res.body.data)) throw new Error('Expected array data');
  })) passed++; else failed++;

  if (await test('费用列表查询', async () => {
    const res = await request('/api/fees');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!Array.isArray(res.body.data)) throw new Error('Expected array data');
  })) passed++; else failed++;

  if (await test('撤回列表查询', async () => {
    const res = await request('/api/applications/withdrawals');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!Array.isArray(res.body.data)) throw new Error('Expected array data');
  })) passed++; else failed++;

  if (await test('期限列表查询', async () => {
    const res = await request('/api/deadlines');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!Array.isArray(res.body.data)) throw new Error('Expected array data');
  })) passed++; else failed++;

  // === 业务规则拦截测试 ===
  if (await test('重复案件拦截', async () => {
    const res = await request('/api/applications', {
      method: 'POST',
      body: {
        case_no: 'CASE-2026-001',
        applicant_name: '测试用户',
        applicant_phone: '13800000000',
        appraisal_type: '法医临床鉴定'
      }
    });
    if (res.status !== 409) throw new Error(`Expected 409, got ${res.status}`);
    if (res.body.code !== 'DUPLICATE_CASE_NO') throw new Error('Expected DUPLICATE_CASE_NO code');
  })) passed++; else failed++;

  if (await test('缺失字段验证', async () => {
    const res = await request('/api/applications', {
      method: 'POST',
      body: { case_no: 'TEST-001' }
    });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  })) passed++; else failed++;

  if (await test('冲突检测接口', async () => {
    const res = await request('/api/applications/schedules/conflicts?expert_id=1&date=2026-06-15&time=09:00');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (typeof res.body.data.has_conflicts !== 'boolean') throw new Error('Expected has_conflicts boolean');
  })) passed++; else failed++;

  if (await test('专家冲突检测', async () => {
    const res = await request('/api/experts/conflicts?case_no=CASE-2026-001');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  })) passed++; else failed++;

  if (await test('期限预警', async () => {
    const res = await request('/api/deadlines/warnings');
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  })) passed++; else failed++;

  // === 完整流程演示测试 ===
  let newAppId = null;
  let newAppCaseNo = 'DEMO-' + Date.now();

  if (await test('创建申请（含材料）', async () => {
    const res = await request('/api/applications', {
      method: 'POST',
      body: {
        case_no: newAppCaseNo,
        applicant_name: '演示用户',
        applicant_phone: '13900000001',
        appraisal_type: '法医临床鉴定',
        material_names: ['委托书', '身份证明', '检材样本']
      }
    });
    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
    if (!res.body.success) throw new Error('Expected success');
    newAppId = res.body.data.id;
  })) passed++; else failed++;

  if (await test('审核通过', async () => {
    const res = await request(`/api/applications/${newAppId}/review`, {
      method: 'PUT',
      body: { decision: 'approve', review_note: '材料齐全', reviewer_name: '审核员' }
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (res.body.data.status !== 'reviewed') throw new Error(`Expected reviewed, got ${res.body.data.status}`);
  })) passed++; else failed++;

  if (await test('受理生成待缴费', async () => {
    const instRes = await request('/api/institutions');
    const instId = instRes.body.data[0]?.id;
    if (!instId) throw new Error('No institution found');

    const res = await request(`/api/applications/${newAppId}/accept`, {
      method: 'PUT',
      body: { institution_id: instId, acceptor_name: '受理员' }
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (res.body.data.status !== 'fee_pending') throw new Error(`Expected fee_pending, got ${res.body.data.status}`);
  })) passed++; else failed++;

  if (await test('未缴费拦截排期', async () => {
    const expRes = await request('/api/experts');
    const expert = expRes.body.data[0];
    const instRes = await request('/api/institutions');
    const inst = instRes.body.data[0];
    if (!expert || !inst) throw new Error('No expert or institution');

    const res = await request(`/api/applications/${newAppId}/schedule`, {
      method: 'POST',
      body: {
        expert_id: expert.id,
        institution_id: inst.id,
        scheduled_date: '2026-07-01',
        scheduled_time: '09:00',
        location: '测试鉴定室',
        creator_name: '排程员'
      }
    });
    if (res.status !== 402) throw new Error(`Expected 402 (unpaid block), got ${res.status}`);
    if (res.body.code !== 'FEE_UNPAID') throw new Error(`Expected FEE_UNPAID, got ${res.body.code}`);
  })) passed++; else failed++;

  if (await test('缴费后状态变为accepted', async () => {
    const res = await request(`/api/fees/${newAppId}/pay`, {
      method: 'POST',
      body: { payer_name: '演示用户' }
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (res.body.data.status !== 'paid') throw new Error(`Expected paid, got ${res.body.data.status}`);

    const appRes = await request(`/api/applications/${newAppId}`);
    if (appRes.body.data.status !== 'accepted') throw new Error(`Expected accepted after fee pay, got ${appRes.body.data.status}`);
  })) passed++; else failed++;

  let newScheduleId = null;
  if (await test('缴费后可排期', async () => {
    const expRes = await request('/api/experts');
    const expert = expRes.body.data.find(e => !JSON.parse(e.conflict_case_nos || '[]').includes(newAppCaseNo));
    const instRes = await request('/api/institutions');
    const inst = instRes.body.data[0];
    if (!expert || !inst) throw new Error('No available expert or institution');

    const res = await request(`/api/applications/${newAppId}/schedule`, {
      method: 'POST',
      body: {
        expert_id: expert.id,
        institution_id: inst.id,
        scheduled_date: '2026-07-01',
        scheduled_time: '09:00',
        location: '测试鉴定室',
        creator_name: '排程员'
      }
    });
    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
    newScheduleId = res.body.data.id;
  })) passed++; else failed++;

  if (await test('加急排期需原因', async () => {
    const res = await request(`/api/applications/${newAppId}/schedule`, {
      method: 'POST',
      body: {
        expert_id: 'test',
        institution_id: 'test',
        scheduled_date: '2026-07-02',
        scheduled_time: '10:00',
        location: '测试室',
        creator_name: '排程员',
        is_urgent: true
      }
    });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    if (res.body.code !== 'URGENT_REASON_REQUIRED') throw new Error(`Expected URGENT_REASON_REQUIRED, got ${res.body.code}`);
  })) passed++; else failed++;

  if (await test('排期冲突拦截', async () => {
    const expRes = await request('/api/experts');
    const expert = expRes.body.data[0];
    const instRes = await request('/api/institutions');
    const inst = instRes.body.data[0];
    if (!expert || !inst) throw new Error('No expert or institution');

    const app4Res = await request('/api/applications?status=scheduled');
    if (app4Res.body.data.length === 0) throw new Error('No scheduled app for conflict test');

    const res = await request(`/api/applications/${app4Res.body.data[0].id}/schedule`, {
      method: 'POST',
      body: {
        expert_id: expert.id,
        institution_id: inst.id,
        scheduled_date: '2026-06-15',
        scheduled_time: '09:00',
        location: '明鉴司法鉴定所201室',
        creator_name: '排程员'
      }
    });
    if (res.status === 201) {
      throw new Error('Expected conflict to block scheduling');
    }
  })) passed++; else failed++;

  if (await test('已完成鉴定不可撤回', async () => {
    const app5Res = await request('/api/applications?status=completed');
    if (app5Res.body.data.length === 0) throw new Error('No completed app');

    const res = await request(`/api/applications/${app5Res.body.data[0].id}/withdraw`, {
      method: 'POST',
      body: { reason: '测试撤回', withdrawer_name: '测试' }
    });
    if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
    if (res.body.code !== 'COMPLETED_CANNOT_WITHDRAW') throw new Error(`Expected COMPLETED_CANNOT_WITHDRAW, got ${res.body.code}`);
  })) passed++; else failed++;

  if (await test('补正退回补正材料后重审', async () => {
    const app2Res = await request('/api/applications?status=correction_needed');
    if (app2Res.body.data.length === 0) throw new Error('No correction_needed app');

    const app2Id = app2Res.body.data[0].id;
    const res = await request(`/api/applications/${app2Id}/materials`, {
      method: 'POST',
      body: {
        materials: [{ name: '委托书', file_url: '/uploads/corrected/doc1.pdf' }],
        uploader_name: '王女士'
      }
    });
    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);

    const appRes = await request(`/api/applications/${app2Id}`);
    if (appRes.body.data.status !== 'reviewing') throw new Error(`Expected reviewing, got ${appRes.body.data.status}`);
  })) passed++; else failed++;

  if (await test('材料签收与盖章', async () => {
    const app1Res = await request('/api/applications?status=submitted');
    if (app1Res.body.data.length === 0) throw new Error('No submitted app');

    const detailRes = await request(`/api/applications/${app1Res.body.data[0].id}`);
    const materials = detailRes.body.data.materials;
    if (!materials || materials.length === 0) throw new Error('No materials');

    const matId = materials[0].id;
    const signRes = await request(`/api/applications/materials/${matId}/sign`, {
      method: 'PUT',
      body: { signer_name: '签收人' }
    });
    if (signRes.status !== 200) throw new Error(`Sign expected 200, got ${signRes.status}`);

    const sealRes = await request(`/api/applications/materials/${matId}/seal`, {
      method: 'PUT',
      body: { sealer_name: '盖章人' }
    });
    if (sealRes.status !== 200) throw new Error(`Seal expected 200, got ${sealRes.status}`);
  })) passed++; else failed++;

  if (await test('撤回后排期失效（形成失效记录）', async () => {
    const app4Res = await request('/api/applications?status=scheduled');
    if (app4Res.body.data.length === 0) throw new Error('No scheduled app for withdrawal test');

    const app4Id = app4Res.body.data[0].id;

    const schedBeforeRes = await request(`/api/applications/${app4Id}`);
    const schedBefore = schedBeforeRes.body.data.schedules;
    if (!schedBefore || schedBefore.length === 0) throw new Error('No schedules before withdrawal');

    const wdRes = await request(`/api/applications/${app4Id}/withdraw`, {
      method: 'POST',
      body: { reason: '个人原因', withdrawer_name: '赵先生' }
    });
    if (wdRes.status !== 201) throw new Error(`Withdraw expected 201, got ${wdRes.status}`);
    const wdId = wdRes.body.data.id;

    const approveRes = await request(`/api/applications/withdrawals/${wdId}/approve`, {
      method: 'PUT',
      body: { approver_name: '主管', approver_note: '同意撤回' }
    });
    if (approveRes.status !== 200) throw new Error(`Approve expected 200, got ${approveRes.status}`);

    const appAfterRes = await request(`/api/applications/${app4Id}`);
    if (appAfterRes.body.data.status !== 'withdrawn') throw new Error(`Expected withdrawn, got ${appAfterRes.body.data.status}`);

    const schedAfterRes = await request(`/api/applications/${app4Id}`);
    const schedAfter = schedAfterRes.body.data.schedules;
    const hasExpired = schedAfter.some(s => s.status === 'expired');
    if (!hasExpired) throw new Error('Expected at least one expired schedule record after withdrawal');

    const feeAfterRes = await request('/api/fees');
    const feeForApp4 = feeAfterRes.body.data.find(f => f.application_id === app4Id && f.status === 'refunded');
    if (!feeForApp4) throw new Error('Expected refund after withdrawal approval');
  })) passed++; else failed++;

  console.log(`\n\x1b[1m=== 测试结果 ===\x1b[0m`);
  console.log(`  通过: \x1b[32m${passed}\x1b[0m`);
  console.log(`  失败: \x1b[31m${failed}\x1b[0m`);
  console.log(`  总计: ${passed + failed}`);
  console.log(`  通过率: ${Math.round(passed / (passed + failed) * 100)}%\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('\x1b[32m✓ 所有测试通过！系统运行正常。\x1b[0m\n');
  }
}

smokeTest().catch((e) => {
  console.error('\x1b[31m测试执行失败:\x1b[0m', e.message);
  console.log('\n  提示: 请确保后端服务已启动 (npm run server:dev)');
  process.exit(1);
});
