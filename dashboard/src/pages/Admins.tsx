import { useEffect, useState } from 'react';
import { adminApi } from '../lib/types';
import { AdminInfo } from '../lib/auth';
import { Card, Badge, Toast, ConfirmDialog } from '../components/ui';
import { Plus, Shield } from 'lucide-react';

export default function Admins() {
  const [admins, setAdmins] = useState<AdminInfo[]>([]);
  const [toast, setToast] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'SUPPORT' });

  const load = () => adminApi.list().then((res) => setAdmins(res.items));
  useEffect(() => { load(); }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const handleCreate = async () => {
    try {
      await adminApi.create(form);
      showToast('Admin created');
      setShowCreate(false);
      setForm({ email: '', password: '', name: '', role: 'SUPPORT' });
      load();
    } catch (err) {
      showToast((err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Admin Users</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Admin
        </button>
      </div>

      {showCreate && (
        <Card>
          <h3 className="text-white font-semibold mb-4">New Admin</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Password</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="input">
                <option value="SUPPORT">SUPPORT</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={handleCreate} className="btn-primary">Create</button>
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
          </div>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-900 text-slate-400">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin._id} className="border-t border-slate-800">
                  <td className="px-4 py-3 text-slate-300">{admin.name}</td>
                  <td className="px-4 py-3 text-slate-300">{admin.email}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${admin.role === 'OWNER' ? 'bg-accent-500/20 text-accent-400' : admin.role === 'ADMIN' ? 'bg-primary-500/20 text-primary-400' : 'bg-slate-600/20 text-slate-400'}`}>
                      {admin.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${(admin as { active?: boolean }).active === false ? 'bg-error-500/20 text-error-500' : 'bg-success-500/20 text-success-500'}`}>
                      {(admin as { active?: boolean }).active === false ? 'Disabled' : 'Active'}
                    </span>
                  </td>
                </tr>
              ))}
              {admins.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-slate-500">No admins</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
