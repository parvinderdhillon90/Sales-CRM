'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Send, Inbox, Mail, MailOpen, Plus } from 'lucide-react';

export default function MessagesPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [me, setMe] = useState<any>(null);
  const [box, setBox] = useState<'inbox' | 'sent'>('inbox');
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [composeForm, setComposeForm] = useState({ recipient_id: '', subject: '', content: '', deal_id: '' });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const [m, u, me_] = await Promise.all([
      fetch(`/api/messages?box=${box}`).then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
      fetch('/api/me').then(r => r.json()),
    ]);
    setMessages(m); setUsers(u); setMe(me_); setLoading(false);
  }

  useEffect(() => { load(); }, [box]);

  async function openMessage(msg: any) {
    setSelected(msg);
    if (box === 'inbox' && !msg.read_at) {
      await fetch('/api/messages', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: msg.id }),
      });
      load();
    }
  }

  async function sendMessage() {
    setSending(true); setError('');
    const res = await fetch('/api/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...composeForm, deal_id: composeForm.deal_id || null }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setSending(false); return; }
    setShowCompose(false);
    setComposeForm({ recipient_id: '', subject: '', content: '', deal_id: '' });
    setBox('sent'); load(); setSending(false);
  }

  const otherUsers = users.filter((u: any) => u.id !== me?.id);
  const unread = messages.filter(m => !m.read_at && box === 'inbox').length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Messages</h1>
          {unread > 0 && <p className="text-blue-600 text-sm font-medium mt-0.5">{unread} unread message{unread > 1 ? 's' : ''}</p>}
        </div>
        <button onClick={() => setShowCompose(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Compose
        </button>
      </div>

      <div className="flex gap-2 mb-5">
        <button onClick={() => { setBox('inbox'); setSelected(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${box === 'inbox' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          <Inbox className="w-4 h-4" /> Inbox
          {unread > 0 && box !== 'inbox' && <span className="bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">{unread}</span>}
        </button>
        <button onClick={() => { setBox('sent'); setSelected(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${box === 'sent' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          <Send className="w-4 h-4" /> Sent
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Message List */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="py-12 text-center text-slate-400">Loading...</div>
          ) : messages.length === 0 ? (
            <div className="py-12 text-center text-slate-400">No messages</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {messages.map((m: any) => {
                const isUnread = !m.read_at && box === 'inbox';
                return (
                  <button key={m.id} onClick={() => openMessage(m)}
                    className={`w-full text-left p-4 hover:bg-slate-50 transition-colors ${selected?.id === m.id ? 'bg-blue-50' : ''} ${isUnread ? 'bg-blue-50/50' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {isUnread ? <Mail className="w-4 h-4 text-blue-500 shrink-0" /> : <MailOpen className="w-4 h-4 text-slate-300 shrink-0" />}
                        <div className="min-w-0">
                          <div className={`text-sm truncate ${isUnread ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                            {box === 'inbox' ? m.other_name : `To: ${m.other_name}`}
                          </div>
                          <div className="text-xs text-slate-500 truncate">{m.subject || '(no subject)'}</div>
                        </div>
                      </div>
                      <div className="text-xs text-slate-400 shrink-0">
                        {new Date(m.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-1 pl-6">{m.content}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Message Detail */}
        <div className="lg:col-span-2">
          {selected ? (
            <div className="card p-6">
              <div className="border-b border-slate-100 pb-4 mb-5">
                <h2 className="font-semibold text-slate-900 text-lg">{selected.subject || '(no subject)'}</h2>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-slate-500">
                  <span>From: <span className="text-slate-700 font-medium">{box === 'inbox' ? selected.other_name : me?.name}</span></span>
                  <span>To: <span className="text-slate-700 font-medium">{box === 'sent' ? selected.other_name : me?.name}</span></span>
                  <span>{new Date(selected.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                {selected.deal_title && (
                  <div className="mt-2">
                    <Link href={`/dashboard/deals/${selected.deal_id}`} className="text-xs text-blue-600 hover:underline">
                      Re: {selected.deal_title}
                    </Link>
                  </div>
                )}
              </div>
              <div className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">{selected.content}</div>
              <div className="mt-6 pt-4 border-t border-slate-100">
                <button onClick={() => {
                  const sender = box === 'inbox' ? messages.find(m => m.id === selected.id) : null;
                  setComposeForm({
                    recipient_id: box === 'inbox' ? String(selected.sender_id || '') : String(selected.recipient_id),
                    subject: `Re: ${selected.subject || ''}`,
                    content: '',
                    deal_id: selected.deal_id ? String(selected.deal_id) : '',
                  });
                  setShowCompose(true);
                }} className="btn-secondary flex items-center gap-2 text-sm">
                  <Send className="w-4 h-4" /> Reply
                </button>
              </div>
            </div>
          ) : (
            <div className="card p-12 text-center text-slate-400">
              <Mail className="w-8 h-8 mx-auto mb-3 text-slate-300" />
              <p>Select a message to read</p>
            </div>
          )}
        </div>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">New Message</h2>
              <button onClick={() => setShowCompose(false)} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="label">To *</label>
                <select className="input" value={composeForm.recipient_id} onChange={e => setComposeForm({...composeForm, recipient_id: e.target.value})}>
                  <option value="">Select recipient</option>
                  {otherUsers.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                </select>
              </div>
              <div>
                <label className="label">Subject</label>
                <input className="input" value={composeForm.subject} onChange={e => setComposeForm({...composeForm, subject: e.target.value})} placeholder="Message subject..." />
              </div>
              <div>
                <label className="label">Message *</label>
                <textarea className="input" rows={5} value={composeForm.content} onChange={e => setComposeForm({...composeForm, content: e.target.value})} placeholder="Write your message..." />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowCompose(false)} className="btn-secondary">Cancel</button>
                <button onClick={sendMessage} disabled={sending || !composeForm.recipient_id || !composeForm.content}
                  className="btn-primary flex items-center gap-2">
                  <Send className="w-4 h-4" /> {sending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
