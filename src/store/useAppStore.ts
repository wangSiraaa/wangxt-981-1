import { create } from 'zustand';
import type {
  Application,
  AuditLog,
  Deadline,
  Expert,
  Fee,
  Institution,
  Role,
  Schedule,
  Toast,
  WithdrawalRequest,
} from '@/shared/types';
import { api } from '@/utils/api';

interface AppState {
  role: Role;
  applications: Application[];
  selectedApplication: Application | null;
  schedules: Schedule[];
  fees: Fee[];
  deadlines: Deadline[];
  auditLogs: AuditLog[];
  experts: Expert[];
  institutions: Institution[];
  withdrawals: WithdrawalRequest[];
  urgentApplications: Application[];
  stats: { totalApplications: number; pendingReviews: number; upcomingSchedules: number; activeWarnings: number } | null;
  loading: boolean;
  error: string | null;
  toasts: Toast[];
  sidebarCollapsed: boolean;

  setRole: (role: Role) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearError: () => void;

  fetchApplications: (status?: string) => Promise<void>;
  fetchApplicationById: (id: string) => Promise<void>;
  createApplication: (data: Record<string, unknown>) => Promise<boolean>;
  withdrawApplication: (id: string, reason: string, withdrawerName: string) => Promise<boolean>;
  acceptApplication: (id: string, institutionId: string, acceptorName: string) => Promise<boolean>;
  rejectApplication: (id: string, reason: string, reviewerName: string) => Promise<boolean>;
  correctMaterials: (id: string, materials: { name: string; file_url?: string }[], uploaderName: string) => Promise<boolean>;

  reviewApplication: (id: string, decision: 'approve' | 'reject', reviewNote: string, reviewerName: string) => Promise<boolean>;

  fetchSchedules: () => Promise<void>;
  createSchedule: (applicationId: string, data: Record<string, unknown>) => Promise<boolean>;
  reschedule: (id: string, data: Record<string, unknown>) => Promise<boolean>;
  checkConflict: (params: { expert_id?: string; institution_id?: string; date: string; time: string; location?: string }) => Promise<boolean | null>;

  fetchFees: () => Promise<void>;
  payFee: (appId: string, payerName: string) => Promise<boolean>;
  requestRefund: (appId: string, refundReason: string, approverName: string) => Promise<boolean>;

  fetchDeadlines: (params?: { application_id?: string; status?: string; type?: string }) => Promise<void>;

  fetchAuditLogs: (applicationId: string) => Promise<void>;

  fetchExperts: (params?: { institution_id?: string; qualification?: string }) => Promise<void>;
  fetchInstitutions: () => Promise<void>;

  fetchWithdrawals: () => Promise<void>;
  approveWithdrawal: (id: string, approverName: string, approverNote?: string) => Promise<boolean>;

  fetchUrgentApplications: (status?: string) => Promise<void>;
  approveUrgent: (id: string, approverName: string, approverNote?: string) => Promise<boolean>;

  fetchStats: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  role: 'party',
  applications: [],
  selectedApplication: null,
  schedules: [],
  fees: [],
  deadlines: [],
  auditLogs: [],
  experts: [],
  institutions: [],
  withdrawals: [],
  urgentApplications: [],
  stats: null,
  loading: false,
  error: null,
  toasts: [],
  sidebarCollapsed: false,

  setRole: (role) => set({ role }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  addToast: (toast) => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2);
    const newToast = { ...toast, id };
    set((s) => ({ toasts: [...s.toasts, newToast] }));
    const duration = toast.duration ?? 3000;
    setTimeout(() => get().removeToast(id), duration);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clearError: () => set({ error: null }),

  fetchApplications: async (status?: string) => {
    set({ loading: true, error: null });
    const res = await api.applications.list(status);
    if (res.success) set({ applications: res.data || [], loading: false });
    else set({ error: res.error ?? '获取申请列表失败', loading: false });
  },

  fetchApplicationById: async (id) => {
    set({ loading: true, error: null });
    const res = await api.applications.getById(id);
    if (res.success) set({ selectedApplication: res.data, loading: false });
    else set({ error: res.error ?? '获取申请详情失败', loading: false });
  },

