import { useEffect, useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Building2, MapPin, Phone, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Institutions() {
  const institutions = useAppStore((s) => s.institutions);
  const loading = useAppStore((s) => s.loading);
  const fetchInstitutions = useAppStore((s) => s.fetchInstitutions);

  useEffect(() => {
    fetchInstitutions();
  }, []);

  return (
    <div className="animate-fade-in">
      <h1 className="font-serif text-2xl font-semibold text-judicial-primary mb-6 flex items-center gap-2">
        <Building2 size={24} />
        机构容量
      </h1>

      {loading && institutions.length === 0 ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="card">
              <div className="skeleton h-6 w-48 mb-3" />
              <div className="skeleton h-4 w-32 mb-2" />
              <div className="skeleton h-3 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {institutions.map((inst) => {
            const capacity = inst.max_capacity ?? 0;
            const currentLoad = inst.current_load ?? 0;
            const loadPct = capacity > 0 ? Math.round((currentLoad / capacity) * 100) : 0;
            return (
              <div key={inst.id} className="card">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Building2 size={18} className="text-judicial-gold" />
                    <span className="font-medium text-judicial-primary">{inst.name}</span>
                  </div>
                  <span className="text-sm text-gray-500">
                    容量：{currentLoad}/{capacity}
                  </span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      loadPct > 80 ? 'bg-judicial-danger' : loadPct > 50 ? 'bg-judicial-warning' : 'bg-judicial-success',
                    )}
                    style={{ width: `${loadPct}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Layers size={14} className="text-gray-400" />
                    <span>{(inst.appraisal_types || []).join('、')}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin size={14} className="text-gray-400" />
                    <span>{inst.address || '-'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Phone size={14} className="text-gray-400" />
                    <span>{inst.phone || '-'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
