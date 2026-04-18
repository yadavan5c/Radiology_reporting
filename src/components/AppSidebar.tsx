import { useEffect, useState } from "react";
import { Activity, ClipboardPlus, Users, Pencil, Check, X } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type NavItem = {
  id: string;
  defaultTitle: string;
  url: string;
  icon: typeof Activity;
};

const NAV_ITEMS: NavItem[] = [
  { id: "ops", defaultTitle: "Ops Command Center", url: "/", icon: Activity },
  { id: "provider", defaultTitle: "Provider Portal", url: "/provider", icon: ClipboardPlus },
  { id: "radiologists", defaultTitle: "Radiologist Management", url: "/radiologists", icon: Users },
];

const STORAGE_KEY = "radiology.tab.titles";

function loadTitles(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setTitles(loadTitles());
  }, []);

  const persist = (next: Record<string, string>) => {
    setTitles(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const titleFor = (item: NavItem) => titles[item.id] ?? item.defaultTitle;

  const startEdit = (e: React.MouseEvent, item: NavItem) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingId(item.id);
    setDraft(titleFor(item));
  };

  const saveEdit = (item: NavItem) => {
    const value = draft.trim() || item.defaultTitle;
    persist({ ...titles, [item.id]: value });
    setEditingId(null);
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="px-3 py-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-primary to-[hsl(var(--primary-glow))] flex items-center justify-center shadow-[var(--shadow-glow)]">
            <Activity className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-sidebar-foreground">RAD Flow</span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Intelligence</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Workspace</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const isEditing = editingId === item.id;
                return (
                  <SidebarMenuItem key={item.id}>
                    {isEditing && !collapsed ? (
                      <div className="flex items-center gap-1 px-2 py-1">
                        <Input
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(item);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="h-8 text-sm"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 shrink-0"
                          onClick={() => saveEdit(item)}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 shrink-0"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <SidebarMenuButton asChild tooltip={titleFor(item)}>
                        <NavLink
                          to={item.url}
                          end
                          className="group/navitem flex items-center gap-2"
                          activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          {!collapsed && (
                            <>
                              <span className="flex-1 truncate">{titleFor(item)}</span>
                              <button
                                type="button"
                                onClick={(e) => startEdit(e, item)}
                                className="opacity-0 group-hover/navitem:opacity-100 transition-opacity rounded p-0.5 hover:bg-sidebar-border"
                                aria-label="Rename tab"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            </>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
