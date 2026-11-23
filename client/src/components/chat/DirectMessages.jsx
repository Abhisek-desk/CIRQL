import { useEffect, useRef } from "react";
import { AnimatePresence, m as motion } from "motion/react";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";

export default function DirectMessages({
  messages = [],
  currentUserId,
  typingUsers = [],
  onEditMessage,
  onDeleteMessage,
  onReplyMessage,
  onReactMessage,
  conversationId,
  highlightMessageId,
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!highlightMessageId) return;

    const target = document.getElementById(
      `message-${highlightMessageId}`,
    );

    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightMessageId, messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  return (
    <div className="custom-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto py-5">
      {messages.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-1 flex-col items-center justify-center px-6 text-center"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-3xl">
            💬
          </div>

          <h3 className="mt-5 text-lg font-bold text-[var(--text)]">
            Start the conversation
          </h3>

          <p className="mt-2 max-w-xs text-sm leading-6 text-[var(--muted)]">
            This is the beginning of your direct conversation. Send a message
            to get things started.
          </p>
        </motion.div>
      ) : (
        <div className="flex flex-col gap-2 px-3 sm:px-5">
          <AnimatePresence initial={false}>
            {messages.map((message) => {
              const senderId =
                message.sender?._id || message.sender?.id || message.sender;

              return (
                <motion.div
                  key={message._id}
                  id={`message-${message._id}`}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className={String(highlightMessageId) === String(message._id) ? "rounded-xl ring-2 ring-indigo-500 ring-offset-2 ring-offset-[var(--bg)]" : ""}
                >
                  <MessageBubble
                    message={message}
                    conversationId={conversationId}
                    isOwn={String(senderId) === String(currentUserId)}
                    currentUserId={currentUserId}
                    onEdit={onEditMessage}
                    onDelete={onDeleteMessage}
                    onReply={onReplyMessage}
                    onReact={onReactMessage}
                    members={[]}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <TypingIndicator
        names={typingUsers.map((item) => item.name || "Someone")}
      />

      <div ref={bottomRef} />
    </div>
  );
}
