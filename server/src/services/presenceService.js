const onlineUsers = new Map();

export const addOnlineUser = (userId, socketId) => {
  const id = userId.toString();

  if (!onlineUsers.has(id)) {
    onlineUsers.set(id, new Set());
  }

  onlineUsers.get(id).add(socketId);
};

export const removeOnlineUser = (userId, socketId) => {
  const id = userId.toString();

  if (!onlineUsers.has(id)) {
    return false;
  }

  const sockets = onlineUsers.get(id);

  sockets.delete(socketId);

  if (sockets.size === 0) {
    onlineUsers.delete(id);
    return true;
  }

  return false;
};

export const isUserOnline = (userId) => {
  return onlineUsers.has(userId.toString());
};

export const getOnlineUsers = () => {
  return Array.from(onlineUsers.keys());
};