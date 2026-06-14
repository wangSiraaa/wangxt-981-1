export type Role = 'party' | 'reviewer' | 'scheduler' | 'supervisor';

export const ROLE_LABELS: Record<Role, string> = {
  party: '当事人',
  reviewer: '窗口人员',
  scheduler: '鉴定机构',
  supervisor: '主管人员',
};

export type AppraisalType =
  | '法医临床'
  | '法医病理'
  | '物证鉴定'
  | '文书鉴定'
  | '痕迹鉴定'
  | '声像资料';

export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'reviewing'
  | 'reviewed'
  | 'correction_needed'
  | 'under_review'
  | 'material_correction'
  | 'accepted'
  | 'fee_pending'
  | 'scheduled'
  | 'in_appraisal'
  | 'completed'
  | 'withdrawn'
  | 'rejected'
  | 'terminated';

export const APPLICATION_STATUS_LABELS: Record<string, string> = {
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
};

export type MaterialStatus = 'pending' | 'approved' | 'rejected' | 'corrected';

export const MATERIAL_STATUS_LABELS: Record<MaterialStatus, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已退回',
  corrected: '已补正',
};

export type ScheduleStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'rescheduled' | 'expired';

export const SCHEDULE_STATUS_LABELS: Record<ScheduleStatus, string> = {
  pending: '待确认',
  confirmed: '已确认',
  in_progress: '进行中',
  completed: '已完成',
  cancelled: '已取消',
  rescheduled: '已改期',
  expired: '已过期',
};

export type FeeStatus = 'unpaid' | 'paid' | 'refunding' | 'refunded' | 'overdue';

export const FEE_STATUS_LABELS: Record<FeeStatus, string> = {
  unpaid: '未缴费',
  paid: '已缴费',
  refunding: '退款中',
  refunded: '已退款',
  overdue: '已逾期',
};

export type DeadlineType = 'material_correction' | 'fee_payment' | 'appraisal' | 'resubmission' | 'review' | 'schedule' | 'completion';

export const DEADLINE_TYPE_LABELS: Record<string, string> = {
  material_correction: '补正材料',
  fee_payment: '费用缴纳',
  appraisal: '鉴定期限',
  resubmission: '重新提交',
  review: '审核期限',
  schedule: '排期期限',
  completion: '完成期限',
};

export type DeadlineStatus = 'active' | 'warning' | 'urgent' | 'expired' | 'completed';

export const DEADLINE_STATUS_LABELS: Record<DeadlineStatus, string> = {
  active: '正常',
  warning: '临近',
  urgent: '紧急',
  expired: '已过期',
  completed: '已完成',
};

export type TransactionType = 'payment' | 'refund' | 'adjustment' | 'discount' | 'compensation';

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  payment: '缴费',
  refund: '退款',
  adjustment: '调整',
  discount: '减免',
  compensation: '赔偿',
};

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

export const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
  pending: '处理中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
};

export type RefundStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'failed';

export const REFUND_STATUS_LABELS: Record<RefundStatus, string> = {
  pending: '待审批',
  approved: '已批准',
  rejected: '已驳回',
  completed: '已完成',
  failed: '失败',
};

export type InvalidationType = 'withdrawal' | 'reschedule' | 'rejection' | 'expired' | 'cancellation';

export const INVALIDATION_TYPE_LABELS: Record<InvalidationType, string> = {
  withdrawal: '申请撤回',
  reschedule: '改期',
  rejection: '驳回',
  expired: '过期',
  cancellation: '取消',
};

export type TransferType = 'submission' | 'return' | 'correction' | 'delivery' | 'return_corrected';

export const TRANSFER_TYPE_LABELS: Record<TransferType, string> = {
  submission: '提交',
  return: '退回',
  correction: '补正',
  delivery: '送达',
  return_corrected: '退回补正',
};

export type TransferStatus = 'in_transit' | 'received' | 'lost' | 'cancelled';

export const TRANSFER_STATUS_LABELS: Record<TransferStatus, string> = {
  in_transit: '流转中',
  received: '已签收',
  lost: '已丢失',
  cancelled: '已取消',
};

export type PlaceholderStatus = 'pending' | 'placed' | 'cancelled';

export const PLACEHOLDER_STATUS_LABELS: Record<PlaceholderStatus, string> = {
  pending: '待占位',
  placed: '已占位',
  cancelled: '已取消',
};

export type AdjustmentType = 'supplement' | 'holiday' | 'urgent' | 'reschedule' | 'withdrawal' | 'correction' | 'extension' | 'shorten';

