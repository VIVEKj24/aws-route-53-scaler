"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { FlashbarProps } from "@cloudscape-design/components/flashbar";

export type NotificationType = "success" | "error" | "warning" | "info";

export interface NotifyOptions {
  type: NotificationType;
  content: string;
}

interface NotificationContextType {
  notify: (options: NotifyOptions) => void;
  items: ReadonlyArray<FlashbarProps.MessageDefinition>;
  dismiss: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<FlashbarProps.MessageDefinition[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const dismiss = useCallback((id: string) => {
    // Clear timer if active
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }

    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback(
    ({ type, content }: NotifyOptions) => {
      const id = `notification-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 9)}`;

      const newItem: FlashbarProps.MessageDefinition = {
        id,
        type,
        content,
        dismissible: true,
        dismissLabel: "Dismiss",
        onDismiss: () => dismiss(id),
      };

      setItems((prev) => [...prev, newItem]);

      if (type === "success") {
        const timer = setTimeout(() => {
          dismiss(id);
        }, 5000);
        timersRef.current.set(id, timer);
      }
    },
    [dismiss]
  );

  useEffect(() => {
    const activeTimers = timersRef.current;
    return () => {
      activeTimers.forEach((timer) => clearTimeout(timer));
      activeTimers.clear();
    };
  }, []);

  return (
    <NotificationContext.Provider value={{ notify, items, dismiss }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotify(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotify must be used within a NotificationProvider");
  }
  return context;
}
