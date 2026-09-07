"use client";

import React, { useEffect, useState } from "react";
import Modal from "@cloudscape-design/components/modal";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Button from "@cloudscape-design/components/button";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import { apiFetch } from "@/lib/api";
import { useNotify } from "@/lib/notification-context";
import { HostedZone } from "@/lib/hooks/use-hosted-zones";

export interface DeleteZoneModalProps {
  visible: boolean;
  zone: HostedZone | null;
  onDismiss: () => void;
  onSuccess: () => void;
}

export function DeleteZoneModal({
  visible,
  zone,
  onDismiss,
  onSuccess,
}: DeleteZoneModalProps) {
  const { notify } = useNotify();
  const [confirmInput, setConfirmInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setConfirmInput("");
      setError(null);
      setDeleting(false);
    }
  }, [visible]);

  if (!zone) {
    return null;
  }

  const isConfirmed = confirmInput.trim() === zone.name;

  const handleDelete = async () => {
    if (!isConfirmed || deleting) return;

    setDeleting(true);
    setError(null);
    try {
      await apiFetch(`/api/hosted-zones/${zone.id}`, {
        method: "DELETE",
      });
      notify({
        type: "success",
        content: `Hosted zone '${zone.name}' deleted`,
      });
      onSuccess();
      onDismiss();
    } catch (err: any) {
      setError(err?.message || "Failed to delete hosted zone");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      header={`Delete hosted zone ${zone.name}`}
      closeAriaLabel="Close modal"
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <Button variant="link" onClick={onDismiss} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleDelete}
            disabled={!isConfirmed || deleting}
            loading={deleting}
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
          This will permanently delete the hosted zone <strong>{zone.name}</strong> and all of its associated DNS records.
        </Box>

        {error && (
          <Alert type="error" dismissible onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        <FormField
          label={
            <span>
              To confirm deletion, type <i>{zone.name}</i> in the field below
            </span>
          }
        >
          <Input
            value={confirmInput}
            onChange={({ detail }) => setConfirmInput(detail.value)}
            placeholder={zone.name}
            disabled={deleting}
            autoFocus
          />
        </FormField>
      </SpaceBetween>
    </Modal>
  );
}

export default DeleteZoneModal;
