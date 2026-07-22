import {
  LayoutDashboard,
  Inbox,
  MessageCircle,
  Camera,
  Users,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

// Foundation shell — one entry per eventual product area. Pages are
// placeholders until each workflow gets built out for real. All dashboard
// routes live under /admin (22 July 2026, Morgan's call) rather than at
// the site root.
export const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Enquiries", href: "/admin/enquiries", icon: Inbox },
  { label: "Live Chat", href: "/admin/live-chat", icon: MessageCircle },
  { label: "Social", href: "/admin/social", icon: Camera },
  { label: "Leads", href: "/admin/leads", icon: Users },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];
