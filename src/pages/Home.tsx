import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { ROLE_LABELS, type Role } from '@/shared/types';
import { Scale, FileText, ClipboardCheck, Building2, ShieldCheck, FolderOpen, Clock, AlertTriangle } from 'lucide-react';

const ROLE_CARDS: { role: Role; icon: React.ReactNode; desc: string; color: string; path: string }[] = [
  {
    role: 'party',
    icon: <FileText size={32} />,
    desc: '提交鉴定申请、查看案件进度、缴纳费用',
    color: 'from-blue-500 to-blue-700',
    path: '/apply',
  },
  {
    role: 'reviewer',
    icon: <ClipboardCheck size={32} />,
    desc: '审核材料、受理案件、管理补正',
    color: 'from-indigo-500 to-indigo-700',
    path: '/review',
  },
  {
    role: 'scheduler',
    icon: <Building2 size={32} />,
    desc: '排期管理、专家调度、容量监控',
    color: 'from-purple-500 to-purple-700',
    path: '/schedule',
  },
  {
    role: 'supervisor',
    icon: <ShieldCheck size={32} />,
    desc: '撤回审批、加急审批、期限预警',
    color: 'from-amber-500 to-amber-700',
    path: '/supervisor',
  },
];

export default function Home() {
  const setRole = useAppStore((s) => s.setRole);
  const stats = useAppStore((s) => s.stats);
  const fetchStats = useAppStore((s) => s.fetchStats);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStats();
  }, []);

  const handleEnter = (role: Role, path: string) => {
    setRole(role);
    navigate(path);
  };

  return (
    <div className="min-h-screen bg-judicial-bg flex flex-col">
      <header className="bg-judicial-primary text-white">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-2">
            <Scale size={36} className="text-judicial-gold" />
            <h1 className="font-serif text-2xl font-bold tracking-wide">司法鉴定预约与协作管理系统</h1>
          </div>
          <p className="text-white/60 text-sm ml-12">Judicial Appraisal Reservation & Collaboration Management System</p>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto px-6 py-10 w-full">
        {stats && (
          <div className="grid grid-cols-4 gap-4 mb-10">
            {[
              { label: '申请总数', value: stats.totalApplications, icon: <FolderOpen size={20} />, color: 'text-judicial-primary' },
              { label: '待审核', value: stats.pendingReviews, icon: <Clock size={20} />, color: 'text-indigo-600' },
              { label: '即将排期', value: stats.upcomingSchedules, icon: <Building2 size={20} />, color: 'text-purple-600' },
              { label: '预警数', value: stats.activeWarnings, icon: <AlertTriangle size={20} />, color: 'text-judicial-danger' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-judicial p-5 shadow-sm border border-gray-100 flex items-center gap-4">
                <div className={`${s.color} opacity-60`}>{s.icon}</div>
                <div>
                  <div className="text-2xl font-serif font-bold text-judicial-primary">{s.value}</div>
                  <div className="text-sm text-gray-500">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <h2 className="font-serif text-lg font-semibold text-judicial-primary mb-6">选择角色进入系统</h2>
        <div className="grid grid-cols-2 gap-6">
          {ROLE_CARDS.map((card) => (
            <button
              key={card.role}
              onClick={() => handleEnter(card.role, card.path)}
              className="bg-white rounded-judicial p-8 shadow-sm border border-gray-100 hover:shadow-md hover:border-judicial-primary/20 transition-all text-left group"
            >
              <div className={`w-14 h-14 rounded-judicial bg-gradient-to-br ${card.color} text-white flex items-center justify-center mb-4 group-hover:scale-105 transition-transform`}>
                {card.icon}
              </div>
              <h3 className="font-serif text-xl font-semibold text-judicial-primary mb-2">{ROLE_LABELS[card.role]}</h3>
              <p className="text-sm text-gray-500">{card.desc}</p>
            </button>
          ))}
        </div>
      </main>

      <footer className="bg-judicial-primary text-white/40 text-center py-4 text-xs">
        司法鉴定预约与协作管理系统 © 2026
      </footer>
    </div>
  );
}
