import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { StatusBadge } from '@/components/StatusBadge';
import { ShieldCheck, Zap, CheckCircle, XCircle, AlertTriangle, FileText, Clock, User, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tab = 'withdrawal' | 'urgent';

export default function Supervisor() {
  const withdrawals = useAppStore((s) => s.withdrawals);
  const urgentSchedules = useAppStore((s) => s.urgentApplications);
  const loading = useAppStore((s) => s.loading);
  const fetchWithdrawals = useAppStore((s) => s.fetchWithdrawals);
  const fetchUrgentApplications = useAppStore((s) => s.fetchUrgentApplications);
  const approveWithdrawal = useAppStore((s) => s.approveWithdrawal);
  const approveUrgent = useAppStore((s) => s.approveUrgent);

  const [tab, setTab] = useState<Tab>('withdrawal');
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchWithdrawals();
    fetchUrgentApplications();
  }, []);

  const searchParams = new URLSearchParams(window.location.search);
  const queryTab = searchParams.get('tab');
  useEffect(() => {
    if (queryTab === 'urgent') setTab('urgent');
  }, [queryTab]);

  const getNote = (id: string) => noteMap[id] ?? '';
  const setNote = (id: string, value: string) => setNoteMap({ ...noteMap, [id]: value });

  return (
    <div className="animate-fade-in">
      <h1 className="font-serif text-2xl font-semibold text-judicial-primary mb-6 flex items-center gap-2">
        <ShieldCheck size={24} />
        主管审批
      </h1>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('withdrawal')}
          className={cn(
            'px-5 py-2 rounded-judicial text-sm font-medium transition-colors',
            tab === 'withdrawal' ? 'bg-judicial-primary text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-judicial-primary',
          )}
        >
          <ShieldCheck size={14} className="inline mr-1" />
          撤回审批
          {withdrawals.filter((w) => w.status === 'pending').length > 0 && (
            <span className="ml-1.5 bg-judicial-danger text-white text-xs px-1.5 py-0.5 rounded-full">
              {withdrawals.filter((w) => w.status === 'pending').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('urgent')}
          className={cn(
            'px-5 py-2 rounded-judicial text-sm font-medium transition-colors',
            tab === 'urgent' ? 'bg-judicial-primary text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-judicial-primary',
          )}
        >
          <Zap size={14} className="inline mr-1" />
          加急审批
          {urgentSchedules.length > 0 && (
            <span className="ml-1.5 bg-judicial-warning text-white text-xs px-1.5 py-0.5 rounded-full">
              {urgentSchedules.length}
            </span>
          )}
        </button>
      </div>

      {tab === 'withdrawal' && (
        <div className="space-y-4">
          {withdrawals.length === 0 ? (
            <div className="card text-center py-12 text-gray-400">
              <ShieldCheck size={48} className="mx-auto mb-3 opacity-30" />
              <p>暂无撤回审批</p>
            </div>
          ) : (
            withdrawals.map((w) => (
              <div key={w.id} className="card">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-judicial-gold" />
                    <span className="font-medium text-judicial-primary">申请ID: {w.application_id}</span>
                    <StatusBadge status={w.status} />
                  </div>
                  <span className="text-xs text-gray-400">{new Date(w.created_at).toLocaleString()}</span>
                </div>
                <div className="text-sm text-gray-600 mb-3">
                  <span className="text-gray-500">撤回原因：</span>{w.reason}
                </div>

                {w.schedule_expired && (
                  <div className="p-2 bg-red-50 text-judicial-danger text-sm rounded-judicial mb-3 animate-shake flex items-center gap-2">
                    <AlertTriangle size={16} /> 注意：该申请已有排期安排，批准撤回将导致排期失效
                  </div>
                )}

                {w.status === 'pending' ? (
                  <div>
                    <textarea
                      value={getNote(w.id)}
                      onChange={(e) => setNote(w.id, e.target.value)}
                      className="input-field min-h-[60px] resize-none text-sm mb-2"
                      placeholder="审批意见（选填）"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => approveWithdrawal(w.id, '主管', getNote(w.id))}
                        disabled={loading}
                        className="btn-primary text-sm flex items-center gap-1"
                      >
                        <CheckCircle size={14} /> 批准撤回
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">
                    {w.reviewed_by && <span>审批人：{w.reviewed_by} · </span>}
                    {w.reviewed_at && <span>{new Date(w.reviewed_at).toLocaleString()}</span>}
                    {w.approver_note && <span> · 意见：{w.approver_note}</span>}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'urgent' && (
        <div className="space-y-4">
          {urgentSchedules.length === 0 ? (
            <div className="card text-center py-12 text-gray-400">
              <Zap size={48} className="mx-auto mb-3 opacity-30" />
              <p>暂无加急审批</p>
            </div>
          ) : (
            urgentSchedules.map((s) => (
              <div key={s.id} className="card">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Zap size={16} className="text-judicial-warning" />
                    <span className="font-medium text-judicial-primary">{(s as any).case_no}</span>
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                      待审批
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">{new Date(s.created_at).toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm text-gray-600 mb-3">
                  <div className="flex items-center gap-1.5">
                    <User size={14} className="text-gray-400" />
                    <span className="text-gray-400">申请人：</span>{(s as any).applicant_name}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <FileText size={14} className="text-gray-400" />
                    <span className="text-gray-400">鉴定类型：</span>{(s as any).appraisal_type}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock size={14} className="text-gray-400" />
                    <span className="text-gray-400">排期：</span>{s.scheduled_date} {s.scheduled_time}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin size={14} className="text-gray-400" />
                    <span className="text-gray-400">地点：</span>{s.location}
                  </div>
                </div>
                {(s as any).expert_name && (
                  <div className="text-sm text-gray-600 mb-3">
                    <span className="text-gray-400">鉴定人：</span>{(s as any).expert_name}
                  </div>
                )}
                {s.urgent_reason && (
                  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-judicial mb-3">
                    <div className="flex items-center gap-1.5 font-medium mb-1">
                      <Zap size={14} /> 加急原因
                    </div>
                    <div>{s.urgent_reason}</div>
                  </div>
                )}
                <div>
                  <textarea
                    value={getNote(s.id)}
                    onChange={(e) => setNote(s.id, e.target.value)}
                    className="input-field min-h-[60px] resize-none text-sm mb-2"
                    placeholder="审批意见（选填）"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => approveUrgent(s.id, '主管', getNote(s.id))}
                      disabled={loading}
                      className="btn-primary text-sm flex items-center gap-1"
                    >
                      <CheckCircle size={14} /> 批准加急
                    </button>
                    <button
                      onClick={() => {
                        setNote(s.id, '');
                        approveUrgent(s.id, '主管', '不予批准');
                      }}
                      disabled={loading}
                      className="btn-danger text-sm flex items-center gap-1"
                    >
                      <XCircle size={14} /> 驳回
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
