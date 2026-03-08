'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#050505] p-6 text-center">
          <div className="bg-[#111] border border-gray-800 p-8 rounded-2xl shadow-2xl max-w-md w-full">
            <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            
            <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-gray-400 mb-6">
              We encountered an unexpected error. Please try again or return to the home page.
            </p>

            {this.state.error && (
              <div className="bg-black/50 p-4 rounded-lg text-left mb-6 overflow-auto max-h-40 border border-gray-800">
                <code className="text-red-400 text-xs font-mono">
                  {this.state.error.message}
                </code>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReload}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
              
              <button
                onClick={this.handleHome}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-[#222] hover:bg-[#333] text-gray-300 rounded-xl font-medium transition-colors border border-gray-700 hover:border-gray-600"
              >
                <Home className="w-4 h-4" />
                Go Home
              </button>
            </div>
            
            <p className="text-xs text-gray-500 mt-8">
              Based on feature request #508
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
