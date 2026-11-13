'use client';

import {
  Activity,
  BookOpen,
  ChevronsUpDown,
  Code2,
  FolderKanban,
  Globe,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Monitor,
  Moon,
  Plug,
  Plus,
  ScrollText,
  Settings,
  Sun,
  Table2,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import type { ComponentProps } from 'react';
import { Logo } from '@/components/logo';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { authClient } from '@/lib/auth-client';

export interface NavProject {
  id: string;
  name: string;
  status: 'pending' | 'active' | 'removed';
}

export interface NavUser {
  name: string;
  email: string;
  operator: { scope: 'all' | 'demo'; readOnly: boolean } | null;
}

const PROJECT_VIEWS = [
  { suffix: '', label: 'Web analytics', icon: Globe },
  { suffix: '/api', label: 'API analytics', icon: Activity },
  { suffix: '/setup', label: 'Website snippet', icon: Code2 },
  { suffix: '/instrument', label: 'API setup', icon: Plug },
  { suffix: '/settings', label: 'Settings', icon: Settings },
] as const;

const OPERATOR_VIEWS = [
  { href: '/operator', label: 'Overview', icon: LayoutDashboard },
  { href: '/operator/projects', label: 'Projects', icon: Table2 },
  { href: '/operator/api-keys', label: 'API keys', icon: KeyRound },
  { href: '/operator/audit', label: 'Audit log', icon: ScrollText },
  { href: '/operator/api-docs', label: 'API docs', icon: BookOpen },
] as const;

const initials = (name: string, email: string) =>
  (name.trim() || email)
    .split(/[\s@.]+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

export function AppSidebar({
  user,
  projects,
  ...props
}: ComponentProps<typeof Sidebar> & { user: NavUser; projects: NavProject[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const activeProject = projects.find((p) => pathname.startsWith(`/projects/${p.id}`));

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/projects" />}>
              <Logo />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Projects</SidebarGroupLabel>
          <SidebarGroupAction render={<Link href="/projects/new" />} title="New project">
            <Plus />
            <span className="sr-only">New project</span>
          </SidebarGroupAction>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === '/projects'}
                tooltip="All projects"
                render={<Link href="/projects" />}
              >
                <FolderKanban />
                <span>All projects</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {projects.map((p) => {
              const open = activeProject?.id === p.id;
              return (
                <SidebarMenuItem key={p.id}>
                  <SidebarMenuButton
                    isActive={open && pathname === `/projects/${p.id}`}
                    tooltip={p.name}
                    render={<Link href={`/projects/${p.id}`} />}
                  >
                    <span className="flex size-4 items-center justify-center rounded-sm bg-muted text-[10px] font-semibold">
                      {p.name[0]?.toUpperCase()}
                    </span>
                    <span className="truncate">{p.name}</span>
                    {p.status === 'pending' && (
                      <Badge variant="outline" className="ml-auto">
                        Pending
                      </Badge>
                    )}
                  </SidebarMenuButton>
                  {open && (
                    <SidebarMenuSub>
                      {PROJECT_VIEWS.map((v) => {
                        const href = `/projects/${p.id}${v.suffix}`;
                        return (
                          <SidebarMenuSubItem key={v.suffix}>
                            <SidebarMenuSubButton
                              isActive={pathname === href}
                              render={<Link href={href} />}
                            >
                              <v.icon />
                              <span>{v.label}</span>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>

        {user.operator && (
          <SidebarGroup>
            <SidebarGroupLabel>
              Operator{user.operator.scope === 'demo' ? ' · demo' : ''}
            </SidebarGroupLabel>
            <SidebarMenu>
              {OPERATOR_VIEWS.map((v) => (
                <SidebarMenuItem key={v.href}>
                  <SidebarMenuButton
                    isActive={
                      v.href === '/operator'
                        ? pathname === '/operator' || pathname === '/operator/compare'
                        : pathname.startsWith(v.href)
                    }
                    tooltip={v.label}
                    render={<Link href={v.href} />}
                  >
                    <v.icon />
                    <span>{v.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger render={<SidebarMenuButton size="lg" />}>
                <Avatar className="size-8 rounded-lg">
                  <AvatarFallback className="rounded-lg">
                    {initials(user.name, user.email)}
                  </AvatarFallback>
                </Avatar>
                <span className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                </span>
                <ChevronsUpDown className="ml-auto" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="min-w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      {theme === 'dark' ? <Moon /> : theme === 'light' ? <Sun /> : <Monitor />}
                      Theme
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuRadioGroup
                        value={theme ?? 'system'}
                        onValueChange={(v) => setTheme(String(v))}
                      >
                        <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onClick={async () => {
                      await authClient.signOut();
                      router.push('/');
                      router.refresh();
                    }}
                  >
                    <LogOut />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
