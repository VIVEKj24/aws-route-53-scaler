"use client";

import React from "react";
import Header from "@cloudscape-design/components/header";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";

export default function HealthChecksPage() {
  return (
    <ContentLayout header={<Header variant="h1">Health checks</Header>}>
      <Container>
        <p>Health checks view coming soon.</p>
      </Container>
    </ContentLayout>
  );
}
