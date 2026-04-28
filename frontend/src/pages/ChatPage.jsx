import { useState } from 'react'
import ChatWindow from '../components/ChatWindow'
//thay bằng import Sidebar from '../components/Sidebar' khi có sidebar riel
// import Sidebar from '../components/Sidebar'
import { mockConversations, MOCK_CURRENT_USER_ID } from '../services/mockData' //xóa khi có API

// Sidebar placeholder — xóa khi có component thật
function SidebarPlaceholder({ conversations, selectedId, onSelectConversation }) {
  return (
    <aside className="chat-sidebar">
      <h2 className="chat-sidebar__title">Tin nhắn</h2>
      <ul className="conv-list">
        {conversations.map((conv) => {
          const other = conv.members.find((m) => m._id !== MOCK_CURRENT_USER_ID) // sxóa khi có API
          return (
            <li
              key={conv._id}
              className={`conv-list__item ${selectedId === conv._id ? 'conv-list__item--active' : ''}`}
              onClick={() => onSelectConversation(conv._id)}
            >
              <div className="conv-list__avatar">
                {other?.fullName?.[0] ?? '?'}
              </div>
              <div className="conv-list__info">
                <span className="conv-list__name">{other?.fullName ?? 'Người dùng'}</span>
                <span className="conv-list__last-msg">{conv.lastMessage?.text ?? ''}</span>
              </div>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}

function ChatPage() {
  const [selectedConversationId, setSelectedConversationId] = useState(null)

  return (
    <div className="chat-layout">
      {/* Cột trái — Sidebar */}
      <SidebarPlaceholder
        conversations={mockConversations}
        selectedId={selectedConversationId}
        onSelectConversation={setSelectedConversationId}
      />
      {/* Cột phải — ChatWindow */}
      <main className="chat-main">
        <ChatWindow conversationId={selectedConversationId} />
      </main>
    </div>
  )
}

export default ChatPage
