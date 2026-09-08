"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useNotify } from "@/lib/notification-context";
import { useKeyboardShortcuts } from "@/lib/keyboard-shortcuts-context";
import AppLayout from "@cloudscape-design/components/app-layout";
import TopNavigation from "@cloudscape-design/components/top-navigation";
import SideNavigation from "@cloudscape-design/components/side-navigation";
import Flashbar from "@cloudscape-design/components/flashbar";
import { applyMode, Mode } from "@cloudscape-design/global-styles";
import { ShortcutsHelpModal } from "@/components/ShortcutsHelpModal";

export function AppLayoutShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { items } = useNotify();
  const pathname = usePathname();
  const router = useRouter();
  const {
    triggerSearch,
    triggerCreate,
    isHelpModalOpen,
    setHelpModalOpen,
  } = useKeyboardShortcuts();

  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Track the first key in a two-key sequence (g+h, g+d)
  const sequenceKeyRef = useRef<string | null>(null);
  const sequenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Theme initialisation ─────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme");
      const initialTheme = saved === "dark" ? "dark" : "light";
      setTheme(initialTheme);
      applyMode(initialTheme === "dark" ? Mode.Dark : Mode.Light);
      if (initialTheme === "dark") {
        document.documentElement.classList.add("awsui-dark-mode");
      } else {
        document.documentElement.classList.remove("awsui-dark-mode");
      }
    } catch {
      // localStorage may fail in private mode
    }
  }, []);

  // ── Global keyboard shortcut listener ────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target.tagName.toLowerCase();

      // Ignore when typing in an input/textarea/select or inside a modal/dialog
      const inEditableField =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target.isContentEditable;

      // Also ignore if a modal dialog is open (any [role="dialog"] in the DOM)
      // — except for "?" which closes the help modal itself (handled via onDismiss)
      const dialogOpen =
        isHelpModalOpen ||
        document.querySelector('[role="dialog"]') !== null;

      if (inEditableField) return;

      // Clear any pending sequence key after 1.5 s of inactivity
      const clearSequence = () => {
        if (sequenceTimerRef.current) clearTimeout(sequenceTimerRef.current);
        sequenceKeyRef.current = null;
        sequenceTimerRef.current = null;
      };

      const key = e.key;

      // ── Two-key sequences ────────────────────────────────────────────────────
      if (sequenceKeyRef.current === "g") {
        clearSequence();
        if (key === "h") {
          e.preventDefault();
          router.push("/hosted-zones");
          return;
        }
        if (key === "d") {
          e.preventDefault();
          router.push("/dashboard");
          return;
        }
        // Unknown second key — fall through to handle as first key
      }

      // If a modal is open, don't handle other shortcuts
      if (dialogOpen) return;

      if (key === "g") {
        // Start a sequence
        sequenceKeyRef.current = "g";
        if (sequenceTimerRef.current) clearTimeout(sequenceTimerRef.current);
        sequenceTimerRef.current = setTimeout(clearSequence, 1500);
        return;
      }

      if (key === "?") {
        e.preventDefault();
        setHelpModalOpen(true);
        return;
      }

      if (key === "/") {
        e.preventDefault();
        triggerSearch();
        return;
      }

      if (key === "n") {
        e.preventDefault();
        triggerCreate();
        return;
      }
    };

    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      if (sequenceTimerRef.current) clearTimeout(sequenceTimerRef.current);
    };
  }, [router, triggerSearch, triggerCreate, isHelpModalOpen, setHelpModalOpen]);

  // ── Theme toggle ─────────────────────────────────────────────────────────────
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem("theme", next);
    } catch {}
    applyMode(next === "dark" ? Mode.Dark : Mode.Light);
    if (next === "dark") {
      document.documentElement.classList.add("awsui-dark-mode");
    } else {
      document.documentElement.classList.remove("awsui-dark-mode");
    }
  };

  return (
    <div>
      <div id="top-navigation">
        <TopNavigation
          identity={{
            href: "/hosted-zones",
            title: "Route 53",
            onFollow: (e) => {
              e.preventDefault();
              router.push("/hosted-zones");
            },
          }}
          utilities={[
            {
              type: "button",
              iconName: "light-dark",
              text: theme === "dark" ? "Light mode" : "Dark mode",
              ariaLabel:
                theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
              onClick: toggleTheme,
            },
            {
              type: "button",
              iconName: "keyboard",
              text: "Shortcuts",
              ariaLabel: "Keyboard shortcuts (?)",
              onClick: () => setHelpModalOpen(true),
            },
            {
              type: "menu-dropdown",
              text: user?.username || "admin@example.com",
              iconName: "user-profile",
              onItemClick: (e) => {
                if (e.detail.id === "signout") {
                  logout();
                }
              },
              items: [{ id: "signout", text: "Sign out" }],
            },
          ]}
        />
      </div>
      <AppLayout
        headerSelector="#top-navigation"
        navigation={
          <SideNavigation
            activeHref={pathname}
            header={{
              href: "/hosted-zones",
              text: "Route 53",
            }}
            onFollow={(event) => {
              if (!event.detail.external) {
                event.preventDefault();
                router.push(event.detail.href);
              }
            }}
            items={[
              { type: "link", text: "Dashboard", href: "/dashboard" },
              { type: "link", text: "Hosted zones", href: "/hosted-zones" },
              { type: "link", text: "Health checks", href: "/health-checks" },
              {
                type: "link",
                text: "Traffic policies",
                href: "/traffic-policies",
              },
              { type: "link", text: "Resolver", href: "/resolver" },
              { type: "link", text: "Profiles", href: "/profiles" },
            ]}
          />
        }
        notifications={<Flashbar items={items} />}
        content={children}
        toolsHide
      />

      <ShortcutsHelpModal
        visible={isHelpModalOpen}
        onDismiss={() => setHelpModalOpen(false)}
      />
    </div>
  );
}

export default AppLayoutShell;
