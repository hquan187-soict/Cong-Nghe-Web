import Conversation from "../models/Conversation.js";

export async function getContactSocketIds(userId, userSocketsMap) {
  const conversations = await Conversation.find({
    members: userId,
  }).select("members");

  const contactIds = new Set();

  conversations.forEach((conversation) => {
    conversation.members.forEach((memberId) => {
      const id = memberId.toString();

      if (id !== userId.toString()) {
        contactIds.add(id);
      }
    });
  });

  return [...contactIds]
    .map((contactId) => userSocketsMap[contactId])
    .filter(Boolean);
}