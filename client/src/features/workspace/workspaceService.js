import api from "../../services/api";

const workspaceService = {
  getWorkspaces: async () => {
    const response = await api.get("/workspaces");
    return response.data.workspaces;
  },

  createWorkspace: async (data) => {
    const response = await api.post("/workspaces", data);
    return response.data.workspace;
  },

  getChannels: async (workspaceId) => {
    const response = await api.get(`/channels/${workspaceId}`);
    return response.data.channels;
  },

  createChannel: async (workspaceId, data) => {
    const response = await api.post(`/channels/${workspaceId}`, data);
    return response.data.channel;
  },

  getWorkspaceMembers: async (workspaceId) => {
    const response = await api.get(`/workspaces/${workspaceId}/members`);

    return response.data.members || [];
  },
};

export default workspaceService;
