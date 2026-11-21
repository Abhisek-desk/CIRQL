import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";

export default function ChatMessages({ messages, typing = false }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  return (
    <div className="custom-scrollbar flex-1 overflow-y-auto py-5">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 px-5">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-2xl">
            #
          </div>
          <h2 className="text-xl font-bold text-[var(--text)]">
            Welcome to #general
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            This is the beginning of your team's conversation.
          </p>
        </div>

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} isOwn={message.isOwn} />
        ))}

        {typing && <TypingIndicator name="Alex" />}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
