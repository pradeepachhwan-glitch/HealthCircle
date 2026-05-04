import type { IncomingMessage, Server as HttpServer } from "http";
import type { Socket } from "net";
import { WebSocketServer, WebSocket } from "ws";
import { db, usersTable, tcConsultations, doctorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getSessionRow, SESSION_COOKIE } from "./auth";
import { logger } from "./logger";

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const pair of header.split(";")) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

interface RoomPeer {
  ws: WebSocket;
  userId: number;
  peerId: string;
  role: "patient" | "doctor" | "guest";
}

const rooms = new Map<number, Set<RoomPeer>>();

const MAX_PEERS_PER_ROOM = 4;
const MAX_MSG_BYTES = 64 * 1024;

function broadcast(roomId: number, sender: RoomPeer, payload: unknown) {
  const room = rooms.get(roomId);
  if (!room) return;
  const msg = JSON.stringify(payload);
  for (const peer of room) {
    if (peer === sender) continue;
    if (peer.ws.readyState === WebSocket.OPEN) {
      try {
        peer.ws.send(msg);
      } catch (err) {
        logger.warn({ err, roomId }, "tc-ws broadcast send failed");
      }
    }
  }
}

function sendTo(peer: RoomPeer, payload: unknown) {
  if (peer.ws.readyState !== WebSocket.OPEN) return;
  try {
    peer.ws.send(JSON.stringify(payload));
  } catch (err) {
    logger.warn({ err }, "tc-ws sendTo failed");
  }
}

function leaveRoom(roomId: number, peer: RoomPeer) {
  const room = rooms.get(roomId);
  if (!room) return;
  room.delete(peer);
  if (room.size === 0) {
    rooms.delete(roomId);
  } else {
    broadcast(roomId, peer, { type: "peer-left", peerId: peer.peerId });
  }
}

async function authenticateUpgrade(req: IncomingMessage): Promise<{ userId: number } | null> {
  const cookieHeader = req.headers["cookie"];
  const cookies = parseCookies(cookieHeader);
  const sid = cookies[SESSION_COOKIE];
  if (!sid) return null;
  const session = await getSessionRow(sid);
  if (!session?.userId) return null;
  const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, session.userId)).limit(1);
  if (!user) return null;
  return { userId: user.id };
}

async function authorizeConsultation(consultationId: number, userId: number): Promise<RoomPeer["role"] | null> {
  const [row] = await db
    .select({
      patientUserId: tcConsultations.userId,
      doctorUserId: doctorsTable.userId,
    })
    .from(tcConsultations)
    .leftJoin(doctorsTable, eq(tcConsultations.doctorId, doctorsTable.id))
    .where(eq(tcConsultations.id, consultationId))
    .limit(1);
  if (!row) return null;
  if (row.patientUserId === userId) return "patient";
  if (row.doctorUserId === userId) return "doctor";
  return null;
}

const PATH_RE = /^\/api\/tc\/ws\/session\/(\d+)$/;

export function attachTeleconsultSignaling(server: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage, ctx: { roomId: number; userId: number; role: RoomPeer["role"] }) => {
    const peerId = `p_${Math.random().toString(36).slice(2, 10)}`;
    const peer: RoomPeer = {
      ws,
      userId: ctx.userId,
      peerId,
      role: ctx.role,
    };

    let room = rooms.get(ctx.roomId);
    if (!room) {
      room = new Set();
      rooms.set(ctx.roomId, room);
    }

    if (room.size >= MAX_PEERS_PER_ROOM) {
      sendTo(peer, { type: "error", reason: "room-full" });
      ws.close(1013, "room-full");
      return;
    }

    room.add(peer);

    // Send current peer list to the joining peer.
    const others = Array.from(room).filter((p) => p !== peer).map((p) => ({ peerId: p.peerId, role: p.role }));
    sendTo(peer, { type: "welcome", peerId, role: peer.role, peers: others });

    // Notify other peers a new peer joined.
    broadcast(ctx.roomId, peer, { type: "peer-joined", peerId, role: peer.role });

    ws.on("message", (raw: WebSocket.RawData) => {
      if (raw.toString().length > MAX_MSG_BYTES) {
        sendTo(peer, { type: "error", reason: "message-too-large" });
        return;
      }
      let parsed: { type?: string; to?: string; payload?: unknown; text?: string };
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        return;
      }

      // WebRTC signaling: targeted relay
      if (parsed.type === "signal" && typeof parsed.to === "string") {
        const target = Array.from(room!).find((p) => p.peerId === parsed.to);
        if (!target) return;
        sendTo(target, { type: "signal", from: peerId, role: peer.role, payload: parsed.payload });
        return;
      }

      // Realtime chat: broadcast to all other peers in the room
      if (parsed.type === "chat" && typeof parsed.text === "string" && parsed.text.length > 0 && parsed.text.length < 4000) {
        broadcast(ctx.roomId, peer, {
          type: "chat",
          from: peerId,
          role: peer.role,
          text: parsed.text,
          ts: Date.now(),
        });
        return;
      }

      // Call control: notify peers about state changes (mic/cam toggle, mode switch)
      if (parsed.type === "state" && parsed.payload && typeof parsed.payload === "object") {
        broadcast(ctx.roomId, peer, { type: "state", from: peerId, payload: parsed.payload });
        return;
      }
    });

    ws.on("close", () => {
      leaveRoom(ctx.roomId, peer);
    });

    ws.on("error", (err: Error) => {
      logger.warn({ err, roomId: ctx.roomId }, "tc-ws connection error");
    });
  });

  server.on("upgrade", (req: IncomingMessage, socket: Socket, head: Buffer) => {
    const url = req.url ?? "";
    const match = url.match(PATH_RE);
    if (!match) return; // Not our endpoint — let other handlers (or default 404) deal with it.

    const consultationId = Number(match[1]);
    if (!Number.isInteger(consultationId) || consultationId <= 0) {
      socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
      socket.destroy();
      return;
    }

    void (async () => {
      try {
        const auth = await authenticateUpgrade(req);
        if (!auth) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }
        const role = await authorizeConsultation(consultationId, auth.userId);
        if (!role) {
          socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
          socket.destroy();
          return;
        }
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit("connection", ws, req, { roomId: consultationId, userId: auth.userId, role });
        });
      } catch (err) {
        logger.warn({ err }, "tc-ws upgrade failed");
        try {
          socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
          socket.destroy();
        } catch {
          // ignore
        }
      }
    })();
  });

  logger.info("Tele-consult signaling attached at /api/tc/ws/session/:id");
}
