import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import type { Application } from '@/shared/types';
import { StatusBadge } from '@/components/StatusBadge';
import { ClipboardCheck, CheckCircle, XCircle, FileText, AlertTriangle, History } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Review() {
  const applications = useAppStore((s) => s.applications);
  const selectedApplication = useAppStore((s) => s.selectedApplication);
  const loading = useAppStore((s) => s.loading);
  const fetchApplications = useAppStore((s) => s.fetchApplications);
  const fetchApplicationById = useAppStore((s) => s.fetchApplicationById);
  const reviewApplication = useAppStore((s) => s.reviewApplication);
  const acceptApplication = useAppStore((s) => s.acceptApplication);
  const institutions = useAppStore((s) => s.institutions);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectingMaterialId, setRejectingMaterialId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [reviewerName] = useState('审核员');

  useEffect(() => {
    fetchApplications();
  }, []);

  useEffect(() => {
    if (selectedId) fetchApplicationById(selectedId);
  }, [selectedId]);

  const pendingApps = applications.filter(
    (a) => a.status === 'submitted' || a.status === 'reviewing' || a.status === 'correction_needed' || a.status === 'material_correction' || a.status === 'under_review' || a.status === 'fee_pending'
  );

  const handleApprove = async () => {
    if (!selectedId) return;
    await reviewApplication(selectedId, 'approve', '审核通过', reviewerName);
    if (selectedId) fetchApplicationById(selectedId);
  };

  const handleReject = async () => {
    if (!selectedId || !rejectReason.trim()) return;
    await reviewApplication(selectedId, 'reject', rejectReason, reviewerName);
    setRejectingMaterialId(null);
    setRejectReason('');
    if (selectedId) fetchApplicationById(selectedId);
  };

  const handleAccept = async () => {
    if (!selectedApplication) return;
    const instId = selectedApplication.institution_id || (institutions[0]?.id ?? '');
    await acceptApplication(selectedApplication.id, instId, reviewerName);
  };

  const allMaterialsApproved = selectedApplication?.materials?.every((m) => m.status === 'approved');

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)] animate-fade-in">
      <div className="w-80 flex-shrink-0 flex flex-col">
        <h2 className="font-serif text-lg font-semibold text-judicial-primary mb-4 flex items-center gap-2">
          <ClipboardCheck size={20} />
          待审核案件
          <span className="text-sm font-normal text-gray-400">({pendingApps.length})</span>
        </h2>
        <div className="flex-1 overflow-auto space-y-2">
          {pendingApps.map((app) => (
            <div
              key={app.id}
              onClick={() => setSelectedId(app.id)}
              className={cn(
                'card cursor-pointer transition-all py-4',
                selectedId === app.id ? 'ring-2 ring-judicial-primary border-judicial-primary' : 'hover:border-judicial-primary/30',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-judicial-primary">{app.case_no}</span>
                <StatusBadge status={app.status} />
              </div>
              <div className="text-xs text-gray-500 mt-1">{app.applicant_name} · {app.appraisal_type}</div>
              {app.correction_count > 0 && (
                <div className="flex items-center gap-1 mt-1">
                  <AlertTriangle size={12} className={cn(app.correction_count >= app.max_corrections - 1 ? 'text-judicial-danger' : 'text-judicial-warning')} />
                  <span className={cn('text-xs', app.correction_count >= app.max_corrections - 1 ? 'text-judicial-danger' : 'text-judicial-warning')}>
                    已补正 {app.correction_count}/{app.max_corrections} 次
                  </span>
                </div>
              )}
            </div>
          ))}
          {pendingApps.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">暂无待审核案件</div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {selectedApplication ? (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-lg font-semibold text-judicial-primary">{selectedApplication.case_no}</h3>
              <div className="flex items-center gap-2">
                {selectedApplication.correction_count > 0 && (
                  <span className="text-xs text-judicial-warning bg-amber-50 px-2 py-1 rounded">
                    补正次数 {selectedApplication.correction_count}/{selectedApplication.max_corrections}
                  </span>
                )}
                {selectedApplication.correction_count >= selectedApplication.max_corrections - 1 && (
                  <span className="text-xs text-judicial-danger bg-red-50 px-2 py-1 rounded animate-shake">
                    即将达到补正上限！
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-sm mb-6">
              <div><span className="text-gray-500">申请人：</span>{selectedApplication.applicant_name}</div>
              <div><span className="text-gray-500">鉴定类型：</span>{selectedApplication.appraisal_type}</div>
              <div><span className="text-gray-500">联系电话：</span>{selectedApplication.applicant_phone}</div>
            </div>

            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <FileText size={16} />
              材料清单
            </h4>

            <div className="space-y-2">
              {(selectedApplication.materials || []).map((material) => (
                <div key={material.id} className="border border-gray-100 rounded-judicial p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-gray-400" />
                      <span className="text-sm font-medium">{material.name}</span>
                      <StatusBadge status={material.status} />
                      {material.version > 1 && (
                        <span className="text-xs text-gray-400">v{material.version}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {material.sign_off_status && (
                        <span className="text-xs text-blue-500">已签署</span>
                      )}
                      {material.sealed && (
                        <span className="text-xs text-green-600">已盖章</span>
                      )}
                    </div>
                  </div>

                  {material.review_note && (
                    <div className="mt-2 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
                      审核意见：{material.review_note}
                    </div>
                  )}
                </div>
              ))}
              {(!selectedApplication.materials || selectedApplication.materials.length === 0) && (
                <div className="text-sm text-gray-400 text-center py-4">暂无材料</div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end gap-3">
              {(selectedApplication.status === 'submitted' || selectedApplication.status === 'reviewing' || selectedApplication.status === 'correction_needed') && (
                <>
                  <button
                    onClick={handleApprove}
                    disabled={loading}
                    className="btn-primary flex items-center gap-2"
                  >
                    <CheckCircle size={16} />
                    {loading ? '审核中...' : '审核通过'}
                  </button>
                  <button
                    onClick={() => setRejectingMaterialId('all')}
                    disabled={loading}
                    className="btn-danger flex items-center gap-2"
                  >
                    <XCircle size={16} />
                    退回补正
                  </button>
                </>
              )}
              {selectedApplication.status === 'reviewed' && (
                <button
                  onClick={handleAccept}
                  disabled={loading}
                  className="btn-primary flex items-center gap-2"
                >
                  <CheckCircle size={16} />
                  {loading ? '受理中...' : '受理通过'}
                </button>
              )}
            </div>

            {rejectingMaterialId && (
              <div className="mt-3 p-3 bg-red-50/30 rounded-judicial animate-fade-in">
                <label className="block text-xs font-medium text-gray-600 mb-1">补正说明</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="input-field min-h-[60px] resize-none text-xs"
                  placeholder="请输入退回/补正说明"
                />
                <div className="flex gap-2 mt-2">
                  <button onClick={handleReject} disabled={!rejectReason.trim()} className="btn-danger text-xs px-3 py-1.5">
                    确认退回
                  </button>
                  <button onClick={() => { setRejectingMaterialId(null); setRejectReason(''); }} className="btn-outline text-xs px-3 py-1.5">
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="card text-center py-20 text-gray-400">
            <ClipboardCheck size={48} className="mx-auto mb-3 opacity-30" />
            <p>请从左侧选择待审核案件</p>
          </div>
        )}
      </div>
    </div>
  );
}
