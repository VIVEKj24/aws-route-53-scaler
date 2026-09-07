"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import Container from "@cloudscape-design/components/container";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Box from "@cloudscape-design/components/box";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Button from "@cloudscape-design/components/button";
import Link from "@cloudscape-design/components/link";
import Spinner from "@cloudscape-design/components/spinner";
import Alert from "@cloudscape-design/components/alert";
import { apiFetch } from "@/lib/api";

interface DashboardStats {
  hosted_zones: number;
  records: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<DashboardStats>("/api/stats");
      setStats(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load dashboard statistics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          description="Route 53 global DNS overview"
        >
          Dashboard
        </Header>
      }
    >
      <SpaceBetween size="l">
        {error && (
          <Alert
            type="error"
            header="Error loading statistics"
            action={<Button onClick={fetchStats}>Retry</Button>}
          >
            {error}
          </Alert>
        )}

        {loading ? (
          <Container>
            <Box textAlign="center" padding={{ vertical: "xxl" }}>
              <Spinner size="large" />
              <Box variant="p" color="text-body-secondary" margin={{ top: "s" }}>
                Loading dashboard statistics...
              </Box>
            </Box>
          </Container>
        ) : stats ? (
          <>
            <ColumnLayout columns={3} variant="default">
              <Container header={<Header variant="h2">Hosted zones</Header>}>
                <SpaceBetween size="s">
                  <Box variant="awsui-value-large" fontSize="display-l" fontWeight="bold">
                    {stats.hosted_zones}
                  </Box>
                  <Box variant="p" color="text-body-secondary">
                    Total hosted zones configured in your account.
                  </Box>
                  <div>
                    <Link
                      href="/hosted-zones"
                      onFollow={(e) => {
                        e.preventDefault();
                        router.push("/hosted-zones");
                      }}
                    >
                      View hosted zones
                    </Link>
                  </div>
                </SpaceBetween>
              </Container>

              <Container header={<Header variant="h2">DNS records</Header>}>
                <SpaceBetween size="s">
                  <Box variant="awsui-value-large" fontSize="display-l" fontWeight="bold">
                    {stats.records}
                  </Box>
                  <Box variant="p" color="text-body-secondary">
                    Total DNS resource record sets across all hosted zones.
                  </Box>
                  <div>
                    <Link
                      href="/hosted-zones"
                      onFollow={(e) => {
                        e.preventDefault();
                        router.push("/hosted-zones");
                      }}
                    >
                      Manage records
                    </Link>
                  </div>
                </SpaceBetween>
              </Container>

              <Container header={<Header variant="h2">Name servers</Header>}>
                <SpaceBetween size="s">
                  <Box variant="awsui-value-large" fontSize="display-l" fontWeight="bold">
                    {stats.hosted_zones * 4}
                  </Box>
                  <Box variant="p" color="text-body-secondary">
                    Each hosted zone receives 4 default Anycast nameservers for resilient DNS resolution.
                  </Box>
                </SpaceBetween>
              </Container>
            </ColumnLayout>

            <Container header={<Header variant="h2">Get started</Header>}>
              <SpaceBetween size="m">
                <Box variant="p">
                  Amazon Route 53 is a highly available and scalable cloud Domain Name System (DNS) web service. Get started by creating your first hosted zone or managing your domain records.
                </Box>
                <ColumnLayout columns={2} variant="text-grid">
                  <SpaceBetween size="xs">
                    <Box variant="h3">1. Create a hosted zone</Box>
                    <Box variant="p" color="text-body-secondary">
                      A hosted zone contains records that tell the Domain Name System how to route traffic for a domain (such as example.com) and its subdomains.
                    </Box>
                    <div>
                      <Button
                        variant="primary"
                        onClick={() => router.push("/hosted-zones")}
                      >
                        Create hosted zone
                      </Button>
                    </div>
                  </SpaceBetween>
                  <SpaceBetween size="xs">
                    <Box variant="h3">2. Manage DNS records</Box>
                    <Box variant="p" color="text-body-secondary">
                      Configure standard and custom DNS records such as A, AAAA, CNAME, MX, TXT, and SRV to connect users to your websites and applications.
                    </Box>
                    <div>
                      <Button
                        onClick={() => router.push("/hosted-zones")}
                      >
                        Open hosted zones
                      </Button>
                    </div>
                  </SpaceBetween>
                </ColumnLayout>
              </SpaceBetween>
            </Container>
          </>
        ) : null}
      </SpaceBetween>
    </ContentLayout>
  );
}
