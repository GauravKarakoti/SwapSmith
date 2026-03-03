import { parseUserCommand } from '../services/parseUserCommand';

// Mock the Groq client to avoid API key requirement
jest.mock('../services/groq-client', () => ({
  parseWithLLM: jest.fn(),
  transcribeAudio: jest.fn(),
}));

describe('Swap and Stake - Enhanced Command Parsing', () => {
  
  describe('Natural language variations', () => {
    
    test('should parse "swap 100 ETH and stake it"', async () => {
      const result = await parseUserCommand('swap 100 ETH and stake it');
      
      expect(result.success).toBe(true);
      expect(result.intent).toBe('swap_and_stake');
      expect(result.amount).toBe(100);
      expect(result.fromAsset).toBe('ETH');
      expect(result.toAsset).toBe('USDC'); // Default
    });
    
    test('should parse "zap 50 BTC into yield"', async () => {
      const result = await parseUserCommand('zap 50 BTC into yield');
      
      expect(result.success).toBe(true);
      expect(result.intent).toBe('swap_and_stake');
      expect(result.amount).toBe(50);
      expect(result.fromAsset).toBe('BTC');
    });
    
    test('should parse "swap my ETH to USDC and stake"', async () => {
      const result = await parseUserCommand('swap my ETH to USDC and stake');
      
      expect(result.success).toBe(true);
      expect(result.intent).toBe('swap_and_stake');
      expect(result.fromAsset).toBe('ETH');
      expect(result.toAsset).toBe('USDC');
    });
    
    test('should parse "zap 1000 USDC to ETH"', async () => {
      const result = await parseUserCommand('zap 1000 USDC to ETH');
      
      expect(result.success).toBe(true);
      expect(result.intent).toBe('swap_and_stake');
      expect(result.amount).toBe(1000);
      expect(result.fromAsset).toBe('USDC');
      expect(result.toAsset).toBe('ETH');
    });
    
    test('should parse "swap 0.5 ETH for USDC and stake immediately"', async () => {
      const result = await parseUserCommand('swap 0.5 ETH for USDC and stake immediately');
      
      expect(result.success).toBe(true);
      expect(result.intent).toBe('swap_and_stake');
      expect(result.amount).toBe(0.5);
      expect(result.fromAsset).toBe('ETH');
      expect(result.toAsset).toBe('USDC');
    });
    
  });
  
  describe('Protocol specification', () => {
    
    test('should detect Aave protocol', async () => {
      const result = await parseUserCommand('swap and stake 100 USDC to ETH on aave');
      
      expect(result.success).toBe(true);
      expect(result.fromProject).toBe('aave');
      expect(result.toProject).toBe('aave');
    });
    
    test('should detect Compound protocol', async () => {
      const result = await parseUserCommand('zap 50 ETH into USDC using compound');
      
      expect(result.success).toBe(true);
      expect(result.fromProject).toBe('compound');
    });
    
    test('should detect Lido protocol', async () => {
      const result = await parseUserCommand('swap 1 ETH and stake in lido');
      
      expect(result.success).toBe(true);
      expect(result.fromProject).toBe('lido');
    });
    
    test('should detect Yearn protocol', async () => {
      const result = await parseUserCommand('zap 1000 USDC to yearn');
      
      expect(result.success).toBe(true);
      expect(result.fromProject).toBe('yearn');
    });
    
  });
  
  describe('Edge cases', () => {
    
    test('should handle command without explicit amount', async () => {
      const result = await parseUserCommand('swap and stake my ETH');
      
      expect(result.success).toBe(true);
      expect(result.intent).toBe('swap_and_stake');
      expect(result.fromAsset).toBe('ETH');
      expect(result.amount).toBeNull();
    });
    
    test('should handle command with only from asset', async () => {
      const result = await parseUserCommand('zap 100 BTC');
      
      expect(result.success).toBe(true);
      expect(result.intent).toBe('swap_and_stake');
      expect(result.fromAsset).toBe('BTC');
      expect(result.toAsset).toBe('USDC'); // Default
    });
    
    test('should handle decimal amounts', async () => {
      const result = await parseUserCommand('swap and stake 0.001 BTC to USDC');
      
      expect(result.success).toBe(true);
      expect(result.amount).toBe(0.001);
    });
    
    test('should handle large amounts', async () => {
      const result = await parseUserCommand('zap 10000 USDC into ETH');
      
      expect(result.success).toBe(true);
      expect(result.amount).toBe(10000);
    });
    
  });
  
  describe('Confidence and validation', () => {
    
    test('should have high confidence for clear commands', async () => {
      const result = await parseUserCommand('swap and stake 100 ETH to USDC');
      
      expect(result.confidence).toBe(80);
    });
    
    test('should require confirmation', async () => {
      const result = await parseUserCommand('swap and stake 100 ETH to USDC');
      
      expect(result.requiresConfirmation).toBe(true);
    });
    
    test('should preserve original input', async () => {
      const input = 'swap and stake 100 ETH to USDC on aave';
      const result = await parseUserCommand(input);
      
      expect(result.originalInput).toBe(input);
    });
    
  });
  
  describe('Asset extraction improvements', () => {
    
    test('should extract asset from "swap <asset>" pattern', async () => {
      const result = await parseUserCommand('swap ETH and stake');
      
      expect(result.success).toBe(true);
      expect(result.fromAsset).toBe('ETH');
    });
    
    test('should extract asset from "my <asset>" pattern', async () => {
      const result = await parseUserCommand('stake my BTC');
      
      expect(result.success).toBe(true);
      expect(result.fromAsset).toBe('BTC');
    });
    
    test('should handle longer asset symbols', async () => {
      const result = await parseUserCommand('zap 100 USDT to WETH');
      
      expect(result.success).toBe(true);
      expect(result.fromAsset).toBe('USDT');
      expect(result.toAsset).toBe('WETH');
    });
    
  });
  
});
