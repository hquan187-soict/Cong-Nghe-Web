users
- email
- fullName
- password
- avatar

conversations
- members -> User[]
- lastMessage -> Message

messages
- conversationId -> Conversation
- senderId -> User
- text
- image
- isRead

calls
- conversationId -> Conversation
- callerId -> User
- startedAt
- endedAt