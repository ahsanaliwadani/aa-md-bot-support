import { useEffect, useState, useRef } from 'react';
import { messageApi, ConversationSummary, ChatMessage, Customer } from '../lib/types';
import { Card, Toast, SearchBar } from '../components/ui';
import { Bot, Send, MessageSquare, UserCheck, ImagePlus, X } from 'lucide-react';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = () => {
    messageApi.listConversations(search).then((res) => setConversations(res.items)).finally(() => setLoading(false));
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
    messageApi.getConversation(selectedJid).then((res) => {
      setMessages(res.messages);
      setUser(res.user);
    });
    const stream = new EventSource('/api/dashboard/realtime', { withCredentials: true });
    const refreshSelected = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data) as { jid?: string };
        if (message.jid === selectedJid) {
          messageApi.getConversation(selectedJid).then((res) => setMessages(res.messages));
        }
      } catch {
        messageApi.getConversation(selectedJid).then((res) => setMessages(res.messages));
      }
    };
    stream.addEventListener('message:new', refreshSelected);
    return () => stream.close();
  }, [selectedJid]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const handleSend = async () => {
    if (!selectedJid || (!reply.trim() && !imageBase64)) return;
    try {
      await messageApi.send(selectedJid, reply, imageBase64 || undefined);
      setReply('');
      setImageBase64('');
      setImageName('');
      showToast('Message sent');
      messageApi.getConversation(selectedJid).then((res) => setMessages(res.messages));
      loadConversations();
    } catch (err) {
      showToast((err as Error).message);
    }
  };


  const handleImageSelect = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be 5MB or smaller');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageBase64(String(reader.result || ''));
      setImageName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const reloadSelected = () => {
    if (!selectedJid) return;
    messageApi.getConversation(selectedJid).then((res) => {
      setMessages(res.messages);
      setUser(res.user);
    });
    loadConversations();
  };

  const handleAssignMe = async () => {
    if (!selectedJid) return;
    await messageApi.assignMe(selectedJid);
    showToast('Chat assigned to you. Bot replies are paused.');
    reloadSelected();
  };

  const handleReleaseBot = async () => {
    if (!selectedJid) return;
    await messageApi.releaseBot(selectedJid);
    showToast('Chat released back to bot automation.');
    reloadSelected();
  };

  return (
    <div className="space-y-3 sm:space-y-4 h-[calc(100dvh-96px)] sm:h-[calc(100vh-120px)] flex flex-col overflow-hidden">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      <h1 className="text-xl sm:text-2xl font-bold text-white flex-shrink-0">Messages</h1>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-3 sm:gap-4 flex-1 min-h-0 overflow-hidden">
        {/* Conversation list */}
        <div className={`${selectedJid ? 'hidden lg:flex' : 'flex'} min-h-0 flex-col overflow-hidden`}>
          <div className="mb-3">
            <SearchBar value={search} onChange={setSearch} placeholder="Search conversations..." />
          </div>
          <Card className="flex-1 min-h-0 p-0 overflow-y-auto overscroll-contain">
            {loading ? (
              <div className="text-center py-8 text-slate-500">Loading...</div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">No conversations</div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.jid}
                  onClick={() => setSelectedJid(conv.jid)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-800 hover:bg-surface-800/50 active:bg-surface-700 transition-colors ${selectedJid === conv.jid ? 'bg-surface-800' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-white">+{conv.phoneNumber}</span>
                    {conv.blocked && <span className="badge bg-error-500/20 text-error-500 text-xs">Blocked</span>}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {conv.lastMessageDirection === 'OUTGOING' ? 'You: ' : ''}{conv.lastMessageBody}
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    {new Date(conv.lastMessageAt).toLocaleString()} · {conv.messageCount} msgs
                  </div>
                </button>
              ))
            )}
          </Card>
        </div>

        {/* Chat panel */}
        <div className={`${selectedJid ? 'flex' : 'hidden lg:flex'} min-h-0 flex-col overflow-hidden`}>
          {selectedJid ? (
            <Card className="flex-1 min-h-0 flex flex-col p-0 overflow-hidden bg-[#0b141a] border-slate-800">
              <div className="px-3 sm:px-4 py-3 border-b border-slate-800 bg-[#111b21] flex items-center justify-between gap-2 flex-shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <button onClick={() => setSelectedJid(null)} className="lg:hidden text-slate-300 text-xl leading-none pr-1">‹</button>
                  <MessageSquare className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <div>
                    <span className="text-white font-medium truncate block">+{selectedJid.split('@')[0]}</span>
                    {user && <span className="text-slate-500 text-sm ml-2">{user.country}</span>}
                    {user?.botPaused && <span className="badge bg-warning-500/20 text-warning-500 text-xs ml-2">Human assigned</span>}
                  </div>
                </div>
                {user?.botPaused ? (
                  <button onClick={handleReleaseBot} className="btn-secondary text-xs flex items-center gap-1"><Bot className="w-4 h-4" /> Assign Bot</button>
                ) : (
                  <button onClick={handleAssignMe} className="btn-secondary text-xs flex items-center gap-1"><UserCheck className="w-4 h-4" /> Assign Me</button>
                )}
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-2 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.08),_transparent_32%),linear-gradient(135deg,#0b141a,#111b21)]">
                {messages.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">No messages</div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg._id} className={`flex ${msg.direction === 'OUTGOING' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[86%] sm:max-w-[70%] px-3 py-2 rounded-2xl text-sm shadow-sm ${msg.direction === 'OUTGOING' ? 'bg-[#005c4b] text-white rounded-br-sm' : 'bg-[#202c33] text-slate-100 rounded-bl-sm'}`}>
                        {msg.mediaUrl && (
                          <a href={msg.mediaUrl} target="_blank" rel="noreferrer" className="block mb-2">
                            <img src={msg.mediaUrl} alt={msg.body || 'WhatsApp image'} className="max-h-72 w-full rounded-xl object-contain bg-black/20" loading="lazy" />
                          </a>
                        )}
                        {msg.body && <div className="whitespace-pre-wrap break-words">{msg.body}</div>}
                        <div className={`text-xs mt-1 ${msg.direction === 'OUTGOING' ? 'text-white/60' : 'text-slate-500'}`}>
                          {new Date(msg.at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className="p-2 sm:p-3 border-t border-slate-800 bg-[#111b21] flex-shrink-0">
                {imageBase64 && (
                  <div className="mb-2 flex items-center gap-2 rounded-xl bg-[#202c33] p-2 text-xs text-slate-300">
                    <img src={imageBase64} alt={imageName || 'Selected image'} className="h-12 w-12 rounded-lg object-cover" />
                    <span className="flex-1 truncate">{imageName}</span>
                    <button onClick={() => { setImageBase64(''); setImageName(''); }} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
                  </div>
                )}
                <div className="flex gap-2">
                  <label className="btn-secondary rounded-full px-3 flex items-center cursor-pointer">
                    <ImagePlus className="w-4 h-4" />
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageSelect(e.target.files?.[0])} />
                  </label>
                  <input
                    type="text"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                    placeholder="Type a reply..."
                    className="input flex-1 rounded-full bg-[#202c33] border-transparent"
                  />
                  <button onClick={handleSend} className="btn-primary rounded-full px-3 sm:px-4 flex items-center gap-2">
                    <Send className="w-4 h-4" /> <span className="hidden sm:inline">Send</span>
                  </button>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="flex-1 min-h-0 hidden lg:flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500">Select a conversation to view messages</p>
                <p className="text-slate-600 text-sm mt-1">You can reply to users directly from here</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