export const ADJUSTMENT_TYPE_LABELS: Record<AdjustmentType, string> = {
  supplement: '材料补正',
  holiday: '节假日顺延',
  urgent: '加急审批',
  reschedule: '机构改期',
  withdrawal: '申请撤回',
  correction: '审核退回',
  extension: '期限延长',
  shorten: '期限缩短',
};

export type WarningLevel = 'normal' | 'warning' | 'urgent' | 'critical';

export const WARNING_LEVEL_LABELS: Record<WarningLevel, string> = {
  normal: '正常',
  warning: '预警',
  urgent: '紧急',
  critical: '严重',
};

export type BlockerType = 'material' | 'fee' | 'expert' | 'correction' | 'qualification';

export const BLOCKER_TYPE_LABELS: Record<BlockerType, string> = {
  material: '材料审核',
  fee: '费用缴纳',
  expert: '专家回避',
  correction: '补正次数',
  qualification: '资质匹配',
};

export type WithdrawalStatus = 'pending' | 'approved' | 'rejected';

export const WITHDRAWAL_STATUS_LABELS: Record<WithdrawalStatus, string> = {
  pending: '待审批',
  approved: '已批准',
  rejected: '已驳回',
};

export interface AuditLog {
  id: string;
  application_id: string;
  actor: string;
  actor_role: Role;
  action: string;
  detail: string;
  is_immutable?: boolean;
  material_sealed_transfer?: boolean;
  electronic_sign_off?: boolean;
  created_at: string;
}

export interface Institution {
  id: string;
  name: string;
  appraisal_types?: AppraisalType[];
  max_capacity?: number;
  current_load?: number;
  available_capacity?: number;
  address?: string;
  phone?: string;
}

export interface ExpertConflict {
  expert_id: string;
  expert_name: string;
  date: string;
  time_slot: string;
  existing_application_id: string;
  existing_case_no: string;
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
  type: 'national' | 'regional';
}

