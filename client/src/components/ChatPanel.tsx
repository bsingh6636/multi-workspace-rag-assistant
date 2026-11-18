import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { CommentDiscussionIcon, PaperAirplaneIcon, PlusIcon } from '@primer/octicons-react'
import { toast } from 'sonner'
import { errorMessage, getRequest, postRequest } from '../lib/http'
import type { Chat, Message, SendResult } from '../types'
import ChatMessage from './ChatMessage'

// Chat for the active workspace: the chat list on the left, the conversation and
// composer on the right. Dashboard renders it with key={workspaceId}, so another
// workspace's chats can never show here.
// onChange: an answer may have saved or completed a task and logged tool calls,
// so the Dashboard refetches its tab counts.
export default function ChatPanel({ workspaceId, onChange }: { workspaceId: string; onChange: () => void }) {
  const [chats, setChats] = useState<Chat[]>([])
  const [loadingChats, setLoadingChats] = useState(true)
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  // Starts true: until the list says whether there's a chat to open, show the
  // loading state, not the "ask a question" empty state.
  const [loadingMessages, setLoadingMessages] = useState(true)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

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
        setLoadingChats(false) // show the list now, without waiting for the first chat's messages
        // Open the newest chat (or the new-chat view) with its saved draft.
        const first = list[0]?.id ?? null
        setActiveChatId(first)
        setDraft(loadDraft(draftKey(workspaceId, first)))
        focusInput(inputRef.current)
        if (!first) return
        setMessages(await getRequest<Message[]>(`${base}/${first}/messages`))
      } catch (e) {
        toast.error(`Couldn't load chats: ${errorMessage(e)}`)
      } finally {
        setLoadingChats(false)
        setLoadingMessages(false)
      }
    }
    loadInitial()
  }, [base, workspaceId])

  // Keep the newest message in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  // Typing anywhere on the page (when nothing editable has focus) goes into the
  // message box, like ChatGPT. Focusing it during keydown makes the browser
  // put that first character there too.
  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return // shortcuts, arrows, Tab…
      const target = e.target as HTMLElement
      // Typing in a field stays there; Space on a focused button or link must still press it.
      if (target.closest('input, textarea, select, [contenteditable="true"], button, a, summary, [role]')) return
      if (document.querySelector('dialog[open]')) return // a modal is open
      inputRef.current?.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  // The message box grows with its text, up to about eight lines, then scrolls.
  useEffect(() => {
    const box = inputRef.current
    if (!box) return
    box.style.height = 'auto'
    box.style.height = `${Math.min(box.scrollHeight, 200)}px`
  }, [draft])

  async function openChat(chatId: string) {
    setActiveChatId(chatId)
    showDraft(chatId)
    focusInput(inputRef.current)
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
    focusInput(inputRef.current)
  }

  async function send(e?: FormEvent) {
    e?.preventDefault()
    const content = draft.trim()
    if (!content || sending) return

    setSending(true)
    changeDraft('')
    if (activeChatId) moveToTop(activeChatId)
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
        const now = new Date().toISOString()
        setChats((list) => [{ ...chat, title: content.slice(0, 60), last_message_at: now }, ...list])
      }

      const { userMessage, assistantMessage } = await postRequest<SendResult>(`${base}/${chatId}/messages`, {
        content,
        timeZone: browserTimeZone(),
      })
      // Swap the placeholders for the saved rows (the answer may be 'failed').
      setMessages((list) => [...list.filter((m) => !placeholders.includes(m)), userMessage, assistantMessage])
    } catch (err) {
      toast.error(`Couldn't send: ${errorMessage(err)}`)
      // The request is over, so stop "Thinking…" now. The refetch below can take
      // several seconds (GETs retry while the server is down).
      setMessages((list) => list.filter((m) => m !== placeholders[1]))
      // Show what the server actually has. If the question wasn't saved, give it back.
      const saved = chatId ? await getRequest<Message[]>(`${base}/${chatId}/messages`).catch(() => null) : null
      setMessages(saved ?? ((list) => list.filter((m) => !placeholders.includes(m))))
      const wasSaved = saved?.some((m) => m.role === 'user' && m.content === content)
      // Put it back under the chat that's open now (it may have just been created).
      if (!wasSaved) changeDraft(content, chatId)
    } finally {
      setSending(false)
      onChange()
    }
  }

  // A chat you write in becomes the most recent one, as the server will list it
  // after a reload (sorted by last_message_at).
  function moveToTop(chatId: string) {
    const now = new Date().toISOString()
    setChats((list) => {
      const chat = list.find((c) => c.id === chatId)
      return chat ? [{ ...chat, last_message_at: now }, ...list.filter((c) => c !== chat)] : list
    })
  }

  async function retry(messageId: string) {
    setMessages((list) => list.map((m) => (m.id === messageId ? { ...m, status: 'pending', error: null } : m)))
    try {
      const { assistantMessage } = await postRequest<{ assistantMessage: Message }>(
        `${base}/${activeChatId}/messages/${messageId}/retry`,
        { timeZone: browserTimeZone() },
      )
      setMessages((list) => list.map((m) => (m.id === messageId ? assistantMessage : m)))
    } catch (err) {
      toast.error(`Retry failed: ${errorMessage(err)}`)
      if (activeChatId) openChat(activeChatId)
    } finally {
      onChange()
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
  const activeTitle = chats.find((c) => c.id === activeChatId)?.title ?? 'New chat'
  const latestAnswerId = messages.findLast((m) => m.role === 'assistant')?.id

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
        <nav className="chat-list" aria-label="Chats" aria-busy={loadingChats}>
          {loadingChats && <ChatListSkeleton />}
          {groupByDate(chats).map((group) => (
            <section key={group.label} className="chat-group">
              <h3 className="chat-group-label">{group.label}</h3>
              <ul>
                {group.chats.map((chat) => (
                  <li key={chat.id}>
                    <button
                      type="button"
                      className="chat-list-item"
                      aria-current={chat.id === activeChatId}
                      onClick={() => openChat(chat.id)}
                      disabled={sending}
                      title={chat.title ?? undefined}
                    >
                      {chat.title ?? 'New chat'}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {!loadingChats && chats.length === 0 && <p className="muted chat-list-empty">No chats yet</p>}
        </nav>
      </aside>

      <section className="chat-main">
        <header className="chat-header">
          {loadingChats ? (
            <div className="skeleton chat-title-skeleton" aria-hidden="true" />
          ) : (
            <h2 className="chat-title" title={activeTitle}>
              {activeTitle}
            </h2>
          )}
        </header>

        <div className="chat-messages" aria-busy={loadingMessages}>
          {/* Messages sit in a centered column; the scrollbar stays at the panel's edge. */}
          <div className="chat-column chat-thread">
            {loadingMessages && <MessagesSkeleton />}

            {!loadingMessages && messages.length === 0 && (
              <div className="blankslate">
                <CommentDiscussionIcon size={24} />
                <h3>Ask about this workspace's documents</h3>
                <p className="muted">Answers come only from documents in this workspace, with sources.</p>
              </div>
            )}

            {!loadingMessages && messages.map((m) => (
                <ChatMessage key={m.id} message={m} onRetry={retry} latest={m.id === latestAnswerId} />
              ))}
            <div ref={bottomRef} />
          </div>
        </div>

        <form className="chat-composer chat-column" onSubmit={send}>
          {/* One rounded box with the send button inside, like ChatGPT's composer. */}
          <div className="chat-input">
            <textarea
              ref={inputRef}
              placeholder="Ask about this workspace's documents…"
              aria-label="Message"
              aria-describedby="chat-hint"
              rows={1}
              maxLength={4000}
              value={draft}
              onChange={(e) => changeDraft(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              type="submit"
              className="btn btn-primary btn-icon chat-send"
              disabled={sending || !draft.trim()}
              aria-label="Send"
            >
              <PaperAirplaneIcon />
            </button>
          </div>
          <p id="chat-hint" className="chat-hint">
            Enter to send, Shift+Enter for a new line. Answers come only from this workspace's documents.
          </p>
        </form>
      </section>
    </div>
  )
}

// Grey placeholder rows shaped like the chat list, shown while it loads.
// Varied widths so it reads as titles, not a table. Hidden from screen readers
// (the list has aria-busy instead).
const SKELETON_WIDTHS = ['85%', '65%', '75%', '55%', '80%', '60%']

function ChatListSkeleton() {
  return (
    <div className="chat-group" aria-hidden="true">
      <div className="skeleton chat-skeleton-label" />
      {SKELETON_WIDTHS.map((width, i) => (
        <div key={i} className="skeleton chat-skeleton-row" style={{ width }} />
      ))}
    </div>
  )
}

// Placeholder shaped like a conversation: a question bubble on the right,
// then lines of answer on the left, twice.
function MessagesSkeleton() {
  return (
    <div className="msg-skeleton" aria-hidden="true">
      <div className="skeleton msg-skeleton-question" style={{ width: '38%' }} />
      <div className="msg-skeleton-answer">
        <div className="skeleton" style={{ width: '92%' }} />
        <div className="skeleton" style={{ width: '80%' }} />
        <div className="skeleton" style={{ width: '45%' }} />
      </div>
      <div className="skeleton msg-skeleton-question" style={{ width: '28%' }} />
      <div className="msg-skeleton-answer">
        <div className="skeleton" style={{ width: '85%' }} />
        <div className="skeleton" style={{ width: '60%' }} />
      </div>
    </div>
  )
}

// Chat list sections by last activity, like ChatGPT's sidebar. Empty sections
// are left out. Days are counted from local midnight.
const DAY_MS = 24 * 60 * 60 * 1000

function groupByDate(chats: Chat[]): { label: string; chats: Chat[] }[] {
  const midnight = new Date()
  midnight.setHours(0, 0, 0, 0)
  const today = midnight.getTime()
  const sections = [
    { label: 'Today', from: today },
    { label: 'Yesterday', from: today - DAY_MS },
    { label: 'Previous 7 days', from: today - 7 * DAY_MS },
    { label: 'Previous 30 days', from: today - 30 * DAY_MS },
    { label: 'Older', from: -Infinity },
  ].map((s) => ({ ...s, chats: [] as Chat[] }))

  // chats is already newest first, so each section stays newest first.
  for (const chat of chats) {
    const time = new Date(chat.last_message_at).getTime()
    // An unreadable date (NaN) matches no section, so it goes under Older.
    const section = sections.find((s) => time >= s.from) ?? sections[sections.length - 1]
    section.chats.push(chat)
  }
  return sections.filter((s) => s.chats.length > 0)
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

// Put the cursor in the message box, except on touch screens, where focusing
// pops up the on-screen keyboard over the conversation.
function focusInput(box: HTMLTextAreaElement | null) {
  if (window.matchMedia('(hover: none)').matches) return
  box?.focus()
}

// The server tells the model today's date in this zone, so "tomorrow" means the
// user's tomorrow (save_task due dates).
function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
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
