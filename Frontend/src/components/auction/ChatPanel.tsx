'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ChatMessage, RoomParticipant } from '@/lib/types';
import { sendChat, getRoomChats } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';

interface ChatPanelProps {
  roomId: string;
  participantId: string;
  participants: RoomParticipant[];
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 5) return 'now';
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}

export default function ChatPanel({
  roomId,
  participantId,
  participants,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const participantMap = new Map(participants.map((p) => [p.id, p]));

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  // Load initial messages
  useEffect(() => {
    async function load() {
      const result = await getRoomChats(roomId);
      if (result.data) {
        setMessages(result.data);
        setTimeout(scrollToBottom, 50);
      }
    }
    load();
  }, [roomId, scrollToBottom]);

  // Realtime subscription for new messages
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`room-chats-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_chats',
          filter: `room_id=eq.${roomId}`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const newMsg = payload.new as ChatMessage;
          // Attach participant info from our local map
          newMsg.participant = participantMap.get(newMsg.participant_id);
          setMessages((prev) => [...prev, newMsg]);
          setTimeout(scrollToBottom, 50);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, scrollToBottom]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const msg = input.trim();
    if (!msg || sending) return;

    setSending(true);
    setInput('');

    await sendChat({
      room_id: roomId,
      participant_id: participantId,
      message: msg,
    });

    setSending(false);
  }

  return (
    <div className="card flex flex-col h-full overflow-hidden">
      <h3 className="eyebrow mb-2 shrink-0">Chat</h3>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto pr-1 space-y-1.5 min-h-0"
      >
        {messages.length === 0 ? (
          <p className="text-xs text-muted text-center py-4">
            No messages yet
          </p>
        ) : (
          messages.map((msg) => {
            const sender =
              msg.participant || participantMap.get(msg.participant_id);
            const isMe = msg.participant_id === participantId;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] px-2.5 py-1.5 rounded-md text-xs ${
                    isMe
                      ? 'bg-link/15 text-chalk border border-link/25'
                      : 'bg-surface-raised text-chalk border border-hairline'
                  }`}
                >
                  {!isMe && (
                    <span className="text-link text-[10px] font-semibold block mb-0.5">
                      {sender?.squad_name || 'Unknown'}
                    </span>
                  )}
                  <span>{msg.message}</span>
                </div>
                <span className="text-[9px] text-muted mt-0.5 px-1">
                  {timeAgo(msg.created_at)}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="flex gap-1.5 mt-2 shrink-0"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          maxLength={200}
          className="flex-1 px-2.5 py-1.5 bg-surface border border-hairline rounded-md text-xs text-chalk placeholder:text-muted focus:outline-none focus:border-link focus:ring-1 focus:ring-link/40 transition-colors"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="px-3 py-1.5 rounded-md bg-chalk text-void text-xs font-semibold hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          Send
        </button>
      </form>
    </div>
  );
}
