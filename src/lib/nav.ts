import {
  LayoutDashboard,
  Inbox,
  MessageCircle,
  Camera,
  Users,
  Building2,
  BarChart3,
  Settings,
  Mic,
  Mail,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

// One entry per product area. All dashboard routes live under /admin (22
// July 2026, Morgan's call) rather than at the site root. Every entry below
// routes to a real, built feature -- Leads (the last one) went live 5 Aug
// 2026 via PR #6.
export const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Enquiries", href: "/admin/enquiries", icon: Inbox },
  { label: "Mail", href: "/admin/mail", icon: Mail },
  { label: "Live Chat", href: "/admin/live-chat", icon: MessageCircle },
  { label: "Talk to Rey", href: "/admin/talk", icon: Mic },
  { label: "Social", href: "/admin/social", icon: Camera },
  // "Clients" = onboarded paying businesses using DM Automation (or a
  // future automation) -- distinct from "Leads" below, which is
  // prospective business that hasn't signed up yet. Easy to conflate at a
  // glance, so worth being explicit here.
  { label: "Clients", href: "/admin/clients", icon: Building2 },
  { label: "Leads", href: "/admin/leads", icon: Users },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];
