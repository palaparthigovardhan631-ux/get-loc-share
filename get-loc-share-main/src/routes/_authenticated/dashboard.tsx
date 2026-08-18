import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listAncestors, createAncestor, deleteAncestor } from "@/lib/ancestors.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Your archive — Kinvoke" },
      {
        name: "description",
        content:
          "Manage every reconstructed ancestor in your Kinvoke archive: add relatives, upload their letters and journals, and open a conversation.",
      },
      { property: "og:title", content: "Your archive — Kinvoke" },
      {
        property: "og:description",
        content:
          "Manage every reconstructed ancestor in your Kinvoke archive: add relatives, upload their letters and journals, and open a conversation.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://get-loc-share.lovable.app/dashboard" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://get-loc-share.lovable.app/dashboard" }],
  }),
  component: Dashboard,
});

function Dashboard() {
  const list = useServerFn(listAncestors);
  const { data, isLoading } = useQuery({ queryKey: ["ancestors"], queryFn: () => list() });

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl text-foreground">Your archive</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Each ancestor is reconstructed only from what you upload.
          </p>
        </div>
        <NewAncestorDialog />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Opening the vault…</p>
      ) : (data ?? []).length === 0 ? (
        <div className="parchment-panel rounded-xl p-10 text-center">
          <h2 className="font-serif text-2xl text-foreground">Your archive is empty</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Begin by naming an ancestor. Then upload their letters, journals or memoirs.
          </p>
          <div className="mt-6">
            <NewAncestorDialog />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data!.map((a) => (
            <AncestorCard key={a.id} ancestor={a} />
          ))}
        </div>
      )}
    </main>
  );
}

