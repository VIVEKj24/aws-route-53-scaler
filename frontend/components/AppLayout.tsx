"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useNotify } from "@/lib/notification-context";
import AppLayout from "@cloudscape-design/components/app-layout";
import TopNavigation from "@cloudscape-design/components/top-navigation";
import SideNavigation from "@cloudscape-design/components/side-navigation";
import Flashbar from "@cloudscape-design/components/flashbar";

export function AppLayoutShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { items } = useNotify();
  const pathname = usePathname();
  const router = useRouter();

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
    </div>
  );
}

export default AppLayoutShell;
