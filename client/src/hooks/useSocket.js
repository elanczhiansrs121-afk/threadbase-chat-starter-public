import { useCallback, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../auth/AuthContext.jsx";

export function useSocket(roomId) {
  const { token } = useAuth();

  const [messages, setMessages] = useState([]);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!token || !roomId) {
      setSocket(null);
      return;
    }

    const socketInstance = io(
      import.meta.env.VITE_SOCKET_URL || "http://localhost:3001",
      {
        auth: { token },
      }
    );

    setMessages([]);
    setSocket(socketInstance);

    const onMessage = (message) => {
      setMessages((previousMessages) => [
        ...previousMessages,
        message,
      ]);
    };

    const onConnect = () => {
      socketInstance.emit("room:join", roomId);
    };

    socketInstance.on("connect", onConnect);
    socketInstance.on("chat:message", onMessage);

    return () => {
      socketInstance.off("connect", onConnect);
      socketInstance.off("chat:message", onMessage);
      socketInstance.disconnect();
    };
  }, [token, roomId]);

  const sendMessage = useCallback(
    (text) => {
      if (!socket || !socket.connected || !roomId) {
        console.warn("Chat socket is not connected yet.");
        return;
      }

      socket.emit("chat:message", {
        roomId,
        text,
      });
    },
    [socket, roomId]
  );

  return { messages, sendMessage };
}