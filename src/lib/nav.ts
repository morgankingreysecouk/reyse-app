import {
  LayoutDashboard,
  Inbox,
  MessageCircle,
  Camera,
  Users,
  BarChart3,
  Settings,
  Mic,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

// Foundation shell — one entry per eventual product area. Pages are
// placeholders until each workflow gets built out for real.
export const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "Enquiries", href: "/enquiries", icon: Inbox },
  { label: "Live Chat", href: "/live-chat", icon: MessageCircle },
  { label: "Talk to Rey", href: "/talk", icon: Mic },
  { label: "Instagram", href: "/instagram", icon: Camera },
  { label: "Leads", href: "/leads", icon: Users },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];
