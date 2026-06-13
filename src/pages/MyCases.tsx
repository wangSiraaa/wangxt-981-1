import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { APPLICATION_STEPS, APPLICATION_STATUS_LABELS, type Application } from '@/shared/types';
import { StatusBadge } from '@/components/StatusBadge';
import { FolderOpen, ChevronDown, ChevronUp, Clock, FileText, CreditCard, ArrowLeftRight } from 'lucide-react';
import { cn } from '@/lib/utils';

function getStepIndex(status: string): number {
  const stepMap: Record<string, number> = {
    submitted: 0,
    reviewing: 1,
    under_review: 1,
    reviewed: 1,
    correction_needed: 1,
    material_correction: 1,
    accepted: 2,
    fee_pending: 3,
    scheduled: 4,
    in_appraisal: 5,
    completed: 6,
  }
  return stepMap[status] ?? -1
}

function Countdown({ dueDate }: { dueDate: string }) {
  const diff = new Date(dueDate).getTime() - Date.now();
  const days = Math.max(0, Math.ceil(diff / 86400000));
  const color = days <= 3 ? 'text-judicial-danger' : days <= 7 ? 'text-judicial-warning' : 'text-judicial-success';
  return <span className={cn('text-sm font-medium', color)}>{days > 0 ? `${days}天` : '已过期'}</span>;
}

