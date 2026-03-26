'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Navbar from '@/components/Navbar'

interface Message {
  id: string
  content: string
  senderId: string
  receiverId: string
  read: boolean
  createdAt: string
}

interface Conversation {
  userId: string
  name: string
  avatar: string | null
  lastMessage: string
  unread: number
  updatedAt: string
}

function MessagesContent() {
  const searchParams = useSearchParams()
  const initialWith = searchParams.get('with')
  const router = useRouter()

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedUser, setSelectedUser] = useState<string | null>(initialWith)
  const [selectedName, setSelectedName] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.user) { router.push('/auth/login'); return }
        setCurrentUserId(data.user.id)
      })
  }, [router])

  useEffect(() => {
    if (!currentUserId) return
    fetch('/api/messages')
      .then(r => r.json())
      .then(data => setConversations(data.conversations ?? []))
  }, [currentUserId])

  useEffect(() => {
    if (!selectedUser) return
    fetch(`/api/messages?with=${selectedUser}`)
      .then(r => r.json())
      .then(data => setMessages(data.messages ?? []))

    const conv = conversations.find(c => c.userId === selectedUser)
    if (conv) setSelectedName(conv.name)
  }, [selectedUser, conversations])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedUser) return
    setSending(true)

    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiverId: selectedUser, content: newMessage }),
    })

    if (res.ok) {
      const data = await res.json()
      setMessages(prev => [...prev, data.message])
      setNewMessage('')
      // Update conversation list
      setConversations(prev => {
        const updated = prev.filter(c => c.userId !== selectedUser)
        const existing = prev.find(c => c.userId === selectedUser)
        return [{
          userId: selectedUser,
          name: existing?.name ?? selectedName,
          avatar: existing?.avatar ?? null,
          lastMessage: newMessage,
          unread: 0,
          updatedAt: new Date().toISOString(),
        }, ...updated]
      })
    }
    setSending(false)
  }

  const selectConversation = (conv: Conversation) => {
    setSelectedUser(conv.userId)
    setSelectedName(conv.name)
    setConversations(prev => prev.map(c => c.userId === conv.userId ? { ...c, unread: 0 } : c))
  }

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <>
      <Navbar />
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Messages</h1>

        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ height: 'calc(100vh - 200px)' }}>
          <div className="flex h-full">
            {/* Sidebar */}
            <div className="w-72 border-r border-gray-100 flex flex-col">
              <div className="p-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900 text-sm">Conversations</h2>
              </div>
              <div className="flex-1 overflow-y-auto">
                {conversations.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 text-sm">
                    Aucune conversation.<br />
                    <a href="/browse" className="text-indigo-600 hover:underline mt-2 inline-block">Parcourir les profils</a>
                  </div>
                ) : (
                  conversations.map(conv => (
                    <button
                      key={conv.userId}
                      onClick={() => selectConversation(conv)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition border-b border-gray-50 ${
                        selectedUser === conv.userId ? 'bg-indigo-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {conv.name[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-900 text-sm truncate">{conv.name}</span>
                            {conv.unread > 0 && (
                              <span className="bg-indigo-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                                {conv.unread}
                              </span>
                            )}
                          </div>
                          <p className="text-gray-400 text-xs truncate mt-0.5">{conv.lastMessage}</p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Chat area */}
            <div className="flex-1 flex flex-col">
              {selectedUser ? (
                <>
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
                    <div className="w-9 h-9 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {selectedName[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{selectedName}</p>
                      <p className="text-gray-400 text-xs">En ligne</p>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-5 space-y-3">
                    {messages.length === 0 ? (
                      <div className="text-center text-gray-400 text-sm py-12">
                        Démarrez la conversation !
                      </div>
                    ) : (
                      messages.map(msg => {
                        const isMe = msg.senderId === currentUserId
                        return (
                          <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-xs sm:max-w-md px-4 py-2.5 rounded-2xl text-sm ${
                              isMe
                                ? 'bg-indigo-600 text-white rounded-br-sm'
                                : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                            }`}>
                              <p>{msg.content}</p>
                              <p className={`text-xs mt-1 ${isMe ? 'text-indigo-200' : 'text-gray-400'}`}>
                                {formatTime(msg.createdAt)}
                              </p>
                            </div>
                          </div>
                        )
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  <form onSubmit={sendMessage} className="px-5 py-4 border-t border-gray-100 flex gap-3">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      placeholder="Écrivez un message..."
                      className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <button
                      type="submit"
                      disabled={sending || !newMessage.trim()}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition"
                    >
                      Envoyer
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center text-gray-400">
                    <div className="text-5xl mb-4">💬</div>
                    <p className="font-medium text-gray-600 mb-1">Vos messages</p>
                    <p className="text-sm">Sélectionnez une conversation ou <a href="/browse" className="text-indigo-600 hover:underline">trouvez un profil</a></p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}

export default function MessagesPage() {
  return (
    <Suspense>
      <MessagesContent />
    </Suspense>
  )
}
