import Link from "next/link";
import { Inbox, MessageCircle, Camera, Users } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";

// The very first screen Morgan sees on login. This used to be a static
// "foundation build, nothing real yet" placeholder left over from the 22
// July shell -- it never got updated as Enquiries, Live Chat, Social, and
// Analytics were actually built and wired to real data, so it was actively
// lying about the state of the product. Leads is the one area genuinely
// still unbuilt (see src/app/admin/leads/page.tsx).
async function getOverviewStats() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [newEnquiries, activeChats, igPostsThisWeek] = await Promise.all([
    db.enquiry.count({ where: { status: "NEW", isTest: false, deletedAt: null } }),
    db.chatConversation.count({ where: { status: "ACTIVE", deletedAt: null } }),
    db.socialPost.count({
      where: {
        platform: "INSTAGRAM",
        status: "PUBLISHED",
        deletedAt: null,
        publishedAt: { gte: sevenDaysAgo },
      },
    }),
  ]);

  return { newEnquiries, activeChats, igPostsThisWeek };
}

export default async function OverviewPage() {
  const stats = await getOverviewStats();

  const tiles = [
    { label: "New enquiries", value: stats.newEnquiries, icon: Inbox, href: "/admin/enquiries" },
    { label: "Active chats", value: stats.activeChats, icon: MessageCircle, href: "/admin/live-chat" },
    { label: "IG posts this week", value: stats.igPostsThisWeek, icon: Camera, href: "/admin/social" },
    { label: "Leads found", value: "—", icon: Users, href: "/admin/leads" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold text-ink">
          Overview
        </h1>
        <p className="text-sm text-ink-muted mt-1">
          A snapshot across everything Reyse is doing right now.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tiles.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="px-5 py-4 h-full hover:border-border-strong transition-colors">
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
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Build status</CardTitle>
          <Badge tone="success">live</Badge>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-ink-muted space-y-2">
            <li>✓ Enquiries — captures every lead, real Postgres data</li>
            <li>✓ Live Chat — Claude-powered widget on reyse.co.uk, real conversations</li>
            <li>✓ Social — generates and publishes to Instagram &amp; Facebook</li>
            <li>✓ Mail Assistant — reads and organises Morgan&rsquo;s inbox</li>
            <li>✓ Talk to Rey — voice conversation with the vault assistant</li>
            <li>✓ Analytics — real AI/subscription usage and cost</li>
            <li className="text-ink-faint">— Leads — prospect-finding tool: not started yet</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