function Timeline({ status }: { status: string }) {
  const currentIdx = getStepIndex(status);
  return (
    <div className="flex items-center gap-0 mt-3">
      {APPLICATION_STEPS.map((step, idx) => (
        <div key={step.key} className="flex items-center flex-1">
          <div className="flex flex-col items-center flex-1">
            <div
              className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-colors',
                idx <= currentIdx
                  ? 'bg-judicial-primary border-judicial-primary text-white'
                  : 'bg-white border-gray-300 text-gray-400',
              )}
            >
              {idx < currentIdx ? '✓' : idx + 1}
            </div>
            <span className={cn('text-xs mt-1', idx <= currentIdx ? 'text-judicial-primary font-medium' : 'text-gray-400')}>
              {step.label}
            </span>
          </div>
          {idx < APPLICATION_STEPS.length - 1 && (
            <div className={cn('h-0.5 flex-1 -mx-1', idx < currentIdx ? 'bg-judicial-primary' : 'bg-gray-200')} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function MyCases() {
  const applications = useAppStore((s) => s.applications);
  const loading = useAppStore((s) => s.loading);
  const fetchApplications = useAppStore((s) => s.fetchApplications);
  const withdrawApplication = useAppStore((s) => s.withdrawApplication);
  const correctMaterials = useAppStore((s) => s.correctMaterials);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [showWithdrawId, setShowWithdrawId] = useState<string | null>(null);
  const [showCorrectId, setShowCorrectId] = useState<string | null>(null);
  const [correctMaterialsList, setCorrectMaterialsList] = useState<{ name: string; file_url: string }[]>([
    { name: '', file_url: '' },
  ]);

  useEffect(() => {
    fetchApplications();
  }, []);

  const handleWithdraw = async (id: string) => {
    if (!withdrawReason.trim()) return;
    await withdrawApplication(id, withdrawReason, '申请人');
    setShowWithdrawId(null);
    setWithdrawReason('');
  };

  const handleCorrect = async (id: string) => {
    const validMaterials = correctMaterialsList.filter((m) => m.name.trim() && m.file_url.trim());
    if (validMaterials.length === 0) return;
    await correctMaterials(id, validMaterials, '申请人');
    setShowCorrectId(null);
    setCorrectMaterialsList([{ name: '', file_url: '' }]);
  };

  const addMaterialField = () => {
    setCorrectMaterialsList([...correctMaterialsList, { name: '', file_url: '' }]);
  };

  const removeMaterialField = (index: number) => {
    if (correctMaterialsList.length > 1) {
      setCorrectMaterialsList(correctMaterialsList.filter((_, i) => i !== index));
    }
  };

  const updateMaterialField = (index: number, field: 'name' | 'file_url', value: string) => {
    const newList = [...correctMaterialsList];
    newList[index][field] = value;
    setCorrectMaterialsList(newList);
  };

  if (loading && applications.length === 0) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card">
            <div className="skeleton h-6 w-48 mb-3" />
            <div className="skeleton h-4 w-32 mb-2" />
            <div className="skeleton h-4 w-64" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <h1 className="font-serif text-2xl font-semibold text-judicial-primary mb-6 flex items-center gap-2">
        <FolderOpen size={24} />
        我的案件
      </h1>

      {applications.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <FolderOpen size={48} className="mx-auto mb-3 opacity-30" />
          <p>暂无案件</p>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => (
            <div key={app.id} className="card">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedId(expandedId === app.id ? null : app.id)}
              >
                <div className="flex items-center gap-3">
                  <FileText size={18} className="text-judicial-gold" />
                  <span className="font-medium text-judicial-primary">{app.case_no}</span>
                  <StatusBadge status={app.status} />
                  {app.is_urgent && <StatusBadge status="urgent_app" className="bg-red-100 text-red-700" />}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>{APPLICATION_STATUS_LABELS[app.status] || app.status}</span>
                  {expandedId === app.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>

              {expandedId === app.id && (
                <div className="mt-4 pt-4 border-t border-gray-100 animate-fade-in">
                  <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                    <div>
                      <span className="text-gray-500">申请人：</span>
                      <span className="font-medium">{app.applicant_name}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">鉴定类型：</span>
                      <span className="font-medium">{app.appraisal_type}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">提交时间：</span>
                      <span className="font-medium">{new Date(app.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <Timeline status={app.status} />

                  {app.deadline && (
                    <div className="flex items-center gap-2 mt-3 text-sm">
                      <Clock size={14} className="text-judicial-warning" />
                      <span className="text-gray-500">期限倒计时：</span>
                      <Countdown dueDate={app.deadline.deadline_date} />
                      {(app.deadline.extended_days || 0) > 0 && (
                        <span className="text-xs text-blue-500">（含法定假日延期{app.deadline.extended_days}天）</span>
                      )}
                    </div>
                  )}

                  {app.schedule && (
                    <div className="mt-3 p-3 bg-blue-50/50 rounded-judicial text-sm">
                      <span className="text-gray-500">排期：</span>
                      <span className="font-medium">{app.schedule.scheduled_date} {app.schedule.scheduled_time}</span>
                      <span className="text-gray-400 ml-2">专家：{app.schedule.expert_name || ''}</span>
                      <span className="text-gray-400 ml-2">地点：{app.schedule.location}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-4">
                    {(app.status === 'correction_needed' || app.status === 'material_correction') && (
                      <button
                        onClick={() => {
                          setShowCorrectId(app.id);
                          setCorrectMaterialsList([{ name: '', file_url: '' }]);
                        }}
                        className="btn-outline text-sm flex items-center gap-1"
                      >
                        <FileText size={14} /> 补正材料
                      </button>
                    )}
                    {app.status === 'fee_pending' && (
                      <button className="btn-gold text-sm flex items-center gap-1">
                        <CreditCard size={14} /> 前往缴费
                      </button>
                    )}
                    {!['completed', 'withdrawn', 'rejected', 'terminated'].includes(app.status) && (
                      <button
                        onClick={() => setShowWithdrawId(app.id)}
                        className="btn-danger text-sm flex items-center gap-1"
                      >
                        <ArrowLeftRight size={14} /> 申请撤回
                      </button>
                    )}
                  </div>

                  {showCorrectId === app.id && (
                    <div className="mt-3 p-4 bg-blue-50/50 rounded-judicial animate-fade-in">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">补正材料清单</h4>
                      <div className="space-y-2">
                        {correctMaterialsList.map((mat, idx) => (
                          <div key={idx} className="flex gap-2 items-start">
                            <input
                              type="text"
                              value={mat.name}
                              onChange={(e) => updateMaterialField(idx, 'name', e.target.value)}
                              className="input-field text-sm flex-1"
                              placeholder="材料名称"
                            />
                            <input
                              type="text"
                              value={mat.file_url}
                              onChange={(e) => updateMaterialField(idx, 'file_url', e.target.value)}
                              className="input-field text-sm flex-1"
                              placeholder="文件链接"
                            />
                            {correctMaterialsList.length > 1 && (
                              <button
                                onClick={() => removeMaterialField(idx)}
                                className="text-red-500 hover:text-red-700 p-2"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={addMaterialField}
                        className="mt-2 text-sm text-judicial-primary hover:underline"
                      >
                        + 添加更多材料
                      </button>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleCorrect(app.id)}
                          disabled={loading || correctMaterialsList.every((m) => !m.name.trim() || !m.file_url.trim())}
                          className="btn-primary text-sm"
                        >
                          {loading ? '提交中...' : '提交补正'}
                        </button>
                        <button
                          onClick={() => {
                            setShowCorrectId(null);
                            setCorrectMaterialsList([{ name: '', file_url: '' }]);
                          }}
                          className="btn-outline text-sm"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  )}

                  {showWithdrawId === app.id && (
                    <div className="mt-3 p-4 bg-red-50/50 rounded-judicial animate-fade-in">
                      <label className="block text-sm font-medium text-gray-700 mb-2">撤回原因</label>
                      <textarea
                        value={withdrawReason}
                        onChange={(e) => setWithdrawReason(e.target.value)}
                        className="input-field min-h-[80px] resize-none"
                        placeholder="请输入撤回原因"
                      />
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => handleWithdraw(app.id)} disabled={!withdrawReason.trim()} className="btn-danger text-sm">
                          确认撤回
                        </button>
                        <button onClick={() => { setShowWithdrawId(null); setWithdrawReason(''); }} className="btn-outline text-sm">
                          取消
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
