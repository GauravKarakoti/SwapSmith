'use client'

import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { ParsedCommand } from '@/utils/groq-client'; // Import the new type

interface IntentConfirmationProps {
  command?: ParsedCommand; // Use the specific type
  onConfirm: (confirmed: boolean) => void;
}

// Staking provider mapping for display
const getStakingProvider = (token: string | null): string => {
  const providers: Record<string, string> = {
    'ETH': 'Lido (stETH)',
    'MATIC': 'Stader (MATICx)',
    'SOL': 'Marinade (mSOL)',
    'ATOM': 'Stride (stATOM)',
    'USDC': 'Aave (aUSDC)'
  };
  return token ? providers[token.toUpperCase()] || 'Best Available Provider' : 'Best Available Provider';
};

const getEstimatedAPR = (token: string | null): string => {
  const rates: Record<string, string> = {
    'ETH': '3.8%',
    'MATIC': '4.2%',
    'SOL': '6.8%',
    'ATOM': '18.5%',
    'USDC': '4.5%'
  };
  return token ? rates[token.toUpperCase()] || 'Variable' : 'Variable';
};

export default function IntentConfirmation({ command, onConfirm }: IntentConfirmationProps) {
  if (!command) return null;

  const confidenceColor = command.confidence >= 80 ? 'text-green-600' :
                          command.confidence >= 60 ? 'text-yellow-600' : 'text-red-600';

  // Render different confirmation content based on intent
  const renderIntentDetails = () => {
    switch (command.intent) {
      case 'portfolio':
        return (
          <div className="bg-white text-gray-900 p-3 rounded border text-sm">
            <p className="mb-2">
              Portfolio Strategy: <strong>{command.amount} {command.fromAsset}</strong>
            </p>
            {command.portfolio && (
              <ul className="space-y-1 text-xs text-gray-600">
                {command.portfolio.map((item, idx) => (
                  <li key={idx}>
                    • {item.percentage}% → {item.toAsset} on {item.toChain}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );

      case 'dca':
        return (
          <div className="bg-white text-gray-900 p-3 rounded border text-sm">
            <p>
              DCA: <strong>{command.amount} {command.fromAsset}</strong> → <strong>{command.toAsset}</strong>
            </p>
            {command.frequency && (
              <p className="text-xs text-gray-600 mt-1">
                Frequency: {command.frequency}
                {command.dayOfWeek && ` (Day: ${command.dayOfWeek})`}
                {command.dayOfMonth && ` (Date: ${command.dayOfMonth})`}
              </p>
            )}
          </div>
        );

      case 'swap':
      default:
        return (
          <div className="bg-white text-gray-900 p-3 rounded border text-sm">
            {command.conditionOperator && command.conditionValue ? (
              <p>
                Limit Order: Swap <strong>{command.amount} {command.fromAsset}</strong> → <strong>{command.toAsset}</strong>
                <br />
                <span className="text-xs text-gray-600">
                  When {command.conditionAsset || command.fromAsset} is {command.conditionOperator === 'gt' ? 'above' : 'below'} ${command.conditionValue}
                </span>
              </p>
            ) : (
              <p>
                Swap <strong>{command.amount} {command.fromAsset}</strong> on {command.fromChain || 'ethereum'} for <strong>{command.toAsset}</strong> on {command.toChain || 'ethereum'}
              </p>
            )}
          </div>
        );
    }
  };

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-md">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-5 h-5 text-yellow-600" />
        <h4 className="font-semibold text-yellow-800">Confirm Your Intent</h4>
      </div>
      
      <div className="mb-3">
        <p className="text-sm text-gray-700 mb-2">I understand you want to:</p>
        {renderIntentDetails()}
      </div>

      <div className="flex items-center justify-between text-sm mb-3">
        <span className="text-gray-600">Confidence level:</span>
        <span className={`font-medium ${confidenceColor}`}>
          {command.confidence}% {command.confidence >= 80 ? 'High' : 'Medium'}
        </span>
      </div>

      {command.validationErrors?.length > 0 && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm">
          <ul className="list-disc list-inside text-red-700">
            {command.validationErrors.map((error: string, index: number) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => onConfirm(true)}
          className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
        >
          <CheckCircle className="w-4 h-4" />
          Yes, Proceed
        </button>
        <button
          onClick={() => onConfirm(false)}
          className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
        >
          <XCircle className="w-4 h-4" />
          Cancel
        </button>
      </div>
    </div>
  );
}
