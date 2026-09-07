"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Button from "@cloudscape-design/components/button";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Box from "@cloudscape-design/components/box";
import Icon from "@cloudscape-design/components/icon";

export interface ComingSoonProps {
  feature: string;
}

export function ComingSoon({ feature }: ComingSoonProps) {
  const router = useRouter();

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "55vh",
        padding: "2rem 1rem",
      }}
    >
      <div style={{ maxWidth: "540px", width: "100%" }}>
        <Container header={<Header variant="h2">{feature}</Header>}>
          <Box textAlign="center" padding={{ vertical: "l", horizontal: "s" }}>
            <SpaceBetween size="l">
              <Icon name="status-info" size="big" />
              <SpaceBetween size="xs">
                <Box variant="h3">
                  {feature} isn&apos;t available in this demo yet.
                </Box>
                <Box variant="p" color="text-body-secondary">
                  This feature is part of the broader AWS Route 53 management suite. In this demo environment, DNS configuration is focused on Hosted Zones and DNS Records.
                </Box>
              </SpaceBetween>
              <div>
                <Button
                  variant="primary"
                  onClick={() => router.push("/hosted-zones")}
                >
                  Go to Hosted zones
                </Button>
              </div>
            </SpaceBetween>
          </Box>
        </Container>
      </div>
    </div>
  );
}

export default ComingSoon;
