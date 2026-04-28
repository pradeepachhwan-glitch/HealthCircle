import { useEffect, useRef, useState, useCallback } from "react";

export type CallMode = "video" | "audio" | "chat";
export type CallStatus =
  | "idle"
  | "requesting-media"
  | "media-error"
  | "connecting"
  | "waiting-peer"
  | "in-call"
  | "ended"
  | "error";

interface RemotePeerState {
  peerId: string;
  stream: MediaStream | null;
}

interface ChatLine {
  from: "self" | "remote";
  text: string;
  ts: number;
}

interface UseCallResult {
  status: CallStatus;
  errorMessage: string | null;
  localStream: MediaStream | null;
  remotePeers: RemotePeerState[];
  micEnabled: boolean;
  camEnabled: boolean;
  myPeerId: string | null;
  chatLines: ChatLine[];
  toggleMic: () => void;
  toggleCam: () => void;
  sendChat: (text: string) => void;
  endCall: () => void;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

function buildWsUrl(consultationId: number): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/api/tc/ws/session/${consultationId}`;
}

/**
 * useTeleconsultCall
 *
 * Establishes a WebRTC peer connection through the api-server's WebSocket
 * signaling endpoint. Supports up to N remote peers per call (one
 * RTCPeerConnection per remote peer). When `mode === "chat"` no media is
 * requested but the WebSocket is still used for realtime chat broadcast.
 */
export function useTeleconsultCall(
  consultationId: number | null,
  mode: CallMode,
  enabled: boolean,
): UseCallResult {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remotePeers, setRemotePeers] = useState<RemotePeerState[]>([]);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  const [chatLines, setChatLines] = useState<ChatLine[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const myPeerIdRef = useRef<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Send signal to a specific remote peer through the WS.
  const sendSignal = useCallback((to: string, payload: unknown) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "signal", to, payload }));
  }, []);

  const createPeerConnection = useCallback((remotePeerId: string): RTCPeerConnection => {
    const existing = peerConnectionsRef.current.get(remotePeerId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add local tracks before any negotiation.
    const stream = localStreamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) {
        pc.addTrack(track, stream);
      }
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignal(remotePeerId, { kind: "ice", candidate: e.candidate.toJSON() });
      }
    };

    pc.ontrack = (e) => {
      const [remoteStream] = e.streams;
      if (!remoteStream) return;
      setRemotePeers((prev) => {
        const idx = prev.findIndex((p) => p.peerId === remotePeerId);
        if (idx === -1) {
          return [...prev, { peerId: remotePeerId, stream: remoteStream }];
        }
        const next = prev.slice();
        next[idx] = { peerId: remotePeerId, stream: remoteStream };
        return next;
      });
      setStatus("in-call");
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "failed" || s === "disconnected" || s === "closed") {
        peerConnectionsRef.current.delete(remotePeerId);
        setRemotePeers((prev) => prev.filter((p) => p.peerId !== remotePeerId));
      }
    };

    peerConnectionsRef.current.set(remotePeerId, pc);
    return pc;
  }, [sendSignal]);

  const handleSignal = useCallback(async (fromPeerId: string, payload: { kind: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }) => {
    const pc = createPeerConnection(fromPeerId);

    if (payload.kind === "offer" && payload.sdp) {
      try {
        await pc.setRemoteDescription(payload.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal(fromPeerId, { kind: "answer", sdp: pc.localDescription?.toJSON() });
      } catch (err) {
        console.warn("[tc-call] failed to handle offer", err);
      }
    } else if (payload.kind === "answer" && payload.sdp) {
      try {
        await pc.setRemoteDescription(payload.sdp);
      } catch (err) {
        console.warn("[tc-call] failed to handle answer", err);
      }
    } else if (payload.kind === "ice" && payload.candidate) {
      try {
        await pc.addIceCandidate(payload.candidate);
      } catch (err) {
        // Benign — candidate may arrive before remote description is set.
        console.debug("[tc-call] ice add failed (often benign)", err);
      }
    }
  }, [createPeerConnection, sendSignal]);

  const offerToPeer = useCallback(async (remotePeerId: string) => {
    const pc = createPeerConnection(remotePeerId);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal(remotePeerId, { kind: "offer", sdp: pc.localDescription?.toJSON() });
    } catch (err) {
      console.warn("[tc-call] failed to create offer", err);
    }
  }, [createPeerConnection, sendSignal]);

  const teardown = useCallback(() => {
    for (const pc of peerConnectionsRef.current.values()) {
      try { pc.close(); } catch { /* noop */ }
    }
    peerConnectionsRef.current.clear();

    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) {
        try { track.stop(); } catch { /* noop */ }
      }
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemotePeers([]);

    if (wsRef.current) {
      try { wsRef.current.close(); } catch { /* noop */ }
      wsRef.current = null;
    }
    myPeerIdRef.current = null;
    setMyPeerId(null);
  }, []);

  const endCall = useCallback(() => {
    teardown();
    setStatus("ended");
  }, [teardown]);

  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !micEnabled;
    for (const track of stream.getAudioTracks()) {
      track.enabled = next;
    }
    setMicEnabled(next);
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "state", payload: { micEnabled: next } }));
    }
  }, [micEnabled]);

  const toggleCam = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !camEnabled;
    for (const track of stream.getVideoTracks()) {
      track.enabled = next;
    }
    setCamEnabled(next);
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "state", payload: { camEnabled: next } }));
    }
  }, [camEnabled]);

  const sendChat = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "chat", text: trimmed }));
    setChatLines((prev) => [...prev, { from: "self", text: trimmed, ts: Date.now() }]);
  }, []);

  // Main effect: connect / disconnect based on inputs.
  useEffect(() => {
    if (!enabled || consultationId == null) {
      teardown();
      setStatus("idle");
      return;
    }

    let cancelled = false;
    setErrorMessage(null);

    (async () => {
      try {
        // 1) Acquire media (skip for chat-only).
        if (mode === "video" || mode === "audio") {
          setStatus("requesting-media");
          const constraints: MediaStreamConstraints = {
            audio: true,
            video: mode === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
          };
          let stream: MediaStream;
          try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
          } catch (err) {
            console.warn("[tc-call] getUserMedia failed", err);
            if (cancelled) return;
            setStatus("media-error");
            setErrorMessage(
              err instanceof Error
                ? `${err.name}: ${err.message}`
                : "Could not access camera or microphone.",
            );
            return;
          }
          if (cancelled) {
            for (const t of stream.getTracks()) t.stop();
            return;
          }
          localStreamRef.current = stream;
          setLocalStream(stream);
          setMicEnabled(true);
          setCamEnabled(mode === "video");
        }

        // 2) Open the signaling WebSocket.
        setStatus("connecting");
        const ws = new WebSocket(buildWsUrl(consultationId));
        wsRef.current = ws;

        ws.addEventListener("open", () => {
          if (cancelled) return;
          setStatus("waiting-peer");
        });

        ws.addEventListener("message", async (ev) => {
          if (cancelled) return;
          let msg: { type: string; peerId?: string; peers?: { peerId: string }[]; from?: string; payload?: { kind: string; sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }; text?: string };
          try {
            msg = JSON.parse(typeof ev.data === "string" ? ev.data : "");
          } catch {
            return;
          }

          if (msg.type === "welcome" && typeof msg.peerId === "string") {
            myPeerIdRef.current = msg.peerId;
            setMyPeerId(msg.peerId);
            // Become offerer to all existing peers.
            for (const other of msg.peers ?? []) {
              await offerToPeer(other.peerId);
            }
          } else if (msg.type === "peer-joined" && typeof msg.peerId === "string") {
            // Other side will offer; we just await.
          } else if (msg.type === "peer-left" && typeof msg.peerId === "string") {
            const pc = peerConnectionsRef.current.get(msg.peerId);
            if (pc) { try { pc.close(); } catch { /* noop */ } }
            peerConnectionsRef.current.delete(msg.peerId);
            setRemotePeers((prev) => prev.filter((p) => p.peerId !== msg.peerId));
            if (peerConnectionsRef.current.size === 0) {
              setStatus("waiting-peer");
            }
          } else if (msg.type === "signal" && typeof msg.from === "string" && msg.payload) {
            await handleSignal(msg.from, msg.payload);
          } else if (msg.type === "chat" && typeof msg.text === "string") {
            setChatLines((prev) => [...prev, { from: "remote", text: msg.text!, ts: Date.now() }]);
          } else if (msg.type === "error") {
            setStatus("error");
            setErrorMessage(`Signaling error: ${(msg as { reason?: string }).reason ?? "unknown"}`);
          }
        });

        ws.addEventListener("error", () => {
          if (cancelled) return;
          setStatus("error");
          setErrorMessage("Could not reach the call signaling server.");
        });

        ws.addEventListener("close", () => {
          if (cancelled) return;
          // Only switch to ended if it wasn't already torn down.
          setStatus((s) => (s === "ended" ? s : "ended"));
        });
      } catch (err) {
        console.warn("[tc-call] setup failed", err);
        if (!cancelled) {
          setStatus("error");
          setErrorMessage(err instanceof Error ? err.message : "Call setup failed.");
        }
      }
    })();

    cleanupRef.current = teardown;
    return () => {
      cancelled = true;
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultationId, mode, enabled]);

  // Final unmount safety net.
  useEffect(() => {
    return () => {
      if (cleanupRef.current) cleanupRef.current();
    };
  }, []);

  return {
    status,
    errorMessage,
    localStream,
    remotePeers,
    micEnabled,
    camEnabled,
    myPeerId,
    chatLines,
    toggleMic,
    toggleCam,
    sendChat,
    endCall,
  };
}
