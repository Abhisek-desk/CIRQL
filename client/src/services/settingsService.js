import api from "./api";

const settingsService = {
  async getNotificationPreferences() {
    const response = await api.get("/settings/notifications");
    return response.data.preferences;
  },

  async updateNotificationPreferences(updates) {
    const response = await api.patch("/settings/notifications", updates);
    return response.data.preferences;
  },
};

export default settingsService;
