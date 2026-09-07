"use client";

import React, { useEffect, useState } from "react";
import Modal from "@cloudscape-design/components/modal";
import Button from "@cloudscape-design/components/button";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import { apiFetch } from "@/lib/api";
import { useNotify } from "@/lib/notification-context";
import { RecordItem } from "@/lib/hooks/use-records";

export interface DeleteRecordModalProps {
  visible: boolean;
  zoneId: number;
  record: RecordItem | null;
  onDismiss: () => void;
  onSuccess: () => void;
}

export function DeleteRecordModal({
  visible,
  zoneId,
  record,
  onDismiss,
  onSuccess,
}: DeleteRecordModalProps) {
  const { notify } = useNotify();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setError(null);
      setDeleting(false);
    }
  }, [visible]);

  if (!record) {
    return null;
  }

  const handleDelete = async () => {
    if (deleting) return;

    setDeleting(true);
    setError(null);
    try {
      await apiFetch(`/api/hosted-zones/${zoneId}/records/${record.id}`, {
        method: "DELETE",
      });
      notify({
        type: "success",
        content: `Record '${record.name}' (${record.type}) deleted`,
      });
      onSuccess();
      onDismiss();
    } catch (err: any) {
      const msg = err?.message || "Failed to delete record";
      setError(msg);
      notify({
        type: "error",
        content: msg,
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      header={`Delete record ${record.name}`}
      closeAriaLabel="Close modal"
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
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
          Are you sure you want to delete the record <strong>{record.name}</strong> of type <strong>{record.type}</strong>?
        </Box>

        {error && (
          <Alert type="error" dismissible onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}
      </SpaceBetween>
    </Modal>
  );
}

export default DeleteRecordModal;
