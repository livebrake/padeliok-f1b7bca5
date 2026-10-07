import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export type LegalSection = { title: string; paragraphs?: string[]; items?: string[] };

export function LegalPage({ title, sections }: { title: string; sections: LegalSection[] }) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link to="/"><img src="/logo.png" alt="padeliOK.lt" className="h-8 w-auto" /></Link>
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">
            <ArrowLeft className="h-4 w-4" /> Grįžti į pradžią
          </Link>
        </div>
      </header>
      <article className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="text-3xl font-bold md:text-4xl">{title}</h1>
        <div className="mt-10 space-y-8">
          {sections.map((s) => (
            <section key={s.title}>
              <h2 className="text-xl font-semibold">{s.title}</h2>
              {s.paragraphs?.map((p) => (
                <p key={p} className="mt-3 leading-relaxed text-muted-foreground">{p}</p>
              ))}
              {s.items && (
                <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground">
                  {s.items.map((i) => <li key={i}>{i}</li>)}
                </ul>
              )}
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
