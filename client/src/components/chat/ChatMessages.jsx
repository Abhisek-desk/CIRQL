import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";

export default function ChatMessages({
  messages = [],
  typingUsers = [],
  channelReadStates = [],
  channel,
  currentUserId,
  members = [],
  highlightMessageId,
  firstUnreadMessageId,
  onEditMessage,
  onDeleteMessage,
  onReplyMessage,
  onReactMessage,
}) {
  const bottomRef = useRef(null);
  const lastMessageIdRef = useRef(null);
  const [highlightedId, setHighlightedId] = useState(null);

  // Scroll to the latest message on initial load and when a new message arrives.
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    const lastMessageId = lastMessage?._id || lastMessage?.id || null;

    if (!lastMessageId) {
      lastMessageIdRef.current = null;
      return;
    }

    const isInitialLoad = !lastMessageIdRef.current;
    const isNewMessage =
      String(lastMessageId) !== String(lastMessageIdRef.current);

    if (isInitialLoad || isNewMessage) {
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({
          behavior: isInitialLoad ? "auto" : "smooth",
        });
      });
    }

    lastMessageIdRef.current = lastMessageId;
  }, [messages]);

  // Scroll to and temporarily highlight a selected search result.
  useEffect(() => {
    if (!highlightMessageId) return;

    const timer = setTimeout(() => {
      const element = document.getElementById(
        `message-${highlightMessageId}`
      );

      if (element) {
        element.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });

        setHighlightedId(String(highlightMessageId));
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [highlightMessageId, messages]);

  useEffect(() => {
    if (!highlightedId) return;

    const timer = setTimeout(() => {
      setHighlightedId(null);
    }, 2500);

    return () => clearTimeout(timer);
  }, [highlightedId]);

  useEffect(() => {
  const debugData = {
    currentUserId,

    readStates: channelReadStates.map((state) => ({
      userId: String(state.user?._id || state.user),
      lastReadAt: state.lastReadAt,
      timestamp: new Date(state.lastReadAt).getTime(),
    })),

    messages: messages.slice(-5).map((message) => {
      const senderId =
        message.sender?._id ||
        message.sender?.id ||
        message.sender;

      return {
        id: String(message._id || message.id),
        senderId: String(senderId),
        isOwn: String(senderId) === String(currentUserId),
        createdAt: message.createdAt,
        timestamp: new Date(message.createdAt).getTime(),
      };
    }),
  };

  console.log(
    "[RECEIPT DEBUG - FULL DATA]\n",
    JSON.stringify(debugData, null, 2)
  );
}, [currentUserId, channelReadStates, messages]);

  const channelName = channel?.name || "channel";
  const typingNames = typingUsers.map((item) => item.name);

  return (
    <div className="custom-scrollbar flex-1 overflow-y-auto py-5">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 px-5">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-2xl text-indigo-500">
            #
          </div>

          <h2 className="text-xl font-bold text-[var(--text)]">
            Welcome to #{channelName}
          </h2>

          <p className="mt-1 text-sm text-[var(--muted)]">
            {channel?.description ||
              "This is the beginning of your team's conversation."}
          </p>
        </div>

        {messages.map((message) => {
          const messageId = String(message._id || message.id);
          const isFirstUnread =
            firstUnreadMessageId &&
            messageId === String(firstUnreadMessageId);

          const senderId =
            message.sender?._id ||
            message.sender?.id ||
            message.sender;

          const isOwn =
            currentUserId &&
            String(senderId) === String(currentUserId);

          const isHighlighted = highlightedId === messageId;

          const seenBy = isOwn
            ? channelReadStates
                .filter((state) => {
                  const readerId = state.user?._id || state.user;

                  return (
                    String(readerId) !== String(senderId) &&
                    new Date(state.lastReadAt).getTime() >=
                      new Date(message.createdAt).getTime()
                  );
                })
                .map((state) => state.user)
                .filter(Boolean)
            : [];

          return (
            <div key={messageId}>
              {isFirstUnread && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center gap-3 px-5 py-4"
                  role="separator"
                  aria-label="New messages"
                >
                  <div className="h-px flex-1 bg-indigo-500/50" />
                  <span className="rounded-full bg-indigo-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-indigo-500">
                    New messages
                  </span>
                  <div className="h-px flex-1 bg-indigo-500/50" />
                </motion.div>
              )}

              <div
                id={`message-${messageId}`}
              className={`rounded-xl transition-all duration-500 ${
                isHighlighted
                  ? "bg-indigo-500/10 ring-2 ring-inset ring-indigo-500/70"
                  : ""
              }`}
            >
              <MessageBubble
                message={message}
                seenBy={seenBy}
                isOwn={Boolean(isOwn)}
                currentUserId={currentUserId}
                members={members}
                onEdit={onEditMessage}
                onDelete={onDeleteMessage}
                onReply={onReplyMessage}
                onReact={onReactMessage}
              />
              </div>
            </div>
          );
        })}

        <AnimatePresence>
          {typingNames.length > 0 && (
            <TypingIndicator names={typingNames} />
          )}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>
    </div>
  );
}





