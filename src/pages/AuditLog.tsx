import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { ROLE_LABELS, type AuditLog } from '@/shared/types';
import { ScrollText, Lock, ShieldCheck, User, Clock, FileText, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AuditLog() {
  const auditLogs = useAppStore((s) => s.auditLogs);
  const applications = useAppStore((s) => s.applications);
  const loading = useAppStore((s) => s.loading);
  const fetchAuditLogs = useAppStore((s) => s.fetchAuditLogs);
  const fetchApplications = useAppStore((s) => s.fetchApplications);

  const [selectedAppId, setSelectedAppId] = useState<string>('');

  useEffect(() => {
    fetchApplications();
  }, []);

  useEffect(() => {
    if (selectedAppId) fetchAuditLogs(selectedAppId);
  }, [selectedAppId]);

  const roleColorMap: Record<string, string> = {
    party: 'bg-blue-50 text-blue-700',
    reviewer: 'bg-indigo-50 text-indigo-700',
    scheduler: 'bg-purple-50 text-purple-700',
    supervisor: 'bg-amber-50 text-amber-700',
  };

  return (
    <div className="animate-fade-in">
      <h1 className="font-serif text-2xl font-semibold text-judicial-primary mb-6 flex items-center gap-2">
        <ScrollText size={24} />
        流程日志
      </h1>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">选择案件</label>
        <select
          value={selectedAppId}
          onChange={(e) => setSelectedAppId(e.target.value)}
          className="select-field max-w-md"
        >
          <option value="">请选择要查看的案件</option>
          {(applications || []).map((app) => (
            <option key={app.id} value={app.id}>{app.case_no} - {app.applicant_name}</option>
          ))}
        </select>
      </div>

      {!selectedAppId ? (
        <div className="card text-center py-12 text-gray-400">
          <ScrollText size={48} className="mx-auto mb-3 opacity-30" />
          <p>请选择案件查看流程日志</p>
        </div>
      ) : loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="skeleton w-3 h-3 rounded-full mt-1.5" />
              <div className="skeleton h-5 w-64 mb-1" />
              <div className="skeleton h-4 w-48" />
            </div>
          ))}
        </div>
      ) : (auditLogs || []).length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <FileText size={48} className="mx-auto mb-3 opacity-30" />
          <p>该案件暂无流程日志</p>
        </div>
      ) : (
        <div className="relative pl-8">
          <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-gray-200" />
          <div className="space-y-6">
            {(auditLogs || []).map((log, idx) => (
              <div key={log.id} className="relative animate-fade-in">
                <div
                  className={cn(
                    'absolute left-[-25px] top-1.5 w-3 h-3 rounded-full border-2 border-white',
                    log.is_immutable ? 'bg-judicial-gold' : 'bg-judicial-primary',
                  )}
                />

                <div className="card py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-gray-400" />
                      <span className="font-medium text-sm text-judicial-primary">{log.actor}</span>
                      <span className={cn('text-xs px-2 py-0.5 rounded', roleColorMap[log.actor_role] ?? 'bg-gray-50 text-gray-500')}>
                        {ROLE_LABELS[log.actor_role as keyof typeof ROLE_LABELS] ?? log.actor_role}
                      </span>
                      {log.is_immutable && (
                        <span className="flex items-center gap-1 text-xs text-judicial-gold bg-amber-50 px-2 py-0.5 rounded">
                          <Lock size={10} /> 不可篡改
                        </span>
                      )}
                      {log.material_sealed_transfer && (
                        <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                          <ShieldCheck size={10} /> 封存移交
                        </span>
                      )}
                      {log.electronic_sign_off && (
                        <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
                          <Eye size={10} /> 电子签章
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock size={10} />
                      {new Date(log.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-sm font-medium text-gray-700 mb-1">{log.action}</div>
                  <div className="text-sm text-gray-500">{log.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
