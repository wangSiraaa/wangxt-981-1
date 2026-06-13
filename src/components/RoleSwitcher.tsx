import { useAppStore } from '@/store/useAppStore';
import { ROLE_LABELS, type Role } from '@/shared/types';
import { ChevronDown, User } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

const ROLES: Role[] = ['party', 'reviewer', 'scheduler', 'supervisor'];

export function RoleSwitcher() {
  const role = useAppStore((s) => s.role);
  const setRole = useAppStore((s) => s.setRole);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-judicial border border-gray-200 bg-white hover:border-judicial-primary transition-colors text-sm"
      >
        <User size={14} className="text-judicial-primary" />
        <span className="text-judicial-primary font-medium">{ROLE_LABELS[role]}</span>
        <ChevronDown size={14} className="text-gray-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-judicial shadow-lg border border-gray-200 py-1 z-50 animate-fade-in">
          {ROLES.map((r) => (
            <button
              key={r}
              onClick={() => {
                setRole(r);
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                r === role
                  ? 'bg-judicial-primary/5 text-judicial-primary font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