  createApplication: async (data) => {
    set({ loading: true, error: null });
    const res = await api.applications.create(data);
    if (res.success) {
      get().addToast({ type: 'success', message: '申请提交成功' });
      set({ loading: false });
      return true;
    }
    get().addToast({ type: 'error', message: res.error ?? '提交失败' });
    set({ error: res.error ?? '提交失败', loading: false });
    return false;
  },

  withdrawApplication: async (id, reason, withdrawerName) => {
    set({ loading: true });
    const res = await api.applications.withdraw(id, reason, withdrawerName);
    if (res.success) {
      get().addToast({ type: 'success', message: '撤回申请已提交' });
      await get().fetchApplications();
      set({ loading: false });
      return true;
    }
    get().addToast({ type: 'error', message: res.error ?? '撤回失败' });
    set({ loading: false });
    return false;
  },

  acceptApplication: async (id, institutionId, acceptorName) => {
    set({ loading: true });
    const res = await api.applications.accept(id, { institution_id: institutionId, acceptor_name: acceptorName });
    if (res.success) {
      get().addToast({ type: 'success', message: '已受理' });
      await get().fetchApplications();
      set({ loading: false });
      return true;
    }
    get().addToast({ type: 'error', message: res.error ?? '受理失败' });
    set({ loading: false });
    return false;
  },

  rejectApplication: async (id, reason, reviewerName) => {
    set({ loading: true });
    const res = await api.applications.review(id, { decision: 'reject', review_note: reason, reviewer_name: reviewerName });
    if (res.success) {
      get().addToast({ type: 'success', message: '已驳回' });
      await get().fetchApplications();
      set({ loading: false });
      return true;
    }
    get().addToast({ type: 'error', message: res.error ?? '驳回失败' });
    set({ loading: false });
    return false;
  },

  correctMaterials: async (id, materials, uploaderName) => {
    set({ loading: true });
    const res = await api.applications.correct(id, materials, uploaderName);
    if (res.success) {
      get().addToast({ type: 'success', message: '补正材料已提交' });
      await get().fetchApplications();
      set({ loading: false });
      return true;
    }
    get().addToast({ type: 'error', message: res.error ?? '补正提交失败' });
    set({ loading: false });
    return false;
  },

  reviewApplication: async (id, decision, reviewNote, reviewerName) => {
    set({ loading: true });
    const res = await api.applications.review(id, { decision, review_note: reviewNote, reviewer_name: reviewerName });
    if (res.success) {
      get().addToast({ type: 'success', message: decision === 'approve' ? '审核通过' : '已退回补正' });
      await get().fetchApplications();
      set({ loading: false });
      return true;
    }
    get().addToast({ type: 'error', message: res.error ?? '审核失败' });
    set({ loading: false });
    return false;
  },

  fetchSchedules: async () => {
    set({ loading: true });
    const res = await api.schedules.list();
    if (res.success) set({ schedules: res.data || [], loading: false });
    else set({ error: res.error ?? '获取排期列表失败', loading: false });
  },

  createSchedule: async (applicationId, data) => {
    set({ loading: true });
    const res = await api.schedules.create(applicationId, data);
    if (res.success) {
      get().addToast({ type: 'success', message: '排期创建成功' });
      await get().fetchSchedules();
      set({ loading: false });
      return true;
    }
    get().addToast({ type: 'error', message: res.error ?? '创建排期失败' });
    set({ loading: false });
    return false;
  },

  reschedule: async (id, data) => {
    set({ loading: true });
    const res = await api.schedules.update(id, data);
    if (res.success) {
      get().addToast({ type: 'success', message: '改期成功' });
      await get().fetchSchedules();
      set({ loading: false });
      return true;
    }
    get().addToast({ type: 'error', message: res.error ?? '改期失败' });
    set({ loading: false });
    return false;
  },

  checkConflict: async (params) => {
    const res = await api.schedules.checkConflicts(params);
    if (res.success && res.data) return (res.data as any).has_conflicts ?? (res.data as any).hasConflict ?? false;
    return null;
  },

