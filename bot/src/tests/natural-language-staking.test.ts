import { parseUserCommand } from '../services/parseUserCommand';

// Mock Groq to test deterministic parsing paths
jest.mock('groq-sdk', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockRejectedValue(new Error("LLM Disabled for Test")),
      },
    },
  }));
});

describe('Natural Language Staking Commands', () => {

  describe('Basic Staking Commands', () => {
    test('should parse "Stake my ETH"', async () => {
      const result = await parseUserCommand('Stake my ETH');
      
      expect(result.success).toBe(true);
      expect(result.intent