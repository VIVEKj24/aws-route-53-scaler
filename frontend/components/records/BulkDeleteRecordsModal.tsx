"use client";

import React, { useEffect, useState } from "react";
import Modal from "@cloudscape-design/components/modal";
import Button from "@cloudscape-design/components/button";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Badge from "@cloudscape-design/components/badge";
import { apiFetch } from "@/lib/api";
import { useNotify } from "@/lib/notification-context";
import { RecordItem } from "@/lib/hooks/use-records";

export interface BulkDeleteRecordsModalProps {
  visible: boolean;
  zoneId: number | string;
  records: RecordItem[];
  onDismiss: () => void;
  onSuccess: () => void;
}

export function BulkDeleteRecordsModal({
  visible,
  zoneId,
  records,
  onDismiss,
  onSuccess,
}: BulkDeleteRecordsModalProps) {
  const { notify } = useNotify();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deletableRecords = records.filter((r) => !r.is_default);
  const defaultCount = records.length - deletableRecords.length;

  useEffect(() => {
    if (visible) {
      setError(null);
      setDeleting(false);
    }
  }, [visible]);

  if (!visible || records.length === 0) {
    return null;
  }

  const handleDelete = async () => {
    if (deleting || deletableRecords.length === 0) return;

    setDeleting(true);
    setError(null);
    let deletedCount = 0;

    try {
      for (const record of deletableRecords) {
        await apiFetch(`/api/hosted-zones/${zoneId}/records/${record.id}`, {
          method: "DELETE",
        });
        deletedCount++;
      }

      notify({
        type: "success",
        content: `Deleted ${deletedCount} ${
          deletedCount === 1 ? "record" : "records"
        }`,
      });
      onSuccess();
      onDismiss();
    } catch (err: any) {
      setError(
        `Failed after deleting ${deletedCount} of ${deletableRecords.length} records: ${
          err?.message || "Unknown error"
        }`
      );
      onSuccess();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      header={`Delete selected records (${deletableRecords.length})`}
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
            disabled={deleting || deletableRecords.length === 0}
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

        {defaultCount > 0 && (
          <Alert type="info" statusIconAriaLabel="Info">
            {defaultCount} default {defaultCount === 1 ? "record" : "records"}{" "}
            cannot be deleted and will be skipped.
          </Alert>
        )}

        <Box variant="p">
          Are you sure you want to delete the following{" "}
          <strong>{deletableRecords.length}</strong> DNS records?
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
            {deletableRecords.map((rec) => (
              <li key={rec.id} style={{ marginBottom: "0.25rem" }}>
                <strong>{rec.name}</strong>{" "}
                <Badge color="blue">{rec.type}</Badge>
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

export default BulkDeleteRecordsModal;
