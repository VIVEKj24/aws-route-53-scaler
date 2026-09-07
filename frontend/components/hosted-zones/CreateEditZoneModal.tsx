"use client";

import React, { useEffect, useState } from "react";
import Modal from "@cloudscape-design/components/modal";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Textarea from "@cloudscape-design/components/textarea";
import RadioGroup from "@cloudscape-design/components/radio-group";
import Button from "@cloudscape-design/components/button";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Alert from "@cloudscape-design/components/alert";
import { apiFetch, ApiError } from "@/lib/api";
import { useNotify } from "@/lib/notification-context";
import { HostedZone } from "@/lib/hooks/use-hosted-zones";

export interface CreateEditZoneModalProps {
  visible: boolean;
  zoneToEdit?: HostedZone | null;
  onDismiss: () => void;
  onSuccess: () => void;
}

export function CreateEditZoneModal({
  visible,
  zoneToEdit,
  onDismiss,
  onSuccess,
}: CreateEditZoneModalProps) {
  const isEdit = Boolean(zoneToEdit);
  const { notify } = useNotify();

  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [zoneType, setZoneType] = useState("public");
  const [domainError, setDomainError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      if (zoneToEdit) {
        setName(zoneToEdit.name);
        setComment(zoneToEdit.comment || "");
      } else {
        setName("");
        setComment("");
      }
      setZoneType("public");
      setDomainError(null);
      setGeneralError(null);
      setSubmitting(false);
    }
  }, [visible, zoneToEdit]);

  const handleSubmit = async () => {
    if (submitting) return;

    setDomainError(null);
    setGeneralError(null);

    const trimmedName = name.trim();
    if (!isEdit && !trimmedName) {
      setDomainError("Domain name is required.");
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit && zoneToEdit) {
        await apiFetch<HostedZone>(`/api/hosted-zones/${zoneToEdit.id}`, {
          method: "PUT",
          body: {
            comment: comment.trim() || null,
          },
        });
        notify({
          type: "success",
          content: `Hosted zone '${zoneToEdit.name}' updated`,
        });
      } else {
        await apiFetch<HostedZone>("/api/hosted-zones", {
          method: "POST",
          body: {
            name: trimmedName,
            comment: comment.trim() || null,
          },
        });
        notify({
          type: "success",
          content: `Hosted zone '${trimmedName}' created`,
        });
      }

      onSuccess();
      onDismiss();
    } catch (err: any) {
      if (err instanceof ApiError && (err.status === 400 || err.status === 409)) {
        setDomainError(err.message);
      } else {
        setGeneralError(err?.message || "An unexpected error occurred.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      header={isEdit ? "Edit hosted zone" : "Create hosted zone"}
      closeAriaLabel="Close modal"
      footer={
        <BoxActions
          onCancel={onDismiss}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitText={isEdit ? "Save changes" : "Create hosted zone"}
        />
      }
    >
      <Form>
        <SpaceBetween size="l">
          {generalError && (
            <Alert type="error" dismissible onDismiss={() => setGeneralError(null)}>
              {generalError}
            </Alert>
          )}

          <FormField
            label="Domain name"
            description={
              isEdit
                ? "The domain name cannot be modified after creation."
                : "The name of the domain that you want to route traffic for."
            }
            constraintText={!isEdit ? "e.g. example.com" : undefined}
            errorText={domainError}
          >
            <Input
              value={name}
              onChange={({ detail }) => {
                setName(detail.value);
                if (domainError) setDomainError(null);
              }}
              placeholder="e.g. example.com"
              disabled={isEdit || submitting}
              autoFocus={!isEdit}
            />
          </FormField>

          <FormField
            label="Comment"
            description="Optional comment or description for this hosted zone."
          >
            <Textarea
              value={comment}
              onChange={({ detail }) => setComment(detail.value)}
              placeholder="Enter optional description"
              disabled={submitting}
            />
          </FormField>

          <FormField
            label="Type"
            description="Choose the type of hosted zone that you want to create."
          >
            <RadioGroup
              value={zoneType}
              onChange={({ detail }) => setZoneType(detail.value)}
              items={[
                {
                  value: "public",
                  label: "Public hosted zone",
                  description: "Routes internet traffic to your resources.",
                  disabled: isEdit || submitting,
                },
                {
                  value: "private",
                  label: "Private hosted zone",
                  description: "Not supported in this demo",
                  disabled: true,
                },
              ]}
            />
          </FormField>
        </SpaceBetween>
      </Form>
    </Modal>
  );
}

function BoxActions({
  onCancel,
  onSubmit,
  submitting,
  submitText,
}: {
  onCancel: () => void;
  onSubmit: () => void;
  submitting: boolean;
  submitText: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
      <Button variant="link" onClick={onCancel} disabled={submitting}>
        Cancel
      </Button>
      <Button
        variant="primary"
        onClick={onSubmit}
        loading={submitting}
        disabled={submitting}
      >
        {submitText}
      </Button>
    </div>
  );
}

export default CreateEditZoneModal;
