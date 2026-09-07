"use client";

import React, { useEffect, useState } from "react";
import Modal from "@cloudscape-design/components/modal";
import Button from "@cloudscape-design/components/button";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import { apiFetch } from "@/lib/api";
import { useNotify } from "@/lib/notification-context";
import { HostedZone } from "@/lib/hooks/use-hosted-zones";

export interface BulkDeleteZonesModalProps {
  visible: boolean;
  zones: HostedZone[];
  onDismiss: () => void;
  onSuccess: () => void;
}

export function BulkDeleteZonesModal({
  visible,
  zones,
  onDismiss,
  onSuccess,
}: BulkDeleteZonesModalProps) {
  const { notify } = useNotify();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setError(null);
      setDeleting(false);
    }
  }, [visible]);

  if (!visible || zones.length === 0) {
    return null;
  }

  const handleDelete = async () => {
    if (deleting) return;

    setDeleting(true);
    setError(null);
    let deletedCount = 0;

    try {
      for (const zone of zones) {
        await apiFetch(`/api/hosted-zones/${zone.id}`, {
          method: "DELETE",
        });
        deletedCount++;
      }

      notify({
        type: "success",
        content: `Deleted ${deletedCount} hosted ${
          deletedCount === 1 ? "zone" : "zones"
        }`,
      });
      onSuccess();
      onDismiss();
    } catch (err: any) {
      setError(
        `Failed after deleting ${deletedCount} of ${zones.length} zones: ${
          err?.message || "Unknown error"
        }`
      );
      onSuccess(); // refresh table with whatever was deleted
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      header={`Delete selected hosted zones (${zones.length})`}
      closeAriaLabel="Close modal"
      footer={
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.5rem",
          }}
        >
          <Button variant="link" onClick={onDismiss} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleDelete}
            loading={deleting}
            disabled={deleting}
          >
            Delete
          </Button>
        </div>
      }
    >
      <SpaceBetween size="m">
        <Alert type="warning" statusIconAriaLabel="Warning">
          This action cannot be undone.
        </Alert>

        <Box variant="p">
          Are you sure you want to delete the following{" "}
          <strong>{zones.length}</strong> hosted zones? All associated DNS
          records will be permanently removed.
        </Box>

        <div
          style={{
            maxHeight: "180px",
            overflowY: "auto",
            backgroundColor: "rgba(0, 0, 0, 0.03)",
            padding: "0.5rem 1rem",
            borderRadius: "4px",
          }}
        >
          <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
            {zones.map((zone) => (
              <li key={zone.id}>
                <strong>{zone.name}</strong> ({zone.record_count} records)
              </li>
            ))}
          </ul>
        </div>

        {error && (
          <Alert type="error" dismissible onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}
      </SpaceBetween>
    </Modal>
  );
}

export default BulkDeleteZonesModal;
