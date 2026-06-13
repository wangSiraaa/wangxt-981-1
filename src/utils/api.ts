import type {
  ApiResponse,
  Application,
  AuditLog,
  ConflictResult,
  Deadline,
  Expert,
  Fee,
  Institution,
  Schedule,
  WithdrawalRequest,
} from '@/shared/types';

async function request<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const body = await res.json();
    if (!res.ok) {
      return { success: false, data: null as T, error: body.error || `HTTP ${res.status}` };
    }
    return { success: body.success !== false, data: body.data as T, error: body.error };
  } catch (err) {
    return { success: false, data: null as T, error: (err as Error).message };
  }
}

function post<T>(url: string, body?: unknown) {
  return request<T>(url, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
}

function put<T>(url: string, body?: unknown) {
  return request<T>(url, { method: 'PUT', body: body ? JSON.stringify(body) : undefined });
}

function del<T>(url: string) {
  return request<T>(url, { method: 'DELETE' });
}

export const api = {
  applications: {
    list: (status?: string) => request<Application[]>(`/api/applications${status ? `?status=${status}` : ''}`),
    getById: (id: string) => request<Application>(`/api/applications/${id}`),
    create: (data: Record<string, unknown>) => post<Application>('/api/applications', data),
    update: (id: string, data: Record<string, unknown>) => put<Application>(`/api/applications/${id}`, data),
    review: (id: string, data: { decision: 'approve' | 'reject'; review_note: string; reviewer_name: string }) =>
      put<Application>(`/api/applications/${id}/review`, data),
    accept: (id: string, data: { institution_id: string; acceptor_name: string }) =>
      put<Application>(`/api/applications/${id}/accept`, data),
    withdraw: (id: string, reason: string, withdrawer_name: string) =>
      post<WithdrawalRequest>(`/api/applications/${id}/withdraw`, { reason, withdrawer_name }),
    correct: (id: string, materials: { name: string; file_url?: string }[], uploader_name: string) =>
      post<Application>(`/api/applications/${id}/materials`, { materials, uploader_name }),
    urgent: (id: string, urgent_reason: string, requester_name: string) =>
      post<Application>(`/api/applications/${id}/urgent`, { urgent_reason, requester_name }),
  },

  materials: {
    sign: (materialId: string, signer_name: string) =>
      put<Application>(`/api/applications/materials/${materialId}/sign`, { signer_name }),
    seal: (materialId: string, sealer_name: string) =>
      put<Application>(`/api/applications/materials/${materialId}/seal`, { sealer_name }),
  },

  schedules: {
    list: () => request<Schedule[]>('/api/applications/schedules'),
    listUrgents: () => request<Schedule[]>('/api/applications/schedules/urgents'),
    create: (applicationId: string, data: Record<string, unknown>) =>
      post<Schedule>(`/api/applications/${applicationId}/schedule`, data),
    update: (id: string, data: Record<string, unknown>) =>
      put<Schedule>(`/api/applications/schedules/${id}`, data),
    checkConflicts: (params: { expert_id?: string; institution_id?: string; date: string; time: string; location?: string }) => {
      const qs = new URLSearchParams();
      if (params.expert_id) qs.set('expert_id', params.expert_id);
      if (params.institution_id) qs.set('institution_id', params.institution_id);
      qs.set('date', params.date);
      qs.set('time', params.time);
      if (params.location) qs.set('location', params.location);
      return request<ConflictResult>(`/api/applications/schedules/conflicts?${qs.toString()}`);
    },
  },

  fees: {
    list: () => request<Fee[]>('/api/fees'),
    pay: (appId: string, payer_name: string) =>
      post<Fee>(`/api/fees/${appId}/pay`, { payer_name }),
    requestRefund: (appId: string, refund_reason: string, approver_name: string) =>
      post<Fee>(`/api/fees/${appId}/refund`, { refund_reason, approver_name }),
    invoice: (appId: string) =>
      request<Fee>(`/api/fees/${appId}/invoice`),
  },

  deadlines: {
    list: (params?: { application_id?: string; status?: string; type?: string }) => {
      const qs = new URLSearchParams();
      if (params?.application_id) qs.set('application_id', params.application_id);
      if (params?.status) qs.set('status', params.status);
      if (params?.type) qs.set('type', params.type);
      const query = qs.toString();
      return request<Deadline[]>(`/api/deadlines${query ? `?${query}` : ''}`);
    },
    warnings: () => request<Deadline[]>('/api/deadlines/warnings'),
  },

  experts: {
    list: (params?: { institution_id?: string; qualification?: string }) => {
      const qs = new URLSearchParams();
      if (params?.institution_id) qs.set('institution_id', params.institution_id);
      if (params?.qualification) qs.set('qualification', params.qualification);
      const query = qs.toString();
      return request<Expert[]>(`/api/experts${query ? `?${query}` : ''}`);
    },
    conflicts: (caseNo: string, expertId?: string) => {
      const qs = new URLSearchParams();
      qs.set('case_no', caseNo);
      if (expertId) qs.set('expert_id', expertId);
      return request<ConflictResult>(`/api/experts/conflicts?${qs.toString()}`);
    },
  },

  institutions: {
    list: () => request<Institution[]>('/api/institutions'),
  },

  withdrawals: {
    list: () => request<WithdrawalRequest[]>('/api/applications/withdrawals'),
    approve: (id: string, approver_name: string, approver_note?: string) =>
      put<WithdrawalRequest>(`/api/applications/withdrawals/${id}/approve`, { approver_name, approver_note }),
  },

  urgents: {
    approve: (id: string, approver_name: string, approver_note?: string) =>
      put<Application>(`/api/applications/urgents/${id}/approve`, { approver_name, approver_note }),
  },

  auditLogs: {
    list: (applicationId: string) => request<AuditLog[]>(`/api/audit-logs?application_id=${applicationId}`),
  },

  stats: {
    get: () => request<{ total: number; pendingReview: number; upcomingSchedules: number; activeWarnings: number }>('/api/stats'),
  },
};
