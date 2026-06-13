import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { ROLE_LABELS, type Role } from '@/shared/types';
import { RoleSwitcher } from '@/components/RoleSwitcher';
import {
  FileText,
  FolderOpen,
  CreditCard,
  ScrollText,
  ClipboardCheck,
  CheckSquare,
  Calendar,
  Users,
  Building2,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Clock,
  LogOut,
  Scale,
} from 'lucide-react';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const NAV_MAP: Record<Role, NavItem[]> = {
  party: [
    { path: '/apply', label: '提交申请', icon: <FileText size={18} /> },
    { path: '/my-cases', label: '我的案件', icon: <FolderOpen size={18} /> },
    { path: '/fees', label: '费用缴纳', icon: <CreditCard size={18} /> },
    { path: '/audit-log', label: '流程日志', icon: <ScrollText size={18} /> },
  ],
  reviewer: [
    { path: '/review', label: '待审核案件', icon: <ClipboardCheck size={18} /> },
    { path: '/my-cases', label: '材料审核', icon: <CheckSquare size={18} /> },
    { path: '/audit-log', label: '流程日志', icon: <ScrollText size={18} /> },
  ],
  scheduler: [
    { path: '/schedule', label: '排期管理', icon: <Calendar size={18} /> },
    { path: '/experts', label: '专家查看', icon: <Users size={18} /> },
    { path: '/institutions', label: '机构容量', icon: <Building2 size={18} /> },
    { path: '/audit-log', label: '流程日志', icon: <ScrollText size={18} /> },
  ],
  supervisor: [
    { path: '/supervisor', label: '撤回审批', icon: <ShieldCheck size={18} /> },
    { path: '/supervisor?tab=urgent', label: '加急审批', icon: <Zap size={18} /> },
    { path: '/deadline', label: '期限预警', icon: <AlertTriangle size={18} /> },
    { path: '/audit-log', label: '流程日志', icon: <ScrollText size={18} /> },
  ],
};

function ToastContainer() {
  const toasts = useAppStore((s) => s.toasts);
  const removeToast = useAppStore((s) => s.removeToast);
  const colorMap = {
    success: 'bg-judicial-success text-white',
    error: 'bg-judicial-danger text-white',
    warning: 'bg-judicial-warning text-white',
    info: 'bg-judicial-primary text-white',
  };
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`${colorMap[t.type]} px-5 py-3 rounded-judicial shadow-lg animate-fade-in flex items-center gap-2 min-w-[260px]`}
          onClick={() => removeToast(t.id)}
        >
          {t.type === 'success' && <CheckSquare size={16} />}
          {t.type === 'error' && <AlertTriangle size={16} />}
          {t.type === 'warning' && <Clock size={16} />}
          {t.type === 'info' && <FileText size={16} />}
          <span className="text-sm font-medium">{t.message}</span>
        </div>
      ))}
    </div>
  );
}

export default function Layout() {
  const role = useAppStore((s) => s.role);
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useAppStore((s) => s.setSidebarCollapsed);
  const navigate = useNavigate();

  const navItems = NAV_MAP[role];

  return (
    <div className="flex h-screen bg-judicial-bg overflow-hidden">
      <aside
        className={`${
          collapsed ? 'w-16' : 'w-56'
        } bg-judicial-primary text-white flex flex-col transition-all duration-300 flex-shrink-0`}
      >
        <div className="flex items-center gap-2 px-4 py-5 border-b border-white/10">
          <Scale size={24} className="text-judicial-gold flex-shrink-0" />
          {!collapsed && (
            <span className="font-serif font-semibold text-sm tracking-wide whitespace-nowrap">
              司法鉴定管理系统
            </span>
          )}
        </div>

        <nav className="flex-1 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 mx-2 px-3 py-2.5 rounded-judicial text-sm transition-colors ${
                  isActive
                    ? 'bg-white/15 text-judicial-gold font-medium'
                    : 'text-white/75 hover:bg-white/10 hover:text-white'
                } ${collapsed ? 'justify-center' : ''}`
              }
            >
              {item.icon}
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3 space-y-2">
          <button
            onClick={() => setSidebarCollapsed(!collapsed)}
            className="w-full flex items-center justify-center py-2 rounded-judicial text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <LogOut size={16} className={collapsed ? '' : 'rotate-180'} />
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-judicial text-white/60 hover:text-white hover:bg-white/10 transition-colors text-xs"
          >
            {!collapsed && <span>返回首页</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-judicial-primary font-serif font-semibold">
              {ROLE_LABELS[role]}工作台
            </span>
          </div>
          <div className="flex items-center gap-4">
            <RoleSwitcher />
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>

      <ToastContainer />
    </div>
  );
}