export interface ConflictResult {
  has_conflicts?: boolean;
  hasConflict?: boolean;
  conflicts?: ExpertConflict[];
  suggestions?: { date: string; timeSlot: string }[];
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

export const APPLICATION_STEPS = [
  { key: 'submitted', label: '提交' },
  { key: 'under_review', label: '审核' },
  { key: 'accepted', label: '受理' },
  { key: 'fee_pending', label: '缴费' },
  { key: 'scheduled', label: '排期' },
  { key: 'in_appraisal', label: '鉴定' },
  { key: 'completed', label: '完成' },
] as const;

export type ApplicationStep = (typeof APPLICATION_STEPS)[number]['key'];

export interface FeeTransaction {
  id: string;
  fee_id: string;
  application_id: string;
  transaction_type: TransactionType;
  amount: number;
  payment_method?: string;
  transaction_no?: string;
  status: TransactionStatus;
  operator_name: string;
  operator_role: string;
  remark?: string;
  supervisor_approval: boolean;
  supervisor_name?: string;
  supervisor_approval_note?: string;
  supervisor_approved_at?: string;
  created_at: string;
}

export interface ScheduleInvalidation {
  id: string;
  schedule_id: string;
  application_id: string;
  invalidation_type: InvalidationType;
  reason: string;
  operator_name: string;
  operator_role: string;
  supervisor_approval: boolean;
  supervisor_name?: string;
  supervisor_approval_note?: string;
  supervisor_approved_at?: string;
  created_at: string;
  case_no?: string;
  applicant_name?: string;
  schedule_date?: string;
  start_time?: string;
  expert_name?: string;
}

export interface MaterialTransfer {
  id: string;
  material_id: string;
  application_id: string;
  transfer_type: TransferType;
  from_party: string;
  from_party_role: string;
  to_party: string;
  to_party_role: string;
  sealed: boolean;
  seal_time?: string;
  seal_operator?: string;
  electronic_sign: boolean;
  sign_time?: string;
  sign_operator?: string;
  placeholder_status: PlaceholderStatus;
  transfer_status: TransferStatus;
  received_at?: string;
  remark?: string;
  created_at: string;
  case_no?: string;
  applicant_name?: string;
  material_name?: string;
  material_type?: string;
}

export interface DeadlineAdjustment {
  id: string;
  deadline_id: string;
  application_id: string;
  adjustment_type: AdjustmentType;
  original_deadline: string;
  new_deadline: string;
  extended_days: number;
  reason: string;
  operator_name: string;
  operator_role: string;
  supervisor_approval: boolean;
  supervisor_name?: string;
  supervisor_approval_note?: string;
  supervisor_approved_at?: string;
  created_at: string;
  case_no?: string;
  applicant_name?: string;
  deadline_type?: string;
  original_deadline_date?: string;
}

export interface ExpertQualification {
  id: string;
  expert_id: string;
  qualification_type: string;
  qualification_code?: string;
  valid_from: string;
  valid_to?: string;
  issuing_authority?: string;
  status: 'active' | 'expired' | 'suspended';
  created_at: string;
}

export interface StatusChangeLog {
  id: string;
  application_id: string;
  old_status?: string;
  new_status?: string;
  actor: string;
  actor_role: string;
  reason: string;
  created_at: string;
  case_no?: string;
  applicant_name?: string;
}

export interface ScheduleBlocker {
  blocker_type: BlockerType;
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ScheduleBlockerResult {
  can_schedule: boolean;
  blockers: ScheduleBlocker[];
  blocker_count: number;
}

export interface Fee extends FeeBase {
  refund_status?: RefundStatus;
  refund_approved?: boolean;
  refund_approver?: string;
  refund_approved_at?: string;
  refund_approval_note?: string;
  payment_method?: string;
  transaction_no?: string;
}

interface FeeBase {
  id: string;
  application_id: string;
  amount: number;
  status: FeeStatus;
  invoice_no?: string;
  paid_at?: string;
  refund_amount?: number;
  refund_reason?: string;
  created_at: string;
}

export interface Application {
  id: string;
  case_no: string;
  applicant_name: string;
  applicant_phone: string;
  appraisal_type: AppraisalType;
  status: ApplicationStatus;
  last_status?: string;
  institution_id: string;
  institution_name?: string;
  correction_count: number;
  max_corrections: number;
  is_urgent?: boolean;
  urgent_reason?: string;
  urgent_approved?: boolean;
  urgent_approver?: string;
  created_at: string;
  updated_at: string;
  accepted_at?: string;
  materials?: Material[];
  schedules?: Schedule[];
  fees?: Fee[];
  deadlines?: Deadline[];
  schedule?: Schedule;
  fee?: Fee;
  deadline?: Deadline;
  withdrawal_request?: WithdrawalRequest;
  fee_transactions?: FeeTransaction[];
  schedule_invalidations?: ScheduleInvalidation[];
  material_transfers?: MaterialTransfer[];
  deadline_adjustments?: DeadlineAdjustment[];
  status_history?: StatusChangeLog[];
}

export interface WithdrawalRequest {
  id: string;
  application_id: string;
  reason: string;
  status: WithdrawalStatus;
  refund_required?: boolean;
  schedule_expired?: boolean;
  approver_note?: string;
  supervisor_approved?: boolean;
  supervisor_name?: string;
  supervisor_approved_at?: string;
  refund_processed?: boolean;
  schedule_invalidated?: boolean;
  created_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  review_note?: string;
  scheduleExpiredWarning?: boolean;
  requestedAt?: string;
}

export interface Deadline {
  id: string;
  application_id: string;
  deadline_type: DeadlineType;
  base_date?: string;
  deadline_date: string;
  holiday_extended?: boolean;
  extended_days?: number;
  status: DeadlineStatus;
  warning_level?: WarningLevel;
  remaining_days?: number;
  adjustment_reason?: string;
  created_at: string;
}

export interface Expert {
  id: string;
  name: string;
  qualification?: string;
  specialty?: AppraisalType;
  institution_id: string;
  institution_name?: string;
  availability?: boolean;
  conflict_case_nos?: string[];
  is_recusal?: boolean;
  recusal_reason?: string;
  qualifications?: ExpertQualification[];
}

export interface Material {
  id: string;
  application_id: string;
  name: string;
  material_name?: string;
  material_type?: string;
  status: MaterialStatus;
  version: number;
  file_url?: string;
  sign_off_status?: string;
  sealed?: boolean;
  review_note?: string;
  rejection_reason?: string;
  transfer_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Schedule {
  id: string;
  application_id: string;
  expert_id: string;
  expert_name?: string;
  institution_id?: string;
  schedule_date?: string;
  schedule_time?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  start_time?: string;
  end_time?: string;
  location: string;
  status: ScheduleStatus;
  is_urgent: boolean;
  urgent_reason?: string;
  reschedule_count?: number;
  invalidation_id?: string;
  created_at: string;
  updated_at: string;
}

