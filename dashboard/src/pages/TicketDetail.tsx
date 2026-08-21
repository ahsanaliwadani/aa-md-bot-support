import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ticketApi, Ticket } from '../lib/types';
import { Card, Badge, Toast } from '../components/ui';
import { Send, Trash2, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TicketDetail() {
  const { ticketId } = useParams();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [reply, setReply] = useState('');
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = () => {
    if (!ticketId) return;
    setLoading(true);
    ticketApi.get(ticketId).then((res) => setTicket(res.ticket)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [ticketId]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const handleReply = async () => {
    if (!ticketId || !reply.trim()) return;
    await ticketApi.reply(ticketId, reply);
    setReply('');
    showToast('Reply sent to customer');
    load();
  };

  const handleStatusChange = async (status: string) => {
    if (!ticketId) return;
    await ticketApi.updateStatus(ticketId, status);
    showToast('Status updated');
    load();
  };

  const handlePriorityChange = async (priority: string) => {
    if (!ticketId) return;
    await ticketApi.updatePriority(ticketId, priority);
    showToast('Priority updated');
    load();
  };

  const handleAssignMe = async () => {
    if (!ticketId) return;
    await ticketApi.assignMe(ticketId);
    showToast('Ticket assigned to you');
    load();
  };

  const handleDelete = async () => {
    if (!ticketId || !window.confirm('Delete this ticket permanently?')) return;
    await ticketApi.delete(ticketId);
    showToast('Ticket deleted');
    navigate('/tickets');
  };

  if (loading || !ticket) return <div className="text-slate-400 animate-pulse">Loading ticket...</div>;

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">Ticket: {ticket.ticketId}</h1>
        <div className="flex gap-2">
          <button onClick={handleAssignMe} className="btn-secondary flex items-center gap-2"><UserCheck className="w-4 h-4" /> Assign Me</button>
          <button onClick={handleDelete} className="btn-secondary text-error-500 flex items-center gap-2"><Trash2 className="w-4 h-4" /> Delete</button>
          <Badge status={ticket.status} />
          <Badge status={ticket.priority} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <div className="mb-4">
              <div className="text-slate-500 text-sm">Subject</div>
              <div className="text-white font-semibold">{ticket.subject}</div>
            </div>
            <div className="mb-4">
              <div className="text-slate-500 text-sm">Category</div>
              <div className="text-slate-300">{ticket.category}</div>
            </div>
            <div>
              <div className="text-slate-500 text-sm">Description</div>
              <div className="text-slate-300 mt-1">{ticket.description}</div>
            </div>
          </Card>

          <Card>
            <h3 className="text-white font-semibold mb-4">Conversation</h3>
            <div className="space-y-3 h-[400px] overflow-y-auto pr-1">
              {ticket.replies.map((r, i) => (
                <div key={i} className={`flex ${r.from === 'ADMIN' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${r.from === 'ADMIN' ? 'bg-primary-600 text-white' : 'bg-surface-900 text-slate-300'}`}>
                    <div className="text-xs mb-1 opacity-60">{r.from === 'ADMIN' ? 'Support Team' : 'Customer'}</div>
                    <div className="whitespace-pre-wrap break-words">{r.message}</div>
                    <div className={`text-xs mt-1 ${r.from === 'ADMIN' ? 'text-white/60' : 'text-slate-500'}`}>{new Date(r.at).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} className="input flex-1" placeholder="Type your reply..." />
              <button onClick={handleReply} className="btn-primary flex items-center gap-2"><Send className="w-4 h-4" /> Send</button>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <h3 className="text-white font-semibold mb-3">Ticket Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Phone:</span><span className="text-slate-300">+{ticket.phoneNumber}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Created:</span><span className="text-slate-300">{new Date(ticket.createdAt).toLocaleString()}</span></div>
              {ticket.assignedTo && <div className="flex justify-between"><span className="text-slate-500">Assigned:</span><span className="text-slate-300">{(ticket.assignedTo as { name: string }).name}</span></div>}
            </div>
          </Card>

          <Card>
            <h3 className="text-white font-semibold mb-3">Update Status</h3>
            <select onChange={(e) => handleStatusChange(e.target.value)} value={ticket.status} className="input mb-3">
              <option value="OPEN">Open</option>
              <option value="WAITING_FOR_USER">Waiting For User</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
            <h3 className="text-white font-semibold mb-3">Update Priority</h3>
            <select onChange={(e) => handlePriorityChange(e.target.value)} value={ticket.priority} className="input">
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </Card>
        </div>
      </div>
    </div>
  );
}
