import api from "../../services/api";

const presenceService = {
  updateStatus: async (payload) => {
    const { data } = await api.put("/presence/status", payload);
    return data.status;
  },

  clearStatus: async () => {
    const { data } = await api.delete("/presence/status");
    return data;
  },
};

export default presenceService;
