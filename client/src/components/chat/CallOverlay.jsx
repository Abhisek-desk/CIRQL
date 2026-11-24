import { useCallback, useEffect, useRef, useState } from "react";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import callService from "../../features/messages/callService";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export default function CallOverlay({
  socket,
  session,
  onSessionChange,
}) {
  const sessionRef = useRef(session);
  const localStreamRef = useRef(null);
  const peerRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const queuedCandidatesRef = useRef([]);
  const iceServersRef = useRef(ICE_SERVERS);

  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [mediaReady, setMediaReady] = useState(false);
  const [remoteReady, setRemoteReady] = useState(false);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    let active = true;
    callService.getIceServers()
      .then((result) => {
        if (active && Array.isArray(result.iceServers) && result.iceServers.length) {
          iceServersRef.current = result.iceServers;
        }
      })
      .catch(() => {
        // Keep the public STUN fallback if the ICE endpoint is unavailable.
      });
    return () => { active = false; };
  }, []);

  const stopMedia = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    remoteStreamRef.current = null;
    queuedCandidatesRef.current = [];

    setMediaReady(false);
    setRemoteReady(false);
    setMuted(false);
    setCameraOff(false);
  }, []);

  const closeCall = useCallback((notify = false) => {
    const current = sessionRef.current;

    if (notify && current && socket?.connected) {
      socket.emit(
        current.direction === "outgoing" && current.phase === "ringing"
          ? "call:cancel"
          : "call:end",
        {
          callId: current.callId,
          conversationId: current.conversationId,
        },
      );
    }

    stopMedia();
    onSessionChange(null);
  }, [socket, onSessionChange, stopMedia]);

  const createPeer = useCallback((current) => {
    if (peerRef.current) return peerRef.current;

    const peer = new RTCPeerConnection({
      iceServers: iceServersRef.current,
    });

    peerRef.current = peer;

    localStreamRef.current?.getTracks().forEach((track) => {
      peer.addTrack(track, localStreamRef.current);
    });

    peer.ontrack = (event) => {
      const stream = event.streams?.[0];

      if (stream) {
        remoteStreamRef.current = stream;

        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          remoteAudioRef.current.play().catch(() => {});
        }

        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
          remoteVideoRef.current.play().catch(() => {});
        }

        setRemoteReady(true);
      }
    };

    peer.onicecandidate = (event) => {
      if (event.candidate && socket?.connected) {
        socket.emit("call:ice", {
          callId: current.callId,
          conversationId: current.conversationId,
          candidate: event.candidate,
        });
      }
    };

    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "connected") {
        onSessionChange((previous) =>
          previous ? { ...previous, phase: "connected" } : null,
        );
      }

      if (
        peer.connectionState === "failed" ||
        peer.connectionState === "closed"
      ) {
        if (peer.connectionState === "failed") {
          toast.error("Call connection failed. Check your network.");
          closeCall(true);
        }
      }
    };

    return peer;
  }, [socket, onSessionChange, closeCall]);

  const acquireMedia = useCallback(async (mode) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: mode === "video",
      });

      localStreamRef.current = stream;
      setMediaReady(true);

      return stream;
    } catch (error) {
      console.error("Call media error:", error);
      toast.error(
        error.name === "NotAllowedError"
          ? "Please allow microphone/camera access."
          : "Unable to access your microphone or camera.",
      );

      return null;
    }
  }, []);

  // OUTGOING CALL
  useEffect(() => {
    if (
      !session ||
      session.direction !== "outgoing" ||
      session.phase !== "starting"
    ) return;

    let cancelled = false;

    const start = async () => {
      const stream = await acquireMedia(session.mode);

      if (cancelled) {
        stream?.getTracks().forEach((track) => track.stop());
        return;
      }

      if (!stream) {
        onSessionChange(null);
        return;
      }

      socket.emit("call:invite", {
        callId: session.callId,
        conversationId: session.conversationId,
        mode: session.mode,
      }, (result) => {
        if (!result?.success) {
          toast.error(result?.message || "Unable to start call.");
          closeCall(false);
          return;
        }

        onSessionChange((previous) =>
          previous ? { ...previous, phase: "ringing" } : null,
        );
      });
    };

    start();

    return () => {
      cancelled = true;
    };
  }, [
    session,
    socket,
    acquireMedia,
    onSessionChange,
    closeCall,
  ]);

  // SOCKET SIGNALING
  useEffect(() => {
    if (!socket) return;

    const handleIncoming = (payload) => {
      if (sessionRef.current) {
        socket.emit("call:reject", payload);
        return;
      }

      onSessionChange({
        ...payload,
        direction: "incoming",
        phase: "incoming",
        remoteName: payload.callerName,
      });
    };

    const handleAccepted = async (payload) => {
      const current = sessionRef.current;

      if (!current || current.callId !== payload.callId) return;

      try {
        const peer = createPeer(current);
        const offer = await peer.createOffer();

        await peer.setLocalDescription(offer);

        socket.emit("call:offer", {
          callId: current.callId,
          conversationId: current.conversationId,
          description: peer.localDescription,
        });

        onSessionChange((previous) =>
          previous ? { ...previous, phase: "connecting" } : null,
        );
      } catch (error) {
        console.error(error);
        toast.error("Could not establish the call.");
        closeCall(true);
      }
    };

    const handleOffer = async (payload) => {
      const current = sessionRef.current;

      if (!current || current.callId !== payload.callId) return;

      try {
        const peer = createPeer(current);

        await peer.setRemoteDescription(
          new RTCSessionDescription(payload.description),
        );

        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        socket.emit("call:answer", {
          callId: current.callId,
          conversationId: current.conversationId,
          description: peer.localDescription,
        });

        for (const candidate of queuedCandidatesRef.current) {
          await peer.addIceCandidate(candidate);
        }

        queuedCandidatesRef.current = [];
      } catch (error) {
        console.error(error);
        toast.error("Unable to receive call connection.");
        closeCall(true);
      }
    };

    const handleAnswer = async (payload) => {
      const current = sessionRef.current;

      if (!current || current.callId !== payload.callId) return;

      try {
        await peerRef.current?.setRemoteDescription(
          new RTCSessionDescription(payload.description),
        );

        for (const candidate of queuedCandidatesRef.current) {
          await peerRef.current?.addIceCandidate(candidate);
        }

        queuedCandidatesRef.current = [];
      } catch (error) {
        console.error("Call answer error:", error);
      }
    };

    const handleIce = async (payload) => {
      const current = sessionRef.current;

      if (!current || current.callId !== payload.callId || !payload.candidate) {
        return;
      }

      const candidate = new RTCIceCandidate(payload.candidate);

      if (!peerRef.current?.remoteDescription) {
        queuedCandidatesRef.current.push(candidate);
        return;
      }

      try {
        await peerRef.current.addIceCandidate(candidate);
      } catch (error) {
        console.error("ICE candidate error:", error);
      }
    };

    const handleRejected = (payload) => {
      const current = sessionRef.current;

      if (!current || current.callId !== payload.callId) return;

      toast("Call declined.");
      closeCall(false);
    };

    const handleMissed = (payload) => {
      const current = sessionRef.current;
      if (!current || current.callId !== payload.callId) return;
      toast("No answer. Call marked as missed.");
      closeCall(false);
    };

    const handleEnded = (payload) => {
      const current = sessionRef.current;

      if (!current || current.callId !== payload.callId) return;

      toast("Call ended.");
      closeCall(false);
    };

    socket.on("call:incoming", handleIncoming);
    socket.on("call:accepted", handleAccepted);
    socket.on("call:offer", handleOffer);
    socket.on("call:answer", handleAnswer);
    socket.on("call:ice", handleIce);
    socket.on("call:rejected", handleRejected);
    socket.on("call:ended", handleEnded);
    socket.on("call:missed", handleMissed);

    return () => {
      socket.off("call:incoming", handleIncoming);
      socket.off("call:accepted", handleAccepted);
      socket.off("call:offer", handleOffer);
      socket.off("call:answer", handleAnswer);
      socket.off("call:ice", handleIce);
      socket.off("call:rejected", handleRejected);
      socket.off("call:ended", handleEnded);
      socket.off("call:missed", handleMissed);
    };
  }, [socket, createPeer, onSessionChange, closeCall]);

  // ATTACH REMOTE MEDIA
  useEffect(() => {
    if (remoteAudioRef.current && remoteStreamRef.current) {
      remoteAudioRef.current.srcObject = remoteStreamRef.current;
      remoteAudioRef.current.play().catch(() => {});
    }

    if (remoteVideoRef.current && remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteReady, session?.mode]);

  // CALL DURATION
  useEffect(() => {
    if (session?.phase !== "connected") {
      setElapsed(0);
      return;
    }

    const timer = setInterval(() => {
      setElapsed((value) => value + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [session?.phase]);

  // RELEASE MEDIA WHEN COMPONENT UNMOUNTS
  useEffect(() => {
    return () => {
      peerRef.current?.close();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const acceptCall = async () => {
    if (!session || !socket?.connected) return;

    const stream = await acquireMedia(session.mode);
    if (!stream) return;

    socket.emit("call:accept", {
      callId: session.callId,
      conversationId: session.conversationId,
    });

    onSessionChange((previous) =>
      previous ? { ...previous, phase: "connecting" } : null,
    );
  };

  const rejectCall = () => {
    if (!session) return;

    socket?.emit("call:reject", {
      callId: session.callId,
      conversationId: session.conversationId,
    });

    closeCall(false);
  };

  const toggleMute = () => {
    const tracks = localStreamRef.current?.getAudioTracks() || [];
    const next = !muted;

    tracks.forEach((track) => {
      track.enabled = !next;
    });

    setMuted(next);
  };

  const toggleCamera = () => {
    const tracks = localStreamRef.current?.getVideoTracks() || [];
    const next = !cameraOff;

    tracks.forEach((track) => {
      track.enabled = !next;
    });

    setCameraOff(next);
  };

  if (!session) return null;

  const formatDuration = (seconds) =>
    `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#171923] text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p className="font-semibold">
              {session.mode === "video" ? "Video call" : "Voice call"}
            </p>
            <p className="text-xs text-zinc-400">
              {session.phase === "incoming"
                ? "Incoming call"
                : session.phase === "ringing"
                  ? "Calling..."
                  : session.phase === "connected"
                    ? formatDuration(elapsed)
                    : "Connecting..."}
            </p>
          </div>

          <button
            onClick={() => closeCall(true)}
            aria-label="Close call"
            className="rounded-full p-2 text-zinc-400 hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>

        <div className="relative flex min-h-[260px] flex-1 items-center justify-center bg-[#10121a] p-6">
          {session.mode === "video" ? (
            <>
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className={`h-full max-h-[55vh] w-full rounded-2xl object-cover ${
                  remoteReady ? "" : "hidden"
                }`}
              />

              {!remoteReady && (
                <div className="text-center">
                  <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-indigo-500/20 text-4xl">
                    {session.remoteName?.[0]?.toUpperCase() || "?"}
                  </div>
                  <p className="mt-4 font-semibold">
                    {session.remoteName || "CIRQL user"}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-indigo-500/20 text-4xl">
                {session.remoteName?.[0]?.toUpperCase() || "?"}
              </div>
              <p className="mt-4 font-semibold">
                {session.remoteName || "CIRQL user"}
              </p>
              <p className="mt-1 text-sm text-zinc-400">
                {session.phase === "connected" ? "Connected" : "Waiting..."}
              </p>
            </div>
          )}

          {session.mode === "video" && mediaReady && (
            <video
              autoPlay
              muted
              playsInline
              ref={(element) => {
                if (element && localStreamRef.current) {
                  element.srcObject = localStreamRef.current;
                }
              }}
              className="absolute bottom-4 right-4 h-28 w-40 rounded-xl border border-white/20 bg-black object-cover"
            />
          )}

          <audio ref={remoteAudioRef} autoPlay />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 border-t border-white/10 px-5 py-5">
          {session.phase === "incoming" ? (
            <>
              <button
                onClick={rejectCall}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 hover:bg-red-500"
                aria-label="Reject call"
              >
                <PhoneOff />
              </button>

              <button
                onClick={acceptCall}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 hover:bg-emerald-500"
                aria-label="Accept call"
              >
                <Phone />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={toggleMute}
                disabled={!mediaReady}
                aria-label={muted ? "Unmute microphone" : "Mute microphone"}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40"
              >
                {muted ? <MicOff /> : <Mic />}
              </button>

              {session.mode === "video" && (
                <button
                  onClick={toggleCamera}
                  disabled={!mediaReady}
                  aria-label={cameraOff ? "Turn camera on" : "Turn camera off"}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-40"
                >
                  {cameraOff ? <VideoOff /> : <Video />}
                </button>
              )}

              <button
                onClick={() => closeCall(true)}
                aria-label="End call"
                className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 hover:bg-red-500"
              >
                <PhoneOff />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


