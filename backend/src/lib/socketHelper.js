import Conversation from "../models/Conversation.js";

const contactsCache = new Map();
const CONTACTS_CACHE_TTL = 30000;

export async function getContactSocketIds(userId, userSocketsMap) {
  const now = Date.now();
  let contactIds;

  const cached = contactsCache.get(userId);
  if (cached && now - cached.cachedAt < CONTACTS_CACHE_TTL) {
    contactIds = cached.contactIds;
  } else {
    const conversations = await Conversation.find({
      members: userId,
    }).select("members");

    contactIds = new Set();
    conversations.forEach((conversation) => {
      conversation.members.forEach((memberId) => {
        const id = memberId.toString();
        if (id !== userId.toString()) {
          contactIds.add(id);
        }
      });
    });

    contactsCache.set(userId, { contactIds, cachedAt: now });
  }

  const socketIds = [];
  for (const contactId of contactIds) {
    const sockets = userSocketsMap.get(contactId);
    if (sockets) {
      sockets.forEach((sid) => socketIds.push(sid));
    }
  }
  return socketIds;
}

export function invalidateContactsCache(userId) {
  contactsCache.delete(userId);
}
