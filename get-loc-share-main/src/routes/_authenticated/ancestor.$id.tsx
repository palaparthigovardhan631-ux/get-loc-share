import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAncestor, listDocuments, ingestDocument, listSessions, createSession, listMessages, listEchoes, writeEcho } from "@/lib/ancestors.functions";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import ReactMarkdown from "react-markdown";
import { VideoCallRoom } from "@/components/VideoCallRoom";

export const Route = createFileRoute("/_authenticated/ancestor/$id")({
  head: ({ params }) => ({
    meta: [
      { title: "In conversation — Kinvoke" },
      {
        name: "description",
        content:
          "Speak with your reconstructed ancestor: a grounded chat vault, a memory timeline of uploaded documents, live video calls and private Echoes.",
      },
      { property: "og:title", content: "In conversation — Kinvoke" },
      {
        property: "og:description",
        content:
          "Speak with your reconstructed ancestor: a grounded chat vault, a memory timeline of uploaded documents, live video calls and private Echoes.",
      },
      { property: "og:type", content: "profile" },
      { property: "og:url", content: `https://get-loc-share.lovable.app/ancestor/${params.id}` },
      { name: "robots", content: "noindex" },
    ],
    links: [
      { rel: "canonical", href: `https://get-loc-share.lovable.app/ancestor/${params.id}` },
    ],
  }),
  component: AncestorPage,
});

