"use client";

import React, { Suspense } from "react";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Spinner from "@cloudscape-design/components/spinner";
import HostedZonesTable from "@/components/hosted-zones/HostedZonesTable";

export default function HostedZonesPage() {
  return (
    <ContentLayout>
      <Suspense
        fallback={
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "4rem",
            }}
          >
            <Spinner size="large" />
          </div>
        }
      >
        <HostedZonesTable />
      </Suspense>
    </ContentLayout>
  );
}
