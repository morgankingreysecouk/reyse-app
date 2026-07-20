import { type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

export function PlaceholderPage({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="h-full flex items-center justify-center">
      <Card className="max-w-md text-center px-8 py-10">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo/10 text-indigo">
          <Icon size={22} />
        </div>
        <h2 className="font-display text-lg font-semibold text-ink mb-1.5">
          {title}
        </h2>
        <p className="text-sm text-ink-muted leading-relaxed">{description}</p>
      </Card>
    </div>
  );
}
