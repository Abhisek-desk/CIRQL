import { useEffect, useRef, useState } from "react";
import { AnimatePresence, m as motion } from "motion/react";

import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";

export default function ChatMessages({
  messages = [],
  typingUsers = [],
  channelReadStates = [],
  channel,
  workspaceId,
  channelId,
  currentUserId,
  members = [],
  highlightMessageId,
  firstUnreadMessageId,
  onEditMessage,
  onDeleteMessage,
  onReplyMessage,
  onJumpToMessage,
  onReactMessage,
}) {
  const scrollContainerRef = useRef(null);
  const lastMessageIdRef = useRef(null);
  const [highlightedId, setHighlightedId] = useState(null);

  // Keep the conversation pinned to the latest message during initial loading.
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    const lastMessageId = lastMessage?._id || lastMessage?.id;

    if (!lastMessageId) {
      lastMessageIdRef.current = null;
      return;
    }

    const isInitialLoad = !lastMessageIdRef.current;
    const isNewMessage =
      String(lastMessageId) !== String(lastMessageIdRef.current);

    if ((!isInitialLoad && !isNewMessage) || highlightMessageId) return;

    const container = scrollContainerRef.current;
    const content = container?.firstElementChild;

    if (!container || !content) return;

    let active = true;
    let frameOne;
    let frameTwo;

    const scrollToBottom = () => {
      if (!active) return;

      container.scrollTop = container.scrollHeight;
      lastMessageIdRef.current = lastMessageId;
    };

    // Scroll after React commits and the browser calculates layout.
    const scheduleScroll = () => {
      frameOne = requestAnimationFrame(() => {
        scrollToBottom();

        frameTwo = requestAnimationFrame(() => {
          scrollToBottom();
        });
      });
    };

    scheduleScroll();

    // Observe the actual message-list height, including image resizing.
    let resizeObserver;

    if (isInitialLoad && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        scrollToBottom();
      });

      resizeObserver.observe(content);
    }

    // Also handle images that finish loading after the initial render.
    const images = [...content.querySelectorAll("img")];

    const handleImageLoad = () => {
      scheduleScroll();
    };

    images.forEach((img) => {
      if (!img.complete) {
        img.addEventListener("load", handleImageLoad);
        img.addEventListener("error", handleImageLoad);
      } else if (img.naturalWidth > 0) {
        img.decode?.().then(scheduleScroll).catch(() => {});
      }
    });

    const cleanupTimer = setTimeout(() => {
      resizeObserver?.disconnect();

      images.forEach((img) => {
        img.removeEventListener("load", handleImageLoad);
        img.removeEventListener("error", handleImageLoad);
      });
    }, isInitialLoad ? 8000 : 1000);

    return () => {
      active = false;
      clearTimeout(cleanupTimer);
      cancelAnimationFrame(frameOne);
      cancelAnimationFrame(frameTwo);
      resizeObserver?.disconnect();

      images.forEach((img) => {
        img.removeEventListener("load", handleImageLoad);
        img.removeEventListener("error", handleImageLoad);
      });
    };
  }, [messages, highlightMessageId]);

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
  const priorityMessageId = [...messages].reverse().find((message) =>
    message.attachments?.some((file) =>
      file.mimeType?.startsWith("image/") || file.resourceType === "image"
    )
  )?._id;

  return (
    <div ref={scrollContainerRef} className="custom-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto py-5">
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

        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="mx-auto flex max-w-md flex-col items-center px-6 py-12 text-center"
          >
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl border border-[var(--border)] bg-[var(--surface)] text-3xl font-bold text-indigo-500 shadow-sm">
              #
            </div>

            <h3 className="text-lg font-bold text-[var(--text)]">
              It's quiet in here
            </h3>

            <p className="mt-2 max-w-xs text-sm leading-6 text-[var(--muted)]">
              This is the start of something great. Send the first message
              and get your team's conversation going.
            </p>

            <div className="mt-5 rounded-full border border-indigo-500/20 bg-indigo-500/[0.06] px-4 py-2 text-xs font-medium text-indigo-500">
              Your conversation starts here
            </div>
          </motion.div>
        )}

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
                workspaceId={workspaceId}
                channelId={channelId}
                seenBy={seenBy}
                prioritizeImages={String(messageId) === String(priorityMessageId)}
                isOwn={Boolean(isOwn)}
                currentUserId={currentUserId}
                members={members}
                onEdit={onEditMessage}
                onDelete={onDeleteMessage}
                onReply={onReplyMessage}
                onJumpToMessage={onJumpToMessage}
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

        
      </div>
    </div>
  );
}
