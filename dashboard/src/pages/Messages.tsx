import { useEffect, useMemo, useRef, useState } from 'react';
import { messageApi, ConversationSummary, ChatMessage, Customer } from '../lib/types';
import { Toast } from '../components/ui';
import { Bot, CheckCheck, ChevronLeft, ImagePlus, MessageSquare, MoreVertical, Search, Send, UserCheck, X } from 'lucide-react';

const dayLabel = (value: string) => {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
};

const timeLabel = (value: string) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const phoneFromJid = (jid: string) => jid.split('@')[0];
const displayName = (conversation: ConversationSummary) => conversation.customerName || `+${conversation.phoneNumber}`;

export default function Messages() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedJid, setSelectedJid] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [user, setUser] = useState<Customer | null>(null);
  const [reply, setReply] = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const [imageName, setImageName] = useState('');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedConversation = conversations.find((conversation) => conversation.jid === selectedJid);
  const customerLabel = user?.name || selectedConversation?.customerName || (selectedJid ? `+${phoneFromJid(selectedJid)}` : 'Customer');
  const messageGroups = useMemo(() => messages.reduce<Array<{ day: string; messages: ChatMessage[] }>>((groups, message) => {
    const day = dayLabel(message.at);
    const last = groups[groups.length - 1];
    if (last?.day === day) last.messages.push(message);
    else groups.push({ day, messages: [message] });
    return groups;
  }, []), [messages]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3500);
  };

  const loadConversations = () => {
    setLoading(true);
    messageApi.listConversations(search)
      .then((result) => setConversations(result.items))
      .catch((error: Error) => showToast(error.message))
      .finally(() => setLoading(false));
  };

  const loadSelected = (jid = selectedJid) => {
    if (!jid) return;
    messageApi.getConversation(jid)
      .then((result) => {
        setMessages(result.messages);
        setUser(result.user);
      })
      .catch((error: Error) => showToast(error.message));
  };

  useEffect(() => {
    loadConversations();
    const stream = new EventSource('/api/dashboard/realtime', { withCredentials: true });
    const refresh = () => loadConversations();
    stream.addEventListener('message:new', refresh);
    stream.addEventListener('ticket:new', refresh);
    return () => stream.close();
  }, [search]);

  useEffect(() => {
    if (!selectedJid) return;
    loadSelected(selectedJid);
    const stream = new EventSource('/api/dashboard/realtime', { withCredentials: true });
    const refreshSelected = (event: MessageEvent) => {
      try {
        const update = JSON.parse(event.data) as { jid?: string };
        if (update.jid === selectedJid) loadSelected(selectedJid);
      } catch {
        loadSelected(selectedJid);
      }
    };
    stream.addEventListener('message:new', refreshSelected);
    return () => stream.close();
  }, [selectedJid]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!selectedJid || sending || (!reply.trim() && !imageBase64)) return;
    try {
      setSending(true);
      await messageApi.send(selectedJid, reply.trim(), imageBase64 || undefined);
      setReply('');
      setImageBase64('');
      setImageName('');
      await Promise.all([loadSelected(selectedJid), loadConversations()]);
    } catch (error) {
      showToast((error as Error).message);
    } finally {
      setSending(false);
    }
  };

  const handleImageSelect = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return showToast('Please select an image file.');
    if (file.size > 5 * 1024 * 1024) return showToast('Image must be 5 MB or smaller.');
    const reader = new FileReader();
    reader.onload = () => {
      setImageBase64(String(reader.result || ''));
      setImageName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleAssignMe = async () => {
    if (!selectedJid) return;
    try {
      await messageApi.assignMe(selectedJid);
      showToast('You are now handling this chat. Bot replies are paused.');
      loadSelected();
      loadConversations();
    } catch (error) { showToast((error as Error).message); }
  };

  const handleReleaseBot = async () => {
    if (!selectedJid) return;
    try {
      await messageApi.releaseBot(selectedJid);
      showToast('Chat returned to bot automation.');
      loadSelected();
      loadConversations();
    } catch (error) { showToast((error as Error).message); }
  };

  return (
    <div className="flex h-[calc(100dvh-76px)] min-h-[560px] flex-col overflow-hidden rounded-xl border border-slate-700/70 bg-[#111b21] shadow-2xl shadow-black/20 sm:h-[calc(100vh-96px)]">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className={`${selectedJid ? 'hidden lg:flex' : 'flex'} min-h-0 flex-col border-r border-[#2a3942] bg-[#111b21]`}>
          <div className="flex items-center justify-between px-4 py-4">
            <div>
              <h1 className="text-xl font-semibold text-white">Messages</h1>
              <p className="mt-0.5 text-xs text-slate-400">WhatsApp support inbox</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400"><MessageSquare className="h-4 w-4" /></div>
          </div>
          <div className="px-3 pb-3">
            <label className="flex items-center gap-2 rounded-lg bg-[#202c33] px-3 py-2 text-slate-400 focus-within:ring-1 focus-within:ring-emerald-500">
              <Search className="h-4 w-4 flex-none" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search chats" className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500" />
            </label>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {loading ? <div className="py-10 text-center text-sm text-slate-500">Loading conversations…</div> : conversations.length === 0 ? (
              <div className="px-8 py-14 text-center text-sm text-slate-500">No conversations found.</div>
            ) : conversations.map((conversation) => (
              <button key={conversation.jid} onClick={() => setSelectedJid(conversation.jid)} className={`flex w-full gap-3 border-b border-[#222f36] px-3 py-3 text-left transition-colors hover:bg-[#202c33] ${selectedJid === conversation.jid ? 'bg-[#2a3942]' : ''}`}>
                <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/80 to-teal-700 text-sm font-semibold text-white">
                  {displayName(conversation).replace(/^\+/, '').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-slate-100">{displayName(conversation)}</span>
                    <span className="flex-none text-[11px] text-slate-500">{timeLabel(conversation.lastMessageAt)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    {conversation.lastMessageDirection === 'OUTGOING' && <CheckCheck className="h-3.5 w-3.5 flex-none text-sky-400" />}
                    <span className="truncate text-xs text-slate-400">{conversation.lastMessageBody || 'Media message'}</span>
                  </div>
                  <div className="mt-1.5 flex gap-1.5">
                    {conversation.botPaused && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">Human</span>}
                    {conversation.blocked && <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-300">Blocked</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className={`${selectedJid ? 'flex' : 'hidden lg:flex'} min-h-0 flex-col bg-[#0b141a]`}>
          {selectedJid ? <>
            <header className="flex items-center justify-between gap-3 border-b border-[#2a3942] bg-[#202c33] px-3 py-2.5 shadow-sm">
              <div className="flex min-w-0 items-center gap-3">
                <button onClick={() => setSelectedJid(null)} aria-label="Back to conversations" className="rounded-full p-1 text-slate-300 hover:bg-white/10 lg:hidden"><ChevronLeft className="h-6 w-6" /></button>
                <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/80 to-teal-700 text-sm font-semibold text-white">{customerLabel.replace(/^\+/, '').slice(0, 2).toUpperCase()}</div>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-white">{customerLabel}</h2>
                  <p className="truncate text-xs text-slate-400">+{phoneFromJid(selectedJid)}{user?.country ? ` · ${user.country}` : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {user?.botPaused ? <button onClick={handleReleaseBot} className="rounded-lg bg-slate-700 px-2.5 py-2 text-xs font-medium text-slate-100 hover:bg-slate-600"><Bot className="mr-1 inline h-3.5 w-3.5" />Bot</button> : <button onClick={handleAssignMe} className="rounded-lg bg-emerald-600 px-2.5 py-2 text-xs font-medium text-white hover:bg-emerald-500"><UserCheck className="mr-1 inline h-3.5 w-3.5" />Assign me</button>}
                <button onClick={() => loadSelected()} aria-label="Refresh conversation" className="rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white"><MoreVertical className="h-5 w-5" /></button>
              </div>
            </header>
            {user?.botPaused && <div className="flex items-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-200"><UserCheck className="h-4 w-4" /> Human support is handling this chat. The bot is paused.</div>}
            <section className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.08),_transparent_30%),linear-gradient(135deg,#0b141a,#111b21)] px-3 py-4 sm:px-6">
              {messageGroups.length === 0 ? <div className="flex h-full flex-col items-center justify-center text-slate-500"><MessageSquare className="mb-3 h-10 w-10" /><p className="text-sm">No messages yet</p><p className="mt-1 text-xs">Send a message to start this conversation.</p></div> : messageGroups.map((group) => (
                <div key={group.day}>
                  <div className="sticky top-0 z-10 mx-auto mb-3 w-fit rounded-lg bg-[#182229]/95 px-3 py-1 text-[11px] font-medium text-slate-300 shadow">{group.day}</div>
                  <div className="space-y-1.5">{group.messages.map((message) => <div key={message._id} className={`flex ${message.direction === 'OUTGOING' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[88%] rounded-lg px-2.5 py-1.5 text-sm shadow-sm sm:max-w-[72%] ${message.direction === 'OUTGOING' ? 'rounded-tr-none bg-[#005c4b] text-white' : 'rounded-tl-none bg-[#202c33] text-slate-100'}`}>
                      {message.mediaUrl && <a href={message.mediaUrl} target="_blank" rel="noreferrer" className="mb-1.5 block"><img src={message.mediaUrl} alt={message.body || 'WhatsApp image'} className="max-h-80 w-full rounded-md object-contain" loading="lazy" /></a>}
                      {message.body && <p className="whitespace-pre-wrap break-words leading-5">{message.body}</p>}
                      <div className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${message.direction === 'OUTGOING' ? 'text-emerald-100/70' : 'text-slate-500'}`}><span>{timeLabel(message.at)}</span>{message.direction === 'OUTGOING' && <CheckCheck className="h-3.5 w-3.5 text-sky-300" />}</div>
                    </div>
                  </div>)}</div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </section>
            <footer className="border-t border-[#2a3942] bg-[#202c33] p-2.5 sm:p-3">
              {imageBase64 && <div className="mb-2 flex items-center gap-2 rounded-lg bg-[#111b21] p-2 text-xs text-slate-300"><img src={imageBase64} alt={imageName || 'Selected image'} className="h-11 w-11 rounded object-cover" /><span className="min-w-0 flex-1 truncate">{imageName}</span><button onClick={() => { setImageBase64(''); setImageName(''); }} aria-label="Remove image" className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button></div>}
              <div className="flex items-end gap-2">
                <label className="cursor-pointer rounded-full p-2.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"><ImagePlus className="h-5 w-5" /><input type="file" accept="image/*" className="hidden" onChange={(event) => handleImageSelect(event.target.files?.[0])} /></label>
                <textarea value={reply} onChange={(event) => setReply(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void handleSend(); } }} rows={1} placeholder="Type a message" className="max-h-28 min-h-[42px] flex-1 resize-y rounded-lg bg-[#2a3942] px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:ring-1 focus:ring-emerald-500" />
                <button onClick={() => void handleSend()} disabled={sending || (!reply.trim() && !imageBase64)} aria-label="Send message" className="rounded-full bg-emerald-600 p-3 text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"><Send className="h-4 w-4" /></button>
              </div>
              <p className="mt-1 pl-11 text-[10px] text-slate-500">Enter to send · Shift + Enter for a new line</p>
            </footer>
          </> : <div className="flex h-full flex-col items-center justify-center bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.08),_transparent_40%)] px-6 text-center"><MessageSquare className="mb-4 h-14 w-14 text-emerald-500/50" /><h2 className="text-lg font-medium text-slate-200">AA MD WhatsApp Inbox</h2><p className="mt-2 max-w-sm text-sm text-slate-500">Choose a conversation to view its messages, take ownership, and reply directly.</p></div>}
        </main>
      </div>
    </div>
  );
}