  fetchFees: async () => {
    set({ loading: true });
    const res = await api.fees.list();
    if (res.success) set({ fees: res.data || [], loading: false });
    else set({ error: res.error ?? '获取费用列表失败', loading: false });
  },

  payFee: async (appId, payerName) => {
    set({ loading: true });
    const res = await api.fees.pay(appId, payerName);
    if (res.success) {
      get().addToast({ type: 'success', message: '缴费成功' });
      await get().fetchFees();
      set({ loading: false });
      return true;
    }
    get().addToast({ type: 'error', message: res.error ?? '缴费失败' });
    set({ loading: false });
    return false;
  },

  requestRefund: async (appId, refundReason, approverName) => {
    set({ loading: true });
    const res = await api.fees.requestRefund(appId, refundReason, approverName);
    if (res.success) {
      get().addToast({ type: 'success', message: '退款申请已提交' });
      await get().fetchFees();
      set({ loading: false });
      return true;
    }
    get().addToast({ type: 'error', message: res.error ?? '退款申请失败' });
    set({ loading: false });
    return false;
  },

  fetchDeadlines: async (params) => {
    set({ loading: true });
    const res = await api.deadlines.list(params);
    if (res.success) set({ deadlines: res.data || [], loading: false });
    else set({ error: res.error ?? '获取期限列表失败', loading: false });
  },

  fetchAuditLogs: async (applicationId) => {
    set({ loading: true });
    const res = await api.auditLogs.list(applicationId);
    if (res.success) set({ auditLogs: res.data || [], loading: false });
    else set({ error: res.error ?? '获取审计日志失败', loading: false });
  },

  fetchExperts: async (params) => {
    set({ loading: true });
    const res = await api.experts.list(params);
    if (res.success) set({ experts: res.data || [], loading: false });
    else set({ error: res.error ?? '获取专家列表失败', loading: false });
  },

  fetchInstitutions: async () => {
    set({ loading: true });
    const res = await api.institutions.list();
    if (res.success) set({ institutions: res.data || [], loading: false });
    else set({ error: res.error ?? '获取机构列表失败', loading: false });
  },

  fetchWithdrawals: async () => {
    set({ loading: true });
    const res = await api.withdrawals.list();
    if (res.success) set({ withdrawals: res.data || [], loading: false });
    else set({ error: res.error ?? '获取撤回列表失败', loading: false });
  },

  approveWithdrawal: async (id, approverName, approverNote) => {
    set({ loading: true });
    const res = await api.withdrawals.approve(id, approverName, approverNote);
    if (res.success) {
      get().addToast({ type: 'success', message: '撤回已批准' });
      await get().fetchWithdrawals();
      set({ loading: false });
      return true;
    }
    get().addToast({ type: 'error', message: res.error ?? '审批失败' });
    set({ loading: false });
    return false;
  },

  fetchUrgentApplications: async (status) => {
    set({ loading: true });
    const res = await api.applications.list(status);
    if (res.success) {
      const urgentApps = (res.data || []).filter((a: any) => a.is_urgent || a.isUrgent);
      set({ urgentApplications: urgentApps, loading: false });
    } else {
      set({ error: res.error ?? '获取加急列表失败', loading: false });
    }
  },

  approveUrgent: async (id, approverName, approverNote) => {
    set({ loading: true });
    const res = await api.urgents.approve(id, approverName, approverNote);
    if (res.success) {
      get().addToast({ type: 'success', message: '加急已批准' });
      await get().fetchUrgentApplications();
      set({ loading: false });
      return true;
    }
    get().addToast({ type: 'error', message: res.error ?? '审批失败' });
    set({ loading: false });
    return false;
  },

  fetchStats: async () => {
    const res = await api.stats.get();
    if (res.success && res.data) {
      const d = res.data as any;
      set({
        stats: {
          totalApplications: d.total ?? d.totalApplications ?? 0,
          pendingReviews: d.pendingReview ?? d.pendingReviews ?? 0,
          upcomingSchedules: d.upcomingSchedules ?? 0,
          activeWarnings: d.activeWarnings ?? 0,
        },
      });
    }
  },
}));
