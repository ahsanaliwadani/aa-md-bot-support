import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { customerApi, Customer, Ticket, Payment } from '../lib/types';
import { Card, Badge, Toast, ConfirmDialog } from '../components/ui';

export default function CustomerDetail() {
  const { id } = useParams();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [messages, setMessages] = useState<Array<{ jid: string; direction: string; body: string; at: string }>>([]);
  const [notes, setNotes] = useState('');
  const [newTag, setNewTag] = useState('');
  const [toast, setToast] = useState('');
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [tab, setTab] = useState<'overview' | 'tickets' | 'payments' | 'conversation'>('overview');

  useEffect(() => {
    if (!id) return;
    customerApi.get(id).then((res) => {
      setCustomer(res.user);
      setTickets(res.tickets);
      setPayments(res.payments);
      setNotes(res.user.notes);
    });
    customerApi.getConversation(id).then((res) => setMessages(res.items)).catch(() => setMessages([]));
  }, [id]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  if (!customer) return <div className="text-slate-400 animate-pulse">Loading customer...</div>;

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Customer: {customer.customerId}</h1>
        <span className="text-slate-400">+{customer.phoneNumber}</span>
      </div>

      <div className="flex gap-2 border-b border-slate-800">
        {(['overview', 'tickets', 'payments', 'conversation'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm capitalize ${tab === t ? 'text-primary-400 border-b-2 border-primary-500' : 'text-slate-400'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <h3 className="text-white font-semibold mb-3">Customer Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Phone:</span><span className="text-slate-300">+{customer.phoneNumber}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Country:</span><span className="text-slate-300">{customer.country}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Key Status:</span><Badge status={customer.accessKeyStatus} /></div>
              <div className="flex justify-between"><span className="text-slate-500">Payment:</span><Badge status={customer.paymentStatus} /></div>
              <div className="flex justify-between"><span className="text-slate-500">Support:</span><Badge status={customer.supportStatus} /></div>
              <div className="flex justify-between"><span className="text-slate-500">Blocked:</span><span className={customer.blocked ? 'text-error-500' : 'text-success-500'}>{customer.blocked ? 'Yes' : 'No'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">First Contact:</span><span className="text-slate-300">{new Date(customer.createdAt).toLocaleString()}</span></div>
            </div>
          </Card>

          <Card>
            <h3 className="text-white font-semibold mb-3">Tags</h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {customer.tags.map((tag) => (
                <span key={tag} className="badge bg-primary-500/20 text-primary-400 flex items-center gap-1">
                  {tag}
                  <button onClick={async () => { await customerApi.removeTag(customer._id, tag); const u = await customerApi.get(customer._id); setCustomer(u.user); }} className="text-primary-400/60 hover:text-error-500">&times;</button>
                </span>
              ))}
              {customer.tags.length === 0 && <span className="text-slate-500 text-sm">No tags</span>}
            </div>
            <div className="flex gap-2">
              <input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Add tag..." className="input flex-1" />
              <button onClick={async () => { if (newTag) { await customerApi.addTag(customer._id, newTag); setNewTag(''); const u = await customerApi.get(customer._id); setCustomer(u.user); } }} className="btn-primary">Add</button>
            </div>
          </Card>

          <Card className="md:col-span-2">
            <h3 className="text-white font-semibold mb-3">Admin Notes</h3>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="input" placeholder="Add notes about this customer..." />
            <button onClick={async () => { await customerApi.updateNotes(customer._id, notes); showToast('Notes saved'); }} className="btn-primary mt-2">Save Notes</button>
          </Card>

          <Card className="md:col-span-2">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold">Block / Unblock</h3>
              {customer.blocked ? (
                <button onClick={async () => { await customerApi.unblock(customer._id); const u = await customerApi.get(customer._id); setCustomer(u.user); showToast('Customer unblocked'); }} className="btn-success">Unblock</button>
              ) : (
                <button onClick={() => setConfirmBlock(true)} className="btn-danger">Block Customer</button>
              )}
            </div>
            {customer.blocked && <p className="text-error-500 text-sm mt-2">Reason: {customer.blockedReason || 'N/A'}</p>}
          </Card>
        </div>
      )}

      {tab === 'tickets' && (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-900 text-slate-400"><tr><th className="text-left px-4 py-3">Ticket</th><th className="text-left px-4 py-3">Subject</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Priority</th><th className="text-left px-4 py-3">Date</th></tr></thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t._id} className="border-t border-slate-800">
                    <td className="px-4 py-3 text-primary-400">{t.ticketId}</td>
                    <td className="px-4 py-3 text-slate-300">{t.subject}</td>
                    <td className="px-4 py-3"><Badge status={t.status} /></td>
                    <td className="px-4 py-3"><Badge status={t.priority} /></td>
                    <td className="px-4 py-3 text-slate-400">{new Date(t.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
                {tickets.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-slate-500">No tickets</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'payments' && (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-900 text-slate-400"><tr><th className="text-left px-4 py-3">Request ID</th><th className="text-left px-4 py-3">Amount</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Date</th></tr></thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p._id} className="border-t border-slate-800">
                    <td className="px-4 py-3 text-primary-400">{p.paymentRequestId}</td>
                    <td className="px-4 py-3 text-slate-300">{p.amount} {p.currency}</td>
                    <td className="px-4 py-3"><Badge status={p.status} /></td>
                    <td className="px-4 py-3 text-slate-400">{new Date(p.submittedAt).toLocaleString()}</td>
                  </tr>
                ))}
                {payments.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-slate-500">No payments</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'conversation' && (
        <Card>
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {messages.length === 0 && <div className="text-slate-500 text-sm">No messages recorded</div>}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.direction === 'OUTGOING' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] px-3 py-2 rounded-lg text-sm ${m.direction === 'OUTGOING' ? 'bg-primary-600 text-white' : 'bg-surface-900 text-slate-300'}`}>
                  <div>{m.body}</div>
                  <div className={`text-xs mt-1 ${m.direction === 'OUTGOING' ? 'text-white/60' : 'text-slate-500'}`}>{new Date(m.at).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={confirmBlock}
        title="Block Customer"
        message="This will prevent the customer from interacting with the support bot. Are you sure?"
        onConfirm={async () => { await customerApi.block(customer._id, blockReason || 'Blocked by admin'); setConfirmBlock(false); setBlockReason(''); const u = await customerApi.get(customer._id); setCustomer(u.user); showToast('Customer blocked'); }}
        onCancel={() => setConfirmBlock(false)}
      />
    </div>
  );
}
