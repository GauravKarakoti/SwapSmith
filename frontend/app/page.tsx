import WalletConnector from '@/components/WalletConnector';
import ChatInterface from '@/components/ChatInterface';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="flex flex-col items-center max-w-4xl mx-auto">
        <header className="text-center my-8">
          <h1 className="text-3xl font-bold text-gray-800">SwapSmith</h1>
          <p className="text-gray-600">Your Voice-Activated Crypto Trading Assistant</p>
        </header>
        
        <div className="mb-6">
          <WalletConnector />
        </div>
        
        <ChatInterface />
      </div>
    </div>
  );
}