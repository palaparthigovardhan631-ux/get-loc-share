import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { FACE_BUCKET } from "@/lib/call.constants";
import { z } from "zod";

/** Persist the storage path of the ancestor's real face photo. */
export const setFace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ancestor_id: z.string().uuid(),
        path: z.string().trim().min(1).max(400),
        voice_id: z.string().trim().max(120).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("ancestor_profiles")
      .update({
        face_url: data.path,
        // New face → re-detect the voice gender on the next call.
        perceived_gender: null,
        // A voice saved for the previous face must not override the new match.
        voice_id: data.voice_id || null,
      })
      .eq("id", data.ancestor_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Signed, temporary URL for showing the stored face in the UI. */
export const getFaceUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ path: z.string().trim().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: signed, error } = await context.supabase.storage
      .from(FACE_BUCKET)
      .createSignedUrl(data.path, 3600);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

export const listCallLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ ancestor_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("call_logs")
      .select("id, started_at, ended_at, turns")
      .eq("ancestor_id", data.ancestor_id)
      .order("started_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Manual override for which voice the ancestor speaks with. */
export const setVoiceGender = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ancestor_id: z.string().uuid(),
        gender: z.enum(["female", "male"]).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("ancestor_profiles")
      // The gendered language voice must win over any stale explicit voice ID.
      .update({ perceived_gender: data.gender, voice_id: null })
      .eq("id", data.ancestor_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
