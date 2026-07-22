import { Inbox, MessageCircle, Camera, Users } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STATS = [
  { label: "New enquiries", value: "—", icon: Inbox },
  { label: "Active chats", value: "—", icon: MessageCircle },
  { label: "IG posts this week", value: "—", icon: Camera },
  { label: "Leads found", value: "—", icon: Users },
];

export default function OverviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-ink">
          Overview
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          Foundation build — real numbers connect once each workflow is
          rebuilt.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((stat) => (
          <Card key={stat.label} className="px-5 py-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-muted uppercase tracking-wide">
                {stat.label}
              </span>
              <stat.icon size={16} className="text-ink-faint" />
            </div>
            <div className="mt-2 font-display text-2xl font-semibold text-ink">
              {stat.value}
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Foundation status</CardTitle>
          <Badge tone="indigo">v0 shell</Badge>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-ink-muted space-y-2">
            <li>✓ Auth — Google sign-in, locked to one account</li>
            <li>✓ Layout shell — sidebar, top bar, design tokens</li>
            <li>✓ Placeholder routes for every planned section</li>
            <li className="text-ink-faint">
              — Real data + workflows: not started yet
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
