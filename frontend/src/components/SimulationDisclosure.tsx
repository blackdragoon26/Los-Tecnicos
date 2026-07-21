import { FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function SimulationDisclosure({ text = "Digital twin simulation - projected households, not deployed customers" }: { text?: string }) {
  return (
    <Badge variant="outline" className="h-auto max-w-full gap-1.5 whitespace-normal border-amber-400/35 bg-amber-400/10 px-2.5 py-1.5 text-[10px] leading-tight text-amber-200">
      <FlaskConical className="h-3 w-3 shrink-0" />
      {text}
    </Badge>
  );
}
