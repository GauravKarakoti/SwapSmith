import { useState, useEffect } from 'react';
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  ShieldX, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Info,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Lock,
  Unlock,
  Flame,
  Warning
} from 'lucide-react';
import { performSecurityScan, getRiskLevelLabel, getRiskScoreColor, type SecurityCheckResult } from '@/utils/security-scanner';

interface TransactionSecurityScannerProps {
  fromToken: string;
  fromNetwork: string;
  toToken: string;
  toNetwork: string;
  fromAmount: string;
  contractAddress?: string;
  userAddress?: string;
  userId?: string;
  onScanComplete?: (result: SecurityCheckResult) => void;
  autoScan?: boolean;
}

export default function TransactionSecurityScanner({
  fromToken,
  fromNetwork,
  toToken,
  toNetwork,
  fromAmount,
  contractAddress,
  userAddress,
  userId,
  onScanComplete,
  autoScan = true
}: TransactionSecurityScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<SecurityCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>('token');

  useEffect(() => {
    if (autoScan && fromToken && toToken) {
      handleScan();
    }
  }, [fromToken, fromNetwork, toToken, toNetwork, fromAmount, contractAddress]);

  const handleScan = async () => {
    setIsScanning(true);
    setError(null);

    try {
      const response = await performSecurityScan(
        fromToken,
        fromNetwork,
        toToken,
        toNetwork,
        fromAmount,
        contractAddress,
        userAddress,
        userId
      );

      const result = response.scanResult;
      setScanResult(result);
      
      if (onScanComplete) {
        onScanComplete(result);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to perform security scan';
      setError(errorMessage);
    } finally {
      setIsScanning(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const getRiskIcon = () => {
    if (!scanResult) return <Shield className="w-6 h-6 text-gray-400" />;
    
    switch (scanResult.riskLevel) {
      case 'safe':
        return <ShieldCheck className="w-6 h-6 text-green-500" />;
      case 'low':
        return <ShieldCheck className="w-6 h-6 text-lime-500" />;
      case 'medium':
        return <ShieldAlert className="w-6 h-6 text-yellow-500" />;
      case 'high':
        return <ShieldAlert className="w-6 h-6 text-orange-500" />;
      case 'critical':
        return <ShieldX className="w-6 h-6 text-red-500" />;
      default:
        return <Shield className="w-6 h-6 text-gray-400" />;
    }
  };

  const getRiskBorderColor = () => {
    if (!scanResult) return 'border-gray-200';
    
    switch (scanResult.riskLevel) {
      case 'safe':
        return 'border-green-300 bg-green-50';
      case 'low':
        return 'border-lime-300 bg-lime-50';
      case 'medium':
        return 'border-yellow-300 bg-yellow-50';
      case 'high':
        return 'border-orange-300 bg-orange-50';
      case 'critical':
        return 'border-red-300 bg-red-50';
      default:
        return 'border-gray-200';
    }
  };

  if (isScanning) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-center gap-3 py-6">
          <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
          <span className="text-gray-600">Running Security Analysis...</span>
        </div>
        <div className="space-y-2 mt-4">
          <div className="h-2 bg-gray-100 rounded overflow-hidden">
            <div className="h-full bg-blue-500 animate-pulse" style={{ width: '60%' }} />
          </div>
          <p className="text-xs text-gray-500 text-center">Analyzing token security and contract behavior</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-red-200 rounded-lg p-4 shadow-sm">
        <div className="flex items-center gap-3 text-red-600">
          <XCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
        <button
          onClick={handleScan}
          className="mt-3 w-full py-2 px-4 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      </div>
    );
  }

  if (!scanResult) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-gray-400" />
            <span className="text-gray-600">Security Scan Available</span>
          </div>
          <button
            onClick={handleScan}
            className="py-2 px-4 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 text-sm font-medium"
          >
            Run Scan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`border rounded-lg p-4 shadow-sm ${getRiskBorderColor()}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {getRiskIcon()}
          <div>
            <h4 className="font-semibold text-gray-900">Security Analysis</h4>
            <p className="text-sm text-gray-600">{scanResult.overallMessage}</p>
          </div>
        </div>
        <div className="text-right">
          <div 
            className="text-2xl font-bold"
            style={{ color: getRiskScoreColor(scanResult.riskScore) }}
          >
            {scanResult.riskScore}
          </div>
          <div className="text-xs text-gray-500">Risk Score</div>
        </div>
      </div>

      {/* Risk Level Badge */}
      <div className="flex items-center gap-2 mb-4">
        <span 
          className="px-3 py-1 rounded-full text-sm font-medium"
          style={{ 
            backgroundColor: getRiskScoreColor(scanResult.riskScore) + '20',
            color: getRiskScoreColor(scanResult.riskScore)
          }}
        >
          {getRiskLevelLabel(scanResult.riskLevel)}
        </span>
        {scanResult.flags.length > 0 && (
          <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
            {scanResult.flags.length} {scanResult.flags.length === 1 ? 'flag' : 'flags'}
          </span>
        )}
      </div>

      {/* Security Checks */}
      <div className="space-y-2">
        {/* Token Security */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('token')}
            className="w-full flex items-center justify-between p-3 bg-white hover:bg-gray-50"
          >
            <div className="flex items-center gap-2">
              {scanResult.checks.tokenSecurity?.passed ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
              <span className="font-medium">Token Security</span>
            </div>
            {expandedSection === 'token' ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>
          {expandedSection === 'token' && (
            <div className="p-3 bg-gray-50 border-t border-gray-200 text-sm">
              <p className="text-gray-600 mb-2">{scanResult.checks.tokenSecurity?.message}</p>
              {scanResult.checks.tokenSecurity?.details?.riskFactors && (
                <ul className="space-y-1">
                  {scanResult.checks.tokenSecurity.details.riskFactors.map((factor, i) => (
                    <li key={i} className="flex items-center gap-2 text-yellow-700">
                      <Warning className="w-3 h-3" />
                      {factor}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Contract Analysis */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('contract')}
            className="w-full flex items-center justify-between p-3 bg-white hover:bg-gray-50"
          >
            <div className="flex items-center gap-2">
              {scanResult.checks.contractAnalysis?.passed ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
              )}
              <span className="font-medium">Contract Analysis</span>
            </div>
            {expandedSection === 'contract' ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>
          {expandedSection === 'contract' && (
            <div className="p-3 bg-gray-50 border-t border-gray-200 text-sm">
              <p className="text-gray-600">{scanResult.checks.contractAnalysis?.message}</p>
            </div>
          )}
        </div>

        {/* Address Reputation */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('address')}
            className="w-full flex items-center justify-between p-3 bg-white hover:bg-gray-50"
          >
            <div className="flex items-center gap-2">
              {scanResult.checks.addressReputation?.passed ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
              <span className="font-medium">Address Reputation</span>
            </div>
            {expandedSection === 'address' ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>
          {expandedSection === 'address' && (
            <div className="p-3 bg-gray-50 border-t border-gray-200 text-sm">
              <p className="text-gray-600">{scanResult.checks.addressReputation?.message}</p>
            </div>
          )}
        </div>

        {/* Transaction Simulation */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('simulation')}
            className="w-full flex items-center justify-between p-3 bg-white hover:bg-gray-50"
          >
            <div className="flex items-center gap-2">
              {scanResult.checks.simulation?.passed ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
              <span className="font-medium">Transaction Simulation</span>
            </div>
            {expandedSection === 'simulation' ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>
          {expandedSection === 'simulation' && (
            <div className="p-3 bg-gray-50 border-t border-gray-200 text-sm">
              <p className="text-gray-600 mb-2">{scanResult.checks.simulation?.message}</p>
              {scanResult.checks.simulation?.details?.warnings && (
                <ul className="space-y-1">
                  {scanResult.checks.simulation.details.warnings.map((warning, i) => (
                    <li key={i} className="flex items-center gap-2 text-yellow-700">
                      <Flame className="w-3 h-3" />
                      {warning}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Liquidity Check */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('liquidity')}
            className="w-full flex items-center justify-between p-3 bg-white hover:bg-gray-50"
          >
            <div className="flex items-center gap-2">
              {scanResult.checks.liquidityCheck?.passed ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
              )}
              <span className="font-medium">Liquidity Check</span>
            </div>
            {expandedSection === 'liquidity' ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>
          {expandedSection === 'liquidity' && (
            <div className="p-3 bg-gray-50 border-t border-gray-200 text-sm">
              <p className="text-gray-600">{scanResult.checks.liquidityCheck?.message}</p>
            </div>
          )}
        </div>
      </div>

      {/* Recommendations */}
      {scanResult.recommendations.length > 0 && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4 h-4 text-blue-600" />
            <span className="font-medium text-blue-800">Recommendations</span>
          </div>
          <ul className="space-y-1">
            {scanResult.recommendations.map((rec, i) => (
              <li key={i} className="text-sm text-blue-700 flex items-start gap-2">
                <span className="text-blue-500">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Re-scan Button */}
      <button
        onClick={handleScan}
        className="mt-4 w-full py-2 text-gray-600 hover:text-gray-800 transition-colors text-sm border border-gray-300 rounded-lg hover:border-gray-400 flex items-center justify-center gap-2"
      >
        <RefreshCw className="w-3 h-3" />
        Re-run Security Scan
      </button>
    </div>
  );
}
