import { io } from "socket.io-client";

const TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2YjAwNzdjMWViNDI0MjMyYWNlNTA5MGYiLCJpYXQiOjE3OTUyNzU5ODQsImV4cCI6MTc5NTI3Njg4NH0.kKAdsOPzEoewQ3gIjkCkM55AZ64F7s4XiYDf__nwzig";
const CHANNEL_ID = "6b01b05e792cdd28f80eb401";

const socket = io("http://localhost:5000", {
  auth: {
    token: TOKEN,
  },
  transports: ["websocket"],
});

socket.on("connect", () => {
  console.log("Connected to CIRQL Socket.IO!");
  console.log("Socket ID:", socket.id);

  // Join channel
  socket.emit("channel:join", CHANNEL_ID, (response) => {
    console.log("Channel join response:", response);

    if (response.success) {
      console.log("Successfully joined channel!");

      // Send a real-time message
      socket.emit(
        "message:send",
        {
          channelId: CHANNEL_ID,
          content: "Hello from CIRQL real-time messaging!",
        },
        (result) => {
          console.log("Message send response:", result);
        },
      );
    }
  });
  // Test typing indicator
  socket.emit("typing:start", CHANNEL_ID);

  console.log("Typing started...");

  setTimeout(() => {
    socket.emit("typing:stop", CHANNEL_ID);
    console.log("Typing stopped...");
  }, 3000);
});

socket.on("message:new", (message) => {
  console.log("\nNew real-time message received:");
  console.log(message);
});

socket.on("presence:online", (data) => {
  console.log("\nOnline users:", data.onlineUsers);
});

socket.on("presence:offline", (data) => {
  console.log("\nOffline users:", data.onlineUsers);
});

socket.on("connect_error", (error) => {
  console.error("Socket connection error:", error.message);
});

socket.on("disconnect", (reason) => {
  console.log("Disconnected:", reason);
});

// Test typing indicator
socket.on("typing:start", (data) => {
  console.log("Typing started:", data);
});

socket.on("typing:stop", (data) => {
  console.log("Typing stopped:", data);
});
