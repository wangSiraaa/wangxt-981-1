import { cn } from '@/lib/utils';
import type {
  ApplicationStatus,
  DeadlineStatus,
  FeeStatus,
  MaterialStatus,
  ScheduleStatus,
  WithdrawalStatus,
  APPLICATION_STATUS_LABELS,
  MATERIAL_STATUS_LABELS,
  SCHEDULE_STATUS_LABELS,
  FEE_STATUS_LABELS,
  DEADLINE_STATUS_LABELS,
  WITHDRAWAL_STATUS_LABELS,
} from '@/shared/types';

type StatusType =
  | ApplicationStatus
  | MaterialStatus
  | ScheduleStatus
  | FeeStatus
  | DeadlineStatus
  | WithdrawalStatus;

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  submitted: 'bg-blue-50 text-blue-700',
  reviewing: 'bg-indigo-50 text-indigo-700',
  reviewed: 'bg-teal-50 text-teal-700',
  correction_needed: 'bg-amber-50 text-amber-700',
  under_review: 'bg-indigo-50 text-indigo-700',
  material_correction: 'bg-amber-50 text-amber-700',
  accepted: 'bg-teal-50 text-teal-700',
  fee_pending: 'bg-orange-50 text-orange-700',
  scheduled: 'bg-cyan-50 text-cyan-700',
  in_appraisal: 'bg-purple-50 text-purple-700',
  completed: 'bg-green-50 text-green-700',
  withdrawn: 'bg-gray-100 text-gray-500',
  rejected: 'bg-red-50 text-red-700',
  terminated: 'bg-gray-200 text-gray-700',

  pending: 'bg-gray-100 text-gray-600',
  approved: 'bg-green-50 text-green-700',
  corrected: 'bg-blue-50 text-blue-700',

  confirmed: 'bg-green-50 text-green-700',
  in_progress: 'bg-purple-50 text-purple-700',
  cancelled: 'bg-gray-100 text-gray-500',
  rescheduled: 'bg-amber-50 text-amber-700',
  expired: 'bg-red-100 text-red-800',

  unpaid: 'bg-orange-50 text-orange-700',
  paid: 'bg-green-50 text-green-700',
  refunding: 'bg-blue-50 text-blue-700',
  refunded: 'bg-gray-100 text-gray-500',
  overdue: 'bg-red-50 text-red-700',

  active: 'bg-green-50 text-green-700',
  warning: 'bg-orange-50 text-orange-700',
  urgent: 'bg-red-50 text-red-700',
  urgent_app: 'bg-red-50 text-red-700',
};

const LABEL_MAP: Record<string, string> = {
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
  pending: '待审核',
  approved: '已通过',
  corrected: '已补正',
  confirmed: '已确认',
  in_progress: '进行中',
  cancelled: '已取消',
  rescheduled: '已改期',
  expired: '已过期',
  unpaid: '未缴费',
  paid: '已缴费',
  refunding: '退款中',
  refunded: '已退款',
  overdue: '已逾期',
  active: '正常',
  warning: '临近',
  urgent: '紧急',
  urgent_app: '加急',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
  pulse?: boolean;
}

export function StatusBadge({ status, className, pulse }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600';
  const label = LABEL_MAP[status] ?? status;

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap',
        style,
        pulse && 'animate-pulse-conflict',
        className,
      )}
    >
      {label}
    </span>
  );
}
