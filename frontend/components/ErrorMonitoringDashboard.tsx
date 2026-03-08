"use client";

import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';

interface ErrorStats {
  criticalErrors: number;
  totalErrors: number;
  lastError: string | null;
  recentErrors: Array<{
    timestamp: string;
    severity: string;
    type: string;
    details: string;
  }>;
  errorsByType: Record<string, number>;
  errorsByHour: Record<string, number>;
}

interface HealthStatus {
  logFileExists: boolean;
  logFileSize: number;
  lastChecked: string;
  sentryConfigured: boolean;
  webhookConfigured: boolean;
  emailConfigured: boolean;
  adminChatConfigured: boolean;
}

interface ErrorMonitoringData {
  success: boolean;
  errorStats: ErrorStats;
  healthStatus: HealthStatus;
  recommendations: string[];
}

export default function ErrorMonitoringDashboard() {
  const [data, setData] = useState<ErrorMonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchErrorData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchErrorData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchErrorData = async () => {
    try {
      const response = await fetch('/api/admin/error-monitoring');
      const result = await response.json();
      
      if (result.success) {
        setData(result);
        setError(null);
      } else {
        setError(result.error || 'Failed to fetch error data');
      }
    } catch (err) {
      setError('Network error while fetching error data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-sm border">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-2 text-red-700">
          <XCircle className="w-5 h-5" />
          <span className="font-medium">Error Monitoring Unavailable</span>
        </div>
        <p className="text-red-600 mt-2">{error}</p>
        <button 
          onClick={fetchErrorData}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { errorStats, healthStatus, recommendations } = data;

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Error Monitoring</h2>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Clock className="w-4 h-4" />
          Last updated: {new Date(healthStatus.lastChecked).toLocaleTimeString()}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Errors</p>
              <p className="text-2xl font-bold text-gray-900">{errorStats.totalErrors}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Critical Errors</p>
              <p className="text-2xl font-bold text-red-600">{errorStats.criticalErrors}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Log File Size</p>
              <p className="text-2xl font-bold text-gray-900">{formatFileSize(healthStatus.logFileSize)}</p>
            </div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              healthStatus.logFileExists ? 'bg-green-100' : 'bg-red-100'
            }`}>
              {healthStatus.logFileExists ? 
                <CheckCircle className="w-5 h-5 text-green-600" /> : 
                <XCircle className="w-5 h-5 text-red-600" />
              }
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Last Error</p>
              <p className="text-sm font-medium text-gray-900">
                {errorStats.lastError ? 
                  new Date(errorStats.lastError).toLocaleString() : 
                  'No errors'
                }
              </p>
            </div>
            <Clock className="w-8 h-8 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Health Status */}
      <div className="bg-white p-6 rounded-lg border shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Monitoring Health</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Sentry', configured: healthStatus.sentryConfigured },
            { label: 'Webhook', configured: healthStatus.webhookConfigured },
            { label: 'Email', configured: healthStatus.emailConfigured },
            { label: 'Telegram', configured: healthStatus.adminChatConfigured },
          ].map(({ label, configured }) => (
            <div key={label} className="flex items-center gap-2">
              {configured ? 
                <CheckCircle className="w-5 h-5 text-green-600" /> : 
                <XCircle className="w-5 h-5 text-red-600" />
              }
              <span className={`text-sm ${configured ? 'text-green-700' : 'text-red-700'}`}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Errors */}
      {errorStats.recentErrors.length > 0 && (
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Recent Errors</h3>
          <div className="space-y-3">
            {errorStats.recentErrors.slice(0, 5).map((error, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <span className={`px-2 py-1 text-xs font-medium rounded ${getSeverityColor(error.severity)}`}>
                  {error.severity}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{error.type}</p>
                  <p className="text-xs text-gray-500">{new Date(error.timestamp).toLocaleString()}</p>
                  {error.details && (
                    <p className="text-xs text-gray-600 mt-1 truncate">{error.details}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Recommendations</h3>
          <ul className="space-y-2">
            {recommendations.map((rec, index) => (
              <li key={index} className="text-sm text-blue-800 flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}