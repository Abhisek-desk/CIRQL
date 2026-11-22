import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { AnimatePresence, motion } from "motion/react";
import toast from "react-hot-toast";

import WorkspaceSidebar from "../components/common/WorkspaceSidebar";
import ChannelSidebar from "../components/channels/ChannelSidebar";
import ChatHeader from "../components/chat/ChatHeader";
import ChatMessages from "../components/chat/ChatMessages";
import MessageSearch from "../components/chat/MessageSearch";
import MessageComposer from "../components/chat/MessageComposer";
import CreateItemModal from "../components/common/CreateItemModal";

import workspaceService from "../features/workspace/workspaceService";
import messageService from "../features/messages/messageService";
import notificationService from "../features/notifications/notificationService";
import readStateService from "../features/messages/readStateService";

import { connectSocket, disconnectSocket } from "../services/socket";

export default function MainLayout() {
  const user = useSelector((state) => state.auth.user);
  const accessToken = useSelector((state) => state.auth.accessToken);
  const token = accessToken || localStorage.getItem("cirql-access-token");

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [workspaceMembers, setWorkspaceMembers] = useState([]);
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);

  const [messages, setMessages] = useState([]);
  const [channelReadStates, setChannelReadStates] = useState([]);
  const [firstUnreadMessageId, setFirstUnreadMessageId] = useState(null);
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchFilters, setSearchFilters] = useState({
    senderId: "",
    dateFilter: "all",
    date: "",
  });
  const [pendingSearchMessage, setPendingSearchMessage] = useState(null);
  const [highlightMessageId, setHighlightMessageId] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [channelUnreadCounts, setChannelUnreadCounts] = useState({});
  const [pendingNotificationChannel, setPendingNotificationChannel] =
    useState(null);

  const selectedChannelRef = useRef(null);
  const selectedWorkspaceRef = useRef(null);
  selectedChannelRef.current = selectedChannel;
  selectedWorkspaceRef.current = selectedWorkspace;
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const applyMessageUpdate = (previous, updatedMessage) => {
    const targetId = String(updatedMessage._id);

    return previous.map((message) => {
      if (String(message._id) === targetId) {
        return {
          ...message,
          ...updatedMessage,
          replyTo:
            message.replyTo && typeof message.replyTo === "object"
              ? message.replyTo
              : (updatedMessage.replyTo ?? message.replyTo),
          reactions: Array.isArray(updatedMessage.reactions)
            ? updatedMessage.reactions
            : message.reactions,
        };
      }

      if (
        message.replyTo &&
        typeof message.replyTo === "object" &&
        String(message.replyTo._id) === targetId
      ) {
        return {
          ...message,
          replyTo: {
            ...message.replyTo,
            content: updatedMessage.content,
            sender: updatedMessage.sender || message.replyTo.sender,
            editedAt: updatedMessage.editedAt || message.replyTo.editedAt,
          },
        };
      }

      return message;
    });
  };

  // GLOBAL MESSAGE SEARCH KEYBOARD SHORTCUT
  useEffect(() => {
    const handleSearchShortcut = (event) => {
      const isSearchShortcut =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";

      if (isSearchShortcut) {
        event.preventDefault();
        setSearchOpen(true);
      }

      if (event.key === "Escape") {
        setSearchOpen(false);
      }
    };

    window.addEventListener("keydown", handleSearchShortcut);

    return () => {
      window.removeEventListener("keydown", handleSearchShortcut);
    };
  }, []);

  // DEBOUNCED CHANNEL MESSAGE SEARCH
  useEffect(() => {
    const channelId = selectedChannel?._id;
    const query = searchQuery.trim();

    if (!searchOpen || !channelId || query.length < 1) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError("");
      return;
    }

    let active = true;

    const timer = setTimeout(async () => {
      try {
        setSearchLoading(true);
        setSearchError("");

        const results = await messageService.searchMessages(
          channelId,
          query,
          searchFilters,
        );

        if (active) {
          setSearchResults(results);
        }
      } catch (error) {
        if (active) {
          setSearchResults([]);
          setSearchError(
            error.response?.data?.message || "Could not search messages",
          );
        }
      } finally {
        if (active) {
          setSearchLoading(false);
        }
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery, searchOpen, selectedChannel?._id, searchFilters]);

  // RESET SEARCH WHEN CHANNEL CHANGES
  useEffect(() => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError("");
    setPendingSearchMessage(null);
    setSearchFilters({
      senderId: "",
      dateFilter: "all",
      date: "",
    });
  }, [selectedChannel?._id]);

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

    const handlePresenceOffline = (payload) => {
      setOnlineUsers(payload?.onlineUsers || []);

      if (payload?.userId) {
        setWorkspaceMembers((previous) =>
          previous.map((member) =>
            String(member._id) === String(payload.userId)
              ? { ...member, lastSeen: payload.lastSeen }
              : member,
          ),
        );
      }
    };

    const handlePresenceStatus = (payload) => {
      if (!payload?.userId) return;

      setWorkspaceMembers((previous) =>
        previous.map((member) =>
          String(member._id) === String(payload.userId)
            ? {
                ...member,
                customStatusText: payload.customStatusText || "",
                customStatusEmoji: payload.customStatusEmoji || "",
                customStatusExpiresAt: payload.customStatusExpiresAt || null,
              }
            : member,
        ),
      );
    };

    const handleNewNotification = (notification) => {
      if (!notification?._id) return;

      setNotifications((previous) => {
        if (
          previous.some((item) => String(item._id) === String(notification._id))
        ) {
          return previous;
        }

        return [notification, ...previous].slice(0, 50);
      });

      if (!notification.isRead) {
        setUnreadCount((previous) => previous + 1);
        toast("New notification", {
          icon: "\uD83D\uDD14",
        });

        const notificationChannel = notification.channel;
        const notificationChannelId =
          notificationChannel?._id || notificationChannel;

        const notificationWorkspaceId =
          notificationChannel?.workspace?._id || notificationChannel?.workspace;

        const activeWorkspaceId = selectedWorkspaceRef.current?._id;
        const activeChannelId = selectedChannelRef.current?._id;

        if (
          notificationChannelId &&
          String(notificationWorkspaceId) === String(activeWorkspaceId) &&
          String(notificationChannelId) !== String(activeChannelId)
        ) {
          setChannelUnreadCounts((previous) => ({
            ...previous,
            [notificationChannelId]: (previous[notificationChannelId] || 0) + 1,
          }));
        }
      }
    };

    socket.on("notification:new", handleNewNotification);

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("presence:online", handlePresence);
    socket.on("presence:offline", handlePresenceOffline);
    socket.on("presence:sync", handlePresence);
    socket.on("presence:status", handlePresenceStatus);

    setSocketConnected(socket.connected);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("presence:online", handlePresence);
      socket.off("presence:offline", handlePresenceOffline);
      socket.off("presence:sync", handlePresence);
      socket.off("presence:status", handlePresenceStatus);
      socket.off("notification:new", handleNewNotification);
      disconnectSocket();
    };
  }, [token]);

  // LOAD NOTIFICATIONS
  useEffect(() => {
    let active = true;

    const loadNotifications = async () => {
      try {
        const data = await notificationService.getNotifications();

        if (!active) return;

        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      } catch (error) {
        if (active) {
          toast.error(
            error.response?.data?.message || "Could not load notifications",
          );
        }
      } finally {
        if (active) setNotificationsLoading(false);
      }
    };

    loadNotifications();

    return () => {
      active = false;
    };
  }, []);
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

  // LOAD WORKSPACE MEMBERS FOR @MENTIONS
  useEffect(() => {
    let active = true;

    const loadMembers = async () => {
      if (!selectedWorkspace?._id) {
        setWorkspaceMembers([]);
        return;
      }

      try {
        const members = await workspaceService.getWorkspaceMembers(
          selectedWorkspace._id,
        );

        if (active) {
          setWorkspaceMembers(members);
        }
      } catch (error) {
        if (active) {
          setWorkspaceMembers([]);
          console.error("Could not load workspace members:", error);
        }
      }
    };

    loadMembers();

    return () => {
      active = false;
    };
  }, [selectedWorkspace?._id]);

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

        if (pendingNotificationChannel) {
          const targetChannel = data.find(
            (channel) =>
              String(channel._id) === String(pendingNotificationChannel),
          );

          if (targetChannel) {
            setSelectedChannel(targetChannel);
            setPendingNotificationChannel(null);
          } else {
            setSelectedChannel(data[0] || null);
          }
        } else {
          setSelectedChannel(data[0] || null);
        }
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

  // LOAD UNREAD COUNTS FOR THE SELECTED WORKSPACE
  useEffect(() => {
    let active = true;

    const loadUnreadCounts = async () => {
      if (!selectedWorkspace?._id) {
        setChannelUnreadCounts({});
        return;
      }

      try {
        const counts = await readStateService.getUnreadCounts(
          selectedWorkspace._id,
        );

        if (!active) return;

        const mappedCounts = {};

        counts.forEach((item) => {
          mappedCounts[String(item.channelId)] = item.count;
        });

        setChannelUnreadCounts(mappedCounts);
      } catch (error) {
        if (active) {
          console.error("Could not load unread counts:", error);
        }
      }
    };

    loadUnreadCounts();

    return () => {
      active = false;
    };
  }, [selectedWorkspace?._id]);

  // MARK ACTIVE CHANNEL AS READ
  useEffect(() => {
    const channelId = selectedChannel?._id;

    if (!channelId) return;

    let active = true;

    const markAsRead = async () => {
      if (document.visibilityState !== "visible") return;

      try {
        const result = await readStateService.markChannelAsRead(channelId);

        if (!active) return;

        setChannelUnreadCounts((previous) => ({
          ...previous,
          [channelId]: 0,
        }));

        setFirstUnreadMessageId(
          result.firstUnreadMessageId
            ? String(result.firstUnreadMessageId)
            : null,
        );
      } catch (error) {
        console.error("Could not mark channel as read:", error);
      }
    };

    // Mark read immediately when opening the channel.
    markAsRead();

    // Mark read when returning to the browser tab.
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        markAsRead();
      }
    };

    // Mark read when the browser window receives focus.
    window.addEventListener("focus", markAsRead);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.removeEventListener("focus", markAsRead);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [selectedChannel?._id]);

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
    setChannelReadStates([]);
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

      if (document.visibilityState === "visible" && document.hasFocus()) {
        readStateService.markChannelAsRead(channelId).catch((error) => {
          console.error("Could not update channel read state:", error);
        });
      }
    };

    const handleMessageUpdated = (updatedMessage) => {
      if (!active) return;

      const incomingChannelId =
        updatedMessage.channel?._id || updatedMessage.channel;

      if (String(incomingChannelId) !== String(channelId)) return;

      setMessages((previous) => applyMessageUpdate(previous, updatedMessage));
    };
    const handleMessageDeleted = (deletedMessage) => {
      if (!active) return;

      const incomingChannelId =
        deletedMessage.channel?._id || deletedMessage.channel;

      if (String(incomingChannelId) !== String(channelId)) return;

      setMessages((previous) =>
        previous.map((message) =>
          String(message._id) === String(deletedMessage._id)
            ? { ...message, ...deletedMessage }
            : message,
        ),
      );
    };

    const handleMessageReactions = (payload) => {
      if (!active) return;

      if (String(payload?.channelId) !== String(channelId)) return;

      setMessages((previous) =>
        previous.map((message) =>
          String(message._id) === String(payload.messageId)
            ? { ...message, reactions: payload.reactions }
            : message,
        ),
      );
    };

    const handleChannelRead = (payload) => {
      if (!active) return;
      if (String(payload?.channelId) !== String(channelId)) return;
      console.log("[RECEIPT DEBUG] Socket event:", payload);
      if (!payload?.user?._id || !payload?.lastReadAt) return;

      setChannelReadStates((previous) => {
        const existing = previous.filter(
          (item) =>
            String(item.user?._id || item.user) !== String(payload.user._id),
        );

        return [
          {
            user: payload.user,
            lastReadAt: payload.lastReadAt,
          },
          ...existing,
        ];
      });
    };

    const handleTypingStart = (payload) => {
      console.log("RECEIVED TYPING START:", payload);
      if (!active || String(payload?.channelId) !== String(channelId)) return;

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
    socket.on("message:updated", handleMessageUpdated);
    socket.on("message:deleted", handleMessageDeleted);
    socket.on("typing:start", handleTypingStart);
    socket.on("typing:stop", handleTypingStop);
    socket.on("message:reactions", handleMessageReactions);
    socket.on("channel:read", handleChannelRead);

    const loadHistory = async () => {
      try {
        const [history, readStates] = await Promise.all([
          messageService.getMessages(channelId),
          readStateService.getChannelReadReceipts(channelId),
        ]);

        if (!active) return;
        console.log("[RECEIPT DEBUG] Channel:", channelId);
        console.log("[RECEIPT DEBUG] API read states:", readStates);
        setChannelReadStates(readStates);

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
      socket.off("message:updated", handleMessageUpdated);
      socket.off("message:deleted", handleMessageDeleted);
      socket.off("typing:start", handleTypingStart);
      socket.off("typing:stop", handleTypingStop);
      socket.off("connect", joinChannel);
      socket.off("message:reactions", handleMessageReactions);
      socket.off("channel:read", handleChannelRead);

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
  const handleSendMessage = (content, replyTo = null, mentionIds = []) => {
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
        replyTo,
        mentionIds,
      },
      (response) => {
        if (!response?.success) {
          toast.error(response?.message || "Message could not be sent");
          return;
        }

        setReplyToMessage(null);
      },
    );
  };

  // EDIT MESSAGE
  const handleEditMessage = async (messageId, content) => {
    try {
      const updatedMessage = await messageService.editMessage(
        messageId,
        content,
      );

      setMessages((previous) =>
        applyMessageUpdate(previous, {
          ...updatedMessage,
          _id: updatedMessage._id || messageId,
        }),
      );

      const socket = connectSocket(token);

      if (socket?.connected) {
        socket.emit("message:updated", messageId);
      }

      toast.success("Message updated");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not edit message");
      throw error;
    }
  };
  // DELETE MESSAGE
  const handleDeleteMessage = async (messageId) => {
    try {
      await messageService.deleteMessage(messageId);

      const deletedAt = new Date().toISOString();

      setMessages((previous) =>
        previous.map((message) =>
          String(message._id) === String(messageId)
            ? {
                ...message,
                content: "This message was deleted",
                deletedAt,
              }
            : message,
        ),
      );

      const socket = connectSocket(token);

      if (socket?.connected) {
        socket.emit("message:deleted", messageId);
      }

      toast.success("Message deleted");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not delete message");
    }
  };

  // TOGGLE MESSAGE REACTION
  const handleReactMessage = async (messageId, emoji) => {
    try {
      const response = await messageService.toggleReaction(messageId, emoji);

      // Update the current user's UI immediately.
      setMessages((previous) =>
        previous.map((message) =>
          String(message._id) === String(messageId)
            ? { ...message, reactions: response.reactions }
            : message,
        ),
      );
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not update reaction");
    }
  };

  const handleSelectWorkspace = (workspace) => {
    setSelectedWorkspace(workspace);
    setMobileMenuOpen(false);
  };

  const handleSearchResultSelect = async (message) => {
    const channelId = selectedChannel?._id;

    if (!channelId || !message?._id) return;

    setSearchOpen(false);
    setPendingSearchMessage(message);
    setHighlightMessageId(null);

    try {
      let currentMessages = [...messages];

      let found = currentMessages.some(
        (item) => String(item._id) === String(message._id),
      );

      let cursor = currentMessages[0]?._id;
      let pageCount = 0;

      while (!found && cursor && pageCount < 100) {
        const page = await messageService.getMessagesPage(
          channelId,
          cursor,
          30,
        );

        const olderMessages = page.messages || [];

        if (olderMessages.length === 0) break;

        currentMessages = [...olderMessages, ...currentMessages];

        found = currentMessages.some(
          (item) => String(item._id) === String(message._id),
        );

        if (!page.hasMore || !page.nextCursor) break;

        cursor = page.nextCursor;
        pageCount += 1;
      }

      if (!found) {
        toast.error("Could not find this message in channel history.");
        setPendingSearchMessage(null);
        return;
      }

      setMessages((previous) => {
        const unique = new Map();

        [...currentMessages, ...previous].forEach((item) => {
          unique.set(String(item._id), item);
        });

        return Array.from(unique.values()).sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
        );
      });

      setHighlightMessageId(String(message._id));
      setPendingSearchMessage(null);
    } catch (error) {
      console.error("Jump to message error:", error);
      setPendingSearchMessage(null);

      toast.error(
        error.response?.data?.message || "Could not load the selected message.",
      );
    }
  };

  const handleReplyPreviewClick = async (messageId) => {
    if (!messageId || !selectedChannel?._id) return;

    const channelId = selectedChannel._id;

    try {
      let currentMessages = [...messages];

      let found = currentMessages.some(
        (item) => String(item._id) === String(messageId),
      );

      let cursor = currentMessages[0]?._id;
      let pageCount = 0;

      while (!found && cursor && pageCount < 100) {
        const page = await messageService.getMessagesPage(
          channelId,
          cursor,
          30,
        );

        const olderMessages = page.messages || [];

        if (!olderMessages.length) break;

        currentMessages = [...olderMessages, ...currentMessages];

        found = currentMessages.some(
          (item) => String(item._id) === String(messageId),
        );

        if (!page.hasMore || !page.nextCursor) break;

        cursor = page.nextCursor;
        pageCount += 1;
      }

      if (!found) {
        toast.error("Original message could not be found.");
        return;
      }

      setMessages((previous) => {
        const unique = new Map();

        [...currentMessages, ...previous].forEach((item) => {
          unique.set(String(item._id), item);
        });

        return Array.from(unique.values()).sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
        );
      });

      setHighlightMessageId(null);

      requestAnimationFrame(() => {
        setHighlightMessageId(String(messageId));
      });
    } catch (error) {
      console.error("Reply navigation error:", error);
      toast.error("Could not navigate to the original message.");
    }
  };
  const handleSelectChannel = (channel) => {
    setSelectedChannel(channel);
    setReplyToMessage(null);
    setMobileMenuOpen(false);
  };
  // MARK ONE NOTIFICATION AS READ
  const handleMarkNotificationRead = async (notificationId) => {
    const notification = notifications.find(
      (item) => String(item._id) === String(notificationId),
    );

    if (!notification || notification.isRead) return;

    try {
      await notificationService.markAsRead(notificationId);

      setNotifications((previous) =>
        previous.map((item) =>
          String(item._id) === String(notificationId)
            ? { ...item, isRead: true }
            : item,
        ),
      );

      setUnreadCount((previous) => Math.max(0, previous - 1));
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Could not mark notification as read",
      );
    }
  };

  // MARK ALL NOTIFICATIONS AS READ
  const handleMarkAllNotificationsRead = async () => {
    if (unreadCount === 0) return;

    try {
      await notificationService.markAllAsRead();

      setNotifications((previous) =>
        previous.map((item) => ({ ...item, isRead: true })),
      );

      setUnreadCount(0);
      toast.success("All notifications marked as read");
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Could not update notifications",
      );
    }
  };

  // OPEN THE CHANNEL ASSOCIATED WITH A NOTIFICATION
  const handleNotificationClick = async (notification) => {
    if (!notification) return;

    if (!notification.isRead) {
      await handleMarkNotificationRead(notification._id);
    }

    const channelId = notification.channel?._id || notification.channel;

    const workspaceId =
      notification.channel?.workspace?._id || notification.channel?.workspace;

    if (!channelId || !workspaceId) {
      toast.error("Could not locate this notification's channel");
      return;
    }

    const workspace = workspaces.find(
      (item) => String(item._id) === String(workspaceId),
    );

    if (!workspace) {
      toast.error("You no longer have access to this workspace");
      return;
    }

    setReplyToMessage(null);

    if (String(selectedWorkspace?._id) === String(workspaceId)) {
      const targetChannel = channels.find(
        (item) => String(item._id) === String(channelId),
      );

      if (targetChannel) {
        setSelectedChannel(targetChannel);
        setMobileMenuOpen(false);
        return;
      }
    }

    setPendingNotificationChannel(channelId);
    setSelectedWorkspace(workspace);
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
          members={workspaceMembers}
          onlineUsers={onlineUsers}
          unreadCounts={channelUnreadCounts}
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
                members={workspaceMembers}
                onlineUsers={onlineUsers}
                unreadCounts={channelUnreadCounts}
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
          onSearchClick={() => setSearchOpen(true)}
          notifications={notifications}
          unreadCount={unreadCount}
          notificationsLoading={notificationsLoading}
          onMarkNotificationRead={handleMarkNotificationRead}
          onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
          onNotificationClick={handleNotificationClick}
        />

        <MessageSearch
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          channel={selectedChannel}
          query={searchQuery}
          onQueryChange={setSearchQuery}
          results={searchResults}
          loading={searchLoading}
          error={searchError}
          onSelectResult={handleSearchResultSelect}
          members={workspaceMembers}
          filters={searchFilters}
          onFiltersChange={setSearchFilters}
          onClearFilters={() =>
            setSearchFilters({
              senderId: "",
              dateFilter: "all",
              date: "",
            })
          }
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
                channelReadStates={channelReadStates}
                channel={selectedChannel}
                firstUnreadMessageId={firstUnreadMessageId}
                typingUsers={typingUsers}
                members={workspaceMembers}
                currentUserId={currentUserId}
                highlightMessageId={highlightMessageId}
                onEditMessage={handleEditMessage}
                onDeleteMessage={handleDeleteMessage}
                onReplyMessage={setReplyToMessage}
                onJumpToMessage={handleReplyPreviewClick}
                onReactMessage={handleReactMessage}
              />
            )}

            <MessageComposer
              key={selectedChannel._id}
              channelName={selectedChannel.name}
              members={workspaceMembers}
              onSend={handleSendMessage}
              onTypingChange={handleTypingChange}
              replyTo={replyToMessage}
              onCancelReply={() => setReplyToMessage(null)}
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
