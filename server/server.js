import "dotenv/config";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { createServer } from "http";
import { Server } from "socket.io";
import { randomUUID } from "crypto";
import { verifyToken } from "./middleware/auth.js";

const app = express();

// Express CORS configuration
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

// Demo users
const USERS = [
  {
    userId: 1,
    name: "Ada",
    email: "ada@threadbase.dev",
    password: "password",
  },
  {
    userId: 2,
    name: "Linus",
    email: "linus@threadbase.dev",
    password: "password",
  },
];

// POST /auth/login
app.post("/auth/login", (req, res) => {
  const { email, password } = req.body ?? {};

  const found = USERS.find(
    (user) => user.email === email && user.password === password
  );

  if (!found) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const accessToken = jwt.sign(
    {
      userId: found.userId,
      name: found.name,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  res.json({
    accessToken,
    user: {
      userId: found.userId,
      name: found.name,
    },
  });
});

// Protected HTTP route
app.get("/api/me", verifyToken, (req, res) => {
  res.json({ user: req.user });
});

// Create HTTP server
const httpServer = createServer(app);

// Attach Socket.IO with its own CORS configuration
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    credentials: true,
  },
});

// Authenticate Socket.IO connections using JWT
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error("Authentication required"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    socket.data.user = decoded;

    next();
  } catch (error) {
    next(new Error("Invalid token"));
  }
});

// Room joining and live message broadcasting
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);
  console.log("Authenticated user:", socket.data.user.name);

  // Join a chat room
  socket.on("room:join", (roomId) => {
    if (typeof roomId !== "string" || !roomId.trim()) {
      return;
    }

    socket.join(roomId);

    console.log(`${socket.data.user.name} joined room: ${roomId}`);
  });

  // Receive and broadcast a chat message
  socket.on("chat:message", ({ roomId, text } = {}) => {
    if (
      typeof roomId !== "string" ||
      !roomId.trim() ||
      typeof text !== "string" ||
      !text.trim()
    ) {
      return;
    }

    // Only allow messages to rooms this socket has joined.
    if (!socket.rooms.has(roomId)) {
      console.log(
        `${socket.data.user.name} attempted to message without joining ${roomId}`
      );
      return;
    }

    const message = {
      id: randomUUID(),
      text: text.trim(),
      user: {
        userId: socket.data.user.userId,
        name: socket.data.user.name,
      },
      timestamp: new Date().toISOString(),
    };

    // Send to everyone in the room, including the sender.
    io.to(roomId).emit("chat:message", message);

    console.log(
      `Message from ${socket.data.user.name} broadcast to ${roomId}`
    );
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

// Start the HTTP server
const PORT = process.env.PORT ?? 3001;

httpServer.listen(PORT, () => {
  console.log(`Server on http://localhost:${PORT}`);
  console.log("POST /auth/login");
  console.log("Socket.IO: ready");
});