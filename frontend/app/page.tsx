"use client";

import Button from "@cloudscape-design/components/button";

export default function Home() {
  return (
    <main style={{ padding: "2rem" }}>
      <h1>Scaler — Phase 0</h1>
      <p>Cloudscape component library loaded successfully.</p>
      <Button variant="primary" id="cloudscape-smoke-test-btn">
        Cloudscape Button ✓
      </Button>
    </main>
  );
}
