import { io } from "socket.io-client";

const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2YjAxYWU3ZTc5MmNkZDI4ZjgwZWIzZmYiLCJpYXQiOjE3OTUyNzYwMDEsImV4cCI6MTc5NTI3NjkwMX0.y9iEff9Y_JqZFSH_e-Qf3jQDa8BuPCmkvVfB4VYcZY8";
const CHANNEL_ID = "6b01b05e792cdd28f80eb401";

const socket = io("http://localhost:5000", {
  auth: { token: TOKEN },
  transports: ["websocket"],
});

socket.on("connect", () => {
  console.log("User 2 connected:", socket.id);

  socket.emit("channel:join", CHANNEL_ID, (response) => {
    console.log("Channel join:", response);
  });
});

socket.on("message:new", (message) => {
  console.log("\n========== NEW MESSAGE ==========");
  console.log("Sender:", message.sender.name);
  console.log("Message:", message.content);
  console.log("=================================");
});

socket.on("typing:start", (data) => {
  console.log(`${data.name} is typing...`);
});

socket.on("typing:stop", () => {
  console.log("User stopped typing.");
});

socket.on("presence:online", (data) => {
  console.log("Online users:", data.onlineUsers);
});

socket.on("presence:offline", (data) => {
  console.log("Online users:", data.onlineUsers);
});

socket.on("connect_error", (error) => {
  console.log("Connection error:", error.message);
});

socket.on("disconnect", (reason) => {
  console.log("User 2 disconnected:", reason);
});