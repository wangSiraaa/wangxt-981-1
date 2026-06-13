import { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import type { Deadline, DeadlineType, DeadlineStatus } from '@/shared/types';
import { DEADLINE_TYPE_LABELS, DEADLINE_STATUS_LABELS } from '@/shared/types';
import { AlertTriangle, Clock, Filter, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

function getCountdown(dueDate: string): { days: number; percentage: number } {
  const now = Date.now();
  const due = new Date(dueDate).getTime();
  const diff = due - now;
  const days = Math.ceil(diff / 86400000);
  const totalDays = 30;
  const percentage = Math.max(0, Math.min(100, Math.round((1 - Math.max(0, days) / totalDays) * 100)));
  return { days: Math.max(0, days), percentage };
}

function getBarColor(days: number, status: DeadlineStatus): string {
  if (status === 'completed') return 'bg-gray-300';
  if (days <= 0 || status === 'expired') return 'bg-red-800';
  if (days <= 3 || status === 'urgent') return 'bg-judicial-danger';
  if (days <= 7 || status === 'warning') return 'bg-judicial-warning';
  return 'bg-judicial-success';
}

function getTextColor(days: number, status: DeadlineStatus): string {
  if (status === 'completed') return 'text-gray-400';
  if (days <= 0 || status === 'expired') return 'text-red-800';
  if (days <= 3 || status === 'urgent') return 'text-judicial-danger';
  if (days <= 7 || status === 'warning') return 'text-judicial-warning';
  return 'text-judicial-success';
}

export default function DeadlinePage() {
  const deadlines = useAppStore((s) => s.deadlines);
  const loading = useAppStore((s) => s.loading);
  const fetchDeadlines = useAppStore((s) => s.fetchDeadlines);

  const [typeFilter, setTypeFilter] = useState<DeadlineType | ''>('');
  const [statusFilter, setStatusFilter] = useState<DeadlineStatus | ''>('');

  useEffect(() => {
    fetchDeadlines();
  }, []);

  const filteredDeadlines = useMemo(() => {
    return deadlines.filter((d) => {
      if (typeFilter && d.type !== typeFilter) return false;
      if (statusFilter && d.status !== statusFilter) return false;
      return true;
    });
  }, [deadlines, typeFilter, statusFilter]);

  const stats = useMemo(() => {
    const active = deadlines.filter((d) => d.status === 'active').length;
    const warning = deadlines.filter((d) => d.status === 'warning').length;
    const urgent = deadlines.filter((d) => d.status === 'urgent').length;
    const expired = deadlines.filter((d) => d.status === 'expired').length;
    return { active, warning, urgent, expired };
  }, [deadlines]);

  return (
    <div className="animate-fade-in">
      <h1 className="font-serif text-2xl font-semibold text-judicial-primary mb-6 flex items-center gap-2">
        <AlertTriangle size={24} />
        期限预警
      </h1>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: '正常', count: stats.active, color: 'bg-judicial-success', textColor: 'text-judicial-success' },
          { label: '临近', count: stats.warning, color: 'bg-judicial-warning', textColor: 'text-judicial-warning' },
          { label: '紧急', count: stats.urgent, color: 'bg-judicial-danger', textColor: 'text-judicial-danger' },
          { label: '已过期', count: stats.expired, color: 'bg-red-800', textColor: 'text-red-800' },
        ].map((s) => (
          <div key={s.label} className="card text-center">
            <div className={cn('text-3xl font-serif font-bold', s.textColor)}>{s.count}</div>
            <div className="text-sm text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as DeadlineType | '')}
            className="select-field w-40 text-sm"
          >
            <option value="">全部类型</option>
            {Object.entries(DEADLINE_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as DeadlineStatus | '')}
          className="select-field w-40 text-sm"
        >
          <option value="">全部状态</option>
          {Object.entries(DEADLINE_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {loading && deadlines.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card">
              <div className="skeleton h-5 w-48 mb-2" />
              <div className="skeleton h-3 w-full mb-1" />
            </div>
          ))}
        </div>
      ) : filteredDeadlines.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <Clock size={48} className="mx-auto mb-3 opacity-30" />
          <p>暂无期限记录</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDeadlines.map((d) => {
            const { days, percentage } = getCountdown(d.deadline_date);
            const barColor = getBarColor(days, d.status);
            const textColor = getTextColor(days, d.status);
            return (
              <div key={d.id} className="card">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-gray-400" />
                    <span className="font-medium text-judicial-primary text-sm">申请ID: {d.application_id}</span>
                    <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded">{DEADLINE_TYPE_LABELS[d.type]}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {(d.extended_days ?? 0) > 0 && (
                      <span className="text-xs text-blue-500 flex items-center gap-1">
                        <Calendar size={10} /> 含法定假日延期{d.extended_days}天
                      </span>
                    )}
                    <span className={cn('text-sm font-semibold', textColor)}>
                      {d.status === 'completed' ? '已完成' : days <= 0 ? '已过期' : `${days}天`}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${percentage}%` }} />
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    截止：{new Date(d.deadline_date).toLocaleDateString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
