"use client";

import React, { useEffect, useState } from "react";
import Modal from "@cloudscape-design/components/modal";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Select from "@cloudscape-design/components/select";
import Textarea from "@cloudscape-design/components/textarea";
import Button from "@cloudscape-design/components/button";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import { apiFetch, ApiError } from "@/lib/api";
import { useNotify } from "@/lib/notification-context";
import { RecordItem } from "@/lib/hooks/use-records";

export interface CreateEditRecordModalProps {
  visible: boolean;
  zoneId: number;
  zoneName: string;
  recordToEdit?: RecordItem | null;
  onDismiss: () => void;
  onSuccess: () => void;
}

const RECORD_TYPES = [
  { value: "A", label: "A — IPv4 address" },
  { value: "AAAA", label: "AAAA — IPv6 address" },
  { value: "CNAME", label: "CNAME — Canonical name" },
  { value: "MX", label: "MX — Mail exchange" },
  { value: "NS", label: "NS — Name server" },
  { value: "PTR", label: "PTR — Pointer" },
  { value: "SRV", label: "SRV — Service locator" },
  { value: "TXT", label: "TXT — Text record" },
  { value: "CAA", label: "CAA — Certificate authority" },
];

function computeRecordName(subdomain: string, zone: string): string {
  const cleanSub = subdomain.trim().replace(/\.$/, "");
  const cleanZone = zone.trim().replace(/\.$/, "");
  if (!cleanSub || cleanSub === "@") {
    return cleanZone;
  }
  if (cleanSub === cleanZone || cleanSub.endsWith("." + cleanZone)) {
    return cleanSub;
  }
  return `${cleanSub}.${cleanZone}`;
}

interface MxRow {
  priority: string;
  host: string;
}

interface SrvRow {
  priority: string;
  weight: string;
  port: string;
  target: string;
}

interface CaaRow {
  flags: string;
  tag: string;
  value: string;
}

