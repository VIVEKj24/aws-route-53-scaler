"use client";

import React, { Suspense, useEffect, useState } from "react";
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
import { apiFetch, ApiError } from "@/lib/api";
import { HostedZone } from "@/lib/hooks/use-hosted-zones";
import RecordsTable from "@/components/records/RecordsTable";

export default function ZoneDetailPage() {
  const params = useParams();
  const router = useRouter();
  const zoneId = params?.id as string;

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
          <RecordsTable zoneId={zone.id} zoneName={zone.name} />
        </Suspense>
      </SpaceBetween>
    </ContentLayout>
  );
}
