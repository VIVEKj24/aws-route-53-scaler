"use client";

/**
 * frontend/lib/keyboard-shortcuts-context.tsx
 *
 * Provides a way for page-level table components to register keyboard shortcut
 * handlers that the global listener in AppLayout can invoke:
 *   - onSearch(): focus the search/filter input
 *   - onCreate(): open the "Create" modal
 *
 * Also exposes isHelpModalOpen / setHelpModalOpen so AppLayout can render the
 * ShortcutsHelpModal without the tables needing to know about it.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

interface ShortcutHandlers {
  onSearch?: () => void;
  onCreate?: () => void;
}

interface KeyboardShortcutsContextValue {
  /** Called by the global listener to fire the search shortcut. */
  triggerSearch: () => void;
  /** Called by the global listener to fire the create shortcut. */
  triggerCreate: () => void;
  /** Table components call this to register their handlers. Returns an unregister fn. */
  registerHandlers: (handlers: ShortcutHandlers) => () => void;
  /** Whether the shortcuts help modal is open. */
  isHelpModalOpen: boolean;
  setHelpModalOpen: (open: boolean) => void;
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextValue>({
  triggerSearch: () => {},
  triggerCreate: () => {},
  registerHandlers: () => () => {},
  isHelpModalOpen: false,
  setHelpModalOpen: () => {},
});

export function KeyboardShortcutsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const handlersRef = useRef<ShortcutHandlers>({});
  const [isHelpModalOpen, setHelpModalOpen] = useState(false);

  const registerHandlers = useCallback((handlers: ShortcutHandlers) => {
    handlersRef.current = handlers;
    return () => {
      handlersRef.current = {};
    };
  }, []);

  const triggerSearch = useCallback(() => {
    handlersRef.current.onSearch?.();
  }, []);

  const triggerCreate = useCallback(() => {
    handlersRef.current.onCreate?.();
  }, []);

  return (
    <KeyboardShortcutsContext.Provider
      value={{
        triggerSearch,
        triggerCreate,
        registerHandlers,
        isHelpModalOpen,
        setHelpModalOpen,
      }}
    >
      {children}
    </KeyboardShortcutsContext.Provider>
  );
}

export function useKeyboardShortcuts() {
  return useContext(KeyboardShortcutsContext);
}