export function CreateEditRecordModal({
  visible,
  zoneId,
  zoneName,
  recordToEdit,
  onDismiss,
  onSuccess,
}: CreateEditRecordModalProps) {
  const isEdit = Boolean(recordToEdit);
  const isDefault = Boolean(recordToEdit?.is_default);
  const { notify } = useNotify();

  const [subdomain, setSubdomain] = useState("");
  const [editName, setEditName] = useState("");
  const [selectedType, setSelectedType] = useState(RECORD_TYPES[0]);
  const [ttl, setTtl] = useState("300");

  // Value states for different types
  const [textareaValues, setTextareaValues] = useState("");
  const [cnameValue, setCnameValue] = useState("");
  const [mxRows, setMxRows] = useState<MxRow[]>([{ priority: "10", host: "" }]);
  const [srvRows, setSrvRows] = useState<SrvRow[]>([
    { priority: "10", weight: "5", port: "5060", target: "" },
  ]);
  const [caaRows, setCaaRows] = useState<CaaRow[]>([
    { flags: "0", tag: "issue", value: "" },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [valuesError, setValuesError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;

    setNameError(null);
    setValuesError(null);
    setGeneralError(null);
    setSubmitting(false);

    if (recordToEdit) {
      setEditName(recordToEdit.name);
      setSubdomain(recordToEdit.name);
      const matchType =
        RECORD_TYPES.find((t) => t.value === recordToEdit.type) || {
          value: recordToEdit.type,
          label: recordToEdit.type,
        };
      setSelectedType(matchType);
      setTtl(String(recordToEdit.ttl));

      // Parse existing values according to type
      const rtype = recordToEdit.type;
      const vals = recordToEdit.values || [];

      if (rtype === "CNAME") {
        setCnameValue(vals[0] || "");
      } else if (rtype === "MX") {
        const rows = vals.map((v) => {
          const parts = v.trim().split(/\s+/);
          return { priority: parts[0] || "10", host: parts.slice(1).join(" ") || "" };
        });
        setMxRows(rows.length ? rows : [{ priority: "10", host: "" }]);
      } else if (rtype === "SRV") {
        const rows = vals.map((v) => {
          const parts = v.trim().split(/\s+/);
          return {
            priority: parts[0] || "10",
            weight: parts[1] || "5",
            port: parts[2] || "5060",
            target: parts[3] || "",
          };
        });
        setSrvRows(rows.length ? rows : [{ priority: "10", weight: "5", port: "5060", target: "" }]);
      } else if (rtype === "CAA") {
        const rows = vals.map((v) => {
          const parts = v.trim().split(/\s+/);
          return {
            flags: parts[0] || "0",
            tag: parts[1] || "issue",
            value: parts.slice(2).join(" ") || "",
          };
        });
        setCaaRows(rows.length ? rows : [{ flags: "0", tag: "issue", value: "" }]);
      } else {
        setTextareaValues(vals.join("\n"));
      }
    } else {
      setSubdomain("");
      setEditName("");
      setSelectedType(RECORD_TYPES[0]);
      setTtl("300");
      setTextareaValues("");
      setCnameValue("");
      setMxRows([{ priority: "10", host: "" }]);
      setSrvRows([{ priority: "10", weight: "5", port: "5060", target: "" }]);
      setCaaRows([{ flags: "0", tag: "issue", value: "" }]);
    }
  }, [visible, recordToEdit]);

  const computedFinalName = isEdit
    ? editName.trim()
    : computeRecordName(subdomain, zoneName);

  const assembleValues = (): string[] => {
    const type = selectedType.value;
    if (type === "CNAME") {
      return cnameValue.trim() ? [cnameValue.trim()] : [];
    }
    if (type === "MX") {
      return mxRows
        .filter((r) => r.host.trim())
        .map((r) => `${r.priority.trim()} ${r.host.trim()}`);
    }
    if (type === "SRV") {
      return srvRows
        .filter((r) => r.target.trim())
        .map(
          (r) =>
            `${r.priority.trim()} ${r.weight.trim()} ${r.port.trim()} ${r.target.trim()}`
        );
    }
    if (type === "CAA") {
      return caaRows
        .filter((r) => r.value.trim())
        .map((r) => `${r.flags.trim()} ${r.tag.trim()} ${r.value.trim()}`);
    }
    // A, AAAA, NS, PTR, TXT
    return textareaValues
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  };

  const handleSubmit = async () => {
    if (submitting) return;

    setNameError(null);
    setValuesError(null);
    setGeneralError(null);

    const parsedTtl = parseInt(ttl, 10);
    if (isNaN(parsedTtl) || parsedTtl < 1) {
      setGeneralError("TTL must be a positive integer.");
      return;
    }

    const values = assembleValues();

    if (!isDefault && values.length === 0) {
      setValuesError("At least one value is required.");
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit && recordToEdit) {
        if (isDefault) {
          // Default records: only TTL can be updated
          await apiFetch(`/api/hosted-zones/${zoneId}/records/${recordToEdit.id}`, {
            method: "PUT",
            body: { ttl: parsedTtl },
          });
        } else {
          await apiFetch(`/api/hosted-zones/${zoneId}/records/${recordToEdit.id}`, {
            method: "PUT",
            body: {
              name: computedFinalName,
              ttl: parsedTtl,
              values,
            },
          });
        }
        notify({
          type: "success",
          content: `Record '${recordToEdit.name}' updated`,
        });
      } else {
        await apiFetch(`/api/hosted-zones/${zoneId}/records`, {
          method: "POST",
          body: {
            name: computedFinalName,
            type: selectedType.value,
            ttl: parsedTtl,
            values,
          },
        });
        notify({
          type: "success",
          content: `Record '${computedFinalName}' (${selectedType.value}) created`,
        });
      }

      onSuccess();
      onDismiss();
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 400) {
        // Show validation error inline near the values or name
        const msg = err.message || "Validation failed";
        if (msg.toLowerCase().includes("name")) {
          setNameError(msg);
        } else {
          setValuesError(msg);
        }
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
      header={
        isEdit
          ? `Edit record ${recordToEdit?.name}`
          : `Create record in ${zoneName}`
      }
      closeAriaLabel="Close modal"
      size="medium"
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <Button variant="link" onClick={onDismiss} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={submitting}
            disabled={submitting}
          >
            {isEdit ? "Save changes" : "Create record"}
          </Button>
        </div>
      }
    >
      <Form>
        <SpaceBetween size="l">
          {generalError && (
            <Alert type="error" dismissible onDismiss={() => setGeneralError(null)}>
              {generalError}
            </Alert>
          )}

          {/* Record Name */}
          <FormField
            label="Record name"
            description={
              isEdit
                ? isDefault
                  ? "Default record names cannot be modified."
                  : "Fully qualified record name."
                : `Enter subdomain prefix or leave blank for apex '${zoneName}'.`
            }
            errorText={nameError}
          >
            {isEdit ? (
              <Input
                value={editName}
                onChange={({ detail }) => {
                  setEditName(detail.value);
                  if (nameError) setNameError(null);
                }}
                disabled={isDefault || submitting}
              />
            ) : (
              <SpaceBetween size="xs">
                <Input
                  value={subdomain}
                  onChange={({ detail }) => {
                    setSubdomain(detail.value);
                    if (nameError) setNameError(null);
                  }}
                  placeholder="e.g. www (or leave empty)"
                  disabled={submitting}
                  autoFocus
                />
                <Box variant="small" color="text-body-secondary">
                  Full record name: <strong>{computedFinalName}</strong>
                </Box>
              </SpaceBetween>
            )}
          </FormField>

          {/* Record Type */}
          <FormField
            label="Record type"
            description={
              isEdit ? "Record type cannot be changed once created." : undefined
            }
          >
            <Select
              selectedOption={selectedType}
              onChange={({ detail }) => {
                setSelectedType(detail.selectedOption as any);
                setValuesError(null);
              }}
              options={RECORD_TYPES}
              disabled={isEdit || submitting}
            />
          </FormField>

          {/* TTL */}
          <FormField
            label="TTL (seconds)"
            description="Time to live, in seconds. Determines how long DNS resolvers cache this record."
          >
            <Input
              value={ttl}
              type="number"
              onChange={({ detail }) => setTtl(detail.value)}
              placeholder="300"
              disabled={submitting}
            />
          </FormField>

          {/* Values Input according to Type */}
          <FormField
            label="Value / Route traffic to"
            description={
              isDefault
                ? "Values of a default record cannot be modified."
                : getValueDescription(selectedType.value)
            }
            errorText={valuesError}
          >
            {isDefault ? (
              <Box variant="p" color="text-body-secondary">
                {recordToEdit?.values?.join(", ")}
              </Box>
            ) : (
              renderValueInput({
                type: selectedType.value,
                textareaValues,
                setTextareaValues,
                cnameValue,
                setCnameValue,
                mxRows,
                setMxRows,
                srvRows,
                setSrvRows,
                caaRows,
                setCaaRows,
                submitting,
                setValuesError,
              })
            )}
          </FormField>
        </SpaceBetween>
      </Form>
    </Modal>
  );
}

