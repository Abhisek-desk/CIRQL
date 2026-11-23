import api from "../../services/api";

const conversationService = {
  getConversations: async () => {
    const response = await api.get("/conversations");
    return response.data;
  },

  startConversation: async (recipientId) => {
    const response = await api.post("/conversations", { recipientId });
    return response.data;
  },

  getMessages: async (conversationId, before, limit = 30) => {
    const response = await api.get(
      `/conversations/${conversationId}/messages`,
      {
        params: { before, limit },
      },
    );

    return response.data;
  },

  markRead: async (conversationId) => {
    const response = await api.post(
      `/conversations/${conversationId}/read`,
    );

    return response.data;
  },

  editMessage: async (messageId, content) => {
    const response = await api.patch(
      `/conversations/messages/${messageId}`,
      { content },
    );

    return response.data;
  },

  deleteMessage: async (messageId) => {
    const response = await api.delete(
      `/conversations/messages/${messageId}`,
    );

    return response.data;
  },
};

export default conversationService;
