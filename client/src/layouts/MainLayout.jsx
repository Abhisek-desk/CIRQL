import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, m as motion } from "motion/react";
import toast from "react-hot-toast";

import WorkspaceSidebar from "../components/common/WorkspaceSidebar";
import ChannelSidebar from "../components/channels/ChannelSidebar";
import ChatHeader from "../components/chat/ChatHeader";
import ChatMessages from "../components/chat/ChatMessages";
import DirectMessages from "../components/chat/DirectMessages";
import CallOverlay from "../components/chat/CallOverlay";
import CallHistoryModal from "../components/chat/CallHistoryModal";
import MessageLoading from "../components/loaders/MessageLoading";
import MessageSearch from "../components/chat/MessageSearch";
import MessageComposer from "../components/chat/MessageComposer";
import CreateItemModal from "../components/common/CreateItemModal";

import workspaceService from "../features/workspace/workspaceService";
import messageService from "../features/messages/messageService";
import uploadService from "../features/messages/uploadService";
import notificationService from "../features/notifications/notificationService";
import readStateService from "../features/messages/readStateService";
import conversationService from "../features/messages/conversationService";

import { connectSocket, disconnectSocket, getSocket } from "../services/socket";


function playCirqlNotificationSound() {
  try {
    const preferences = JSON.parse(
      localStorage.getItem("cirql-notification-preferences") || "{}"
    );

    if (preferences.sound === false) return;

    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return;

    const context = new AudioContextClass();

    if (context.state === "suspended") {
      context.resume().catch(() => {});
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(660, context.currentTime);
    oscillator.frequency.setValueAtTime(880, context.currentTime + 0.09);

    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.12,
      context.currentTime + 0.025
    );
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      context.currentTime + 0.22
    );

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start();
    oscillator.stop(context.currentTime + 0.24);

    oscillator.onended = () => context.close();
  } catch {
    // Audio is optional; notification delivery must never fail because of it.
  }
}
export default function MainLayout() {
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const currentUserId = user?.id || user?._id;
  const accessToken = useSelector((state) => state.auth.accessToken);
  const token = accessToken || localStorage.getItem("cirql-access-token");

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [workspaceMembers, setWorkspaceMembers] = useState([]);
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);

  // DIRECT MESSAGES
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [callSession, setCallSession] = useState(null);
  const [callHistoryOpen, setCallHistoryOpen] = useState(false);
  const handleStartCall = (mode) => {
    if (!selectedConversation) return;
    if (callSession) {
      toast.error("A call is already active.");
      return;
    }
    const recipient = selectedConversation.participants?.find(
      (participant) => String(participant._id || participant) !== String(currentUserId),
    );
    const recipientName = typeof recipient === "object" ? recipient?.name : "CIRQL user";
    setCallSession({
      callId: crypto.randomUUID(),
      conversationId: selectedConversation._id,
      mode,
      direction: "outgoing",
      phase: "starting",
      remoteName: recipientName,
    });
  };


  const [messages, setMessages] = useState([]);
  const [channelReadStates, setChannelReadStates] = useState([]);
  const [firstUnreadMessageId, setFirstUnreadMessageId] = useState(null);
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageLoadError, setMessageLoadError] = useState("");
  const [retryHistory, setRetryHistory] = useState(0);
  const [historyReadyChannelId, setHistoryReadyChannelId] = useState(null);

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
  const [highlightMessageId, setHighlightMessageId] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [notifications, setNotifications] = useState([]);
  const seenNotificationIdsRef = useRef(new Set());
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [channelUnreadCounts, setChannelUnreadCounts] = useState({});
  const [pendingNotificationChannel, setPendingNotificationChannel] =
    useState(null);

  const [pendingPermalink] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const match = window.location.hash.match(/^#message-(.+)$/);

    const workspaceId = params.get("workspaceId");
    const channelId = params.get("channelId");
    const conversationId = params.get("conversationId");
    const messageId = match?.[1];

    if (!messageId) return null;

    if (conversationId) {
      return { conversationId, messageId };
    }

    return workspaceId && channelId
      ? { workspaceId, channelId, messageId }
      : null;
  });

  const permalinkHandledRef = useRef("");

  // OPEN THE CONVERSATION FROM A SHARED DM LINK
  useEffect(() => {
    if (!pendingPermalink?.conversationId || !conversations.length) return;

    const target = conversations.find(
      (item) =>
        String(item._id) === String(pendingPermalink.conversationId),
    );

    if (!target) {
      const key = `dm:${pendingPermalink.conversationId}`;
      if (permalinkHandledRef.current === key) return;

      permalinkHandledRef.current = key;
      toast.error("The linked conversation could not be found.");
      return;
    }

    if (
      String(selectedConversation?._id) !==
      String(pendingPermalink.conversationId)
    ) {
      setSelectedConversation(target);
      setSelectedChannel(null);
      setReplyToMessage(null);
      setMessages([]);
      setTypingUsers([]);
    }
  }, [pendingPermalink, conversations, selectedConversation?._id]);

  const selectedChannelRef = useRef(null);
  const selectedWorkspaceRef = useRef(null);
  useEffect(() => {
    selectedChannelRef.current = selectedChannel;
    selectedWorkspaceRef.current = selectedWorkspace;
  }, [selectedChannel, selectedWorkspace]);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const directTypingTimeoutRef = useRef(null);
  const directIsTypingRef = useRef(false);
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

      const notificationId = String(notification._id);

      // Ignore an event already received or loaded from notification history.
      if (seenNotificationIdsRef.current.has(notificationId)) return;

      seenNotificationIdsRef.current.add(notificationId);

      setNotifications((previous) => [
        notification,
        ...previous.filter(
          (item) => String(item._id) !== notificationId,
        ),
      ].slice(0, 50));

      if (!notification.isRead) {
        setUnreadCount((previous) => previous + 1);

        playCirqlNotificationSound();
        toast("New notification", {
          icon: "\uD83D\uDD14",
        });

        const notificationChannel = notification.channel;
        const notificationChannelId =
          notificationChannel?._id || notificationChannel;

        const notificationWorkspaceId =
          notificationChannel?.workspace?._id ||
          notificationChannel?.workspace;

        const activeWorkspaceId = selectedWorkspaceRef.current?._id;
        const activeChannelId = selectedChannelRef.current?._id;

        if (
          notificationChannelId &&
          String(notificationWorkspaceId) === String(activeWorkspaceId) &&
          String(notificationChannelId) !== String(activeChannelId)
        ) {
          setChannelUnreadCounts((previous) => ({
            ...previous,
            [notificationChannelId]:
              (previous[notificationChannelId] || 0) + 1,
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

  // LOAD DIRECT MESSAGE CONVERSATIONS
  useEffect(() => {
    if (!currentUserId) return;

    let active = true;

    const loadConversations = async () => {
      try {


        const response = await conversationService.getConversations();

        if (!active) return;

        setConversations(response.conversations || []);
      } catch (error) {
        if (active) {
          console.error("Could not load direct conversations:", error);
          toast.error(
            error.response?.data?.message ||
            "Could not load direct conversations"
          );
        }
      }
    };

    loadConversations();

    return () => {
      active = false;
    };
  }, [currentUserId]);

  // LOAD NOTIFICATIONS
  useEffect(() => {
    let active = true;

    const loadNotifications = async () => {
      try {
        const data = await notificationService.getNotifications();

        if (!active) return;

        seenNotificationIdsRef.current = new Set([
            ...seenNotificationIdsRef.current,
            ...(data.notifications || []).map((item) => String(item._id)),
          ]);
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

        const requestedWorkspaceId = new URLSearchParams(
          window.location.search
        ).get("workspaceId");

        const requestedWorkspace = data.find(
          (item) => String(item._id) === String(requestedWorkspaceId)
        );

        return requestedWorkspace || data[0] || null;
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
  }, [selectedWorkspace?._id, pendingNotificationChannel, pendingPermalink]);

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

        const permalinkChannel =
          pendingPermalink &&
          String(pendingPermalink.workspaceId) === String(selectedWorkspace._id)
            ? data.find(
                (channel) =>
                  String(channel._id) === String(pendingPermalink.channelId)
              )
            : null;

        if (permalinkChannel) {
          setSelectedChannel(permalinkChannel);
          setPendingNotificationChannel(null);
        } else if (pendingNotificationChannel) {
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
  }, [selectedWorkspace?._id, pendingNotificationChannel, pendingPermalink]);

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
  }, [selectedWorkspace?._id, pendingNotificationChannel, pendingPermalink]);

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

  // DIRECT MESSAGE TYPING EVENTS
  const handleDirectTypingChange = useCallback(
    (isTyping) => {
      const conversationId = selectedConversation?._id;
      const socket = connectSocket(token);

      if (!conversationId || !socket?.connected) return;

      if (directTypingTimeoutRef.current) {
        clearTimeout(directTypingTimeoutRef.current);
        directTypingTimeoutRef.current = null;
      }

      if (isTyping) {
        if (!directIsTypingRef.current) {
          socket.emit("dm:typing:start", conversationId);
          directIsTypingRef.current = true;
        }

        directTypingTimeoutRef.current = setTimeout(() => {
          socket.emit("dm:typing:stop", conversationId);
          directIsTypingRef.current = false;
          directTypingTimeoutRef.current = null;
        }, 1200);
      } else if (directIsTypingRef.current) {
        socket.emit("dm:typing:stop", conversationId);
        directIsTypingRef.current = false;
      }
    },
    [selectedConversation?._id, token],
  );
  // LOAD MESSAGE HISTORY + JOIN CHANNEL + TYPING LISTENERS
  useEffect(() => {
    const channelId = selectedChannel?._id;

    if (!channelId) {
      setMessages([]);
      setTypingUsers([]);
      setMessageLoadError("");
      setLoadingMessages(false);
      return;
    }

    const socket = connectSocket(token);

    if (!socket) {
      setMessageLoadError("Could not connect to the chat server.");
      setLoadingMessages(false);
      return;
    }

    let active = true;
    let connectionTimeout = null;
    let joinTimeout = null;

    setMessages([]);
    setTypingUsers([]);
    setChannelReadStates([]);
    setMessageLoadError("");
    setLoadingMessages(true);
    setHistoryReadyChannelId(null);

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

        setHistoryReadyChannelId(String(channelId));
      } catch (error) {
        if (active) {
          const errorMessage =
            error.response?.data?.message ||
            "Could not load messages. Please try again.";

          setMessageLoadError(errorMessage);
          toast.error(errorMessage);
        }
      } finally {
        if (active) setLoadingMessages(false);
      }
    };

    const joinChannel = () => {
      if (!active) return;

      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
      }

      joinTimeout = setTimeout(() => {
        if (!active) return;

        const errorMessage =
          "Could not join this channel. Please retry.";

        setMessageLoadError(errorMessage);
        setLoadingMessages(false);
        toast.error(errorMessage);
      }, 10000);

      socket.emit("channel:join", channelId, (response) => {
        if (!active) return;

        if (joinTimeout) {
          clearTimeout(joinTimeout);
          joinTimeout = null;
        }

        if (!response?.success) {
          const errorMessage =
            response?.message || "Could not join channel. Please retry.";

          setMessageLoadError(errorMessage);
          setLoadingMessages(false);
          toast.error(errorMessage);
          return;
        }

        loadHistory();
      });
    };

    if (socket.connected) {
      joinChannel();
    } else {
      connectionTimeout = setTimeout(() => {
        if (!active) return;

        const errorMessage =
          "Chat server connection timed out. Please retry.";

        setMessageLoadError(errorMessage);
        setLoadingMessages(false);
        toast.error(errorMessage);
      }, 10000);

      socket.once("connect", joinChannel);
    }

    return () => {
      active = false;

      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
      }

      if (joinTimeout) {
        clearTimeout(joinTimeout);
      }

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
  }, [selectedChannel?._id, token, currentUserId, retryHistory]);

  // DIRECT MESSAGE HISTORY + REAL-TIME SOCKET EVENTS
  useEffect(() => {
    const conversationId = selectedConversation?._id;

    if (!conversationId) return;

    const socket = connectSocket(token);

    if (!socket) {
      setMessageLoadError("Could not connect to the chat server.");
      setLoadingMessages(false);
      return;
    }

    let active = true;
    let joined = false;
    let connectionTimeout = null;
    let joinTimeout = null;

    setMessages([]);
    setTypingUsers([]);
    setMessageLoadError("");
    setLoadingMessages(true);

    const markRead = async () => {
      try {
        await conversationService.markRead(conversationId);

        if (!active) return;

        setConversations((previous) =>
          previous.map((conversation) =>
            String(conversation._id) === String(conversationId)
              ? { ...conversation, unreadCount: 0 }
              : conversation,
          ),
        );
      } catch (error) {
        console.error("Could not mark direct conversation as read:", error);
      }
    };

    const updateConversationPreview = (message) => {
      setConversations((previous) =>
        previous.map((conversation) =>
          String(conversation._id) === String(conversationId)
            ? {
                ...conversation,
                lastMessage: message,
                lastMessageAt: message.createdAt || new Date().toISOString(),
                unreadCount: 0,
              }
            : conversation,
        ),
      );
    };

    const handleNewDirectMessage = (message) => {
      if (!active) return;

      const incomingConversationId =
        message.conversation?._id || message.conversation;

      if (String(incomingConversationId) !== String(conversationId)) {
        return;
      }

      setMessages((previous) => {
        if (previous.some((item) => String(item._id) === String(message._id))) {
          return previous;
        }

        return [...previous, message].sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
        );
      });

      updateConversationPreview(message);

      if (document.visibilityState === "visible" && document.hasFocus()) {
        markRead();
      }
    };

    const handleDirectMessageUpdated = (updatedMessage) => {
      if (!active) return;

      const incomingConversationId =
        updatedMessage.conversation?._id || updatedMessage.conversation;

      if (String(incomingConversationId) !== String(conversationId)) {
        return;
      }

      setMessages((previous) =>
        applyMessageUpdate(previous, updatedMessage),
      );

      setConversations((previous) =>
        previous.map((conversation) =>
          String(conversation._id) === String(conversationId) &&
          String(conversation.lastMessage?._id) === String(updatedMessage._id)
            ? { ...conversation, lastMessage: updatedMessage }
            : conversation,
        ),
      );
    };

    const handleDirectMessageDeleted = (deletedMessage) => {
      if (!active) return;

      const incomingConversationId =
        deletedMessage.conversation?._id || deletedMessage.conversation;

      if (String(incomingConversationId) !== String(conversationId)) {
        return;
      }

      setMessages((previous) =>
        previous.map((message) =>
          String(message._id) === String(deletedMessage._id)
            ? { ...message, ...deletedMessage }
            : message,
        ),
      );

      setConversations((previous) =>
        previous.map((conversation) =>
          String(conversation._id) === String(conversationId) &&
          String(conversation.lastMessage?._id) === String(deletedMessage._id)
            ? { ...conversation, lastMessage: deletedMessage }
            : conversation,
        ),
      );
    };

    const handleDirectMessageReactions = (payload) => {
      if (!active) return;

      if (String(payload?.conversationId) !== String(conversationId)) {
        return;
      }

      setMessages((previous) =>
        previous.map((message) =>
          String(message._id) === String(payload.messageId)
            ? { ...message, reactions: payload.reactions || [] }
            : message,
        ),
      );
    };
    const handleDirectTypingStart = (payload) => {
      if (!active) return;

      if (String(payload?.conversationId) !== String(conversationId)) {
        return;
      }

      if (String(payload.userId) === String(currentUserId)) return;

      setTypingUsers((previous) => {
        if (
          previous.some(
            (item) => String(item.userId) === String(payload.userId),
          )
        ) {
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

    const handleDirectTypingStop = (payload) => {
      if (!active) return;

      if (String(payload?.conversationId) !== String(conversationId)) {
        return;
      }

      setTypingUsers((previous) =>
        previous.filter(
          (item) => String(item.userId) !== String(payload.userId),
        ),
      );
    };

    socket.on("dm:message:new", handleNewDirectMessage);
    socket.on("dm:message:updated", handleDirectMessageUpdated);
    socket.on("dm:message:deleted", handleDirectMessageDeleted);
    socket.on("dm:message:reactions", handleDirectMessageReactions);
    socket.on("dm:typing:start", handleDirectTypingStart);
    socket.on("dm:typing:stop", handleDirectTypingStop);

    const loadHistory = async () => {
      try {
        const response = await conversationService.getMessages(
          conversationId,
          undefined,
          30,
        );

        if (!active) return;

        setMessages((previous) => {
          const combined = [...(response.messages || []), ...previous];
          const unique = new Map();

          combined.forEach((message) => {
            unique.set(String(message._id), message);
          });

          return Array.from(unique.values()).sort(
            (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
          );
        });

        await markRead();
      } catch (error) {
        if (active) {
          const errorMessage =
            error.response?.data?.message ||
            "Could not load direct messages. Please try again.";

          setMessageLoadError(errorMessage);
          toast.error(errorMessage);
        }
      } finally {
        if (active) {
          setLoadingMessages(false);
        }
      }
    };

    const joinConversation = () => {
      if (!active || !socket.connected) return;

      if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
      }

      if (joinTimeout) {
        clearTimeout(joinTimeout);
      }

      joinTimeout = setTimeout(() => {
        if (!active) return;

        setMessageLoadError(
          "Could not join this conversation. Please retry.",
        );
        setLoadingMessages(false);
      }, 10000);

      socket.emit("dm:join", conversationId, async (response) => {
        if (!active) return;

        if (joinTimeout) {
          clearTimeout(joinTimeout);
          joinTimeout = null;
        }

        if (!response?.success) {
          setMessageLoadError(
            response?.message || "Could not join this conversation.",
          );
          setLoadingMessages(false);
          return;
        }

        joined = true;
        await loadHistory();
      });
    };

    socket.on("connect", joinConversation);

    if (socket.connected) {
      joinConversation();
    } else {
      connectionTimeout = setTimeout(() => {
        if (!active) return;

        setMessageLoadError(
          "Chat server connection timed out. Please retry.",
        );
        setLoadingMessages(false);
      }, 10000);
    }

    return () => {
      active = false;

      if (connectionTimeout) clearTimeout(connectionTimeout);
      if (joinTimeout) clearTimeout(joinTimeout);

      socket.off("connect", joinConversation);
      socket.off("dm:message:new", handleNewDirectMessage);
      socket.off("dm:message:updated", handleDirectMessageUpdated);
      socket.off("dm:message:deleted", handleDirectMessageDeleted);
      socket.off("dm:message:reactions", handleDirectMessageReactions);
      socket.off("dm:typing:start", handleDirectTypingStart);
      socket.off("dm:typing:stop", handleDirectTypingStop);

      if (joined && socket.connected) {
        socket.emit("dm:leave", conversationId);
      }
    };
  }, [selectedConversation?._id, token, currentUserId, retryHistory]);
  // AUTOMATICALLY LOAD AND NAVIGATE TO A SHARED MESSAGE PERMALINK
  useEffect(() => {
    if (
      !pendingPermalink ||
      !selectedWorkspace?._id ||
      !selectedChannel?._id ||
      loadingMessages ||
      historyReadyChannelId !== String(selectedChannel._id)
    ) {
      return;
    }

    if (
      String(selectedWorkspace._id) !== String(pendingPermalink.workspaceId) ||
      String(selectedChannel._id) !== String(pendingPermalink.channelId)
    ) {
      return;
    }

    const permalinkKey = `${pendingPermalink.channelId}:${pendingPermalink.messageId}`;

    if (permalinkHandledRef.current === permalinkKey) return;

    let active = true;

    const loadPermalinkMessage = async () => {
      try {
        let currentMessages = [...messages];

        let found = currentMessages.some(
          (item) => String(item._id) === String(pendingPermalink.messageId)
        );

        let cursor = currentMessages[0]?._id;
        let pageCount = 0;

        while (!found && cursor && pageCount < 100) {
          const page = await messageService.getMessagesPage(
            selectedChannel._id,
            cursor,
            30
          );

          if (!active) return;

          const olderMessages = page.messages || [];

          if (!olderMessages.length) break;

          currentMessages = [...olderMessages, ...currentMessages];

          found = currentMessages.some(
            (item) => String(item._id) === String(pendingPermalink.messageId)
          );

          if (!page.hasMore || !page.nextCursor) break;

          cursor = page.nextCursor;
          pageCount += 1;
        }

        if (!active) return;

        if (!found) {
          permalinkHandledRef.current = permalinkKey;
          toast.error("The shared message could not be found.");
          return;
        }

        setMessages((previous) => {
          const unique = new Map();

          [...currentMessages, ...previous].forEach((item) => {
            unique.set(String(item._id), item);
          });

          return Array.from(unique.values()).sort(
            (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
          );
        });

        permalinkHandledRef.current = permalinkKey;

        setHighlightMessageId(null);

        requestAnimationFrame(() => {
          if (active) {
            setHighlightMessageId(String(pendingPermalink.messageId));
          }
        });

        toast.success("Shared message opened");
      } catch (error) {
        if (!active) return;

        console.error("Permalink navigation error:", error);

        toast.error(
          error.response?.data?.message ||
          "Could not open the shared message."
        );
      }
    };

    loadPermalinkMessage();

    return () => {
      active = false;
    };
  }, [
    pendingPermalink,
    selectedWorkspace?._id,
    selectedChannel?._id,
    historyReadyChannelId,
    loadingMessages,
    messages,
  ]);
  // AUTOMATICALLY LOAD AND NAVIGATE TO A SHARED DM MESSAGE
  useEffect(() => {
    if (
      !pendingPermalink?.conversationId ||
      !selectedConversation?._id ||
      String(selectedConversation._id) !== String(pendingPermalink.conversationId) ||
      loadingMessages
    ) {
      return;
    }

    const permalinkKey = `dm:${pendingPermalink.conversationId}:${pendingPermalink.messageId}`;

    if (permalinkHandledRef.current === permalinkKey) return;

    let active = true;

    const loadDirectPermalink = async () => {
      try {
        let currentMessages = [...messages];

        let found = currentMessages.some(
          (item) => String(item._id) === String(pendingPermalink.messageId),
        );

        let cursor = currentMessages[0]?._id;
        let pageCount = 0;

        while (!found && cursor && pageCount < 100) {
          const page = await conversationService.getMessages(
            selectedConversation._id,
            cursor,
            30,
          );

          if (!active) return;

          const olderMessages = page.messages || [];
          if (!olderMessages.length) break;

          currentMessages = [...olderMessages, ...currentMessages];

          found = currentMessages.some(
            (item) => String(item._id) === String(pendingPermalink.messageId),
          );

          if (!page.hasMore || !page.nextCursor) break;

          cursor = page.nextCursor;
          pageCount += 1;
        }

        if (!active) return;

        if (!found) {
          permalinkHandledRef.current = permalinkKey;
          toast.error("The shared direct message could not be found.");
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

        permalinkHandledRef.current = permalinkKey;
        setHighlightMessageId(null);

        requestAnimationFrame(() => {
          if (active) {
            setHighlightMessageId(String(pendingPermalink.messageId));
          }
        });

        toast.success("Shared direct message opened");
      } catch (error) {
        if (!active) return;

        console.error("DM permalink navigation error:", error);
        toast.error(
          error.response?.data?.message ||
          "Could not open the shared direct message.",
        );
      }
    };

    loadDirectPermalink();

    return () => {
      active = false;
    };
  }, [
    pendingPermalink,
    selectedConversation?._id,
    loadingMessages,
    messages,
  ]);

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
  const handleSendMessage = async (
    content,
    replyTo = null,
    mentionIds = [],
    files = []
  ) => {
    if (!selectedChannel?._id) {
      throw new Error("Please select a channel first.");
    }

    if (uploadingAttachments) {
      throw new Error("An upload is already in progress.");
    }

    handleTypingChange(false);

    const channelId = selectedChannel._id;
    let uploadedAttachments = [];

    try {
      if (files.length > 0) {
        setUploadingAttachments(true);
        setUploadProgress(0);

        for (let index = 0; index < files.length; index += 1) {
          const uploadedFile = await uploadService.uploadFile(
            files[index],
            (progress) => {
              const overallProgress = Math.round(
                ((index + progress / 100) / files.length) * 100
              );

              setUploadProgress(overallProgress);
            }
          );

          uploadedAttachments.push(uploadedFile);
        }
      }

      const socket = connectSocket(token);

      if (!socket?.connected) {
        throw new Error("Chat server disconnected. Please try again.");
      }

      const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Message delivery timed out. Please try again."));
        }, 12000);

        socket.emit(
          "message:send",
          {
            channelId,
            content,
            replyTo,
            mentionIds,
            attachments: uploadedAttachments,
          },
          (result) => {
            clearTimeout(timeout);

            if (!result?.success) {
              reject(
                new Error(result?.message || "Message could not be sent.")
              );
              return;
            }

            resolve(result);
          }
        );
      });

      setReplyToMessage(null);
      return response;
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
        error.message ||
        "Message could not be sent."
      );

      throw error;
    } finally {
      setUploadingAttachments(false);
      setUploadProgress(0);
    }
  };

  // SEND DIRECT MESSAGE
  const handleSendDirectMessage = async (...args) => {
    const [content, replyTo = null, , files = []] = args;
    const conversationId = selectedConversation?._id;

    if (!conversationId) {
      throw new Error("Please select a conversation first.");
    }

    if (uploadingAttachments) {
      throw new Error("An upload is already in progress.");
    }

    handleDirectTypingChange(false);

    let uploadedAttachments = [];

    try {
      if (files.length > 0) {
        setUploadingAttachments(true);
        setUploadProgress(0);

        for (let index = 0; index < files.length; index += 1) {
          const uploadedFile = await uploadService.uploadFile(
            files[index],
            (progress) => {
              const overallProgress = Math.round(
                ((index + progress / 100) / files.length) * 100,
              );

              setUploadProgress(overallProgress);
            },
          );

          uploadedAttachments.push(uploadedFile);
        }
      }

      const socket = connectSocket(token);

      if (!socket?.connected) {
        throw new Error("Chat server disconnected. Please try again.");
      }

      const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Message delivery timed out. Please try again."));
        }, 12000);

        socket.emit(
          "dm:send",
          {
            conversationId,
            content,
            replyTo,
            attachments: uploadedAttachments,
          },
          (result) => {
            clearTimeout(timeout);

            if (!result?.success || !result.message) {
              reject(
                new Error(result?.message || "Direct message could not be sent."),
              );
              return;
            }

            resolve(result);
          },
        );
      });

      const sentMessage = response.message;

      setMessages((previous) => {
        if (
          previous.some(
            (message) => String(message._id) === String(sentMessage._id),
          )
        ) {
          return previous;
        }

        return [...previous, sentMessage].sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
        );
      });

      setConversations((previous) =>
        previous.map((conversation) =>
          String(conversation._id) === String(conversationId)
            ? {
                ...conversation,
                lastMessage: sentMessage,
                lastMessageAt: sentMessage.createdAt,
                unreadCount: 0,
              }
            : conversation,
        ),
      );

      setReplyToMessage(null);

      return response;
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
        error.message ||
        "Direct message could not be sent.",
      );

      throw error;
    } finally {
      setUploadingAttachments(false);
      setUploadProgress(0);
    }
  };
  // EDIT MESSAGE
  const handleEditMessage = useCallback(async (messageId, content) => {
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
  }, [token]);
  // DELETE MESSAGE
  const handleDeleteMessage = useCallback(async (messageId) => {
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
  }, [token]);

  // EDIT DIRECT MESSAGE
  const handleEditDirectMessage = useCallback(async (messageId, content) => {
    try {
      const updatedMessage = await conversationService.editMessage(
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
        socket.emit("dm:message:updated", messageId);
      }

      toast.success("Message updated");
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Could not edit direct message",
      );
      throw error;
    }
  }, [token]);

  // DELETE DIRECT MESSAGE
  const handleDeleteDirectMessage = useCallback(async (messageId) => {
    try {
      await conversationService.deleteMessage(messageId);

      const deletedAt = new Date().toISOString();

      const deletedMessage = {
        _id: messageId,
        content: "This message was deleted",
        deletedAt,
      };

      setMessages((previous) =>
        previous.map((message) =>
          String(message._id) === String(messageId)
            ? { ...message, ...deletedMessage }
            : message,
        ),
      );

      const socket = connectSocket(token);

      if (socket?.connected) {
        socket.emit("dm:message:deleted", messageId);
      }

      toast.success("Message deleted");
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Could not delete direct message",
      );
    }
  }, [token]);
  // TOGGLE MESSAGE REACTION
  const handleReactMessage = useCallback(async (messageId, emoji) => {
    try {
      const targetMessage = messages.find(
        (message) => String(message._id) === String(messageId),
      );

      const isDirectMessage = Boolean(targetMessage?.conversation);

      const response = isDirectMessage
        ? await conversationService.toggleReaction(messageId, emoji)
        : await messageService.toggleReaction(messageId, emoji);

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
  }, [messages]);

  // START A DIRECT CONVERSATION FROM A WORKSPACE MEMBER
  const handleSelectMember = async (member) => {
    const recipientId = member?._id || member?.id;

    if (!recipientId || String(recipientId) === String(currentUserId)) {
      return;
    }

    try {
      const response = await conversationService.startConversation(recipientId);
      const conversation = response.conversation;

      if (!conversation?._id) {
        throw new Error("Could not create or open this conversation.");
      }

      setConversations((previous) => {
        const filtered = previous.filter(
          (item) => String(item._id) !== String(conversation._id)
        );

        return [conversation, ...filtered];
      });

      setSelectedConversation(conversation);
      setSelectedChannel(null);
      setReplyToMessage(null);
      setMessages([]);
      setTypingUsers([]);
      setMobileMenuOpen(false);
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
        error.message ||
        "Could not start direct conversation"
      );
    }
  };

  // OPEN AN EXISTING DIRECT CONVERSATION
  const handleSelectConversation = (conversation) => {
    if (!conversation?._id) return;

    setSelectedConversation(conversation);
    setSelectedChannel(null);
    setReplyToMessage(null);
    setMessages([]);
    setTypingUsers([]);
    setMobileMenuOpen(false);
  };

  const handleSelectWorkspace = (workspace) => {
    setSelectedConversation(null);
    setSelectedWorkspace(workspace);
    setMobileMenuOpen(false);
  };

  const handleSearchResultSelect = async (message) => {
    const channelId = selectedChannel?._id;

    if (!channelId || !message?._id) return;

    setSearchOpen(false);
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
    } catch (error) {
      console.error("Jump to message error:", error);

      toast.error(
        error.response?.data?.message || "Could not load the selected message.",
      );
    }
  };

  const handleReplyPreviewClick = useCallback(async (messageId) => {
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
  }, [messages, selectedChannel]);
  const handleSelectChannel = (channel) => {
    setSelectedConversation(null);
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

    // DIRECT MESSAGE NOTIFICATION
    const conversationId =
      notification.conversation?._id || notification.conversation;

    if (
      conversationId &&
      ["direct_message", "direct_message_reply"].includes(notification.type)
    ) {
      let targetConversation = conversations.find(
        (item) => String(item._id) === String(conversationId),
      );

      // Refresh the list if the conversation is not currently loaded.
      if (!targetConversation) {
        try {
          const response = await conversationService.getConversations();
          const updatedConversations = response.conversations || [];

          setConversations(updatedConversations);

          targetConversation = updatedConversations.find(
            (item) => String(item._id) === String(conversationId),
          );
        } catch (error) {
          console.error("Could not load notification conversation:", error);
        }
      }

      if (!targetConversation) {
        toast.error("Could not locate this direct conversation");
        return;
      }

      handleSelectConversation(targetConversation);
      return;
    }

    // EXISTING CHANNEL NOTIFICATION NAVIGATION
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

  const onlineCount = onlineUsers.length;

  return (
    <div className="flex h-dvh overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      <div className="hidden lg:flex">
        <WorkspaceSidebar
          workspaces={workspaces}
          selectedWorkspace={selectedWorkspace}
          onSelectWorkspace={handleSelectWorkspace}
          onCreateWorkspace={() => setWorkspaceModalOpen(true)}
        onSettingsClick={() => navigate("/settings")}
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
          conversations={conversations}
          selectedConversation={selectedConversation}
          onSelectConversation={handleSelectConversation}
          onSelectMember={handleSelectMember}
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
        onSettingsClick={() => navigate("/settings")}
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
                conversations={conversations}
                selectedConversation={selectedConversation}
                onSelectConversation={handleSelectConversation}
                onSelectMember={handleSelectMember}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ChatHeader
          onMenuClick={() => setMobileMenuOpen(true)}
        onVoiceCall={() => handleStartCall("audio")}
        onVideoCall={() => handleStartCall("video")}
        onCallHistory={() => setCallHistoryOpen(true)}
          channel={selectedChannel}
          conversation={selectedConversation}
          currentUserId={currentUserId}
          onlineUsers={onlineUsers}
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
          <div
            className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center"
            role="status"
            aria-live="polite"
          >
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-2xl font-bold text-indigo-500">
              #
            </div>

            <h2 className="text-xl font-bold text-[var(--text)]">
              Welcome to CIRQL
            </h2>

            <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--muted)]">
              Getting your workspace and conversations ready...
            </p>

            <div className="mt-5 h-1 w-32 overflow-hidden rounded-full bg-[var(--surface-hover)]">
              <div className="h-full w-1/2 rounded-full bg-indigo-500" />
            </div>
          </div>
        ) : selectedConversation ? (
          <>
            {loadingMessages ? (
              <div className="flex-1 overflow-y-auto">
                <MessageLoading />
              </div>
            ) : messageLoadError ? (
              <div className="flex flex-1 items-center justify-center px-6 py-10">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-7 text-center shadow-xl"
                >
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-2xl text-red-500">
                    !
                  </div>

                  <h3 className="mt-5 text-lg font-bold text-[var(--text)]">
                    Couldn't load direct messages
                  </h3>

                  <p role="alert" className="mt-2 text-sm text-[var(--muted)]">
                    {messageLoadError}
                  </p>

                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => {
                      setMessageLoadError("");
                      setLoadingMessages(true);
                      setRetryHistory((previous) => previous + 1);
                    }}
                    className="mt-6 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
                  >
                    Retry loading messages
                  </motion.button>
                </motion.div>
              </div>
            ) : (
              <DirectMessages
                messages={messages}
                currentUserId={currentUserId}
                conversationId={selectedConversation._id}
                highlightMessageId={highlightMessageId}
                typingUsers={typingUsers}
                onEditMessage={handleEditDirectMessage}
                onDeleteMessage={handleDeleteDirectMessage}
                onReplyMessage={setReplyToMessage}
              />
            )}

            <MessageComposer
              key={selectedConversation._id}
              channelName={
                selectedConversation.participants?.find(
                  (participant) =>
                    String(participant._id || participant) !==
                    String(currentUserId),
                )?.name || "Direct message"
              }
              members={[]}
              onSend={handleSendDirectMessage}
              uploading={uploadingAttachments}
              uploadProgress={uploadProgress}
              onTypingChange={handleDirectTypingChange}
              replyTo={replyToMessage}
              onCancelReply={() => setReplyToMessage(null)}
            />
          </>
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
            {messageLoadError ? (
              <div className="flex flex-1 items-center justify-center overflow-y-auto px-6 py-10">
                <motion.div
                  initial={{ opacity: 0, y: 16, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.25 }}
                  className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-7 text-center shadow-xl"
                >
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-2xl text-red-500">
                    !
                  </div>

                  <h3 className="mt-5 text-lg font-bold text-[var(--text)]">
                    Couldn't load this conversation
                  </h3>

                  <p
                    role="alert"
                    className="mt-2 text-sm leading-6 text-[var(--muted)]"
                  >
                    {messageLoadError}
                  </p>

                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => {
                      setMessageLoadError("");
                      setLoadingMessages(true);
                      setRetryHistory((previous) => previous + 1);
                    }}
                    className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500"
                  >
                    <span className="text-base">?</span>
                    Retry loading messages
                  </motion.button>
                </motion.div>
              </div>
            ) : (
              <ChatMessages
                isLoading={loadingMessages}
                messages={messages}
                channelReadStates={channelReadStates}
                channel={selectedChannel}
                workspaceId={selectedWorkspace._id}
                channelId={selectedChannel._id}
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
            uploading={uploadingAttachments}
            uploadProgress={uploadProgress}
              onTypingChange={handleTypingChange}
              replyTo={replyToMessage}
              onCancelReply={() => setReplyToMessage(null)}
            />
          </>
        )}
      </main>

      <CallHistoryModal

        open={callHistoryOpen}

        onClose={() => setCallHistoryOpen(false)}

        conversationId={selectedConversation?._id}

        currentUserId={currentUserId}

      />


      <CallOverlay
        socket={getSocket()}
        session={callSession}
        onSessionChange={setCallSession}
      />

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

