"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Button from "@cloudscape-design/components/button";
import Alert from "@cloudscape-design/components/alert";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Box from "@cloudscape-design/components/box";
import SpaceBetween from "@cloudscape-design/components/space-between";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { user, loading: authLoading, login } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/hosted-zones");
    }
  }, [authLoading, user, router]);

  const handleSubmit = async () => {
    if (submitting) return;

    setError(null);
    setSubmitting(true);

    try {
      await login(username, password);
      router.replace("/hosted-zones");
    } catch (err: any) {
      setError(err?.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        backgroundColor: "#f2f3f3",
        padding: "1.5rem",
      }}
    >
      <div style={{ width: "100%", maxWidth: "460px" }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
          <SpaceBetween size="m">
            {error && (
              <Alert
                type="error"
                dismissible
                onDismiss={() => setError(null)}
                header="Sign in failed"
              >
                {error}
              </Alert>
            )}
            <Container
              header={
                <Header variant="h2" description="Sign in with your administrator account">
                  Route 53
                </Header>
              }
            >
              <Form
                actions={
                  <Button
                    variant="primary"
                    loading={submitting}
                    disabled={submitting}
                    onClick={() => void handleSubmit()}
                  >
                    Sign in
                  </Button>
                }
              >
                <SpaceBetween size="l">
                  <FormField label="Username">
                    <Input
                      value={username}
                      onChange={({ detail }) => setUsername(detail.value)}
                      placeholder="admin@example.com"
                      disabled={submitting}
                      autoFocus
                    />
                  </FormField>
                  <FormField label="Password">
                    <Input
                      type="password"
                      value={password}
                      onChange={({ detail }) => setPassword(detail.value)}
                      placeholder="Enter password"
                      disabled={submitting}
                    />
                  </FormField>
                  <Box variant="small" color="text-body-secondary">
                    Demo credentials: admin@example.com / Password123!
                  </Box>
                </SpaceBetween>
              </Form>
            </Container>
          </SpaceBetween>
        </form>
      </div>
    </div>
  );
}
