import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { setFace, getFaceUrl, setVoiceGender } from "@/lib/call.functions";
import { FACE_BUCKET } from "@/lib/call.constants";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Hand, Loader2, Mic, MicOff, Phone, PhoneOff, Send, Upload, Video, VideoOff } from "lucide-react";

type Ancestor = {
  id: string;
  full_name: string;
  spoken_language: string | null;
  face_url: string | null;
  portrait_url: string | null;
  perceived_gender?: "female" | "male" | null;
};

type Turn = { role: "user" | "assistant"; content: string };

type Status = "idle" | "connecting" | "live" | "ended";

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session expired. Sign in again.");
  return { Authorization: `Bearer ${token}` };
}

/** Grabs a still frame from an uploaded video clip so D-ID has a face to rig. */
function frameFromVideo(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = URL.createObjectURL(file);
    video.onloadeddata = () => {
      video.currentTime = Math.min(0.6, (video.duration || 1) / 3);
    };
    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Could not read the clip."));
      ctx.drawImage(video, 0, 0);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(video.src);
          blob ? resolve(blob) : reject(new Error("Could not read the clip."));
        },
        "image/jpeg",
        0.92,
      );
    };
    video.onerror = () => reject(new Error("Could not read the clip."));
  });
}

export function VideoCallRoom({
  ancestor,
  sessionId,
  onFaceSaved,
  onVoiceSaved,
}: {
  ancestor: Ancestor;
  sessionId: string | null;
  onFaceSaved: (path: string) => void;
  onVoiceSaved: () => void;
}) {
  const saveFace = useServerFn(setFace);
  const signFace = useServerFn(getFaceUrl);
  const saveVoice = useServerFn(setVoiceGender);
  const [voice, setVoice] = useState<"female" | "male" | null>(ancestor.perceived_gender ?? null);

  useEffect(() => {
    setVoice(ancestor.perceived_gender ?? null);
  }, [ancestor.perceived_gender]);

  const chooseVoice = useCallback(
    async (next: "female" | "male" | null) => {
      setVoice(next);
      try {
        await saveVoice({ data: { ancestor_id: ancestor.id, gender: next } });
        onVoiceSaved();
        toast.success(
          next === "female"
            ? "Voice set to a woman's voice."
            : next === "male"
              ? "Voice set to a man's voice."
              : "Voice will be matched from the photo.",
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not save the voice choice.");
      }
    },
    [ancestor.id, onVoiceSaved, saveVoice],
  );

  const [facePreview, setFacePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [caption, setCaption] = useState<string>("");
  const [youSaid, setYouSaid] = useState<string>("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [typed, setTyped] = useState("");
  const speechTokenRef = useRef(0);
  const selfVideoRef = useRef<HTMLVideoElement | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);


  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamIdRef = useRef<string | null>(null);
  const didSessionRef = useRef<string | null>(null);
  const callLogRef = useRef<string | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const historyRef = useRef<Turn[]>([]);
  const busyRef = useRef(false);
  const micOnRef = useRef(true);
  const statusRef = useRef<Status>("idle");

  useEffect(() => {
    micOnRef.current = micOn;
  }, [micOn]);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  useEffect(() => {
    camStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = camOn));
  }, [camOn]);
  useEffect(() => {
    micStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = micOn));
  }, [micOn]);


  /* ------------------------------------------------------------------ */
  /* Face preview                                                        */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (ancestor.face_url) {
        try {
          const { url } = await signFace({ data: { path: ancestor.face_url } });
          if (!cancelled) setFacePreview(url);
          return;
        } catch {
          /* fall through to portrait */
        }
      }
      if (!cancelled) setFacePreview(ancestor.portrait_url);
    })();
    return () => {
      cancelled = true;
    };
  }, [ancestor.face_url, ancestor.portrait_url, signFace]);

  const handleFaceUpload = async (file: File) => {
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Sign in again to upload.");

      let blob: Blob = file;
      let ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      if (file.type.startsWith("video/")) {
        blob = await frameFromVideo(file);
        ext = "jpg";
      }
      if (blob.size > 10_000_000) throw new Error("That image is too large — keep it under 10 MB.");

      const path = `${uid}/${ancestor.id}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(FACE_BUCKET).upload(path, blob, {
        contentType: blob.type || "image/jpeg",
        upsert: true,
      });
      if (error) throw new Error(error.message);

      await saveFace({ data: { ancestor_id: ancestor.id, path } });
      const { url } = await signFace({ data: { path } });
      setFacePreview(url);
      onFaceSaved(path);
      toast.success("Face saved. They are ready to be called.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /* Signalling helper                                                   */
  /* ------------------------------------------------------------------ */
  const callApi = useCallback(async (payload: Record<string, unknown>) => {
    const headers = await authHeaders();
    const res = await fetch("/api/call", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      /* non-JSON error body */
    }
    if (!res.ok) throw new Error((json.error as string) || text || "Call service failed");
    return json;
  }, []);

  /* ------------------------------------------------------------------ */
  /* Teardown                                                            */
  /* ------------------------------------------------------------------ */
  const teardown = useCallback(
    async (markEnded = true) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      try {
        recorderRef.current?.state !== "inactive" && recorderRef.current?.stop();
      } catch {
        /* noop */
      }
      recorderRef.current = null;
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
      camStreamRef.current?.getTracks().forEach((t) => t.stop());
      camStreamRef.current = null;
      if (selfVideoRef.current) selfVideoRef.current.srcObject = null;

      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
      pcRef.current?.close();
      pcRef.current = null;
      setListening(false);
      setSpeaking(false);
      setThinking(false);

      const streamId = streamIdRef.current;
      const didSessionId = didSessionRef.current;
      streamIdRef.current = null;
      didSessionRef.current = null;
      if (streamId && didSessionId) {
        await callApi({
          action: "end",
          streamId,
          didSessionId,
          callLogId: callLogRef.current,
        }).catch(() => {});
      }
      callLogRef.current = null;
      if (markEnded) setStatus("ended");
    },
    [callApi],
  );

  useEffect(() => () => void teardown(false), [teardown]);

  /* ------------------------------------------------------------------ */
  /* One conversational turn                                             */
  /* ------------------------------------------------------------------ */
  const sendText = useCallback(
    async (question: string) => {
      if (!streamIdRef.current || !didSessionRef.current) return;
      busyRef.current = true;
      setThinking(true);
      try {
        setYouSaid(question);
        historyRef.current = [...historyRef.current, { role: "user" as const, content: question }].slice(-10);

        const result = await callApi({
          action: "say",
          ancestorId: ancestor.id,
          sessionId,
          streamId: streamIdRef.current,
          didSessionId: didSessionRef.current,
          text: question,
          history: historyRef.current.slice(0, -1),
        });
        const reply = (result.text as string) ?? "";
        setCaption(reply);
        historyRef.current = [...historyRef.current, { role: "assistant" as const, content: reply }].slice(-10);
        setSpeaking(true);
        // Fallback in case the stream never reports completion.
        const estimate = Math.min(30000, 1800 + reply.length * 70);
        const token = ++speechTokenRef.current;
        window.setTimeout(() => {
          if (speechTokenRef.current !== token) return;
          setSpeaking(false);
          busyRef.current = false;
        }, estimate);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something broke mid-call");
        busyRef.current = false;
        setSpeaking(false);
      } finally {
        setThinking(false);
      }
    },
    [ancestor.id, callApi, sessionId],
  );

  const sendUtterance = useCallback(
    async (audio: Blob) => {
      if (!streamIdRef.current || !didSessionRef.current) return;
      busyRef.current = true;
      setThinking(true);
      try {
        const headers = await authHeaders();
        const form = new FormData();
        form.append("file", audio, "speech.webm");
        if (ancestor.spoken_language) form.append("language", ancestor.spoken_language);
        const sttRes = await fetch("/api/stt", { method: "POST", headers, body: form });
        if (!sttRes.ok) throw new Error(await sttRes.text());
        const { text } = (await sttRes.json()) as { text: string };
        const question = (text || "").trim();
        if (question.length < 2) {
          busyRef.current = false;
          setThinking(false);
          return;
        }
        await sendText(question);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something broke mid-call");
        busyRef.current = false;
        setSpeaking(false);
        setThinking(false);
      }
    },
    [ancestor.spoken_language, sendText],
  );

  /** Cut the ancestor off mid-sentence and hand the floor back to the caller. */
  const bargeIn = useCallback(() => {
    speechTokenRef.current += 1;
    busyRef.current = false;
    setSpeaking(false);
    setThinking(false);
    if (streamIdRef.current && didSessionRef.current) {
      void callApi({
        action: "interrupt",
        streamId: streamIdRef.current,
        didSessionId: didSessionRef.current,
      }).catch(() => {});
    }
  }, [callApi]);


  /* ------------------------------------------------------------------ */
  /* Voice activity detection loop                                       */
  /* ------------------------------------------------------------------ */
  const startListening = useCallback(
    async (stream: MediaStream) => {
      const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      const buffer = new Float32Array(analyser.fftSize);

      let recording = false;
      let chunks: Blob[] = [];
      let silenceSince = 0;
      let speechStart = 0;

      const SPEECH_THRESHOLD = 0.018;
      const SILENCE_MS = 1100;
      const MIN_UTTERANCE_MS = 350;

      const tick = () => {
        rafRef.current = requestAnimationFrame(tick);
        if (statusRef.current !== "live") return;

        analyser.getFloatTimeDomainData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
        const rms = Math.sqrt(sum / buffer.length);
        const now = performance.now();

        const blocked = busyRef.current || !micOnRef.current;
        if (blocked) {
          if (recording) {
            recording = false;
            chunks = [];
            try {
              recorderRef.current?.stop();
            } catch {
              /* noop */
            }
            setListening(false);
          }
          return;
        }

        if (!recording && rms > SPEECH_THRESHOLD) {
          recording = true;
          chunks = [];
          speechStart = now;
          silenceSince = 0;
          setListening(true);
          const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
            ? "audio/webm;codecs=opus"
            : "audio/webm";
          const rec = new MediaRecorder(stream, { mimeType: mime });
          recorderRef.current = rec;
          rec.ondataavailable = (e) => {
            if (e.data.size) chunks.push(e.data);
          };
          rec.onstop = () => {
            setListening(false);
            const duration = performance.now() - speechStart;
            const blob = new Blob(chunks, { type: mime });
            chunks = [];
            if (duration >= MIN_UTTERANCE_MS && blob.size > 2000 && !busyRef.current) {
              void sendUtterance(blob);
            }
          };
          rec.start();
          return;
        }

        if (recording) {
          if (rms > SPEECH_THRESHOLD) {
            silenceSince = 0;
          } else if (!silenceSince) {
            silenceSince = now;
          } else if (now - silenceSince > SILENCE_MS) {
            recording = false;
            silenceSince = 0;
            try {
              recorderRef.current?.stop();
            } catch {
              /* noop */
            }
          }
          // Hard cap so one long monologue still gets sent.
          if (now - speechStart > 25000) {
            recording = false;
            try {
              recorderRef.current?.stop();
            } catch {
              /* noop */
            }
          }
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [sendUtterance],
  );

  /* ------------------------------------------------------------------ */
  /* Start the call                                                      */
  /* ------------------------------------------------------------------ */
  const startCall = async () => {
    if (status === "connecting" || status === "live") return;
    setStatus("connecting");
    setCaption("");
    setYouSaid("");
    historyRef.current = [];
    busyRef.current = false;

    try {
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      micStreamRef.current = mic;

      // Caller's own camera — the second leg of the two-way call.
      try {
        const cam = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 } },
        });
        camStreamRef.current = cam;
        if (selfVideoRef.current) {
          selfVideoRef.current.srcObject = cam;
          void selfVideoRef.current.play().catch(() => {});
        }
        setCamOn(true);
      } catch {
        setCamOn(false);
      }


      const created = await callApi({
        action: "create",
        ancestorId: ancestor.id,
        sessionId,
      });
      const streamId = created.streamId as string;
      const didSessionId = created.didSessionId as string;
      streamIdRef.current = streamId;
      didSessionRef.current = didSessionId;
      callLogRef.current = (created.callLogId as string) ?? null;

      const pc = new RTCPeerConnection({ iceServers: created.iceServers as RTCIceServer[] });
      pcRef.current = pc;

      pc.ontrack = (event) => {
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          void videoRef.current.play().catch(() => {});
        }
      };
      pc.onicecandidate = (event) => {
        void callApi({
          action: "ice",
          streamId,
          didSessionId,
          candidate: event.candidate
            ? {
                candidate: event.candidate.candidate,
                sdpMid: event.candidate.sdpMid,
                sdpMLineIndex: event.candidate.sdpMLineIndex,
              }
            : {},
        }).catch(() => {});
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") setStatus("live");
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          void teardown();
        }
      };
      pc.ondatachannel = (event) => {
        event.channel.onmessage = (msg) => {
          const data = String(msg.data ?? "");
          if (data.includes("stream/started")) setSpeaking(true);
          if (data.includes("stream/done") || data.includes("stream/ready")) {
            setSpeaking(false);
            busyRef.current = false;
          }
        };
      };

      await pc.setRemoteDescription(created.offer as RTCSessionDescriptionInit);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await callApi({
        action: "sdp",
        streamId,
        didSessionId,
        answer: { type: answer.type, sdp: answer.sdp },
      });

      setStatus("live");
      statusRef.current = "live";
      await startListening(mic);
      toast.success("You are connected. Just speak — they are listening.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not place the call");
      await teardown();
      setStatus("idle");
    }
  };

  const hasFace = Boolean(ancestor.face_url || facePreview);

  /* ------------------------------------------------------------------ */
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-lg border border-border bg-secondary/40 shadow-inner">
        <div className="aspect-[4/5] w-full sm:aspect-video">
          {status === "live" || status === "connecting" ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="h-full w-full bg-black object-cover"
            />
          ) : facePreview ? (
            <img
              src={facePreview}
              alt={`Portrait of ${ancestor.full_name}`}
              className="h-full w-full object-cover opacity-90 sepia-[0.35]"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
              <Video className="h-8 w-8 opacity-50" />
              <p className="font-serif text-lg">No face has been given to {ancestor.full_name} yet.</p>
              <p className="max-w-sm text-sm">
                Upload a clear, front-facing photograph — or a short clip — and their likeness will
                speak to you.
              </p>
            </div>
          )}
        </div>

        {status === "connecting" && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="font-serif italic">Reaching across the years…</p>
            </div>
          </div>
        )}

        {status === "live" && (
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-background/80 px-3 py-1 text-xs backdrop-blur">
            <span
              className={`h-2 w-2 rounded-full ${
                thinking
                  ? "animate-pulse bg-amber-500"
                  : speaking
                    ? "bg-primary"
                    : listening
                      ? "animate-pulse bg-emerald-500"
                      : "bg-muted-foreground"
              }`}
            />
            {thinking ? "Remembering…" : speaking ? "Speaking" : listening ? "Listening" : "Your turn"}
          </div>
        )}

        {(status === "live" || status === "connecting") && (
          <div className="absolute right-3 top-3 h-24 w-20 overflow-hidden rounded-md border border-border bg-black/70 shadow-lg sm:h-32 sm:w-24">
            <video
              ref={selfVideoRef}
              autoPlay
              playsInline
              muted
              className={`h-full w-full scale-x-[-1] object-cover ${camOn ? "" : "hidden"}`}
            />
            {!camOn && (
              <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                Camera off
              </div>
            )}
          </div>
        )}

        {(caption || youSaid) && status === "live" && (
          <div className="absolute inset-x-0 bottom-0 space-y-1 bg-gradient-to-t from-background/95 to-transparent p-4">
            {youSaid && <p className="text-xs text-muted-foreground">You: {youSaid}</p>}
            {caption && <p className="font-serif text-base leading-snug">{caption}</p>}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {status === "live" || status === "connecting" ? (
          <>
            <Button variant="destructive" onClick={() => void teardown()}>
              <PhoneOff className="mr-2 h-4 w-4" /> End call
            </Button>
            <Button variant="outline" onClick={() => setMicOn((v) => !v)}>
              {micOn ? <Mic className="mr-2 h-4 w-4" /> : <MicOff className="mr-2 h-4 w-4" />}
              {micOn ? "Mute" : "Unmute"}
            </Button>
            <Button variant="outline" onClick={() => setCamOn((v) => !v)}>
              {camOn ? <Video className="mr-2 h-4 w-4" /> : <VideoOff className="mr-2 h-4 w-4" />}
              {camOn ? "Stop camera" : "Start camera"}
            </Button>
            <Button variant="outline" onClick={bargeIn} disabled={!speaking && !thinking}>
              <Hand className="mr-2 h-4 w-4" /> Interrupt
            </Button>
          </>
        ) : (
          <Button onClick={() => void startCall()} disabled={!hasFace}>
            <Phone className="mr-2 h-4 w-4" /> Call {ancestor.full_name.split(" ")[0]}
          </Button>
        )}

        <label className="inline-flex">
          <input
            type="file"
            accept="image/*,video/*"
            className="hidden"
            disabled={uploading || status === "live"}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void handleFaceUpload(file);
            }}
          />
          <Button asChild variant="outline" disabled={uploading}>
            <span>
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {hasFace ? "Replace photo or clip" : "Upload photo or clip"}
            </span>
          </Button>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Speaking voice:</span>
        {([
          { value: null, label: "Match the photo" },
          { value: "female" as const, label: "Woman" },
          { value: "male" as const, label: "Man" },
        ]).map((opt) => (
          <Button
            key={opt.label}
            type="button"
            size="sm"
            variant={voice === opt.value ? "default" : "outline"}
            disabled={status === "live"}
            onClick={() => void chooseVoice(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {status === "live" && (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const question = typed.trim();
            if (!question) return;
            setTyped("");
            if (speaking || thinking) bargeIn();
            void sendText(question);
          }}
        >
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="…or type what you want to ask"
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          <Button type="submit" variant="secondary" disabled={!typed.trim()} aria-label="Send message">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      )}


      <p className="text-sm leading-relaxed text-muted-foreground">
        Speak naturally — the call listens for you to finish, then {ancestor.full_name} answers aloud
        in{" "}
        <span className="text-foreground">{ancestor.spoken_language || "their own tongue"}</span>,
        grounded in the memories you have entrusted to the archive. Everything said is written into
        the transcript in the Vault.
      </p>
    </div>
  );
}
