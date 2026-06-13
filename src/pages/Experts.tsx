import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { StatusBadge } from '@/components/StatusBadge';
import { Users, Briefcase, Building2 } from 'lucide-react';

export default function Experts() {
  const experts = useAppStore((s) => s.experts);
  const loading = useAppStore((s) => s.loading);
  const fetchExperts = useAppStore((s) => s.fetchExperts);

  useEffect(() => {
    fetchExperts();
  }, []);

  return (
    <div className="animate-fade-in">
      <h1 className="font-serif text-2xl font-semibold text-judicial-primary mb-6 flex items-center gap-2">
        <Users size={24} />
        专家查看
      </h1>

      {loading && experts.length === 0 ? (
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card">
              <div className="skeleton h-6 w-32 mb-3" />
              <div className="skeleton h-4 w-24" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {experts.map((expert) => (
            <div key={expert.id} className="card">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-judicial-gold" />
                  <span className="font-medium text-judicial-primary">{expert.name}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${expert.availability ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {expert.availability ? '可用' : '不可用'}
                </span>
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <div className="flex items-center gap-2">
                  <Briefcase size={14} className="text-gray-400" />
                  <span>专业：{expert.specialty}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 size={14} className="text-gray-400" />
                  <span>机构：{expert.institution_name || '未指定'}</span>
                </div>
                {expert.qualification && (
                  <div className="flex items-center gap-2">
                    <Briefcase size={14} className="text-gray-400" />
                    <span>资质：{expert.qualification}</span>
                  </div>
                )}
              </div>
              {expert.conflict_case_nos && expert.conflict_case_nos.length > 0 && (
                <div className="mt-3 pt-2 border-t border-gray-50 text-xs text-red-500">
                  冲突案件：{expert.conflict_case_nos.join('、')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
