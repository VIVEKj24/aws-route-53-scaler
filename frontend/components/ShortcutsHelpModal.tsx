"use client";

/**
 * frontend/components/ShortcutsHelpModal.tsx
 *
 * Keyboard shortcuts reference modal, opened by pressing "?".
 */

import React from "react";
import Modal from "@cloudscape-design/components/modal";
import Box from "@cloudscape-design/components/box";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Button from "@cloudscape-design/components/button";

interface ShortcutRow {
  keys: string[];
  description: string;
}

const SHORTCUTS: ShortcutRow[] = [
  { keys: ["/"], description: "Focus search / filter input" },
  { keys: ["n"], description: "Open Create modal" },
  { keys: ["g", "h"], description: "Go to Hosted Zones" },
  { keys: ["g", "d"], description: "Go to Dashboard" },
  { keys: ["?"], description: "Show this help dialog" },
];

interface ShortcutsHelpModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export function ShortcutsHelpModal({
  visible,
  onDismiss,
}: ShortcutsHelpModalProps) {
  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      header="Keyboard shortcuts"
      footer={
        <Box float="right">
          <Button variant="primary" onClick={onDismiss}>
            Close
          </Button>
        </Box>
      }
      size="small"
    >
      <SpaceBetween size="xs">
        {SHORTCUTS.map(({ keys, description }) => (
          <div
            key={keys.join("+")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
            }}
          >
            <span style={{ color: "var(--color-text-body-secondary, #5f6b7a)" }}>
              {description}
            </span>
            <span style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
              {keys.map((k, i) => (
                <React.Fragment key={i}>
                  <kbd
                    style={{
                      display: "inline-block",
                      padding: "2px 7px",
                      border: "1px solid var(--color-border-divider-default, #d1d5db)",
                      borderRadius: "4px",
                      background: "var(--color-background-container-header, #f4f4f4)",
                      fontFamily: "monospace",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      lineHeight: "1.5",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.12)",
                    }}
                  >
                    {k}
                  </kbd>
                  {i < keys.length - 1 && (
                    <span style={{ color: "#888", fontSize: "0.75rem", alignSelf: "center" }}>
                      then
                    </span>
                  )}
                </React.Fragment>
              ))}
            </span>
          </div>
        ))}
      </SpaceBetween>
    </Modal>
  );
}

export default ShortcutsHelpModal;
