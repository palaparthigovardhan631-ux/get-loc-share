import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kinvoke — Speak with an AI ancestor from their letters" },
      {
        name: "description",
        content:
          "Upload journals, letters and memoirs to build a persistent, voice-accurate AI persona of a past relative — grounded strictly in their own words.",
      },
      { property: "og:title", content: "Kinvoke — A generative legacy archive" },
      {
        property: "og:description",
        content:
          "Upload letters, journals and memoirs and speak face to face with a past relative reconstructed from their own writings.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://get-loc-share.lovable.app/" },
      { property: "og:image", content: "https://get-loc-share.lovable.app/og-image.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://get-loc-share.lovable.app/og-image.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://get-loc-share.lovable.app/" }],
  }),
  component: Landing,
});

function Landing() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
  }, []);

  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link to="/" className="font-serif text-xl tracking-tight text-foreground">
          Kinvoke
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {signedIn ? (
            <Button asChild variant="default">
              <Link to="/dashboard">Enter the archive</Link>
            </Button>
          ) : (
            <>
              <Link to="/auth" className="text-muted-foreground hover:text-foreground">
                Sign in
              </Link>
              <Button asChild>
                <Link to="/auth">Begin</Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      <section className="mx-auto max-w-3xl px-6 pb-24 pt-16 text-center">
        <p className="mb-6 font-serif italic text-muted-foreground">A generative legacy archive</p>
        <h1 className="font-serif text-5xl leading-[1.05] tracking-tight text-foreground sm:text-6xl md:text-7xl">
          Sit again at the hearth of someone the world has forgotten.
        </h1>
        <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Upload the letters, journals and memoirs of a past relative. From their own words we
          reconstruct a persistent voice — warm, temporally consistent, honest about what it
          cannot remember — and you can speak with them again.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link to={signedIn ? "/dashboard" : "/auth"}>
              {signedIn ? "Open your archive" : "Begin an ancestor"}
            </Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-24">
        <h2 className="mb-8 text-center font-serif text-3xl text-foreground">
          How Kinvoke reconstructs a voice
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Ingested with care",
              body: "Journals, letters and memoirs are chunked, embedded and stored in a private vault only you can read.",
            },
            {
              title: "Voice-accurate",
              body: "Each reply is grounded in retrieved passages, matching vocabulary, cadence and warmth from the source texts.",
            },
            {
              title: "Honest about silence",
              body: "When the archive holds no answer, your ancestor says so — never inventing modern facts to fill the gap.",
            },
          ].map((f) => (
            <div key={f.title} className="parchment-panel rounded-xl p-6">
              <h3 className="font-serif text-xl text-foreground">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-24 text-center">
        <h2 className="font-serif text-3xl text-foreground">Start with the paper you already have</h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Old letters fade, foxing spreads and ink lifts from the page. Read our guide to keeping
          them safe before you digitise a single word.
        </p>
        <div className="mt-6">
          <Button asChild variant="secondary">
            <Link to="/guides/preserving-old-letters">How to preserve old letters</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        Handle these voices with care. They are reflections, not the departed themselves.
      </footer>
    </main>
  );
}
