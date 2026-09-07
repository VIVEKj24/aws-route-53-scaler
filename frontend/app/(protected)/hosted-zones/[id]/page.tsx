"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import ContentLayout from "@cloudscape-design/components/content-layout";
import BreadcrumbGroup from "@cloudscape-design/components/breadcrumb-group";
import Header from "@cloudscape-design/components/header";
import Container from "@cloudscape-design/components/container";
import Box from "@cloudscape-design/components/box";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Alert from "@cloudscape-design/components/alert";
import Spinner from "@cloudscape-design/components/spinner";
import Badge from "@cloudscape-design/components/badge";
import Button from "@cloudscape-design/components/button";
import ButtonDropdown from "@cloudscape-design/components/button-dropdown";
import { apiFetch, ApiError } from "@/lib/api";
import { useNotify } from "@/lib/notification-context";
import { HostedZone } from "@/lib/hooks/use-hosted-zones";
import RecordsTable from "@/components/records/RecordsTable";

export default function ZoneDetailPage() {
  const params = useParams();
  const router = useRouter();
  const zoneId = params?.id as string;
  const { notify } = useNotify();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [zone, setZone] = useState<HostedZone | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!zoneId) return;

    setLoading(true);
    setNotFound(false);
    setError(null);

    apiFetch<HostedZone>(`/api/hosted-zones/${zoneId}`)
      .then((data) => {
        setZone(data);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setError(err?.message || "Failed to load hosted zone details");
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [zoneId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/hosted-zones/${zoneId}/import`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to import zone file");
      }

      const data = await res.json();
      if (data.skipped && data.skipped.length > 0) {
        notify({
          type: "warning",
          content: `Imported ${data.imported} records (${data.skipped.length} skipped: ${data.skipped[0]})`,
        });
      } else {
        notify({
          type: "success",
          content: `Successfully imported ${data.imported} records`,
        });
      }

      setRefreshKey((prev) => prev + 1);
      const updatedZone = await apiFetch<HostedZone>(`/api/hosted-zones/${zoneId}`);
      setZone(updatedZone);
    } catch (err: any) {
      notify({
        type: "error",
        content: err?.message || "Failed to import zone file",
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleExport = async ({ detail }: { detail: { id: string } }) => {
    if (!zone) return;
    setExporting(true);
    try {
      const res = await fetch(
        `/api/hosted-zones/${zoneId}/export?format=${detail.id}`,
        { credentials: "include" }
      );
      if (!res.ok) {
        throw new Error("Failed to export zone");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${zone.name}.${detail.id === "json" ? "json" : "zone"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      notify({
        type: "error",
        content: err?.message || "Export failed",
      });
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <ContentLayout>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "50vh",
          }}
        >
          <Spinner size="large" />
        </div>
      </ContentLayout>
    );
  }

  if (notFound) {
    return (
      <ContentLayout>
        <SpaceBetween size="l">
          <BreadcrumbGroup
            items={[
              { text: "Hosted zones", href: "/hosted-zones" },
              { text: "Not found", href: `/hosted-zones/${zoneId}` },
            ]}
            onFollow={(e) => {
              e.preventDefault();
              router.push(e.detail.href);
            }}
          />
          <Alert
            type="error"
            header="Hosted zone not found"
            action={
              <Link
                href="/hosted-zones"
                style={{ color: "#0972d3", fontWeight: 600 }}
              >
                Back to Hosted zones
              </Link>
            }
          >
            The requested hosted zone with ID {zoneId} does not exist or has been deleted.
          </Alert>
        </SpaceBetween>
      </ContentLayout>
    );
  }

  if (error || !zone) {
    return (
      <ContentLayout>
        <Alert type="error" header="Error loading zone">
          {error || "Unknown error occurred"}
        </Alert>
      </ContentLayout>
    );
  }

  return (
    <ContentLayout
      breadcrumbs={
        <BreadcrumbGroup
          items={[
            { text: "Hosted zones", href: "/hosted-zones" },
            { text: zone.name, href: `/hosted-zones/${zone.id}` },
          ]}
          onFollow={(e) => {
            e.preventDefault();
            router.push(e.detail.href);
          }}
        />
      }
      header={
        <Header
          variant="h1"
          description={`Zone configuration and DNS records for ${zone.name}`}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                accept=".zone,.txt,.bind,text/plain"
                onChange={handleFileChange}
              />
              <Button
                iconName="upload"
                loading={importing}
                onClick={() => fileInputRef.current?.click()}
              >
                Import
              </Button>
              <ButtonDropdown
                items={[
                  { id: "bind", text: "BIND zone file (.zone)" },
                  { id: "json", text: "JSON format (.json)" },
                ]}
                loading={exporting}
                onItemClick={handleExport}
              >
                Export
              </ButtonDropdown>
            </SpaceBetween>
          }
        >
          {zone.name}
        </Header>
      }
    >
      <SpaceBetween size="l">
        <Container header={<Header variant="h2">Hosted zone details</Header>}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "1.5rem",
            }}
          >
            <div>
              <Box variant="awsui-key-label">Hosted zone ID</Box>
              <Box variant="p">{zone.id}</Box>
            </div>
            <div>
              <Box variant="awsui-key-label">Record count</Box>
              <Box variant="p">{zone.record_count}</Box>
            </div>
            <div>
              <Box variant="awsui-key-label">Comment</Box>
              <Box variant="p">{zone.comment || "-"}</Box>
            </div>
            <div>
              <Box variant="awsui-key-label">Type</Box>
              <div>
                <Badge color="green">Public</Badge>
              </div>
            </div>
          </div>
        </Container>

        <Suspense
          fallback={
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "2rem",
              }}
            >
              <Spinner size="large" />
            </div>
          }
        >
          <RecordsTable key={refreshKey} zoneId={zone.id} zoneName={zone.name} />
        </Suspense>
      </SpaceBetween>
    </ContentLayout>
  );
}
