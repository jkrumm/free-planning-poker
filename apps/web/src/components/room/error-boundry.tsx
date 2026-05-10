import React, { Component, type ReactNode } from 'react';

import { Button, Container, Text, Title } from '@mantine/core';

import { addBreadcrumb, captureError } from 'fpp/utils/app-error';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Add breadcrumb for error boundary catch
    addBreadcrumb(
      `Error boundary caught error in ${this.props.componentName ?? 'Unknown Component'}`,
      'error',
      {
        componentStack: errorInfo.componentStack?.substring(0, 100) ?? 'N/A',
        errorMessage: error.message,
      },
    );

    // Capture error with full context
    captureError(
      error,
      {
        component: this.props.componentName ?? 'ErrorBoundary',
        action: 'componentDidCatch',
        extra: {
          errorBoundary: 'true',
          componentStack: errorInfo.componentStack?.substring(0, 200) ?? 'N/A',
          hasComponentStack: !!errorInfo.componentStack,
        },
      },
      'critical', // Maps to 'fatal' level in Sentry
    );
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Container size="sm" py="xl">
          <div style={{ textAlign: 'center' }}>
            <Title order={2} mb="md">
              Something went wrong
            </Title>
            <Text size="lg" c="dimmed" mb="xl">
              We have been notified about this error and will fix it soon.
            </Text>
            <Button
              variant="outline"
              onClick={() => {
                this.setState({
                  hasError: false,
                  error: undefined,
                });
                window.location.reload();
              }}
            >
              Reload Page
            </Button>
          </div>
        </Container>
      );
    }

    return this.props.children;
  }
}