function AncestorPage() {
  const { id } = Route.useParams();
  const getA = useServerFn(getAncestor);
  const { data: ancestor, isLoading } = useQuery({
    queryKey: ["ancestor", id],
    queryFn: () => getA({ data: { id } }),
  });

  if (isLoading) return <main className="mx-auto max-w-6xl px-6 py-10 text-muted-foreground">Opening…</main>;
  if (!ancestor) return <main className="mx-auto max-w-6xl px-6 py-10">Not found. <Link to="/dashboard" className="underline">Back</Link></main>;

  const lifespan = [ancestor.birth_year, ancestor.passing_year].filter(Boolean).join(" – ");

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6">
        <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">← Archive</Link>
        <div className="mt-3 flex items-start gap-5">
          {ancestor.portrait_url ? (
            <img
              src={ancestor.portrait_url}
              alt={`Portrait of ${ancestor.full_name}`}
              className="h-24 w-24 shrink-0 rounded-full border border-border object-cover shadow-md sm:h-28 sm:w-28"
            />
          ) : (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-border bg-muted/40 font-serif text-3xl text-muted-foreground sm:h-28 sm:w-28">
              {ancestor.full_name.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="font-serif text-4xl text-foreground">{ancestor.full_name}</h1>
            {(lifespan || ancestor.relation) && (
              <p className="mt-1 italic text-muted-foreground">
                {[ancestor.relation, lifespan].filter(Boolean).join(" · ")}
              </p>
            )}
            {(ancestor.spoken_language || ancestor.accent_note) && (
              <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                Speaks: {[ancestor.spoken_language, ancestor.accent_note].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="vault">
        <TabsList>
          <TabsTrigger value="vault">The Vault</TabsTrigger>
          <TabsTrigger value="call">Live Call</TabsTrigger>
          <TabsTrigger value="timeline">Memory Timeline</TabsTrigger>
          <TabsTrigger value="echoes">Echoes</TabsTrigger>
          <TabsTrigger value="upload">Upload</TabsTrigger>
        </TabsList>
        <TabsContent value="vault" className="mt-4">
          <ChatPanel
            ancestorId={id}
            ancestorName={ancestor.full_name}
            language={ancestor.spoken_language}
            accent={ancestor.accent_note}
            gender={ancestor.perceived_gender as "female" | "male" | null}
          />
        </TabsContent>
        <TabsContent value="call" className="mt-4">
          <CallPanel
            ancestor={{
              id,
              full_name: ancestor.full_name,
              spoken_language: ancestor.spoken_language,
              face_url: ancestor.face_url,
              portrait_url: ancestor.portrait_url,
              perceived_gender: ancestor.perceived_gender as "female" | "male" | null,
            }}
          />
        </TabsContent>
        <TabsContent value="timeline" className="mt-4">
          <TimelinePanel ancestorId={id} />
        </TabsContent>
        <TabsContent value="echoes" className="mt-4">
          <EchoesPanel ancestorId={id} ancestorName={ancestor.full_name} />
        </TabsContent>
        <TabsContent value="upload" className="mt-4">
          <UploadPanel ancestorId={id} />
        </TabsContent>
      </Tabs>

    </main>
  );
}

function ChatPanel({ ancestorId, ancestorName, language, accent, gender }: { ancestorId: string; ancestorName: string; language: string | null; accent: string | null; gender: "female" | "male" | null }) {
  const listS = useServerFn(listSessions);
  const createS = useServerFn(createSession);
  const listM = useServerFn(listMessages);

  const { data: sessions } = useQuery({
    queryKey: ["sessions", ancestorId],
    queryFn: () => listS({ data: { ancestor_id: ancestorId } }),
  });

  const [sessionId, setSessionId] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      if (sessions === undefined) return;
      if (sessions.length > 0) {
        setSessionId(sessions[0].id);
      } else {
        const { id } = await createS({ data: { ancestor_id: ancestorId } });
        setSessionId(id);
      }
    })();
  }, [sessions, ancestorId, createS]);

  const { data: prior } = useQuery({
    queryKey: ["messages", sessionId],
    queryFn: () => sessionId ? listM({ data: { session_id: sessionId } }) : Promise.resolve([]),
    enabled: !!sessionId,
  });

  const initialMessages = useMemo(
    () =>
      (prior ?? []).map((m) => ({
        id: m.id,
        role: (m.role === "ancestor" ? "assistant" : "user") as "assistant" | "user",
        parts: [{ type: "text" as const, text: m.content }],
      })),
    [prior],
  );

  if (!sessionId) {
    return <div className="parchment-panel rounded-xl p-8 text-muted-foreground">Preparing the room…</div>;
  }

  return (
    <ChatWindow
      key={sessionId}
      ancestorId={ancestorId}
      sessionId={sessionId}
      ancestorName={ancestorName}
      language={language}
      accent={accent}
      gender={gender}
      initial={initialMessages}
    />
  );
}

function ChatWindow({
  ancestorId,
  sessionId,
  ancestorName,
  language,
  accent,
  gender,
  initial,
}: {
  ancestorId: string;
  sessionId: string;
  ancestorName: string;
  language: string | null;
  accent: string | null;
  gender: "female" | "male" | null;
  initial: { id: string; role: "user" | "assistant"; parts: { type: "text"; text: string }[] }[];
}) {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: () => (token ? { Authorization: `Bearer ${token}` } : ({} as Record<string, string>)),
        body: { ancestorId, sessionId },
      }),
    [token, ancestorId, sessionId],
  );

  const { messages, sendMessage, status } = useChat({
    id: sessionId,
    messages: initial,
    transport,
    onError: (e) => toast.error(e.message),
  });

  // Auto-play the newest assistant reply as TTS once streaming completes.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const spokenIdsRef = useRef<Set<string>>(new Set());
  // Skip messages that were already present on mount (restored history).
  useEffect(() => {
    for (const m of initial) spokenIdsRef.current.add(m.id);
  }, [initial]);

  useEffect(() => {
    if (status !== "ready") return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    if (spokenIdsRef.current.has(last.id)) return;
    const text = last.parts
      .map((p) => (p.type === "text" ? (p as { text: string }).text : ""))
      .join("")
      .trim();
    if (!text) return;
    spokenIdsRef.current.add(last.id);
    (async () => {
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.slice(0, 3800), language, accent, gender }),
        });
        if (!res.ok) return;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        audioRef.current?.pause();
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => URL.revokeObjectURL(url);
        await audio.play().catch(() => {
          /* autoplay may be blocked until the user interacts again */
        });
      } catch {
        /* swallow — playback is best-effort */
      }
    })();
  }, [messages, status, language, accent, gender]);

  useEffect(() => () => audioRef.current?.pause(), []);

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const busy = status === "submitted" || status === "streaming";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || busy || !token) return;
    sendMessage({ text: input.trim() });
    setInput("");
  };

  return (
    <div className="parchment-panel flex h-[70vh] flex-col overflow-hidden rounded-xl">
      <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
        {messages.length === 0 && (
          <div className="mx-auto max-w-lg py-16 text-center">
            <p className="font-serif text-2xl italic text-muted-foreground">
              A hush falls over the room.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Ask {ancestorName} anything — a memory, an opinion, a story from their era.
            </p>
          </div>
        )}
        {messages.map((m) => {
          const text = m.parts
            .map((p) => (p.type === "text" ? (p as { text: string }).text : ""))
            .join("");
          if (m.role === "user") {
            return (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl bg-primary px-5 py-3 text-primary-foreground">
                  {text}
                </div>
              </div>
            );
          }
          return (
            <div key={m.id} className="max-w-[85%]">
              <p className="mb-1 font-serif text-sm italic text-accent">{ancestorName}</p>
              <div className="prose prose-sm max-w-none font-serif text-lg leading-relaxed text-foreground">
                <ReactMarkdown>{text || "…"}</ReactMarkdown>
              </div>
            </div>
          );
        })}
        {busy && (
          <p className="animate-pulse font-serif italic text-muted-foreground">
            {ancestorName} is gathering their thoughts…
          </p>
        )}
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-border/60 bg-background/40 p-4">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask ${ancestorName}…`}
          disabled={busy || !token}
          className="font-serif text-base"
        />
        <Button type="submit" disabled={busy || !input.trim() || !token}>
          Send
        </Button>
      </form>
    </div>
  );
}