function AncestorCard({ ancestor }: { ancestor: { id: string; full_name: string; biography: string | null; birth_year: number | null; passing_year: number | null; relation: string | null } }) {
  const del = useServerFn(deleteAncestor);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const remove = async () => {
    if (!confirm(`Delete ${ancestor.full_name} and all their documents?`)) return;
    setBusy(true);
    try {
      await del({ data: { id: ancestor.id } });
      toast.success("Removed from archive");
      qc.invalidateQueries({ queryKey: ["ancestors"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    } finally {
      setBusy(false);
    }
  };

  const lifespan = [ancestor.birth_year, ancestor.passing_year].filter(Boolean).join(" – ");

  return (
    <div className="parchment-panel group relative rounded-xl p-6">
      <button
        onClick={remove}
        disabled={busy}
        aria-label="Delete ancestor"
        className="absolute right-3 top-3 rounded-md p-2 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-destructive group-hover:opacity-100"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      <Link to="/ancestor/$id" params={{ id: ancestor.id }} className="block">
        <h3 className="font-serif text-2xl text-foreground">{ancestor.full_name}</h3>
        {(lifespan || ancestor.relation) && (
          <p className="mt-1 text-sm italic text-muted-foreground">
            {[ancestor.relation, lifespan].filter(Boolean).join(" · ")}
          </p>
        )}
        {ancestor.biography && (
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
            {ancestor.biography}
          </p>
        )}
      </Link>
    </div>
  );
}

function NewAncestorDialog() {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [relation, setRelation] = useState("");
  const [birth, setBirth] = useState("");
  const [passing, setPassing] = useState("");
  const [bio, setBio] = useState("");
  const [language, setLanguage] = useState("");
  const [accent, setAccent] = useState("");
  const [birthplace, setBirthplace] = useState("");
  const [hometown, setHometown] = useState("");
  const [profession, setProfession] = useState("");
  const [lifeEvents, setLifeEvents] = useState("");
  const [likes, setLikes] = useState("");
  const [dislikes, setDislikes] = useState("");
  const [foods, setFoods] = useState("");
  const [tragedies, setTragedies] = useState("");
  const [proudest, setProudest] = useState("");
  const [worldview, setWorldview] = useState("");
  const create = useServerFn(createAncestor);
  const qc = useQueryClient();
  const router = useRouter();

  const reset = () => {
    setFullName(""); setRelation(""); setBirth(""); setPassing(""); setBio("");
    setLanguage(""); setAccent(""); setBirthplace(""); setHometown(""); setProfession("");
    setLifeEvents(""); setLikes(""); setDislikes(""); setFoods(""); setTragedies("");
    setProudest(""); setWorldview("");
  };

  const mutation = useMutation({
    mutationFn: async () =>
      create({
        data: {
          full_name: fullName,
          relation: relation || null,
          birth_year: birth ? Number(birth) : null,
          passing_year: passing ? Number(passing) : null,
          biography: bio || null,
          spoken_language: language || null,
          accent_note: accent || null,
          birthplace: birthplace || null,
          hometown: hometown || null,
          profession: profession || null,
          life_events: lifeEvents || null,
          likes: likes || null,
          dislikes: dislikes || null,
          favorite_foods: foods || null,
          personal_tragedies: tragedies || null,
          proudest_moments: proudest || null,
          worldview: worldview || null,
        },
      }),
    onSuccess: ({ id }) => {
      toast.success("Ancestor added");
      qc.invalidateQueries({ queryKey: ["ancestors"] });
      setOpen(false);
      reset();
      router.navigate({ to: "/ancestor/$id", params: { id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add ancestor</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Name an ancestor</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
        >
          <div>
            <Label htmlFor="fn">Full name</Label>
            <Input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} required maxLength={120} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <Label htmlFor="rel">Relation</Label>
              <Input id="rel" placeholder="great-grandmother" value={relation} onChange={(e) => setRelation(e.target.value)} maxLength={80} />
            </div>
            <div>
              <Label htmlFor="by">Born</Label>
              <Input id="by" inputMode="numeric" placeholder="1902" value={birth} onChange={(e) => setBirth(e.target.value.replace(/\D/g, "").slice(0, 4))} />
            </div>
            <div>
              <Label htmlFor="py">Passed</Label>
              <Input id="py" inputMode="numeric" placeholder="1987" value={passing} onChange={(e) => setPassing(e.target.value.replace(/\D/g, "").slice(0, 4))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="lang">Spoken language</Label>
              <Input id="lang" placeholder="English, Hindi, Bengali…" value={language} onChange={(e) => setLanguage(e.target.value)} maxLength={80} />
            </div>
            <div>
              <Label htmlFor="acc">Voice / accent note</Label>
              <Input id="acc" placeholder="soft Bengali-accented English, elderly" value={accent} onChange={(e) => setAccent(e.target.value)} maxLength={400} />
            </div>
          </div>

          <div className="border-t border-border/60 pt-4">
            <p className="font-serif text-sm uppercase tracking-widest text-muted-foreground">Lived reality</p>
            <p className="mt-1 text-xs text-muted-foreground">The more detail here, the more the ancestor stays anchored in their own world.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="bp">Birthplace</Label>
              <Input id="bp" placeholder="Chittagong, Bengal" value={birthplace} onChange={(e) => setBirthplace(e.target.value)} maxLength={200} />
            </div>
            <div>
              <Label htmlFor="hm">Hometowns / places lived</Label>
              <Input id="hm" placeholder="Calcutta, then London (1954–)" value={hometown} onChange={(e) => setHometown(e.target.value)} maxLength={200} />
            </div>
          </div>
          <div>
            <Label htmlFor="prof">Profession / trade</Label>
            <Input id="prof" placeholder="Village schoolteacher, then postal clerk" value={profession} onChange={(e) => setProfession(e.target.value)} maxLength={200} />
          </div>
          <div>
            <Label htmlFor="ev">Key life events</Label>
            <Textarea id="ev" rows={2} value={lifeEvents} onChange={(e) => setLifeEvents(e.target.value)} maxLength={4000} placeholder="Married 1928; lost the farm in Partition; emigrated 1962…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="lk">Loves</Label>
              <Textarea id="lk" rows={2} value={likes} onChange={(e) => setLikes(e.target.value)} maxLength={1000} placeholder="Monsoon evenings, Tagore, sweet tea…" />
            </div>
            <div>
              <Label htmlFor="dl">Cannot stand</Label>
              <Textarea id="dl" rows={2} value={dislikes} onChange={(e) => setDislikes(e.target.value)} maxLength={1000} placeholder="Loud parties, wastefulness…" />
            </div>
          </div>
          <div>
            <Label htmlFor="fd">Favorite foods</Label>
            <Input id="fd" placeholder="Fish curry, luchi, rice pudding" value={foods} onChange={(e) => setFoods(e.target.value)} maxLength={1000} />
          </div>
          <div>
            <Label htmlFor="tr">Wounds & personal tragedies</Label>
            <Textarea id="tr" rows={2} value={tragedies} onChange={(e) => setTragedies(e.target.value)} maxLength={2000} placeholder="Lost their brother in the war; miscarriage in 1936…" />
          </div>
          <div>
            <Label htmlFor="pr">Proudest moments</Label>
            <Textarea id="pr" rows={2} value={proudest} onChange={(e) => setProudest(e.target.value)} maxLength={2000} placeholder="Building the school with their own hands; seeing the first grandchild…" />
          </div>
          <div>
            <Label htmlFor="wv">Worldview, faith, politics</Label>
            <Textarea id="wv" rows={2} value={worldview} onChange={(e) => setWorldview(e.target.value)} maxLength={2000} placeholder="Devout Hindu; suspicious of the British; believed in education above all…" />
          </div>
          <div>
            <Label htmlFor="bio">A few lines of biography (optional narrative)</Label>
            <Textarea id="bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={4000} placeholder="A short paragraph in their own spirit…" />
          </div>

          <p className="text-xs italic text-muted-foreground">
            A portrait will be painted for them as they are added — this can take a few seconds.
          </p>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Painting portrait…" : "Add to archive"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
