// TODO: xóa khi API sẵn sàng

export const MOCK_CURRENT_USER_ID = 'user_001'

export const mockConversations = [
  {
    _id: 'conv_001',
    members: [
      { _id: 'user_001', fullName: 'User A', avatar: null },
      { _id: 'user_002', fullName: 'User B', avatar: null },
    ],
    lastMessage: { text: 'Hello', createdAt: '2026-04-24T08:30:00Z' },
    updatedAt: '2026-04-24T08:30:00Z',
  },
  {
    _id: 'conv_002',
    members: [
      { _id: 'user_001', fullName: 'User A', avatar: null },
      { _id: 'user_003', fullName: 'User C', avatar: null },
    ],
    lastMessage: { text: 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua Ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat', createdAt: '2026-04-23T21:00:00Z' },
    updatedAt: '2026-04-23T21:00:00Z',
  },
  {
    _id: 'conv_003',
    members: [
      { _id: 'user_001', fullName: 'User A', avatar: null },
      { _id: 'user_004', fullName: 'User D', avatar: null },
    ],
    lastMessage: { text: 'Chat GPT Gemini Cursor Claude Deepseek Grok  ', createdAt: '2026-04-22T14:15:00Z' },
    updatedAt: '2026-04-22T14:15:00Z',
  },
]

const makeMsg = (id, convId, senderId, text, createdAt) => ({
  _id: id,
  conversationId: convId,
  senderId,
  text,
  image: null,
  isRead: true,
  createdAt,
  updatedAt: createdAt,
})

export const mockMessages = {
  conv_001: [
    makeMsg('m002', 'conv_001', 'user_001', 'Hello', '2026-04-24T07:01:00Z'),
    makeMsg('m003', 'conv_001', 'user_002', 'Xin chào', '2026-04-24T07:05:00Z'),
    makeMsg('m004', 'conv_001', 'user_001', '124332345', '2026-04-24T07:10:00Z'),
    makeMsg('m005', 'conv_001', 'user_002', 'Lorem ipsum dolor sit amet.', '2026-04-24T07:11:00Z'),
    makeMsg('m006', 'conv_001', 'user_001', 'Hello', '2026-04-24T07:12:00Z'),
  ],
  conv_002: [
    makeMsg('m102', 'conv_002', 'user_001', 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua Ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur Excepteur sint occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum', '2026-04-23T20:05:00Z'),
    makeMsg('m101', 'conv_002', 'user_003', 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua Ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur Excepteur sint occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium totam rem aperiam eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo', '2026-04-23T20:00:00Z'),
    makeMsg('m103', 'conv_002', 'user_003', 'Okokok', '2026-04-23T21:00:00Z'),
  ],
  conv_003: [
    makeMsg('m200', 'conv_003', 'user_001', 'Chat GPT Gemini Cursor Claude Deepseek Grok  ', '2026-04-22T14:00:00Z'),
    makeMsg('m201', 'conv_003', 'user_001', 'Hello', '2026-04-22T14:00:00Z'),
    makeMsg('m202', 'conv_003', 'user_004', 'Goodbye', '2026-04-22T14:15:00Z'),
    makeMsg('m203', 'conv_003', 'user_001', 'See you later!', '2026-04-22T14:20:00Z'),
    makeMsg('m204', 'conv_003', 'user_004', 'Take care!', '2026-04-22T14:25:00Z'),
    makeMsg('m205', 'conv_003', 'user_001', 'Goodbye for now!', '2026-04-22T14:30:00Z'),
    makeMsg('m206', 'conv_003', 'user_004', 'See you soon!', '2026-04-22T14:35:00Z'),
    makeMsg('m207', 'conv_003', 'user_001', 'Take care!', '2026-04-22T14:40:00Z'),
    makeMsg('m208', 'conv_003', 'user_004', 'Goodbye!', '2026-04-22T14:45:00Z'),
    makeMsg('m209', 'conv_003', 'user_001', 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua Ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur Excepteur sint occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium totam rem aperiam eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo', '2026-04-22T14:50:00Z'),
    makeMsg('m210', 'conv_003', 'user_001', 'Hello again!', '2026-04-22T14:55:00Z'),
    makeMsg('m211', 'conv_003', 'user_001', 'test scroll', '2026-04-22T14:50:00Z'),
  ],
}

// Giả lập GET /api/messages/:conversationId?page=1&limit=20
export function getMockMessages(conversationId, page = 1, limit = 20) {
  const all = mockMessages[conversationId] ?? []
  const total = all.length
  // Tin nhắn được sắp xếp tăng dần theo thời gian; page 1 = mới nhất
  const startIndex = Math.max(0, total - page * limit)
  const endIndex = total - (page - 1) * limit
  const messages = all.slice(startIndex, endIndex)
  return {
    messages,
    pagination: {
      page,
      limit,
      total,
      hasMore: startIndex > 0,
    },
  }
}