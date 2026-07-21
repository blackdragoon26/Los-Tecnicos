import { Award, ExternalLink } from "lucide-react";

export default function RecognitionBadge({ compact = false }: { compact?: boolean }) {
  return (
    <a
      href="https://stellar.org/"
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
      aria-label="Stellar APAC Winner, opens stellar.org"
    >
      <Award className="h-4 w-4" />
      Stellar APAC Winner
      {!compact && <ExternalLink className="h-3.5 w-3.5" />}
    </a>
  );
}
