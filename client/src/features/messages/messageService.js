import api from "../../services/api";

const messageService = {
  getMessages: async (channelId) => {
    const response = await api.get(`/messages/${channelId}`, {
      params: { limit: 30 },
    });

    return response.data.messages || [];
  },

  getMessagesPage: async (channelId, before, limit = 30) => {
    const response = await api.get(`/messages/${channelId}`, {
      params: { before, limit },
    });

    return response.data;
  },

  searchMessages: async (channelId, query, filters = {}) => {
    const params = {
      q: query,
      ...(filters.senderId && { senderId: filters.senderId }),
      ...(filters.dateFilter &&
        filters.dateFilter !== "all" && {
          dateFilter: filters.dateFilter,
        }),
      ...(filters.dateFilter === "custom" &&
        filters.date && { date: filters.date }),
    };

    const response = await api.get(`/messages/${channelId}/search`, {
      params,
    });

    return response.data.messages || [];
  },

  sendMessage: async (channelId, content) => {
    const response = await api.post(`/messages/${channelId}`, {
      content,
    });

    return response.data.data;
  },

  editMessage: async (messageId, content) => {
    const response = await api.patch(`/messages/${messageId}`, {
      content,
    });

    return response.data.data;
  },

  deleteMessage: async (messageId) => {
    const response = await api.delete(`/messages/${messageId}`);
    return response.data;
  },

  toggleReaction: async (messageId, emoji) => {
    const response = await api.post(`/reactions/${messageId}`, {
      emoji,
    });

    return response.data;
  },
};

export default messageService;