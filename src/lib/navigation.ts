import {
  BarChart3,
  ClipboardCheck,
  FileText,
  LockKeyhole,
  Route,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Wrench,
} from "lucide-react";

export const navItems = [
  { label: "Dashboard", href: "/", icon: BarChart3 },
  { label: "Projects", href: "/projects", icon: FileText },
  { label: "Trace Import", href: "/trace-import", icon: UploadCloud },
  { label: "Eval Builder", href: "/eval-builder", icon: Sparkles },
  { label: "Graders", href: "/graders", icon: ShieldCheck },
  { label: "Prompt Optimizer", href: "/prompt-optimizer", icon: Wrench },
  { label: "Routing & Caching", href: "/routing-caching", icon: Route },
  { label: "Reports", href: "/reports", icon: ClipboardCheck },
  { label: "Settings", href: "/settings", icon: LockKeyhole },
];
