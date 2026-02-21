import stelltronLogo from "@/assets/stelltron-logo-new.png";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";

const teamMembers = [
  { name: "Sankalp", role: "Gemini CLI lover", bio: "Striving to work on the next big thing in decentralized energy trading.", initials: "SK" },
  { name: "Akarsh", role: "The Cheetah", bio: "The reliable last minute guy who always delivers under pressure.", initials: "AK" },
  { name: "Siddhant", role: "Cursor Pro Black Dealer", bio: "Sleep doesn't know him, hustling all day and night.", initials: "SD" },
];

export default function About() {
  return (
    <div className="min-h-screen pt-20 pb-12 px-4">
      <div className="container mx-auto max-w-3xl">
        <div className="text-center mb-14">
          <img
            src={stelltronLogo}
            alt="Stelltron"
            className="w-12 h-12 rounded-lg mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-foreground tracking-tight mb-2">Los Tecnicos</h1>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            A trio of tech enthusiasts building awesome things. Fueled by instant noodles and the thrill of hitting deploy.
          </p>
        </div>

        <Separator className="mb-10" />

        <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-mono text-center mb-6">The Team</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {teamMembers.map((member) => (
            <Card key={member.name} className="group hover:border-primary/30 transition-colors">
              <CardContent className="pt-6 text-center">
                <Avatar className="w-12 h-12 mx-auto mb-3">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                    {member.initials}
                  </AvatarFallback>
                </Avatar>
                <h3 className="text-sm font-bold text-foreground">{member.name}</h3>
                <Badge variant="outline" className="text-[9px] mt-1 border-primary/20 text-primary">{member.role}</Badge>
                <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{member.bio}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
