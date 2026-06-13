import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import type { AppraisalType } from '@/shared/types';
import { FileText, Plus, Trash2, Send, Building2 } from 'lucide-react';

const APPRAISAL_TYPES: AppraisalType[] = ['法医临床', '法医病理', '物证鉴定', '文书鉴定', '痕迹鉴定', '声像资料'];

export default function Apply() {
  const createApplication = useAppStore((s) => s.createApplication);
  const loading = useAppStore((s) => s.loading);
  const institutions = useAppStore((s) => s.institutions);
  const fetchInstitutions = useAppStore((s) => s.fetchInstitutions);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    caseNumber: '',
    applicantName: '',
    phone: '',
    appraisalType: '' as AppraisalType | '',
    institutionId: '',
  });
  const [materials, setMaterials] = useState<{ name: string }[]>([{ name: '' }]);

  useEffect(() => {
    if (institutions.length === 0) fetchInstitutions();
  }, []);

  const addMaterial = () => setMaterials([...materials, { name: '' }]);
  const removeMaterial = (idx: number) => {
    if (materials.length > 1) setMaterials(materials.filter((_, i) => i !== idx));
  };
  const updateMaterial = (idx: number, name: string) => {
    const next = [...materials];
    next[idx] = { name };
    setMaterials(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.caseNumber || !form.applicantName || !form.phone || !form.appraisalType || !form.institutionId) return;
    const materialNames = materials.filter((m) => m.name.trim()).map((m) => m.name.trim());
    if (materialNames.length === 0) return;

    const ok = await createApplication({
      case_no: form.caseNumber,
      applicant_name: form.applicantName,
      applicant_phone: form.phone,
      appraisal_type: form.appraisalType,
      institution_id: form.institutionId,
      material_names: materialNames,
    });
    if (ok) navigate('/my-cases');
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <h1 className="font-serif text-2xl font-semibold text-judicial-primary mb-6 flex items-center gap-2">
        <FileText size={24} />
        提交鉴定申请
      </h1>

      <form onSubmit={handleSubmit} className="card space-y-5">
        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">案件编号 <span className="text-judicial-danger">*</span></label>
            <input
              type="text"
              value={form.caseNumber}
              onChange={(e) => setForm({ ...form, caseNumber: e.target.value })}
              className="input-field"
              placeholder="请输入案件编号"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">申请人姓名 <span className="text-judicial-danger">*</span></label>
            <input
              type="text"
              value={form.applicantName}
              onChange={(e) => setForm({ ...form, applicantName: e.target.value })}
              className="input-field"
              placeholder="请输入申请人姓名"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">联系电话 <span className="text-judicial-danger">*</span></label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="input-field"
              placeholder="请输入联系电话"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">鉴定类型 <span className="text-judicial-danger">*</span></label>
            <select
              value={form.appraisalType}
              onChange={(e) => setForm({ ...form, appraisalType: e.target.value as AppraisalType })}
              className="select-field"
              required
            >
              <option value="">请选择鉴定类型</option>
              {APPRAISAL_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">鉴定机构 <span className="text-judicial-danger">*</span></label>
          <div className="relative">
            <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={form.institutionId}
              onChange={(e) => setForm({ ...form, institutionId: e.target.value })}
              className="select-field pl-9"
              required
            >
              <option value="">请选择鉴定机构</option>
              {institutions.map((inst) => (
                <option key={inst.id} value={inst.id}>{inst.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">鉴定材料 <span className="text-judicial-danger">*</span></label>
            <button type="button" onClick={addMaterial} className="text-judicial-primary text-sm flex items-center gap-1 hover:underline">
              <Plus size={14} /> 添加材料
            </button>
          </div>
          <div className="space-y-2">
            {materials.map((m, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={m.name}
                  onChange={(e) => updateMaterial(idx, e.target.value)}
                  className="input-field flex-1"
                  placeholder={`材料 ${idx + 1} 名称`}
                  required
                />
                {materials.length > 1 && (
                  <button type="button" onClick={() => removeMaterial(idx)} className="text-judicial-danger hover:text-red-600 p-1">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-gray-100">
          <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
            <Send size={16} />
            {loading ? '提交中...' : '提交申请'}
          </button>
        </div>
      </form>
    </div>
  );
}
