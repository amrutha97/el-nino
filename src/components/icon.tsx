import type { LucideIcon } from "lucide-react";

/** 16px, stroke 2. Every control icon uses this and nothing else. */
export function Icon({ icon: Glyph }: { icon: LucideIcon }) {
  return <Glyph size={16} strokeWidth={2} aria-hidden="true" className="shrink-0" />;
}
