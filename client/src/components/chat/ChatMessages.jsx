import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";

import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";

export default function ChatMessages({
  messages = [],
  typingUsers = [],
  channel,
  currentUserId,
  members = [],
  highlightMessageId,
  onEditMessage,
  onDeleteMessage,
  onReplyMessage,
  onReactMessage,
}) {
  const bottomRef = useRef(null);
  const lastMessageIdRef = useRef(null);
  const [highlightedId, setHighlightedId] = useState(null);

  // Only auto-scroll when a new message is added at the bottom.
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    const lastMessageId = lastMessage?._id || lastMessage?.id || null;

    if (
      lastMessageId &&
      lastMessageIdRef.current &&
      String(lastMessageId) !== String(lastMessageIdRef.current)
    ) {
      bottomRef.current?.scrollIntoView({
        behavior: "smooth",
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
          const senderId =
            message.sender?._id ||
            message.sender?.id ||
            message.sender;

          const isOwn =
            currentUserId &&
            String(senderId) === String(currentUserId);

          const isHighlighted = highlightedId === messageId;

          return (
            <div
              key={messageId}
              id={`message-${messageId}`}
              className={`rounded-xl transition-all duration-500 ${
                isHighlighted
                  ? "bg-indigo-500/10 ring-2 ring-inset ring-indigo-500/70"
                  : ""
              }`}
            >
              <MessageBubble
                message={message}
                isOwn={Boolean(isOwn)}
                currentUserId={currentUserId}
                members={members}
                onEdit={onEditMessage}
                onDelete={onDeleteMessage}
                onReply={onReplyMessage}
                onReact={onReactMessage}
              />
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
