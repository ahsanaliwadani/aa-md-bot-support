import { useEffect, useState, useRef } from 'react';
import { messageApi, ConversationSummary, ChatMessage, Customer } from '../lib/types';
import { Card, Toast, SearchBar } from '../components/ui';
import { Bot, Send, MessageSquare, UserCheck } from 'lucide-react';

export default function Messages() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedJid, setSelectedJid] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [user, setUser] = useState<Customer | null>(null);
  const [reply, setReply] = useState('');
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
    if (!selectedJid || !reply.trim()) return;
    try {
      await messageApi.send(selectedJid, reply);
      setReply('');
      showToast('Message sent');
      messageApi.getConversation(selectedJid).then((res) => setMessages(res.messages));
      loadConversations();
    } catch (err) {
      showToast((err as Error).message);
    }
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
    <div className="space-y-4">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      <h1 className="text-2xl font-bold text-white">Messages</h1>

      <div className="flex flex-col lg:flex-row gap-4 lg:h-[calc(100vh-180px)]">
        {/* Conversation list */}
        <div className="w-full lg:w-80 flex-shrink-0 flex flex-col lg:max-h-full">
          <div className="mb-3">
            <SearchBar value={search} onChange={setSearch} placeholder="Search conversations..." />
          </div>
          <Card className="max-h-80 lg:max-h-none flex-1 p-0 overflow-y-auto">
            {loading ? (
              <div className="text-center py-8 text-slate-500">Loading...</div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">No conversations</div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.jid}
                  onClick={() => setSelectedJid(conv.jid)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-800 hover:bg-surface-800/50 transition-colors ${selectedJid === conv.jid ? 'bg-surface-800' : ''}`}
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
        <div className="min-h-[520px] lg:min-h-0 flex-1 flex flex-col">
          {selectedJid ? (
            <Card className="flex-1 flex flex-col p-0">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary-400" />
                  <div>
                  <span className="text-white font-medium">+{selectedJid.split('@')[0]}</span>
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
              <div className="h-[420px] lg:h-auto lg:flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">No messages</div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg._id} className={`flex ${msg.direction === 'OUTGOING' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] px-3 py-2 rounded-lg text-sm ${msg.direction === 'OUTGOING' ? 'bg-primary-600 text-white' : 'bg-surface-900 text-slate-300'}`}>
                        <div className="whitespace-pre-wrap break-words">{msg.body}</div>
                        <div className={`text-xs mt-1 ${msg.direction === 'OUTGOING' ? 'text-white/60' : 'text-slate-500'}`}>
                          {new Date(msg.at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className="p-3 border-t border-slate-800 flex gap-2">
                <input
                  type="text"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                  placeholder="Type a reply..."
                  className="input flex-1"
                />
                <button onClick={handleSend} className="btn-primary flex items-center gap-2">
                  <Send className="w-4 h-4" /> Send
                </button>
              </div>
            </Card>
          ) : (
            <Card className="flex-1 flex items-center justify-center">
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
