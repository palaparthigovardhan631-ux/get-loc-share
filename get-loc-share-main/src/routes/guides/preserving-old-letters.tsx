import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

const URL = "https://get-loc-share.lovable.app/guides/preserving-old-letters";

export const Route = createFileRoute("/guides/preserving-old-letters")({
  head: () => ({
    meta: [
      { title: "How to Preserve Old Letters: A Practical Archiving Guide" },
      {
        name: "description",
        content:
          "Step-by-step guide to preserving old family letters: safe handling, unfolding, storage materials, humidity, repairs to avoid, and how to digitise them properly.",
      },
      { property: "og:title", content: "How to preserve old letters — Kinvoke" },
      {
        property: "og:description",
        content:
          "Safe handling, archival storage, humidity control and digitising: how to keep family letters readable for another century.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { property: "og:image", content: "https://get-loc-share.lovable.app/og-image.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://get-loc-share.lovable.app/og-image.jpg" },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "How to preserve old letters",
          description:
            "A practical guide to handling, storing and digitising old family letters so their words survive.",
          mainEntityOfPage: URL,
          author: { "@type": "Organization", name: "Kinvoke" },
          publisher: { "@type": "Organization", name: "Kinvoke" },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Home",
              item: "https://get-loc-share.lovable.app/",
            },
            {
              "@type": "ListItem",
              position: 2,
              name: "How to preserve old letters",
              item: URL,
            },
          ],
        }),
      },
    ],
  }),
  component: Guide,
});

const sections = [
  {
    h: "1. Handle them as little as possible",
    p: [
      "Skin oils and salts accelerate paper decay, so wash and fully dry your hands before touching a letter — cotton gloves are usually worse, because they reduce grip and snag brittle edges.",
      "Support the whole sheet from underneath with a piece of stiff card when you move it. Never lift a fragile letter by one corner, and never lick a finger to separate pages.",
    ],
  },
  {
    h: "2. Unfold once, gently, and stop if it resists",
    p: [
      "Letters stored folded for decades crack along the creases. Open them slowly on a clean, flat surface and leave them flat from then on.",
      "If a fold will not relax, do not force it. Humidification is a conservator's job; a home attempt with steam or water will tide-mark the paper and bleed iron gall ink.",
    ],
  },
  {
    h: "3. Remove what is quietly destroying them",
    p: [
      "Take out paper clips, staples, rubber bands and pins — they rust and cut. Set aside newspaper clippings, which are highly acidic and will brown anything they touch.",
      "Never repair a tear with sticky tape. Pressure-sensitive tape stains permanently and its adhesive is close to impossible to reverse. Use archival-quality mending tissue, or simply leave the tear supported and unhandled.",
    ],
  },
  {
    h: "4. Store in archival materials",
    p: [
      "Use acid-free, lignin-free folders and boxes, or polyester (Mylar) sleeves. Avoid PVC plastics and ordinary shoeboxes.",
      "Store flat rather than upright where possible, one letter per folder, with its envelope kept alongside — postmarks, addresses and stamps carry dates and places you will want later.",
    ],
  },
  {
    h: "5. Control the environment",
    p: [
      "Aim for a cool, stable room at roughly 18°C with 35–50% relative humidity. Fluctuation does more damage than any single reading.",
      "Keep letters out of attics, basements and garages, away from exterior walls, and out of direct sunlight or UV lamps — light fades ink irreversibly.",
    ],
  },
  {
    h: "6. Digitise before you need to",
    p: [
      "Scan flat at 600 dpi in colour (not greyscale — colour records ink fading and paper tone) and save the master as TIFF or PNG, with JPEG copies for everyday use.",
      "If you photograph instead, use diffuse daylight, no flash, and shoot square to the page. Capture both sides of every sheet, including blank versos, which often hold pencil notes.",
      "Name files consistently — date, sender, recipient — and keep three copies in two formats with one off-site. A single hard drive is not a backup.",
    ],
  },
  {
    h: "7. Transcribe while someone still reads the hand",
    p: [
      "Old cursive, abbreviations and regional spellings become unreadable within a generation. Type out the text exactly as written, keeping original spelling, and note anything illegible in brackets.",
      "A plain-text transcript is also what makes the letters searchable, quotable and usable by software later.",
    ],
  },
];

function Guide() {
  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Link to="/" className="font-serif text-xl tracking-tight text-foreground">
          Kinvoke
        </Link>
        <Button asChild variant="secondary" size="sm">
          <Link to="/auth">Begin an archive</Link>
        </Button>
      </header>

      <article className="mx-auto max-w-3xl px-6 pb-24">
        <p className="font-serif italic text-muted-foreground">Guide</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight text-foreground sm:text-5xl">
          How to preserve old letters
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
          Family letters fail in predictable ways: acidic paper browns, folds crack, tape stains,
          damp brings mould and ink fades in the light. Almost all of it is preventable with
          ordinary care. Here is what to do with a box of old correspondence — physically first,
          then digitally, so the words outlive the paper.
        </p>

        {sections.map((s) => (
          <section key={s.h} className="mt-10">
            <h2 className="font-serif text-2xl text-foreground">{s.h}</h2>
            {s.p.map((para) => (
              <p key={para} className="mt-3 leading-relaxed text-muted-foreground">
                {para}
              </p>
            ))}
          </section>
        ))}

        <section className="parchment-panel mt-14 rounded-xl p-8">
          <h2 className="font-serif text-2xl text-foreground">From transcript to living voice</h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Once your letters are transcribed as plain text or Markdown, Kinvoke can read them.
            Upload the files to an ancestor's archive and every passage is chunked, embedded and
            stored privately — then you can ask questions and hear answers drawn only from what
            they actually wrote, in their own vocabulary and cadence.
          </p>
          <div className="mt-6">
            <Button asChild>
              <Link to="/auth">Upload your first letter</Link>
            </Button>
          </div>
        </section>
      </article>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        Kinvoke — a generative legacy archive.
      </footer>
    </main>
  );
}
