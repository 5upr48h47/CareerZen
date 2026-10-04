import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './auth.js';

// JWT_SECRET is a factory (it validates the env var), so call it to get the
// actual string. Passing the function itself to jwt.verify made every socket
// auth attempt fail, so no client was ever registered and no real-time events
// were ever delivered — users only saw updates on a manual page refresh.
const SECRET = JWT_SECRET();

const connectedClients = new Map(); // userId -> Set of WebSocket instances

export function initSocketServer(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, _req) => {
    let currentUserId = null;

    // Handle authentication message or query param
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'auth') {
          try {
            const decoded = jwt.verify(data.token, SECRET);
            currentUserId = decoded.id;
            if (!connectedClients.has(currentUserId)) {
              connectedClients.set(currentUserId, new Set());
            }
            connectedClients.get(currentUserId).add(ws);
            ws.send(JSON.stringify({ type: 'authenticated', userId: currentUserId }));
          } catch (_err) {
            ws.send(JSON.stringify({ type: 'error', message: 'Auth failed' }));
          }
        }
      } catch (e) {
        console.error('Socket message parse error:', e);
      }
    });

    ws.on('close', () => {
      if (currentUserId && connectedClients.has(currentUserId)) {
        connectedClients.get(currentUserId).delete(ws);
        if (connectedClients.get(currentUserId).size === 0) {
          connectedClients.delete(currentUserId);
        }
      }
    });
  });

  return wss;
}

export function sendToUser(userId, payload) {
  const targetId = Number(userId);
  if (connectedClients.has(targetId)) {
    const clients = connectedClients.get(targetId);
    const data = JSON.stringify(payload);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }
}

export function broadcast(payload) {
  const data = JSON.stringify(payload);
  for (const clientSet of connectedClients.values()) {
    for (const client of clientSet) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }
}