function getValueDescription(type: string): string {
  switch (type) {
    case "A":
      return "Enter IPv4 addresses, one per line (e.g. 192.0.2.1).";
    case "AAAA":
      return "Enter IPv6 addresses, one per line (e.g. 2001:db8::1).";
    case "CNAME":
      return "Enter the canonical domain name target (e.g. example.com). Exactly one value.";
    case "MX":
      return "Enter mail servers with priority numbers (e.g. 10 mail.example.com).";
    case "NS":
      return "Enter authoritative name server hostnames, one per line.";
    case "PTR":
      return "Enter the reverse lookup hostname target (e.g. host.example.com).";
    case "TXT":
      return "Enter text values, one per line (e.g. v=spf1 include:_spf.google.com ~all).";
    case "SRV":
      return "Enter service locator records with Priority, Weight, Port, and Target hostname.";
    case "CAA":
      return "Enter Certificate Authority Authorization records with Flags, Tag, and Value.";
    default:
      return "Enter record values.";
  }
}

function renderValueInput({
  type,
  textareaValues,
  setTextareaValues,
  cnameValue,
  setCnameValue,
  mxRows,
  setMxRows,
  srvRows,
  setSrvRows,
  caaRows,
  setCaaRows,
  submitting,
  setValuesError,
}: {
  type: string;
  textareaValues: string;
  setTextareaValues: (val: string) => void;
  cnameValue: string;
  setCnameValue: (val: string) => void;
  mxRows: MxRow[];
  setMxRows: React.Dispatch<React.SetStateAction<MxRow[]>>;
  srvRows: SrvRow[];
  setSrvRows: React.Dispatch<React.SetStateAction<SrvRow[]>>;
  caaRows: CaaRow[];
  setCaaRows: React.Dispatch<React.SetStateAction<CaaRow[]>>;
  submitting: boolean;
  setValuesError: (err: string | null) => void;
}) {
  if (type === "CNAME") {
    return (
      <Input
        value={cnameValue}
        onChange={({ detail }) => {
          setCnameValue(detail.value);
          setValuesError(null);
        }}
        placeholder="target.example.com"
        disabled={submitting}
      />
    );
  }

  if (type === "MX") {
    return (
      <SpaceBetween size="s">
        {mxRows.map((row, idx) => (
          <div
            key={idx}
            style={{
              display: "grid",
              gridTemplateColumns: "100px 1fr auto",
              gap: "0.5rem",
              alignItems: "center",
            }}
          >
            <Input
              type="number"
              value={row.priority}
              onChange={({ detail }) => {
                const next = [...mxRows];
                next[idx].priority = detail.value;
                setMxRows(next);
                setValuesError(null);
              }}
              placeholder="10"
              disabled={submitting}
            />
            <Input
              value={row.host}
              onChange={({ detail }) => {
                const next = [...mxRows];
                next[idx].host = detail.value;
                setMxRows(next);
                setValuesError(null);
              }}
              placeholder="mail.example.com"
              disabled={submitting}
            />
            {mxRows.length > 1 && (
              <Button
                variant="icon"
                iconName="close"
                onClick={() => setMxRows(mxRows.filter((_, i) => i !== idx))}
                disabled={submitting}
                ariaLabel="Remove MX row"
              />
            )}
          </div>
        ))}
        <Button
          onClick={() => setMxRows([...mxRows, { priority: "10", host: "" }])}
          disabled={submitting}
        >
          Add another value
        </Button>
      </SpaceBetween>
    );
  }

  if (type === "SRV") {
    return (
      <SpaceBetween size="s">
        {srvRows.map((row, idx) => (
          <div
            key={idx}
            style={{
              display: "grid",
              gridTemplateColumns: "80px 80px 90px 1fr auto",
              gap: "0.5rem",
              alignItems: "center",
            }}
          >
            <Input
              type="number"
              value={row.priority}
              onChange={({ detail }) => {
                const next = [...srvRows];
                next[idx].priority = detail.value;
                setSrvRows(next);
                setValuesError(null);
              }}
              placeholder="Priority"
              disabled={submitting}
            />
            <Input
              type="number"
              value={row.weight}
              onChange={({ detail }) => {
                const next = [...srvRows];
                next[idx].weight = detail.value;
                setSrvRows(next);
                setValuesError(null);
              }}
              placeholder="Weight"
              disabled={submitting}
            />
            <Input
              type="number"
              value={row.port}
              onChange={({ detail }) => {
                const next = [...srvRows];
                next[idx].port = detail.value;
                setSrvRows(next);
                setValuesError(null);
              }}
              placeholder="Port"
              disabled={submitting}
            />
            <Input
              value={row.target}
              onChange={({ detail }) => {
                const next = [...srvRows];
                next[idx].target = detail.value;
                setSrvRows(next);
                setValuesError(null);
              }}
              placeholder="target.example.com"
              disabled={submitting}
            />
            {srvRows.length > 1 && (
              <Button
                variant="icon"
                iconName="close"
                onClick={() => setSrvRows(srvRows.filter((_, i) => i !== idx))}
                disabled={submitting}
                ariaLabel="Remove SRV row"
              />
            )}
          </div>
        ))}
        <Button
          onClick={() =>
            setSrvRows([
              ...srvRows,
              { priority: "10", weight: "5", port: "5060", target: "" },
            ])
          }
          disabled={submitting}
        >
          Add another value
        </Button>
      </SpaceBetween>
    );
  }

  if (type === "CAA") {
    const tagOptions = [
      { value: "issue", label: "issue" },
      { value: "issuewild", label: "issuewild" },
      { value: "iodef", label: "iodef" },
    ];

    return (
      <SpaceBetween size="s">
        {caaRows.map((row, idx) => (
          <div
            key={idx}
            style={{
              display: "grid",
              gridTemplateColumns: "80px 140px 1fr auto",
              gap: "0.5rem",
              alignItems: "center",
            }}
          >
            <Input
              type="number"
              value={row.flags}
              onChange={({ detail }) => {
                const next = [...caaRows];
                next[idx].flags = detail.value;
                setCaaRows(next);
                setValuesError(null);
              }}
              placeholder="0"
              disabled={submitting}
            />
            <Select
              selectedOption={
                tagOptions.find((o) => o.value === row.tag) || tagOptions[0]
              }
              onChange={({ detail }) => {
                const next = [...caaRows];
                next[idx].tag = detail.selectedOption.value || "issue";
                setCaaRows(next);
                setValuesError(null);
              }}
              options={tagOptions}
              disabled={submitting}
            />
            <Input
              value={row.value}
              onChange={({ detail }) => {
                const next = [...caaRows];
                next[idx].value = detail.value;
                setCaaRows(next);
                setValuesError(null);
              }}
              placeholder="letsencrypt.org"
              disabled={submitting}
            />
            {caaRows.length > 1 && (
              <Button
                variant="icon"
                iconName="close"
                onClick={() => setCaaRows(caaRows.filter((_, i) => i !== idx))}
                disabled={submitting}
                ariaLabel="Remove CAA row"
              />
            )}
          </div>
        ))}
        <Button
          onClick={() =>
            setCaaRows([...caaRows, { flags: "0", tag: "issue", value: "" }])
          }
          disabled={submitting}
        >
          Add another value
        </Button>
      </SpaceBetween>
    );
  }

  // A, AAAA, NS, PTR, TXT
  return (
    <Textarea
      value={textareaValues}
      onChange={({ detail }) => {
        setTextareaValues(detail.value);
        setValuesError(null);
      }}
      placeholder={
        type === "A"
          ? "192.0.2.1\n192.0.2.2"
          : type === "AAAA"
          ? "2001:db8::1"
          : type === "NS"
          ? "ns1.example.com\nns2.example.com"
          : type === "PTR"
          ? "host.example.com"
          : "v=spf1 include:_spf.google.com ~all"
      }
      rows={4}
      disabled={submitting}
    />
  );
}

export default CreateEditRecordModal;
