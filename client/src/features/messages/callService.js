import api from "../../services/api";

const callService = {
  getIceServers: async () => {
    const response = await api.get("/calls/ice-servers");
    return response.data;
  },

  getHistory: async (conversationId) => {
    const response = await api.get(`/calls/history/${conversationId}`);
    return response.data;
  },
};

export default callService;
