import { useEffect, useState, useRef } from 'react';
import { messageApi, ConversationSummary, ChatMessage, Customer } from '../lib/types';
import { Card, Toast, SearchBar } from '../components/ui';
import { Send, MessageSquare } from 'lucide-react';

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
    const interval = setInterval(loadConversations, 10000);
    return () => clearInterval(interval);
  }, [search]);

  useEffect(() => {
    if (!selectedJid) return;
    messageApi.getConversation(selectedJid).then((res) => {
      setMessages(res.messages);
      setUser(res.user);
    });
    const interval = setInterval(() => {
      messageApi.getConversation(selectedJid).then((res) => setMessages(res.messages));
    }, 5000);
    return () => clearInterval(interval);
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

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      <h1 className="text-2xl font-bold text-white">Messages</h1>

      <div className="flex gap-4 h-[calc(100vh-180px)]">
        {/* Conversation list */}
        <div className="w-80 flex-shrink-0 flex flex-col">
          <div className="mb-3">
            <SearchBar value={search} onChange={setSearch} placeholder="Search conversations..." />
          </div>
          <Card className="flex-1 p-0 overflow-y-auto">
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
        <div className="flex-1 flex flex-col">
          {selectedJid ? (
            <Card className="flex-1 flex flex-col p-0">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary-400" />
                <div>
                  <span className="text-white font-medium">+{selectedJid.split('@')[0]}</span>
                  {user && <span className="text-slate-500 text-sm ml-2">{user.country}</span>}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">No messages</div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg._id} className={`flex ${msg.direction === 'OUTGOING' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] px-3 py-2 rounded-lg text-sm ${msg.direction === 'OUTGOING' ? 'bg-primary-600 text-white' : 'bg-surface-900 text-slate-300'}`}>
                        <div>{msg.body}</div>
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
