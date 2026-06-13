import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { StatusBadge } from '@/components/StatusBadge';
import { CreditCard, Download, AlertTriangle, FileText, RefreshCw, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Fees() {
  const fees = useAppStore((s) => s.fees);
  const loading = useAppStore((s) => s.loading);
  const fetchFees = useAppStore((s) => s.fetchFees);
  const payFee = useAppStore((s) => s.payFee);
  const requestRefund = useAppStore((s) => s.requestRefund);
  const navigate = useNavigate();

  const [refundFeeId, setRefundFeeId] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState('');

  useEffect(() => {
    fetchFees();
  }, []);

  const unpaidCount = fees.filter((f) => f.status === 'unpaid' || f.status === 'overdue').length;
  const hasUnpaid = unpaidCount > 0;

  const handlePay = async (fee: { id: string; application_id: string }) => {
    await payFee(fee.application_id, '缴费人');
  };

  const handleRefund = async (fee: { application_id: string }) => {
    if (!refundReason.trim()) return;
    await requestRefund(fee.application_id, refundReason, '审批人');
    setRefundFeeId(null);
    setRefundReason('');
  };

  return (
    <div className="animate-fade-in">
      <h1 className="font-serif text-2xl font-semibold text-judicial-primary mb-6 flex items-center gap-2">
        <CreditCard size={24} />
        费用管理
      </h1>

      {hasUnpaid && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-judicial flex items-center gap-3 animate-shake">
          <AlertTriangle size={20} className="text-judicial-warning flex-shrink-0" />
          <div>
            <span className="font-medium text-amber-800">您有 {unpaidCount} 笔未缴纳费用</span>
            <p className="text-sm text-amber-600">请尽快完成缴费，逾期将影响鉴定进度</p>
          </div>
        </div>
      )}

      {loading && fees.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card">
              <div className="skeleton h-5 w-48 mb-2" />
              <div className="skeleton h-4 w-32" />
            </div>
          ))}
        </div>
      ) : fees.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <CreditCard size={48} className="mx-auto mb-3 opacity-30" />
          <p>暂无费用记录</p>
        </div>
      ) : (
        <div className="space-y-3">
          {fees.map((fee) => (
            <div key={fee.id} className="card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Receipt size={18} className="text-judicial-gold" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-judicial-primary">申请ID: {fee.application_id}</span>
                      <StatusBadge status={fee.status} />
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      创建时间：{new Date(fee.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-serif text-lg font-semibold text-judicial-primary">
                    ¥{(fee.amount || 0).toLocaleString()}
                  </div>
                </div>
              </div>

              {fee.paid_at && (
                <div className="text-xs text-gray-400 mt-1">缴费时间：{new Date(fee.paid_at).toLocaleString()}</div>
              )}

              {fee.invoice_no && (
                <div className="text-xs text-gray-400 mt-1">发票号：{fee.invoice_no}</div>
              )}

              {fee.refund_reason && (
                <div className="mt-2 text-xs text-blue-600 bg-blue-50/50 px-2 py-1 rounded">
                  退款原因：{fee.refund_reason}
                </div>
              )}

              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50">
                {(fee.status === 'unpaid' || fee.status === 'overdue') && (
                  <button onClick={() => handlePay(fee)} disabled={loading} className="btn-gold text-sm flex items-center gap-1">
                    <CreditCard size={14} /> 立即缴费
                  </button>
                )}
                {fee.status === 'paid' && fee.invoice_no && (
                  <button className="btn-outline text-sm flex items-center gap-1">
                    <Download size={14} /> 下载发票
                  </button>
                )}
                {fee.status === 'paid' && (
                  <button onClick={() => setRefundFeeId(fee.id)} className="text-sm text-gray-400 hover:text-judicial-primary flex items-center gap-1">
                    <RefreshCw size={14} /> 申请退款
                  </button>
                )}
              </div>

              {refundFeeId === fee.id && (
                <div className="mt-3 p-3 bg-blue-50/30 rounded-judicial animate-fade-in">
                  <label className="block text-sm text-gray-600 mb-1">退款原因</label>
                  <textarea
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    className="input-field min-h-[60px] resize-none text-sm"
                    placeholder="请输入退款原因"
                  />
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => handleRefund(fee)} disabled={!refundReason.trim()} className="btn-primary text-sm">
                      提交退款申请
                    </button>
                    <button onClick={() => { setRefundFeeId(null); setRefundReason(''); }} className="btn-outline text-sm">
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
