import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createLovableAiGatewayProvider, CHAT_MODEL, embedTexts } from "@/lib/ai-gateway.server";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { buildSystemPrompt, type PersonaProfile } from "@/lib/persona";

type ChatBody = { messages?: UIMessage[]; ancestorId?: string; sessionId?: string };


export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as ChatBody;
        if (!Array.isArray(body.messages) || !body.ancestorId) {
          return new Response("Missing messages or ancestorId", { status: 400 });
        }

        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
        if (!token || token.split(".").length !== 3) {
          return new Response("Unauthorized", { status: 401 });
        }

        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;
        const lovableKey = process.env.LOVABLE_API_KEY;
        if (!supabaseUrl || !supabaseKey || !lovableKey) {
          return new Response("Server misconfigured", { status: 500 });
        }

        const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
          global: {
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              if (supabaseKey.startsWith("sb_") && h.get("Authorization") === `Bearer ${supabaseKey}`) {
                h.delete("Authorization");
              }
              h.set("apikey", supabaseKey);
              h.set("Authorization", `Bearer ${token}`);
              return fetch(input, { ...init, headers: h });
            },
          },
          auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
        });

        // Verify caller and ancestor
        const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
        if (claimsErr || !claims?.claims?.sub) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { data: ancestor, error: ancestorErr } = await supabase
          .from("ancestor_profiles")
          .select("full_name, biography, birth_year, passing_year, relation, system_prompt_override, spoken_language, accent_note, hometown, birthplace, profession, life_events, likes, dislikes, favorite_foods, personal_tragedies, proudest_moments, worldview")
          .eq("id", body.ancestorId)
          .maybeSingle();
        if (ancestorErr || !ancestor) {
          return new Response("Ancestor not found", { status: 404 });
        }

        // Extract latest user question for retrieval
        const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
        const queryText = lastUser
          ? (lastUser.parts ?? [])
              .map((p) => (p.type === "text" ? (p as { text: string }).text : ""))
              .join(" ")
              .trim()
          : "";

        let retrieved: {
          id: string;
          content: string;
          document_title: string | null;
          era_label: string | null;
          document_date: string | null;
        }[] = [];

        if (queryText) {
          try {
            const [queryVec] = await embedTexts([queryText]);
            const { data: matches, error: matchErr } = await supabase.rpc("match_memory_chunks", {
              query_embedding: queryVec as unknown as string,
              target_ancestor_id: body.ancestorId,
              match_count: 8,
            });
            if (!matchErr && matches) retrieved = matches;
          } catch (err) {
            console.error("Retrieval failed:", err);
          }
        }

        const systemPrompt = buildSystemPrompt(ancestor as unknown as PersonaProfile, retrieved);
        const gateway = createLovableAiGatewayProvider(lovableKey);
        const model = gateway(CHAT_MODEL);

        const result = streamText({
          model,
          system: systemPrompt,
          messages: await convertToModelMessages(body.messages),
          onFinish: async ({ text }) => {
            if (!body.sessionId) return;
            try {
              // Persist the user turn (last user msg) and assistant reply.
              if (lastUser && queryText) {
                await supabase.from("chat_messages").insert({
                  session_id: body.sessionId,
                  user_id: claims.claims.sub,
                  role: "user",
                  content: queryText,
                });
              }
              await supabase.from("chat_messages").insert({
                session_id: body.sessionId,
                user_id: claims.claims.sub,
                role: "ancestor",
                content: text,
                retrieved_chunk_ids: retrieved.map((r) => r.id),
              });
            } catch (err) {
              console.error("Persist message failed:", err);
            }
          },
        });

        return result.toUIMessageStreamResponse({ originalMessages: body.messages });
      },
    },
  },
});
