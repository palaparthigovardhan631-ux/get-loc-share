import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const AncestorInput = z.object({
  full_name: z.string().trim().min(1).max(120),
  biography: z.string().trim().max(4000).optional().nullable(),
  birth_year: z.number().int().min(1000).max(2100).optional().nullable(),
  passing_year: z.number().int().min(1000).max(2100).optional().nullable(),
  relation: z.string().trim().max(80).optional().nullable(),
  system_prompt_override: z.string().trim().max(4000).optional().nullable(),
  spoken_language: z.string().trim().max(80).optional().nullable(),
  accent_note: z.string().trim().max(400).optional().nullable(),
  hometown: z.string().trim().max(200).optional().nullable(),
  birthplace: z.string().trim().max(200).optional().nullable(),
  profession: z.string().trim().max(200).optional().nullable(),
  life_events: z.string().trim().max(4000).optional().nullable(),
  likes: z.string().trim().max(1000).optional().nullable(),
  dislikes: z.string().trim().max(1000).optional().nullable(),
  favorite_foods: z.string().trim().max(1000).optional().nullable(),
  personal_tragedies: z.string().trim().max(2000).optional().nullable(),
  proudest_moments: z.string().trim().max(2000).optional().nullable(),
  worldview: z.string().trim().max(2000).optional().nullable(),
});

async function generatePortrait(a: {
  full_name: string;
  biography?: string | null;
  birth_year?: number | null;
  passing_year?: number | null;
  relation?: string | null;
}): Promise<string | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;
  const lifespan = [a.birth_year, a.passing_year].filter(Boolean).join("–");
  const prompt = `A dignified, painterly portrait of ${a.full_name}${
    a.relation ? ` (${a.relation})` : ""
  }${lifespan ? `, lifespan ${lifespan}` : ""}. ${
    a.biography?.slice(0, 400) ?? ""
  } Style: aged sepia oil painting, soft candlelight, quiet study, gentle brushwork, muted parchment and ink palette, museum archival photograph feel, head and shoulders framing, looking softly toward the viewer. No text, no watermark.`;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });
    if (!res.ok) {
      console.error("Portrait gen failed:", res.status, await res.text().catch(() => ""));
      return null;
    }
    const json = (await res.json()) as {
      choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[];
      data?: { b64_json?: string; url?: string }[];
    };
    const fromChoice = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (fromChoice) return fromChoice;
    const d = json.data?.[0];
    if (d?.b64_json) return `data:image/png;base64,${d.b64_json}`;
    if (d?.url) return d.url;
    return null;
  } catch (err) {
    console.error("Portrait gen error:", err);
    return null;
  }
}

export const listAncestors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ancestor_profiles")
      .select("id, full_name, biography, birth_year, passing_year, relation, portrait_url, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getAncestor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: ancestor, error } = await context.supabase
      .from("ancestor_profiles")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ancestor) throw new Error("Ancestor not found");
    return ancestor;
  });

