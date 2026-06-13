import { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import type { Schedule } from '@/shared/types';
import { StatusBadge } from '@/components/StatusBadge';
import {
  Calendar, Plus, Users, AlertTriangle, MapPin, Clock, Zap, RefreshCw, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const TIME_SLOTS = ['09:00-10:00', '10:00-11:00', '11:00-12:00', '14:00-15:00', '15:00-16:00', '16:00-17:00'];

function getWeekDays(baseDate: Date): Date[] {
  const day = baseDate.getDay();
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - (day === 0 ? 6 : day - 1));
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

const WEEKDAY_NAMES = ['周一', '周二', '周三', '周四', '周五'];

export default function Schedule() {
  const schedules = useAppStore((s) => s.schedules);
  const experts = useAppStore((s) => s.experts);
  const institutions = useAppStore((s) => s.institutions);
  const applications = useAppStore((s) => s.applications);
  const loading = useAppStore((s) => s.loading);
  const fetchSchedules = useAppStore((s) => s.fetchSchedules);
  const fetchExperts = useAppStore((s) => s.fetchExperts);
  const fetchInstitutions = useAppStore((s) => s.fetchInstitutions);
  const fetchApplications = useAppStore((s) => s.fetchApplications);
  const createSchedule = useAppStore((s) => s.createSchedule);
  const reschedule = useAppStore((s) => s.reschedule);
  const checkConflict = useAppStore((s) => s.checkConflict);

  const [weekOffset, setWeekOffset] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    expertId: '',
    institutionId: '',
    applicationId: '',
    date: '',
    timeSlot: '',
    location: '',
    isUrgent: false,
    urgentReason: '',
  });
  const [conflictResult, setConflictResult] = useState<boolean | null>(null);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);

  useEffect(() => {
    fetchSchedules();
    fetchExperts();
    fetchInstitutions();
    fetchApplications();
  }, []);

  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() + weekOffset * 7);
  const weekDays = getWeekDays(baseDate);

  const handleCheckConflict = async () => {
    if (!form.expertId || !form.institutionId || !form.date || !form.timeSlot) return;
    const [startTime] = form.timeSlot.split('-');
    const result = await checkConflict({
      expert_id: form.expertId,
      institution_id: form.institutionId,
      date: form.date,
      time: startTime,
      location: form.location || undefined,
    });
    setConflictResult(result);
  };

  const handleCreate = async () => {
    const [startTime] = form.timeSlot.split('-');
    const data: Record<string, unknown> = {
      expert_id: form.expertId,
      institution_id: form.institutionId,
      scheduled_date: form.date,
      scheduled_time: startTime,
      location: form.location,
      creator_name: '排程员',
      is_urgent: form.isUrgent,
      urgent_reason: form.isUrgent ? form.urgentReason : '',
    };
    const ok = await createSchedule(form.applicationId, data);
    if (ok) {
      setShowForm(false);
      setForm({ expertId: '', institutionId: '', applicationId: '', date: '', timeSlot: '', location: '', isUrgent: false, urgentReason: '' });
      setConflictResult(null);
      fetchApplications();
    }
  };

  const handleReschedule = async (scheduleId: string) => {
    const [startTime] = form.timeSlot.split('-');
    const ok = await reschedule(scheduleId, {
      scheduled_date: form.date,
      scheduled_time: startTime,
      location: form.location,
      rescheduler_name: '排程员',
    });
    if (ok) {
      setRescheduleId(null);
    }
  };

  const getSchedulesForSlot = (date: Date, timeSlot: string) => {
    const dateStr = date.toISOString().split('T')[0];
    const [startTime] = timeSlot.split('-');
    return schedules.filter((s) => s.scheduled_date === dateStr && s.scheduled_time === startTime);
  };

  const institutionCapacity = useMemo(() => {
    const total = schedules.length;
    const max = 30;
    return { current: total, max, percentage: Math.min(100, Math.round((total / max) * 100)) };
  }, [schedules]);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl font-semibold text-judicial-primary flex items-center gap-2">
          <Calendar size={24} />
          排期管理
        </h1>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> 新建排期
        </button>
      </div>

      {showForm && (
        <div className="card mb-6 border-judicial-primary/20 animate-fade-in">
          <h3 className="font-medium text-judicial-primary mb-4">{rescheduleId ? '改期排期' : '新建排期'}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">鉴定机构 *</label>
              <select
                value={form.institutionId}
                onChange={(e) => {
                  setForm({ ...form, institutionId: e.target.value, expertId: '' });
                  setConflictResult(null);
                  fetchExperts();
                }}
                className="select-field"
                disabled={!!rescheduleId}
              >
                <option value="">请选择机构</option>
                {institutions.map((inst) => (
                  <option key={inst.id} value={inst.id}>{inst.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">鉴定专家 *</label>
              <select
                value={form.expertId}
                onChange={(e) => { setForm({ ...form, expertId: e.target.value }); setConflictResult(null); }}
                className="select-field"
                disabled={!form.institutionId && !rescheduleId}
              >
                <option value="">请选择专家</option>
                {experts
                  .filter((ex) => !form.institutionId || ex.institution_id === form.institutionId)
                  .map((ex) => (
                  <option key={ex.id} value={ex.id}>{ex.name} - {ex.qualification || ex.specialty || ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">申请案件 *</label>
              <select
                value={form.applicationId}
                onChange={(e) => setForm({ ...form, applicationId: e.target.value })}
                className="select-field"
                disabled={!!rescheduleId}
              >
                <option value="">请选择待排期案件</option>
                {applications
                  .filter((a) => a.status === 'accepted' || a.status === 'fee_pending')
                  .map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.case_no} - {app.applicant_name} - {app.appraisal_type}
                    {app.status === 'fee_pending' ? ' [待缴费]' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">鉴定地点 *</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="input-field"
                placeholder="请输入鉴定地点"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">日期 *</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => { setForm({ ...form, date: e.target.value }); setConflictResult(null); }}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">时间段 *</label>
              <select
                value={form.timeSlot}
                onChange={(e) => { setForm({ ...form, timeSlot: e.target.value }); setConflictResult(null); }}
                className="select-field"
              >
                <option value="">请选择时间段</option>
                {TIME_SLOTS.map((ts) => (
                  <option key={ts} value={ts}>{ts}</option>
                ))}
              </select>
            </div>
          </div>

          {form.expertId && form.institutionId && form.date && form.timeSlot && (
            <div className="mt-3">
              <button onClick={handleCheckConflict} className="text-sm text-judicial-primary hover:underline flex items-center gap-1">
                <AlertTriangle size={14} /> 检测冲突
              </button>
              {conflictResult === true && (
                <div className="mt-2 p-2 bg-red-50 text-judicial-danger text-sm rounded-judicial animate-shake flex items-center gap-2">
                  <AlertTriangle size={16} /> 检测到时间冲突！该专家在此时间段已有安排
                </div>
              )}
              {conflictResult === false && (
                <div className="mt-2 p-2 bg-green-50 text-judicial-success text-sm rounded-judicial flex items-center gap-2">
                  ✓ 该时间段可用，无冲突
                </div>
              )}
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.isUrgent}
                onChange={(e) => setForm({ ...form, isUrgent: e.target.checked })}
                className="rounded border-gray-300"
              />
              <Zap size={14} className="text-judicial-warning" />
              加急排期
            </label>
            {form.isUrgent && (
              <input
                type="text"
                value={form.urgentReason}
                onChange={(e) => setForm({ ...form, urgentReason: e.target.value })}
                className="input-field flex-1"
                placeholder="请输入加急原因"
              />
            )}
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={rescheduleId ? () => handleReschedule(rescheduleId) : handleCreate}
              disabled={loading || !form.expertId || !form.institutionId || !form.date || !form.timeSlot || !form.location || (!rescheduleId && !form.applicationId)}
              className="btn-primary text-sm"
            >
              {rescheduleId ? '确认改期' : '创建排期'}
            </button>
            <button
              onClick={() => { setShowForm(false); setRescheduleId(null); setConflictResult(null); }}
              className="btn-outline text-sm"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset(weekOffset - 1)} className="p-1.5 rounded hover:bg-gray-100">
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-medium text-judicial-primary">
            {weekDays[0].toLocaleDateString()} - {weekDays[4].toLocaleDateString()}
          </span>
          <button onClick={() => setWeekOffset(weekOffset + 1)} className="p-1.5 rounded hover:bg-gray-100">
            <ChevronRight size={18} />
          </button>
          <button onClick={() => setWeekOffset(0)} className="text-xs text-judicial-primary hover:underline ml-1">本周</button>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1"><Clock size={14} /> 共 {schedules.length} 个排期</span>
          <span className="flex items-center gap-1">
            <Users size={14} /> 机构容量
            <span className={cn('font-medium', institutionCapacity.percentage > 80 ? 'text-judicial-danger' : 'text-judicial-success')}>
              {institutionCapacity.current}/{institutionCapacity.max}
            </span>
          </span>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-judicial-primary/5">
                <th className="px-3 py-2 text-left text-gray-500 font-medium w-24">时间段</th>
                {weekDays.map((d, i) => (
                  <th key={i} className="px-3 py-2 text-center text-gray-500 font-medium">
                    <div>{WEEKDAY_NAMES[i]}</div>
                    <div className="text-xs text-gray-400">{d.getMonth() + 1}/{d.getDate()}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TIME_SLOTS.map((ts) => (
                <tr key={ts} className="border-t border-gray-50">
                  <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{ts}</td>
                  {weekDays.map((d, i) => {
                    const items = getSchedulesForSlot(d, ts);
                    return (
                      <td key={i} className="px-1 py-1 text-center">
                        {items.map((s) => (
                          <div
                            key={s.id}
                            className={cn(
                              'text-xs px-1.5 py-1 rounded mb-0.5 cursor-pointer',
                              s.is_urgent
                                ? 'bg-amber-50 text-judicial-warning'
                                : 'bg-blue-50 text-blue-700',
                            )}
                            onClick={() => {
                              setRescheduleId(s.id);
                              setShowForm(true);
                              const timeEnd = ts.split('-')[1];
                              setForm({
                                expertId: s.expert_id,
                                institutionId: s.institution_id,
                                applicationId: s.application_id,
                                date: s.scheduled_date,
                                timeSlot: `${s.scheduled_time}-${timeEnd || s.scheduled_time}`,
                                location: s.location,
                                isUrgent: s.is_urgent,
                                urgentReason: s.urgent_reason ?? '',
                              });
                            }}
                          >
                            <div className="font-medium truncate">{s.expert_name || '专家'}</div>
                            <div className="truncate text-[10px] opacity-75">{s.location}</div>
                            {s.is_urgent && <Zap size={10} className="inline text-judicial-warning" />}
                          </div>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">机构容量</span>
          <span className="text-sm text-gray-500">{institutionCapacity.percentage}%</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              institutionCapacity.percentage > 80 ? 'bg-judicial-danger' : institutionCapacity.percentage > 50 ? 'bg-judicial-warning' : 'bg-judicial-success',
            )}
            style={{ width: `${institutionCapacity.percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}
