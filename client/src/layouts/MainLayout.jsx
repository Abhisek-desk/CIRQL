import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { AnimatePresence, motion } from "motion/react";
import toast from "react-hot-toast";

import WorkspaceSidebar from "../components/common/WorkspaceSidebar";
import ChannelSidebar from "../components/channels/ChannelSidebar";
import ChatHeader from "../components/chat/ChatHeader";
import ChatMessages from "../components/chat/ChatMessages";
import MessageComposer from "../components/chat/MessageComposer";
import CreateItemModal from "../components/common/CreateItemModal";

import workspaceService from "../features/workspace/workspaceService";
import messageService from "../features/messages/messageService";

import { connectSocket, disconnectSocket } from "../services/socket";

export default function MainLayout() {
  const user = useSelector((state) => state.auth.user);
  const accessToken = useSelector((state) => state.auth.accessToken);
  const token = accessToken || localStorage.getItem("cirql-access-token");

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);

  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);

  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [channelModalOpen, setChannelModalOpen] = useState(false);

  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [loadingChannels, setLoadingChannels] = useState(false);

  // SOCKET CONNECTION + ONLINE PRESENCE
  useEffect(() => {
    if (!token) return;

    const socket = connectSocket(token);
    if (!socket) return;

    const handleConnect = () => setSocketConnected(true);
    const handleDisconnect = () => {
      setSocketConnected(false);
      setTypingUsers([]);
    };

    const handlePresence = (payload) => {
      setOnlineUsers(payload?.onlineUsers || []);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("presence:online", handlePresence);
    socket.on("presence:offline", handlePresence);

    setSocketConnected(socket.connected);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("presence:online", handlePresence);
      socket.off("presence:offline", handlePresence);
      disconnectSocket();
    };
  }, [token]);

  // LOAD WORKSPACES
  const loadWorkspaces = useCallback(async () => {
    try {
      setLoadingWorkspaces(true);

      const data = await workspaceService.getWorkspaces();
      setWorkspaces(data);

      setSelectedWorkspace((current) => {
        if (current && data.some((item) => item._id === current._id)) {
          return data.find((item) => item._id === current._id);
        }

        return data[0] || null;
      });
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not load workspaces");
    } finally {
      setLoadingWorkspaces(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  // LOAD CHANNELS
  useEffect(() => {
    let active = true;

    const loadChannels = async () => {
      if (!selectedWorkspace?._id) {
        setChannels([]);
        setSelectedChannel(null);
        return;
      }

      try {
        setLoadingChannels(true);
        setChannels([]);
        setSelectedChannel(null);

        const data = await workspaceService.getChannels(selectedWorkspace._id);

        if (!active) return;

        setChannels(data);
        setSelectedChannel(data[0] || null);
      } catch (error) {
        if (active) {
          toast.error(
            error.response?.data?.message || "Could not load channels",
          );
        }
      } finally {
        if (active) setLoadingChannels(false);
      }
    };

    loadChannels();

    return () => {
      active = false;
    };
  }, [selectedWorkspace?._id]);

  // TYPING EVENTS
  const handleTypingChange = useCallback(
    (isTyping) => {
      const channelId = selectedChannel?._id;
      const socket = connectSocket(token);

      if (!channelId || !socket?.connected) return;

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      if (isTyping) {
        if (!isTypingRef.current) {
          console.log("SENDING TYPING START:", channelId);
          socket.emit("typing:start", channelId);
          isTypingRef.current = true;
        }

        typingTimeoutRef.current = setTimeout(() => {
          socket.emit("typing:stop", channelId);
          isTypingRef.current = false;
          typingTimeoutRef.current = null;
        }, 1200);
      } else if (isTypingRef.current) {
        socket.emit("typing:stop", channelId);
        isTypingRef.current = false;
      }
    },
    [selectedChannel?._id, token],
  );

  // LOAD MESSAGE HISTORY + JOIN CHANNEL + TYPING LISTENERS
  useEffect(() => {
    const channelId = selectedChannel?._id;

    if (!channelId) {
      setMessages([]);
      setTypingUsers([]);
      return;
    }

    const socket = connectSocket(token);
    if (!socket) return;

    let active = true;

    setMessages([]);
    setTypingUsers([]);
    setLoadingMessages(true);

    const handleNewMessage = (message) => {
      if (!active) return;

      const incomingChannelId = message.channel?._id || message.channel;

      if (String(incomingChannelId) !== String(channelId)) return;

      setMessages((previous) => {
        const exists = previous.some(
          (item) => String(item._id) === String(message._id),
        );

        if (exists) return previous;

        return [...previous, message];
      });
    };

    const handleTypingStart = (payload) => {
      console.log("RECEIVED TYPING START:", payload);
      if (!active || String(payload?.channelId) !== String(channelId)) return;

      const currentUserId = user?.id || user?._id;

      if (String(payload.userId) === String(currentUserId)) return;

      setTypingUsers((previous) => {
        if (previous.some((item) => item.userId === payload.userId)) {
          return previous;
        }

        return [
          ...previous,
          {
            userId: payload.userId,
            name: payload.name || "Someone",
          },
        ];
      });
    };

    const handleTypingStop = (payload) => {
      console.log("RECEIVED TYPING STOP:", payload);
      if (!active || String(payload?.channelId) !== String(channelId)) return;

      setTypingUsers((previous) =>
        previous.filter((item) => item.userId !== payload.userId),
      );
    };

    socket.on("message:new", handleNewMessage);
    socket.on("typing:start", handleTypingStart);
    socket.on("typing:stop", handleTypingStop);

    const loadHistory = async () => {
      try {
        const history = await messageService.getMessages(channelId);

        if (!active) return;

        setMessages((previous) => {
          const combined = [...history, ...previous];
          const unique = new Map();

          combined.forEach((message) => {
            unique.set(String(message._id), message);
          });

          return Array.from(unique.values()).sort(
            (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
          );
        });
      } catch (error) {
        if (active) {
          toast.error(
            error.response?.data?.message || "Could not load messages",
          );
        }
      } finally {
        if (active) setLoadingMessages(false);
      }
    };

    const joinChannel = () => {
      socket.emit("channel:join", channelId, (response) => {
        if (!active) return;

        if (!response?.success) {
          toast.error(response?.message || "Could not join channel");
          setLoadingMessages(false);
          return;
        }

        loadHistory();
      });
    };

    if (socket.connected) {
      joinChannel();
    } else {
      socket.once("connect", joinChannel);
    }

    return () => {
      active = false;

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      if (isTypingRef.current && socket.connected) {
        socket.emit("typing:stop", channelId);
      }

      isTypingRef.current = false;

      socket.off("message:new", handleNewMessage);
      socket.off("typing:start", handleTypingStart);
      socket.off("typing:stop", handleTypingStop);
      socket.off("connect", joinChannel);

      if (socket.connected) {
        socket.emit("channel:leave", channelId);
      }
    };
  }, [selectedChannel?._id, token, user?.id, user?._id]);

  // CREATE WORKSPACE
  const handleCreateWorkspace = async (data) => {
    try {
      const workspace = await workspaceService.createWorkspace(data);

      setWorkspaces((previous) => [workspace, ...previous]);
      setSelectedWorkspace(workspace);
      setWorkspaceModalOpen(false);

      toast.success("Workspace created successfully");
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Could not create workspace",
      );
      throw error;
    }
  };

  // CREATE CHANNEL
  const handleCreateChannel = async (data) => {
    if (!selectedWorkspace) return;

    try {
      const channel = await workspaceService.createChannel(
        selectedWorkspace._id,
        data,
      );

      setChannels((previous) => [...previous, channel]);
      setSelectedChannel(channel);

      toast.success("Channel created successfully");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not create channel");
      throw error;
    }
  };

  // SEND MESSAGE
  const handleSendMessage = (content) => {
    if (!selectedChannel?._id) return;

    handleTypingChange(false);

    const socket = connectSocket(token);

    if (!socket?.connected) {
      toast.error("Connecting to chat server. Please try again.");
      return;
    }

    socket.emit(
      "message:send",
      {
        channelId: selectedChannel._id,
        content,
      },
      (response) => {
        if (!response?.success) {
          toast.error(response?.message || "Message could not be sent");
        }
      },
    );
  };

  const handleSelectWorkspace = (workspace) => {
    setSelectedWorkspace(workspace);
    setMobileMenuOpen(false);
  };

  const handleSelectChannel = (channel) => {
    setSelectedChannel(channel);
    setMobileMenuOpen(false);
  };

  const currentUserId = user?.id || user?._id;
  const onlineCount = onlineUsers.length;

  return (
    <div className="flex h-dvh overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      <div className="hidden lg:flex">
        <WorkspaceSidebar
          workspaces={workspaces}
          selectedWorkspace={selectedWorkspace}
          onSelectWorkspace={handleSelectWorkspace}
          onCreateWorkspace={() => setWorkspaceModalOpen(true)}
        />
      </div>

      <div className="hidden lg:flex">
        <ChannelSidebar
          workspace={selectedWorkspace}
          channels={channels}
          selectedChannel={selectedChannel}
          onSelectChannel={handleSelectChannel}
          onCreateChannel={() => setChannelModalOpen(true)}
          user={user}
        />
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          >
            <motion.div
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", damping: 25 }}
              className="flex h-full"
              onClick={(event) => event.stopPropagation()}
            >
              <WorkspaceSidebar
                workspaces={workspaces}
                selectedWorkspace={selectedWorkspace}
                onSelectWorkspace={handleSelectWorkspace}
                onCreateWorkspace={() => setWorkspaceModalOpen(true)}
              />

              <ChannelSidebar
                onClose={() => setMobileMenuOpen(false)}
                workspace={selectedWorkspace}
                channels={channels}
                selectedChannel={selectedChannel}
                onSelectChannel={handleSelectChannel}
                onCreateChannel={() => setChannelModalOpen(true)}
                user={user}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex min-w-0 flex-1 flex-col">
        <ChatHeader
          onMenuClick={() => setMobileMenuOpen(true)}
          channel={selectedChannel}
          socketConnected={socketConnected}
          onlineCount={onlineCount}
        />

        {loadingWorkspaces || loadingChannels ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-indigo-500/20 border-t-indigo-500" />
          </div>
        ) : !selectedWorkspace ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <h2 className="text-2xl font-bold">Your team starts here</h2>
            <p className="mt-2 max-w-sm text-sm text-[var(--muted)]">
              Create your first workspace and bring your team conversations
              together.
            </p>
            <button
              onClick={() => setWorkspaceModalOpen(true)}
              className="mt-6 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white"
            >
              Create workspace
            </button>
          </div>
        ) : !selectedChannel ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <h2 className="text-xl font-bold">No channels yet</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Create a channel to start your first conversation.
            </p>
            <button
              onClick={() => setChannelModalOpen(true)}
              className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white"
            >
              Create channel
            </button>
          </div>
        ) : (
          <>
            {loadingMessages ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500/20 border-t-indigo-500" />
              </div>
            ) : (
              <ChatMessages
                messages={messages}
                channel={selectedChannel}
                typingUsers={typingUsers}
                currentUserId={currentUserId}
              />
            )}

            <MessageComposer
              key={selectedChannel._id}
              channelName={selectedChannel.name}
              onSend={handleSendMessage}
              onTypingChange={handleTypingChange}
            />
          </>
        )}
      </main>

      <CreateItemModal
        open={workspaceModalOpen}
        onClose={() => setWorkspaceModalOpen(false)}
        onSubmit={handleCreateWorkspace}
        title="Create a workspace"
        description="Give your team a dedicated place to collaborate."
      />

      <CreateItemModal
        open={channelModalOpen}
        onClose={() => setChannelModalOpen(false)}
        onSubmit={handleCreateChannel}
        title="Create a channel"
        description={`Add a conversation space to ${selectedWorkspace?.name || "your workspace"}.`}
        isChannel
      />
    </div>
  );
}