export const createAncestor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AncestorInput.parse(input))
  .handler(async ({ data, context }) => {
    const portrait_url = await generatePortrait(data);
    const { data: row, error } = await context.supabase
      .from("ancestor_profiles")
      .insert({ ...data, portrait_url, user_id: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteAncestor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("ancestor_profiles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ ancestor_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: docs, error } = await context.supabase
      .from("source_documents")
      .select("id, title, era_label, document_date, status, chunk_count, error_message, created_at, raw_content")
      .eq("ancestor_id", data.ancestor_id)
      .order("document_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return docs ?? [];
  });

const IngestInput = z.object({
  ancestor_id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(500_000),
  era_label: z.string().trim().max(80).optional().nullable(),
  document_date: z.string().trim().max(20).optional().nullable(), // yyyy-mm-dd
});

export const ingestDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => IngestInput.parse(input))
  .handler(async ({ data, context }) => {
    // Verify ancestor ownership (RLS also enforces)
    const { data: ancestor, error: aErr } = await context.supabase
      .from("ancestor_profiles")
      .select("id")
      .eq("id", data.ancestor_id)
      .maybeSingle();
    if (aErr) throw new Error(aErr.message);
    if (!ancestor) throw new Error("Ancestor not found");

    const documentDate = data.document_date && /^\d{4}-\d{2}-\d{2}$/.test(data.document_date)
      ? data.document_date
      : null;

    const { data: doc, error: dErr } = await context.supabase
      .from("source_documents")
      .insert({
        ancestor_id: data.ancestor_id,
        user_id: context.userId,
        title: data.title,
        file_type: "text",
        era_label: data.era_label ?? null,
        document_date: documentDate,
        raw_content: data.content,
        status: "processing",
      })
      .select("id")
      .single();
    if (dErr) throw new Error(dErr.message);

    try {
      const { chunkText } = await import("./chunk");
      const { embedTexts } = await import("./ai-gateway.server");
      const chunks = chunkText(data.content);
      if (chunks.length === 0) throw new Error("No content to embed");
      const vectors = await embedTexts(chunks);
      const rows = chunks.map((content, i) => ({
        document_id: doc.id,
        ancestor_id: data.ancestor_id,
        user_id: context.userId,
        chunk_index: i,
        content,
        embedding: vectors[i] as unknown as string, // pgvector accepts array via supabase-js
        document_title: data.title,
        era_label: data.era_label ?? null,
        document_date: documentDate,
      }));
      // Insert in batches of 100
      for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        const { error: cErr } = await context.supabase.from("memory_chunks").insert(batch);
        if (cErr) throw new Error(cErr.message);
      }
      await context.supabase
        .from("source_documents")
        .update({ status: "ready", chunk_count: chunks.length })
        .eq("id", doc.id);
      return { id: doc.id, chunks: chunks.length };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await context.supabase
        .from("source_documents")
        .update({ status: "error", error_message: message })
        .eq("id", doc.id);
      throw new Error(message);
    }
  });

export const listSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ ancestor_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("chat_sessions")
      .select("id, title, created_at")
      .eq("ancestor_id", data.ancestor_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ ancestor_id: z.string().uuid(), title: z.string().max(120).optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("chat_sessions")
      .insert({ ancestor_id: data.ancestor_id, user_id: context.userId, title: data.title ?? "New conversation" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const listMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ session_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("session_id", data.session_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listEchoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ ancestor_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("echoes")
      .select("id, content, session_id, created_at")
      .eq("ancestor_id", data.ancestor_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const writeEcho = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      ancestor_id: z.string().uuid(),
      session_id: z.string().uuid().optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Server misconfigured");

    // Load ancestor + recent conversation for reflection prompt
    const { data: ancestor, error: aErr } = await context.supabase
      .from("ancestor_profiles")
      .select("full_name, biography, relation, birth_year, passing_year, spoken_language")
      .eq("id", data.ancestor_id)
      .maybeSingle();
    if (aErr || !ancestor) throw new Error("Ancestor not found");

    let transcript = "";
    if (data.session_id) {
      const { data: msgs } = await context.supabase
        .from("chat_messages")
        .select("role, content, created_at")
        .eq("session_id", data.session_id)
        .order("created_at", { ascending: true })
        .limit(40);
      transcript = (msgs ?? [])
        .map((m) => `${m.role === "ancestor" ? ancestor.full_name : "The visitor"}: ${m.content}`)
        .join("\n");
    }
    if (!transcript.trim()) {
      throw new Error("No conversation to reflect on yet.");
    }

    const lifespan = [ancestor.birth_year, ancestor.passing_year].filter(Boolean).join(" – ");
    const system = `You are ${ancestor.full_name}${lifespan ? ` (${lifespan})` : ""}, writing a brief private diary entry — an "Echo" — after a conversation with a descendant. Write in first person, in your own voice and era-appropriate register.${ancestor.spoken_language ? ` Write in ${ancestor.spoken_language}.` : ""} 4–7 sentences. No headings, no meta-commentary, no modern jargon. Reflect on what was said, what it stirred in you, and any wish or memory it awakened. If the language is Hindi/Bengali/etc., write in that language's native script.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "openai/gpt-5.6-sol",
        reasoning_effort: "none",
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Here is our conversation:\n\n${transcript.slice(-6000)}\n\nWrite your diary entry now.` },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Echo generation failed [${res.status}]: ${body}`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("No reflection was written.");

    const { data: row, error } = await context.supabase
      .from("echoes")
      .insert({
        ancestor_id: data.ancestor_id,
        session_id: data.session_id ?? null,
        user_id: context.userId,
        content,
      })
      .select("id, content, session_id, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
