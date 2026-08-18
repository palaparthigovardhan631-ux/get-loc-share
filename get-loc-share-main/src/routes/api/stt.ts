import { createFileRoute } from "@tanstack/react-router";
import { authenticateRequest } from "@/lib/api-auth.server";

const MODEL = "openai/gpt-4o-transcribe";

export const Route = createFileRoute("/api/stt")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticateRequest(request);
        if (auth instanceof Response) return auth;

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Server misconfigured", { status: 500 });

        const inbound = await request.formData();
        const file = inbound.get("file");
        if (!(file instanceof File)) return new Response("Missing audio file", { status: 400 });
        if (file.size > 20_000_000) return new Response("Audio too large", { status: 400 });

        const form = new FormData();
        form.append("file", file, file.name || "speech.webm");
        form.append("model", MODEL);
        const language = inbound.get("language");
        if (typeof language === "string" && language.trim()) {
          form.append("prompt", `The speaker may be talking in ${language.trim()} or English.`);
        }

        const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}` },
          body: form,
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          console.error(`STT failed [${res.status}]: ${body}`);
          return new Response(body || "Transcription failed", { status: res.status });
        }
        const json = (await res.json()) as { text?: string };
        return Response.json({ text: (json.text ?? "").trim() });
      },
    },
  },
});
