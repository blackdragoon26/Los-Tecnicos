import { Mail } from "lucide-react";
import RecognitionBadge from "@/components/RecognitionBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const core = [
  { initials: "SK", name: "Sankalp", title: "Founder and systems builder", bio: "Turns ambitious grid ideas into circuits, backend contracts and pitch-ready demos." },
  { initials: "AK", name: "Akarsh", title: "The Cheetah", bio: "The reliable last-minute builder who keeps delivery moving under pressure." },
  { initials: "AJ", name: "Abhishek", title: "Hardware Whisperer", bio: "Coaxes ESP32s, relays and batteries into reporting the truth about every watt." },
];

export default function About() {
  return (
    <main className="min-h-screen px-4 pb-16 pt-24">
      <div className="container mx-auto max-w-5xl">
        <header className="mx-auto max-w-2xl text-center"><RecognitionBadge /><h1 className="mt-6 text-3xl font-bold">Building energy agency for households</h1><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Stelltron explores how local hardware, app wallets and verifiable telemetry can help individuals share surplus energy. The award does not imply Stellar endorsement of projected simulation data.</p><Button asChild variant="outline" className="mt-6"><a href="mailto:sankalp.jha9643@gmail.com?subject=Partner%20with%20Stelltron"><Mail className="mr-2 h-4 w-4" />Partner with Stelltron</a></Button><p className="mt-2 text-xs text-primary">Seeking angel and pre-seed partners</p></header>

        <section className="mt-14"><p className="text-center text-xs uppercase tracking-widest text-primary">Core team</p><div className="mt-6 grid gap-4 md:grid-cols-2"><TeamCard person={core[0]} className="md:col-span-2 md:mx-auto md:w-[calc(50%-0.5rem)]" /><TeamCard person={core[1]} /><TeamCard person={core[2]} /></div></section>

        <section className="mt-14 border-t border-border pt-10"><h2 className="text-xl font-semibold">Contributors</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Card><CardContent className="pt-5"><div className="avatar-token">SD</div><h3 className="mt-3 font-semibold">Siddhant</h3><p className="text-xs text-primary">Early contributor</p><p className="mt-2 text-sm text-muted-foreground">Helped shape the project through late nights, experiments and the original product build.</p></CardContent></Card></div></section>
      </div>
    </main>
  );
}

function TeamCard({ person, className = "" }: { person: typeof core[number]; className?: string }) {
  return <Card className={className}><CardContent className="pt-6 text-center"><div className="avatar-token mx-auto">{person.initials}</div><h2 className="mt-4 text-lg font-semibold">{person.name}</h2><p className="mt-1 text-xs font-medium text-primary">{person.title}</p><p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">{person.bio}</p></CardContent></Card>;
}
