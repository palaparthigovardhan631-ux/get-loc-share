import { createFileRoute } from "@tanstack/react-router";

type TtsBody = {
  text?: string;
  language?: string | null;
  accent?: string | null;
  voice?: string | null;
  gender?: "female" | "male" | null;
};

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as TtsBody;
        const text = (body.text ?? "").trim();
        if (!text) return new Response("Missing text", { status: 400 });
        if (text.length > 4000) {
          return new Response("Text too long", { status: 400 });
        }
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Server misconfigured", { status: 500 });

        const language = body.language?.trim();
        const accent = body.accent?.trim();
        const instructionBits = [
          "Speak as a warm, elderly ancestor recalling memories.",
          "Pace: gentle and unhurried, with natural pauses.",
          language ? `Speak in ${language}.` : null,
          accent ? `Voice character: ${accent}.` : null,
          body.gender === "female"
            ? "The speaker is an elderly woman; keep the timbre clearly feminine."
            : body.gender === "male"
              ? "The speaker is an elderly man; keep the timbre clearly masculine."
              : null,
        ].filter(Boolean);

        const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openai/gpt-4o-mini-tts",
            input: text,
            voice: body.voice || (body.gender === "female" ? "shimmer" : "sage"),
            instructions: instructionBits.join(" "),
            response_format: "mp3",
          }),
        });
        if (!res.ok) {
          const errBody = await res.text().catch(() => "");
          console.error(`TTS failed [${res.status}]: ${errBody}`);
          return new Response(errBody || "TTS failed", { status: res.status });
        }
        return new Response(res.body, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
