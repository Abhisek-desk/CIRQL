
import api from "../../services/api";

const readStateService = {
  getUnreadCounts: async (workspaceId) => {
    const response = await api.get(
      `/read-states/workspace/${workspaceId}`
    );

    return response.data.unreadCounts || [];
  },

  markChannelAsRead: async (channelId) => {
    const response = await api.post(
      `/read-states/${channelId}/read`
    );

    return response.data;
  },

  getChannelReadReceipts: async (channelId) => {
    const response = await api.get(
      `/read-states/${channelId}/receipts`
    );

    return response.data.readStates || [];
  },
};

export default readStateService;
