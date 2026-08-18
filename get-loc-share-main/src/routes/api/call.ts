import { createFileRoute } from "@tanstack/react-router";
import { authenticateRequest } from "@/lib/api-auth.server";
import { createLovableAiGatewayProvider, CHAT_MODEL, embedTexts } from "@/lib/ai-gateway.server";
import { buildSystemPrompt, PERSONA_COLUMNS, type PersonaProfile } from "@/lib/persona";
import {
  createStream,
  submitAnswer,
  submitIce,
  speak,
  closeStream,
  pickVoice,
  detectGenderFromPhoto,
} from "@/lib/did.server";
import { generateText } from "ai";

const FACE_BUCKET = "ancestor-faces";

type Body = {
  action?: string;
  ancestorId?: string;
  streamId?: string;
  sessionId?: string;
  didSessionId?: string;
  callLogId?: string;
  answer?: RTCSessionDescriptionInit;
  candidate?: { candidate?: string | null; sdpMid?: string | null; sdpMLineIndex?: number | null };
  text?: string;
  history?: { role: "user" | "assistant"; content: string }[];
};

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; contentType: string } | null {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!m) return null;
  const binary = atob(m[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, contentType: m[1] };
}

export const Route = createFileRoute("/api/call")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (auth instanceof Response) return auth;
        const { supabase, userId } = auth;

        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        try {
          switch (body.action) {
            /* ---------------------------------------------------------- */
            case "create": {
              if (!body.ancestorId) return new Response("Missing ancestorId", { status: 400 });
              if (!process.env.DID_API_KEY) {
                return Response.json(
                  { error: "The video avatar service is not configured yet." },
                  { status: 503 },
                );
              }

              const { data: ancestor, error } = await supabase
                .from("ancestor_profiles")
                .select("id, face_url, portrait_url, full_name, perceived_gender")
                .eq("id", body.ancestorId)
                .maybeSingle();
              if (error || !ancestor) return new Response("Ancestor not found", { status: 404 });

              let path = ancestor.face_url;

              // No real photo yet? Fall back to the generated portrait by
              // materialising it into storage so D-ID can fetch it.
              if (!path && ancestor.portrait_url?.startsWith("data:")) {
                const decoded = dataUrlToBytes(ancestor.portrait_url);
                if (decoded) {
                  const ext = decoded.contentType.includes("jpeg") ? "jpg" : "png";
                  const genPath = `${userId}/${ancestor.id}-portrait.${ext}`;
                  const up = await supabase.storage
                    .from(FACE_BUCKET)
                    .upload(genPath, decoded.bytes, {
                      contentType: decoded.contentType,
                      upsert: true,
                    });
                  if (!up.error) {
                    path = genPath;
                    await supabase
                      .from("ancestor_profiles")
                      .update({ face_url: genPath })
                      .eq("id", ancestor.id);
                  }
                }
              } else if (!path && ancestor.portrait_url?.startsWith("http")) {
                path = null;
              }

              let sourceUrl: string | null = null;
              if (path) {
                const { data: signed } = await supabase.storage
                  .from(FACE_BUCKET)
                  .createSignedUrl(path, 60 * 60);
                sourceUrl = signed?.signedUrl ?? null;
              } else if (ancestor.portrait_url?.startsWith("http")) {
                sourceUrl = ancestor.portrait_url;
              }

              if (!sourceUrl) {
                return Response.json(
                  { error: "Upload a clear photograph of this ancestor before calling." },
                  { status: 400 },
                );
              }

              // Match the speaking voice to the face in the photograph.
              if (!ancestor.perceived_gender) {
                const gender = await detectGenderFromPhoto(sourceUrl);
                if (gender) {
                  await supabase
                    .from("ancestor_profiles")
                    .update({ perceived_gender: gender })
                    .eq("id", ancestor.id);
                }
              }

              const stream = await createStream(sourceUrl);

              const { data: log } = await supabase
                .from("call_logs")
                .insert({
                  user_id: userId,
                  ancestor_id: body.ancestorId,
                  session_id: body.sessionId ?? null,
                  stream_id: stream.id,
                })
                .select("id")
                .single();

              return Response.json({
                streamId: stream.id,
                didSessionId: stream.session_id,
                offer: stream.offer,
                iceServers: stream.ice_servers,
                callLogId: log?.id ?? null,
              });
            }

            /* ---------------------------------------------------------- */
            case "sdp": {
              if (!body.streamId || !body.didSessionId || !body.answer) {
                return new Response("Missing sdp params", { status: 400 });
              }
              await submitAnswer(body.streamId, body.didSessionId, body.answer);
              return Response.json({ ok: true });
            }

            /* ---------------------------------------------------------- */
            case "ice": {
              if (!body.streamId || !body.didSessionId) {
                return new Response("Missing ice params", { status: 400 });
              }
              await submitIce(body.streamId, body.didSessionId, body.candidate ?? {});
              return Response.json({ ok: true });
            }

            /* ---------------------------------------------------------- */
            case "say": {
              if (!body.ancestorId || !body.streamId || !body.didSessionId || !body.text?.trim()) {
                return new Response("Missing say params", { status: 400 });
              }
              const lovableKey = process.env.LOVABLE_API_KEY;
              if (!lovableKey) return new Response("Server misconfigured", { status: 500 });

              const { data: ancestor, error } = await supabase
                .from("ancestor_profiles")
                .select(`${PERSONA_COLUMNS}, voice_id, perceived_gender`)
                .eq("id", body.ancestorId)
                .maybeSingle();
              if (error || !ancestor) return new Response("Ancestor not found", { status: 404 });

              const persona = ancestor as unknown as PersonaProfile & {
                voice_id: string | null;
                perceived_gender: "female" | "male" | null;
              };
              const question = body.text.trim().slice(0, 2000);

              // Retrieve grounding memories.
              let retrieved: {
                id: string;
                content: string;
                document_title: string | null;
                era_label: string | null;
                document_date: string | null;
              }[] = [];
              try {
                const [queryVec] = await embedTexts([question]);
                const { data: matches } = await supabase.rpc("match_memory_chunks", {
                  query_embedding: queryVec as unknown as string,
                  target_ancestor_id: body.ancestorId,
                  match_count: 6,
                });
                if (matches) retrieved = matches;
              } catch (err) {
                console.error("Call retrieval failed:", err);
              }

              const gateway = createLovableAiGatewayProvider(lovableKey);
              const { text: reply } = await generateText({
                model: gateway(CHAT_MODEL),
                system: buildSystemPrompt(persona, retrieved, { spoken: true }),
                messages: [
                  ...(body.history ?? []).slice(-8).map((m) => ({
                    role: m.role,
                    content: m.content.slice(0, 1500),
                  })),
                  { role: "user" as const, content: question },
                ],
              });

              const spokenText =
                reply.replace(/[*_#`>]/g, "").replace(/\s+/g, " ").trim() ||
                "Forgive me — the memory slipped away just then.";

              await speak({
                streamId: body.streamId,
                sessionId: body.didSessionId,
                text: spokenText,
                voiceId: pickVoice(persona.spoken_language, persona.voice_id, persona.perceived_gender),
                style: null,
              });

              // Persist the exchange into the chat transcript.
              if (body.sessionId) {
                try {
                  await supabase.from("chat_messages").insert([
                    { session_id: body.sessionId, user_id: userId, role: "user", content: question },
                    {
                      session_id: body.sessionId,
                      user_id: userId,
                      role: "ancestor",
                      content: spokenText,
                      retrieved_chunk_ids: retrieved.map((r) => r.id),
                    },
                  ]);
                } catch (err) {
                  console.error("Call transcript persist failed:", err);
                }
              }

              return Response.json({ text: spokenText });
            }

            /* ---------------------------------------------------------- */
            case "interrupt": {
              // Cutting in mid-sentence: silence the avatar with an empty line.
              if (!body.streamId || !body.didSessionId) {
                return new Response("Missing interrupt params", { status: 400 });
              }
              await speak({
                streamId: body.streamId,
                sessionId: body.didSessionId,
                text: " ",
                voiceId: "en-US-GuyNeural",
                style: null,
              }).catch(() => {});
              return Response.json({ ok: true });
            }

            /* ---------------------------------------------------------- */
            case "end": {

              if (body.streamId && body.didSessionId) {
                await closeStream(body.streamId, body.didSessionId).catch(() => {});
              }
              if (body.callLogId) {
                await supabase
                  .from("call_logs")
                  .update({ ended_at: new Date().toISOString() })
                  .eq("id", body.callLogId);
              }
              return Response.json({ ok: true });
            }

            default:
              return new Response("Unknown action", { status: 400 });
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : "Call failed";
          console.error("Call route error:", message);
          return Response.json({ error: message }, { status: 502 });
        }
      },
    },
  },
});
