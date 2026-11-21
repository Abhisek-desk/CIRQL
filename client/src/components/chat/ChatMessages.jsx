import { useEffect, useRef } from "react";
import { AnimatePresence } from "motion/react";

import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";

export default function ChatMessages({
  messages = [],
  typingUsers = [],
  channel,
  currentUserId,
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

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
          const senderId =
            message.sender?._id ||
            message.sender?.id ||
            message.sender;

          const isOwn =
            currentUserId &&
            String(senderId) === String(currentUserId);

          return (
            <MessageBubble
              key={message._id || message.id}
              message={message}
              isOwn={Boolean(isOwn)}
            />
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