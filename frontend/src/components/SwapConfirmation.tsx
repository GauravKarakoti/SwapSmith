'use client'

interface QuoteData {
  depositAmount: string;
  depositCoin: string;
  depositNetwork: string;
  rate: string;
  settleAmount: string;
  settleCoin: string;
  settleNetwork: string;
  depositAddress: string;
  memo?: string;
}

interface SwapConfirmationProps {
  quote: QuoteData;
}

export default function SwapConfirmation({ quote }: SwapConfirmationProps) {
  const handleConfirm = () => {
    const message = `Swapping ${quote.depositAmount} ${quote.depositCoin} to ${quote.settleAmount} ${quote.settleCoin} ${quote.memo ? ` with memo: ${quote.memo}` : ''}`;
    alert(message);
  };

  return (
    <div className="mt-4 p-4 bg-blue-50 rounded-lg">
      <button 
        onClick={handleConfirm}
        className="w-full py-2 bg-green-500 text-white rounded hover:bg-green-600"
      >
        Confirm Swap
      </button>
    </div>
  );
}