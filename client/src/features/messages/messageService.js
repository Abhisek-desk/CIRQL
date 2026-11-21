import api from "../../services/api";

const messageService = {
  getMessages: async (channelId) => {
    const response = await api.get(`/messages/${channelId}`, {
      params: { limit: 30 },
    });

    return response.data.messages || [];
  },

  sendMessage: async (channelId, content) => {
    const response = await api.post(`/messages/${channelId}`, {
      content,
    });

    return response.data.data;
  },
};

export default messageService;