function UploadPanel({ ancestorId }: { ancestorId: string }) {
  const ingest = useServerFn(ingestDocument);
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [era, setEra] = useState("");
  const [docDate, setDocDate] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (f: File) => {
    if (f.size > 5_000_000) {
      toast.error("File too large (max 5 MB of text).");
      return;
    }
    const text = await f.text();
    setContent(text);
    if (!title) setTitle(f.name.replace(/\.(md|txt|markdown)$/i, ""));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setBusy(true);
    try {
      const res = await ingest({
        data: {
          ancestor_id: ancestorId,
          title: title.trim(),
          content: content.trim(),
          era_label: era.trim() || null,
          document_date: docDate.trim() || null,
        },
      });
      toast.success(`Ingested (${res.chunks} memory chunks)`);
      setTitle(""); setEra(""); setDocDate(""); setContent("");
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["documents", ancestorId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ingestion failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="parchment-panel rounded-xl p-6">
      <h2 className="font-serif text-2xl text-foreground">Add a document</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Plain text or Markdown. Each document is chunked, embedded and stored privately.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="file">Upload .txt or .md</Label>
          <Input
            id="file"
            type="file"
            ref={fileRef}
            accept=".txt,.md,.markdown,text/plain,text/markdown"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
          </div>
          <div>
            <Label htmlFor="era">Era label (optional)</Label>
            <Input id="era" value={era} onChange={(e) => setEra(e.target.value)} placeholder="Wartime letters" maxLength={80} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="docDate">Date (yyyy-mm-dd, optional)</Label>
            <Input id="docDate" value={docDate} onChange={(e) => setDocDate(e.target.value)} placeholder="1943-06-12" />
          </div>
        </div>
        <div>
          <Label htmlFor="content">Content</Label>
          <Textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} rows={10} maxLength={500_000} required placeholder="Paste or upload the text of a letter, journal entry, memoir chapter…" className="font-serif text-base" />
        </div>
        <Button type="submit" disabled={busy || !title.trim() || !content.trim()}>
          {busy ? "Ingesting…" : "Add to archive"}
        </Button>
      </form>
    </div>
  );
}

function TimelinePanel({ ancestorId }: { ancestorId: string }) {
  const listD = useServerFn(listDocuments);
  const { data: docs, isLoading } = useQuery({
    queryKey: ["documents", ancestorId],
    queryFn: () => listD({ data: { ancestor_id: ancestorId } }),
  });

  const [openId, setOpenId] = useState<string | null>(null);

  if (isLoading) return <p className="text-muted-foreground">Loading the timeline…</p>;
  if (!docs || docs.length === 0) {
    return (
      <div className="parchment-panel rounded-xl p-10 text-center">
        <p className="font-serif text-xl text-foreground">No documents yet.</p>
        <p className="mt-2 text-sm text-muted-foreground">Upload a letter or journal to begin the timeline.</p>
      </div>
    );
  }

  return (
    <div className="parchment-panel rounded-xl p-6">
      <h2 className="mb-6 font-serif text-2xl text-foreground">Memory timeline</h2>
      <ol className="relative border-l border-border pl-6">

        {docs.map((d) => (
          <li key={d.id} className="mb-8 last:mb-0">
            <span className="absolute -left-[7px] mt-1 h-3 w-3 rounded-full bg-accent" />
            <button
              onClick={() => setOpenId(openId === d.id ? null : d.id)}
              className="text-left"
            >
              <p className="font-serif text-xs uppercase tracking-widest text-muted-foreground">
                {d.document_date ?? d.era_label ?? "Undated"}
                {" · "}
                <span className={d.status === "ready" ? "text-accent" : d.status === "error" ? "text-destructive" : ""}>
                  {d.status === "ready" ? `${d.chunk_count} memories` : d.status}
                </span>
              </p>
              <h3 className="mt-1 font-serif text-2xl text-foreground hover:text-accent">{d.title}</h3>
            </button>
            {openId === d.id && d.raw_content && (
              <div className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-background/60 p-4 font-serif text-base leading-relaxed text-foreground">
                {d.raw_content}
              </div>
            )}
            {d.error_message && (
              <p className="mt-2 text-xs text-destructive">{d.error_message}</p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function EchoesPanel({ ancestorId, ancestorName }: { ancestorId: string; ancestorName: string }) {
  const listE = useServerFn(listEchoes);
  const writeE = useServerFn(writeEcho);
  const listS = useServerFn(listSessions);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data: echoes, isLoading } = useQuery({
    queryKey: ["echoes", ancestorId],
    queryFn: () => listE({ data: { ancestor_id: ancestorId } }),
  });
  const { data: sessions } = useQuery({
    queryKey: ["sessions", ancestorId],
    queryFn: () => listS({ data: { ancestor_id: ancestorId } }),
  });

  const compose = async () => {
    const latestSession = sessions?.[0]?.id ?? null;
    if (!latestSession) {
      toast.error("Have a conversation in the Vault first — Echoes are reflections on what was said.");
      return;
    }
    setBusy(true);
    try {
      await writeE({ data: { ancestor_id: ancestorId, session_id: latestSession } });
      toast.success(`${ancestorName} left a new echo in the diary`);
      qc.invalidateQueries({ queryKey: ["echoes", ancestorId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not write echo");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="parchment-panel rounded-xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl text-foreground">The Echoes</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Private diary entries {ancestorName} writes after each conversation.
          </p>
        </div>
        <Button onClick={compose} disabled={busy}>
          {busy ? "Listening…" : "Ask for a new echo"}
        </Button>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <p className="text-muted-foreground">Turning the page…</p>
        ) : !echoes || echoes.length === 0 ? (
          <p className="font-serif italic text-muted-foreground">No echoes yet. After you speak in the Vault, ask for one.</p>
        ) : (
          <ol className="space-y-6">
            {echoes.map((e) => (
              <li key={e.id} className="border-l-2 border-accent/60 pl-5">
                <p className="font-serif text-xs uppercase tracking-widest text-muted-foreground">
                  {new Date(e.created_at).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" })}
                </p>
                <p className="mt-2 whitespace-pre-wrap font-serif text-lg leading-relaxed text-foreground">
                  {e.content}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}


function CallPanel({
  ancestor,
}: {
  ancestor: {
    id: string;
    full_name: string;
    spoken_language: string | null;
    face_url: string | null;
    portrait_url: string | null;
    perceived_gender: "female" | "male" | null;
  };
}) {
  const listS = useServerFn(listSessions);
  const createS = useServerFn(createSession);
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState<string | null>(null);

  const { data: sessions } = useQuery({
    queryKey: ["sessions", ancestor.id],
    queryFn: () => listS({ data: { ancestor_id: ancestor.id } }),
  });

  useEffect(() => {
    (async () => {
      if (sessions === undefined || sessionId) return;
      if (sessions.length > 0) {
        setSessionId(sessions[0].id);
      } else {
        const { id } = await createS({ data: { ancestor_id: ancestor.id } });
        setSessionId(id);
      }
    })();
  }, [sessions, sessionId, ancestor.id, createS]);

  return (
    <div className="parchment-panel rounded-xl p-6">
      <h2 className="mb-1 font-serif text-2xl">Face to face</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        A live, spoken conversation. Their photograph is brought to motion and answers you aloud.
      </p>
      <VideoCallRoom
        ancestor={ancestor}
        sessionId={sessionId}
        onFaceSaved={() => queryClient.invalidateQueries({ queryKey: ["ancestor", ancestor.id] })}
        onVoiceSaved={() => queryClient.invalidateQueries({ queryKey: ["ancestor", ancestor.id] })}
      />
    </div>
  );
}
