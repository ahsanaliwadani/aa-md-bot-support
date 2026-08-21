import { useEffect, useState } from 'react';
import { faqApi, FAQ } from '../lib/types';
import { Card, Toast, ConfirmDialog } from '../components/ui';
import { Plus, Edit2, Trash2 } from 'lucide-react';

export default function FAQPage() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [toast, setToast] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<FAQ | null>(null);
  const [editing, setEditing] = useState<FAQ | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ question: '', answer: '', keywords: '', enabled: true });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    faqApi.list()
      .then((res) => setFaqs(res.items))
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const startEdit = (faq: FAQ) => {
    setEditing(faq);
    setCreating(false);
    setForm({ question: faq.question, answer: faq.answer, keywords: faq.keywords.join(', '), enabled: faq.enabled });
  };

  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    setForm({ question: '', answer: '', keywords: '', enabled: true });
  };

  const handleSave = async () => {
    const keywords = form.keywords.split(',').map((k) => k.trim()).filter(Boolean);
    if (editing) {
      await faqApi.update(editing._id, { question: form.question, answer: form.answer, keywords, enabled: form.enabled });
      showToast('FAQ updated');
    } else {
      await faqApi.create({ question: form.question, answer: form.answer, keywords });
      showToast('FAQ created');
    }
    setEditing(null);
    setCreating(false);
    load();
  };

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">FAQ Management</h1>
        <button onClick={startCreate} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add FAQ
        </button>
      </div>

      {(creating || editing) && (
        <Card>
          <h3 className="text-white font-semibold mb-4">{editing ? 'Edit FAQ' : 'New FAQ'}</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Question</label>
              <input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} className="input" placeholder="What is AA MD Bot?" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Answer</label>
              <textarea value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} rows={4} className="input" placeholder="AA MD Bot is..." />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Keywords (comma-separated)</label>
              <input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} className="input" placeholder="what is, about, info" />
            </div>
            {editing && (
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} className="w-4 h-4" />
                Enabled
              </label>
            )}
            <div className="flex gap-2">
              <button onClick={handleSave} className="btn-primary">Save</button>
              <button onClick={() => { setCreating(false); setEditing(null); }} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {loading && <Card><div className="text-center text-slate-500 py-6">Loading FAQs...</div></Card>}
        {error && <Card><div className="text-center text-error-500 py-6">{error}</div></Card>}
        {!loading && !error && faqs.map((faq) => (
          <Card key={faq._id}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-white font-medium">{faq.question}</h3>
                  {!faq.enabled && <span className="badge bg-slate-600/20 text-slate-400">Disabled</span>}
                </div>
                <p className="text-slate-400 text-sm">{faq.answer}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {faq.keywords.map((k) => (
                    <span key={k} className="badge bg-primary-500/10 text-primary-400 text-xs">{k}</span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 ml-3">
                <button onClick={() => startEdit(faq)} className="text-slate-400 hover:text-primary-400">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => setConfirmDelete(faq)} className="text-slate-400 hover:text-error-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </Card>
        ))}
        {!loading && !error && faqs.length === 0 && <Card><div className="text-center text-slate-500 py-6">No FAQs yet. Defaults will appear after refresh if you have FAQ permission.</div></Card>}
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete FAQ"
        message={`Delete "${confirmDelete?.question}"? This cannot be undone.`}
        onConfirm={async () => { if (confirmDelete) { await faqApi.delete(confirmDelete._id); setConfirmDelete(null); showToast('FAQ deleted'); load(); } }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
