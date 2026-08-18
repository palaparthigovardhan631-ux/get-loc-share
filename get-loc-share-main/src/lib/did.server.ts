/**
 * D-ID Talks Streams client — turns a still photograph into a live,
 * lip-synced talking head delivered over WebRTC.
 * Docs: https://docs.d-id.com/reference/talks-streams-overview
 */

const DID_BASE = "https://api.d-id.com";

function authHeader() {
  const key = process.env.DID_API_KEY;
  if (!key) throw new Error("Missing DID_API_KEY");
  // D-ID issues keys as "<base64-email>:<secret>" and expects HTTP Basic.
  return `Basic ${btoa(key)}`;
}

async function didFetch(path: string, init: RequestInit) {
  const res = await fetch(`${DID_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`D-ID ${path} failed [${res.status}]: ${text.slice(0, 500)}`);
  }
  return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}

export type DidStream = {
  id: string;
  session_id: string;
  offer: RTCSessionDescriptionInit;
  ice_servers: RTCIceServer[];
};

export async function createStream(sourceUrl: string): Promise<DidStream> {
  const json = (await didFetch("/talks/streams", {
    method: "POST",
    body: JSON.stringify({
      source_url: sourceUrl,
      stream_warmup: true,
      config: { stitch: true },
    }),
  })) as unknown as DidStream;
  return json;
}

export async function submitAnswer(
  streamId: string,
  sessionId: string,
  answer: RTCSessionDescriptionInit,
) {
  return didFetch(`/talks/streams/${streamId}/sdp`, {
    method: "POST",
    body: JSON.stringify({ answer, session_id: sessionId }),
  });
}

export async function submitIce(
  streamId: string,
  sessionId: string,
  candidate: {
    candidate?: string | null;
    sdpMid?: string | null;
    sdpMLineIndex?: number | null;
  },
) {
  const payload = candidate.candidate
    ? {
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid,
        sdpMLineIndex: candidate.sdpMLineIndex,
        session_id: sessionId,
      }
    : { session_id: sessionId };
  return didFetch(`/talks/streams/${streamId}/ice`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Microsoft neural voices, chosen by language and perceived gender. */
type VoicePair = { match: RegExp; male: string; female: string };

const VOICE_BY_LANGUAGE: VoicePair[] = [
  { match: /hindi|हिन/i, male: "hi-IN-MadhurNeural", female: "hi-IN-SwaraNeural" },
  { match: /telugu/i, male: "te-IN-MohanNeural", female: "te-IN-ShrutiNeural" },
  { match: /tamil/i, male: "ta-IN-ValluvarNeural", female: "ta-IN-PallaviNeural" },
  { match: /bengali|bangla/i, male: "bn-IN-BashkarNeural", female: "bn-IN-TanishaaNeural" },
  { match: /marathi/i, male: "mr-IN-ManoharNeural", female: "mr-IN-AarohiNeural" },
  { match: /gujarati/i, male: "gu-IN-NiranjanNeural", female: "gu-IN-DhwaniNeural" },
  { match: /kannada/i, male: "kn-IN-GaganNeural", female: "kn-IN-SapnaNeural" },
  { match: /malayalam/i, male: "ml-IN-MidhunNeural", female: "ml-IN-SobhanaNeural" },
  { match: /punjabi/i, male: "pa-IN-OjasNeural", female: "pa-IN-VaaniNeural" },
  { match: /urdu/i, male: "ur-IN-SalmanNeural", female: "ur-IN-GulNeural" },
  { match: /spanish|espa/i, male: "es-ES-AlvaroNeural", female: "es-ES-ElviraNeural" },
  { match: /french|fran/i, male: "fr-FR-HenriNeural", female: "fr-FR-DeniseNeural" },
  { match: /german|deutsch/i, male: "de-DE-ConradNeural", female: "de-DE-KatjaNeural" },
  { match: /italian|italiano/i, male: "it-IT-DiegoNeural", female: "it-IT-ElsaNeural" },
  { match: /portug/i, male: "pt-BR-AntonioNeural", female: "pt-BR-FranciscaNeural" },
  { match: /arabic|عرب/i, male: "ar-EG-ShakirNeural", female: "ar-EG-SalmaNeural" },
  { match: /japanese|日本/i, male: "ja-JP-KeitaNeural", female: "ja-JP-NanamiNeural" },
  { match: /mandarin|chinese|中文/i, male: "zh-CN-YunjianNeural", female: "zh-CN-XiaoxiaoNeural" },
  { match: /russian|рус/i, male: "ru-RU-DmitryNeural", female: "ru-RU-SvetlanaNeural" },
  { match: /british|england|english \(uk\)/i, male: "en-GB-RyanNeural", female: "en-GB-SoniaNeural" },
  { match: /irish/i, male: "en-IE-ConnorNeural", female: "en-IE-EmilyNeural" },
  { match: /australian/i, male: "en-AU-WilliamNeural", female: "en-AU-NatashaNeural" },
  { match: /indian english/i, male: "en-IN-PrabhatNeural", female: "en-IN-NeerjaNeural" },
];

const DEFAULT_PAIR: VoicePair = {
  match: /.*/,
  male: "en-US-GuyNeural",
  female: "en-US-JennyNeural",
};

export type PerceivedGender = "female" | "male" | null | undefined;

export function pickVoice(
  language: string | null,
  explicit: string | null,
  gender?: PerceivedGender,
) {
  const lang = language ?? "";
  const pair = VOICE_BY_LANGUAGE.find((entry) => entry.match.test(lang)) ?? DEFAULT_PAIR;
  // A current Woman/Man selection (including a photo match) must take
  // precedence over a legacy voice ID saved on this profile.
  if (gender === "female") return pair.female;
  if (gender === "male") return pair.male;
  if (explicit?.trim()) return explicit.trim();
  return pair.male;
}

/**
 * Look at the ancestor's photograph and decide whether the voice should read
 * as feminine or masculine. Returns null when it genuinely cannot tell.
 */
export async function detectGenderFromPhoto(imageUrl: string): Promise<"female" | "male" | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;

  // Inline the image: signed storage URLs are sometimes unreachable from the
  // provider, which silently made every detection fail (and default to male).
  let inlined = imageUrl;
  try {
    const img = await fetch(imageUrl);
    if (img.ok) {
      const buf = Buffer.from(await img.arrayBuffer());
      const mime = img.headers.get("content-type") || "image/jpeg";
      inlined = `data:${mime};base64,${buf.toString("base64")}`;
    }
  } catch (err) {
    console.error("Could not inline face image for voice matching:", err);
  }

  const ask = async (attempt: number) => {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "This is a photo used to pick a synthetic narration voice. Judging only by visible appearance (hair, clothing, facial features), would a feminine or a masculine speaking voice suit this person better? Answer with exactly one lowercase word: feminine or masculine. Never answer anything else — if unsure, choose the closer of the two.",
              },
              { type: "image_url", image_url: { url: inlined } },
            ],
          },
        ],
        max_tokens: 6,
        temperature: 0,
      }),
    });
    if (!res.ok) {
      console.error(
        `Gender detection failed [${res.status}] (attempt ${attempt}): ${(await res.text()).slice(0, 300)}`,
      );
      return null;
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const answer = (json.choices?.[0]?.message?.content ?? "").toLowerCase();
    if (/feminine|female|woman|girl|lady/.test(answer)) return "female" as const;
    if (/masculine|male|man|boy|gentleman/.test(answer)) return "male" as const;
    console.error(`Gender detection inconclusive (attempt ${attempt}): "${answer}"`);
    return null;
  };

  try {
    return (await ask(1)) ?? (await ask(2));
  } catch (err) {
    console.error("Gender detection error:", err);
    return null;
  }
}


export async function speak(opts: {
  streamId: string;
  sessionId: string;
  text: string;
  voiceId: string;
  style?: string | null;
}) {
  return didFetch(`/talks/streams/${opts.streamId}`, {
    method: "POST",
    body: JSON.stringify({
      script: {
        type: "text",
        input: opts.text.slice(0, 900),
        provider: {
          type: "microsoft",
          voice_id: opts.voiceId,
          voice_config: { style: opts.style || "Default" },
        },
        ssml: false,
      },
      config: { stitch: true, fluent: true, pad_audio: 0.2 },
      session_id: opts.sessionId,
    }),
  });
}

export async function closeStream(streamId: string, sessionId: string) {
  return didFetch(`/talks/streams/${streamId}`, {
    method: "DELETE",
    body: JSON.stringify({ session_id: sessionId }),
  });
}
