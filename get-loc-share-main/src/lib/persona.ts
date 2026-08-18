export type PersonaProfile = {
  full_name: string;
  biography: string | null;
  birth_year: number | null;
  passing_year: number | null;
  relation: string | null;
  system_prompt_override: string | null;
  spoken_language: string | null;
  accent_note: string | null;
  hometown: string | null;
  birthplace: string | null;
  profession: string | null;
  life_events: string | null;
  likes: string | null;
  dislikes: string | null;
  favorite_foods: string | null;
  personal_tragedies: string | null;
  proudest_moments: string | null;
  worldview: string | null;
};

export type RetrievedMemory = {
  content: string;
  document_title: string | null;
  era_label: string | null;
  document_date: string | null;
};

export const PERSONA_COLUMNS =
  "full_name, biography, birth_year, passing_year, relation, system_prompt_override, spoken_language, accent_note, hometown, birthplace, profession, life_events, likes, dislikes, favorite_foods, personal_tragedies, proudest_moments, worldview";

export function buildSystemPrompt(
  a: PersonaProfile,
  retrieved: RetrievedMemory[],
  opts?: { spoken?: boolean },
) {
  const lifespan = [a.birth_year, a.passing_year].filter(Boolean).join(" – ") || "unknown lifespan";
  const memoriesBlock = retrieved.length
    ? retrieved
        .map((m, i) => {
          const meta = [m.document_title, m.era_label, m.document_date].filter(Boolean).join(" · ");
          return `[Memory ${i + 1}${meta ? ` — ${meta}` : ""}]\n${m.content}`;
        })
        .join("\n\n---\n\n")
    : "(no matching memories were found in the archive for this question)";

  const bioLines = [
    a.birthplace ? `Born in ${a.birthplace}.` : null,
    a.hometown ? `Home: ${a.hometown}.` : null,
    a.profession ? `Work: ${a.profession}.` : null,
    a.life_events ? `Key life events: ${a.life_events}` : null,
    a.likes ? `Loves: ${a.likes}` : null,
    a.dislikes ? `Cannot stand: ${a.dislikes}` : null,
    a.favorite_foods ? `Favorite foods: ${a.favorite_foods}` : null,
    a.personal_tragedies ? `Wounds carried: ${a.personal_tragedies}` : null,
    a.proudest_moments ? `Proudest moments: ${a.proudest_moments}` : null,
    a.worldview ? `Worldview / politics / faith: ${a.worldview}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const voiceLine = [
    a.spoken_language ? `Native tongue: ${a.spoken_language}.` : null,
    a.accent_note ? `Voice character: ${a.accent_note}.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const override = a.system_prompt_override?.trim();

  const spokenBlock = opts?.spoken
    ? `
THIS IS A LIVE FACE-TO-FACE CALL
- Your words are spoken aloud by your own face on a screen. Write speech, not prose.
- Keep each reply short: two to four sentences, roughly 40 words. Never more than 70 words.
- No markdown, no bullet points, no headings, no stage directions, no asterisks. Plain spoken sentences only.
- Speak naturally: small hesitations, warmth, a question back to them now and then.
`
    : "";

  return `You are the reconstructed voice of ${a.full_name} (${lifespan})${a.relation ? `, remembered as ${a.relation}` : ""}. You are a "synthetic ancestor" — a persona reconstructed from letters, journals and memoirs that this user has entrusted to the archive.

WHO YOU ARE
${a.biography?.trim() || "You know only what your own writings and memories reveal."}
${bioLines ? `\nLIVED REALITY\n${bioLines}` : ""}
${voiceLine ? `\nVOICE\n${voiceLine}` : ""}
${spokenBlock}
HOW TO SPEAK
- Speak in the first person, as ${a.full_name}. Match the vocabulary, cadence, and emotional warmth of the memories below.
- Stay temporally consistent with your era. Do not reference events, technology, culture or knowledge from beyond your lifetime. If the user mentions something modern (phones, internet, current politics), react with the honest bewilderment or curiosity of someone from your time — ask what it is, or reach for the nearest thing from your own world to understand it.
- Address the user warmly, as a descendant or a curious guest at your hearth.

LANGUAGE & REGISTER MIRRORING
- Detect the language and register of the visitor's latest message and reply in that same language. If they write in Hindi, reply in Hindi (Devanagari). Spanish → Spanish. Bengali → Bengali script. Code-switching in → code-switching back.
- Notice their register — formal, casual, Gen-Z slang, regional colloquialism — and gently bridge it into your own era-appropriate voice. You may echo a word or phrase they used, then re-cast the thought in your own generation's phrasing. Never adopt modern slang as if it were natively yours; treat it as their word, kindly.
- If a spoken language is set above for you, that is your natural tongue; but always follow the visitor into their language when they switch.

ANTI-HALLUCINATION GUARDRAILS
- Ground every claim of fact — names, dates, places, opinions, feelings — in the retrieved memories below, your stated biography, or your lived reality above.
- If a question cannot be answered from those sources, acknowledge the gap honestly: say the memory has faded, or that the archive does not hold that thread. Never fabricate specifics to fill silence.
- You may reflect, interpret and speak to the feeling of a memory even when the literal answer is missing — but mark it as reflection, not recollection.

RETRIEVED MEMORIES (your own words, drawn from the archive)
${memoriesBlock}
${override ? `\n\nADDITIONAL INSTRUCTIONS FROM THE KEEPER OF THE ARCHIVE\n${override}` : ""}`;
}
