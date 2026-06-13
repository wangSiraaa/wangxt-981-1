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

export type WithdrawalStatus = 'pending' | 'approved' | 'rejected';

export const WITHDRAWAL_STATUS_LABELS: Record<WithdrawalStatus, string> = {
  pending: '待审批',
  approved: '已批准',
  rejected: '已驳回',
};

export interface Application {
  id: string;
  case_no: string;
  applicant_name: string;
  applicant_phone: string;
  appraisal_type: AppraisalType;
  status: ApplicationStatus;
  institution_id: string;
  institution_name?: string;
  correction_count: number;
  max_corrections: number;
  is_urgent?: boolean;
  urgent_reason?: string;
  created_at: string;
  updated_at: string;
  materials?: Material[];
  schedules?: Schedule[];
  fees?: Fee[];
  deadlines?: Deadline[];
  schedule?: Schedule;
  fee?: Fee;
  deadline?: Deadline;
  withdrawal_request?: WithdrawalRequest;
}

export interface Material {
  id: string;
  application_id: string;
  name: string;
  status: MaterialStatus;
  version: number;
  file_url?: string;
  sign_off_status?: string;
  sealed?: boolean;
  review_note?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface Schedule {
  id: string;
  application_id: string;
  expert_id: string;
  expert_name?: string;
  institution_id?: string;
  scheduled_date: string;
  scheduled_time: string;
  location: string;
  status: ScheduleStatus;
  is_urgent: boolean;
  urgent_reason?: string;
  reschedule_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Fee {
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

export interface Deadline {
  id: string;
  application_id: string;
  type: DeadlineType;
  base_date?: string;
  deadline_date: string;
  holiday_extended?: boolean;
  extended_days?: number;
  status: DeadlineStatus;
  created_at: string;
}

export interface WithdrawalRequest {
  id: string;
  application_id: string;
  reason: string;
  status: WithdrawalStatus;
  refund_required?: boolean;
  schedule_expired?: boolean;
  approver_note?: string;
  created_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  review_note?: string;
  scheduleExpiredWarning?: boolean;
  requestedAt?: string;
}

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

export interface Expert {
  id: string;
  name: string;
  qualification?: string;
  specialty?: AppraisalType;
  institution_id: string;
  institution_name?: string;
  availability?: boolean;
  conflict_case_nos?: string[];
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
