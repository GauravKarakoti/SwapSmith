import { NextApiRequest, NextApiResponse } from 'next';
import { parseUserCommand } from '@/utils/groq-client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const parsedCommand = await parseUserCommand(message);
    console.log("Parsed command:", parsedCommand);
    res.status(200).json(parsedCommand);
  } catch (error) {
    console.error('Error parsing command:', error);
    res.status(500).json({ error: 'Failed to parse command' });
  }
}