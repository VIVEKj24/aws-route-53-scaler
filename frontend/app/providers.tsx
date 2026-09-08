"use client";

import React from "react";
import { NotificationProvider } from "@/lib/notification-context";
import { AuthProvider } from "@/lib/auth-context";
import { KeyboardShortcutsProvider } from "@/lib/keyboard-shortcuts-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NotificationProvider>
      <AuthProvider>
        <KeyboardShortcutsProvider>{children}</KeyboardShortcutsProvider>
      </AuthProvider>
    </NotificationProvider>
  );
}
