import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { CommentDiscussionIcon, PaperAirplaneIcon, PlusIcon } from '@primer/octicons-react'
import { toast } from 'sonner'
import { errorMessage, getRequest, postRequest } from '../lib/http'
import type { Chat, Message, SendResult } from '../types'
import ChatMessage from './ChatMessage'

// Chat for the active workspace: the chat list on the left, the conversation and
// composer on the right. Dashboard renders it with key={workspaceId}, so another
// workspace's chats can never show here.
export default function ChatPanel({ workspaceId }: { workspaceId: string }) {
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const base = `/workspaces/${workspaceId}/chats`

  // Show the saved draft for a chat (null = the new, not-yet-created chat).
  function showDraft(chatId: string | null) {
    setDraft(loadDraft(draftKey(workspaceId, chatId)))
  }

  // Typing updates the box and the saved draft for the open chat.
  function changeDraft(text: string, chatId: string | null = activeChatId) {
    setDraft(text)
    saveDraft(draftKey(workspaceId, chatId), text)
  }

  // Load the chat list and open the most recent chat.
  useEffect(() => {
    async function loadInitial() {
      try {
        const list = await getRequest<Chat[]>(base)
        setChats(list)
        // Open the newest chat (or the new-chat view) with its saved draft.
        const first = list[0]?.id ?? null
        setActiveChatId(first)
        setDraft(loadDraft(draftKey(workspaceId, first)))
        if (!first) return
        setLoadingMessages(true)
        setMessages(await getRequest<Message[]>(`${base}/${first}/messages`))
      } catch (e) {
        toast.error(`Couldn't load chats: ${errorMessage(e)}`)
      } finally {
        setLoadingMessages(false)
      }
    }
    loadInitial()
  }, [base, workspaceId])

  // Keep the newest message in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  async function openChat(chatId: string) {
    setActiveChatId(chatId)
    showDraft(chatId)
    setLoadingMessages(true)
    try {
      setMessages(await getRequest<Message[]>(`${base}/${chatId}/messages`))
    } catch (e) {
      toast.error(`Couldn't load this chat: ${errorMessage(e)}`)
    } finally {
      setLoadingMessages(false)
    }
  }

  function startNewChat() {
    setActiveChatId(null)
    setMessages([])
    showDraft(null)
  }

  async function send(e?: FormEvent) {
    e?.preventDefault()
    const content = draft.trim()
    if (!content || sending) return

    setSending(true)
    changeDraft('')
    // Show the question and a "Thinking…" placeholder straight away.
    const placeholders = [tempMessage('user', content, 'done'), tempMessage('assistant', null, 'pending')]
    setMessages((list) => [...list, ...placeholders])

    let chatId = activeChatId
    try {
      // The first message of a new chat creates the chat.
      if (!chatId) {
        const chat = await postRequest<Chat>(base)
        chatId = chat.id
        setActiveChatId(chat.id)
        setChats((list) => [{ ...chat, title: content.slice(0, 60) }, ...list])
      }

      const { userMessage, assistantMessage } = await postRequest<SendResult>(`${base}/${chatId}/messages`, {
        content,
      })
      // Swap the placeholders for the saved rows (the answer may be 'failed').
      setMessages((list) => [...list.filter((m) => !placeholders.includes(m)), userMessage, assistantMessage])
    } catch (err) {
      toast.error(`Couldn't send: ${errorMessage(err)}`)
      // Show what the server actually has. If the question wasn't saved, give it back.
      const saved = chatId ? await getRequest<Message[]>(`${base}/${chatId}/messages`).catch(() => null) : null
      setMessages(saved ?? ((list) => list.filter((m) => !placeholders.includes(m))))
      const wasSaved = saved?.some((m) => m.role === 'user' && m.content === content)
      // Put it back under the chat that's open now (it may have just been created).
      if (!wasSaved) changeDraft(content, chatId)
    } finally {
      setSending(false)
    }
  }

  async function retry(messageId: string) {
    setMessages((list) => list.map((m) => (m.id === messageId ? { ...m, status: 'pending', error: null } : m)))
    try {
      const { assistantMessage } = await postRequest<{ assistantMessage: Message }>(
        `${base}/${activeChatId}/messages/${messageId}/retry`,
      )
      setMessages((list) => list.map((m) => (m.id === messageId ? assistantMessage : m)))
    } catch (err) {
      toast.error(`Retry failed: ${errorMessage(err)}`)
      if (activeChatId) openChat(activeChatId)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter adds a line. Ignore Enter while an IME is composing.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }

  // Already on a fresh, empty chat (also true when there are no chats yet), so
  // "New chat" would do nothing. Saved chats always have messages, because a chat
  // row is only created when its first message is sent.
  const isEmptyChat = activeChatId === null && messages.length === 0

  return (
    <div className="chat box">
      <aside className="chat-sidebar">
        <button
          type="button"
          className="btn btn-sm chat-new"
          onClick={startNewChat}
          disabled={sending || isEmptyChat}
          title={isEmptyChat ? 'This chat is already empty. Ask a question to start it.' : undefined}
        >
          <PlusIcon />
          New chat
        </button>
        <ul className="chat-list" aria-label="Chats">
          {chats.map((chat) => (
            <li key={chat.id}>
              <button
                type="button"
                className="chat-list-item"
                aria-current={chat.id === activeChatId}
                onClick={() => openChat(chat.id)}
                disabled={sending}
              >
                {chat.title ?? 'New chat'}
              </button>
            </li>
          ))}
          {chats.length === 0 && <li className="muted chat-list-empty">No chats yet</li>}
        </ul>
      </aside>

      <section className="chat-main">
        <div className="chat-messages">
          {loadingMessages && (
            <div className="blankslate" aria-busy="true">
              <span className="spinner" aria-hidden="true" />
            </div>
          )}

          {!loadingMessages && messages.length === 0 && (
            <div className="blankslate">
              <CommentDiscussionIcon size={24} />
              <h3>Ask about this workspace's documents</h3>
              <p className="muted">Answers come only from documents in this workspace, with sources.</p>
            </div>
          )}

          {!loadingMessages && messages.map((m) => <ChatMessage key={m.id} message={m} onRetry={retry} />)}
          <div ref={bottomRef} />
        </div>

        <form className="chat-composer" onSubmit={send}>
          <textarea
            className="form-control"
            placeholder="Ask a question… (Enter to send, Shift+Enter for a new line)"
            aria-label="Message"
            rows={2}
            maxLength={4000}
            value={draft}
            onChange={(e) => changeDraft(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button type="submit" className="btn btn-primary" disabled={sending || !draft.trim()} aria-label="Send">
            <PaperAirplaneIcon />
          </button>
        </form>
      </section>
    </div>
  )
}

// A local stand-in shown until the server's row arrives.
function tempMessage(role: 'user' | 'assistant', content: string | null, status: Message['status']): Message {
  return {
    id: `temp-${crypto.randomUUID()}`,
    chat_id: '',
    role,
    content,
    citations: [],
    status,
    error: null,
    created_at: new Date().toISOString(),
  }
}

// Unsent text is kept per chat in localStorage (like ChatGPT and Claude), so
// switching chats or reloading doesn't lose it. It's a per-browser convenience,
// not data, so it doesn't go to the server. Storage can be blocked (private
// windows, strict settings); then drafts simply aren't kept.
function draftKey(workspaceId: string, chatId: string | null): string {
  return `draft:${workspaceId}:${chatId ?? 'new'}`
}

function loadDraft(key: string): string {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

function saveDraft(key: string, text: string) {
  try {
    if (text) localStorage.setItem(key, text)
    else localStorage.removeItem(key)
  } catch {
    // Storage unavailable: the draft just isn't kept.
  }
}
