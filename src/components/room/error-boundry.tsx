import React, { Component, type ReactNode } from 'react';

import { Button, Container, Text, Title } from '@mantine/core';

import * as Sentry from '@sentry/nextjs';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorId?: string;
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
    // Capture error with Sentry and get the event ID for user reference
    const errorId = Sentry.withScope((scope) => {
      scope.setTag('component', this.props.componentName ?? 'ErrorBoundary');
      scope.setTag('errorBoundary', 'true');
      scope.setLevel('error');

      scope.setExtra('componentStack', errorInfo.componentStack);
      scope.setExtra('errorInfo', errorInfo);

      scope.addBreadcrumb({
        message: `Error boundary caught error in ${this.props.componentName ?? 'Unknown Component'}`,
        category: 'error',
        level: 'error',
        data: {
          componentStack: errorInfo.componentStack,
          errorMessage: error.message,
        },
      });

      return Sentry.captureException(error);
    });

    this.setState({ errorId });
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
            <Text size="lg" c="dimmed" mb="md">
              We have been notified about this error and will fix it soon.
            </Text>
            {this.state.errorId && (
              <Text size="sm" c="dimmed" mb="xl">
                Error ID: {this.state.errorId}
              </Text>
            )}
            <Button
              variant="outline"
              onClick={() => {
                this.setState({
                  hasError: false,
                  error: undefined,
                  errorId: undefined,
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
