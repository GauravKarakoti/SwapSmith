'use client';

import React from 'react';
import toast from 'react-hot-toast';
import ErrorFallback from '@/components/ErrorFallback';

interface GlobalErrorBoundaryProps {
  children: React.ReactNode;
}

interface GlobalErrorBoundaryState {
  hasError: boolean;
}

export default class GlobalErrorBoundary extends React.Component<
  GlobalErrorBoundaryProps,
  GlobalErrorBoundaryState
> {
  state: GlobalErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): GlobalErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Global render error:', error, errorInfo);
    toast.error('The app hit an unexpected error. You can retry without losing the whole page.');
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          description="A rendering error interrupted this screen. Retry to recover, or go back to the homepage."
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}
