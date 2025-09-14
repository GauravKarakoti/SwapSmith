import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const systemPrompt = `
You are a cryptocurrency trading assistant that helps users execute swaps. 
Always respond with a valid JSON object in this exact format:
{
  "intent": "swap",
  "fromAsset": "ETH",
  "fromChain": "ethereum",
  "toAsset": "BTC",
  "toChain": "bitcoin",
  "amountType": "percentage|exact|value",
  "amount": "50",
  "success": true,
  "errorMessage": null
}

If the user's request is unclear, set success: false and provide an errorMessage.
Map chain names to these standardized values: ethereum, bitcoin, polygon, arbitrum, avalanche, optimism, bsc.
`;

export async function parseUserCommand(userInput: string) {
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userInput }
      ],
      model: "openai/gpt-oss-20b",
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    return JSON.parse(completion.choices[0].message.content || '{}');
  } catch (error) {
    console.error("Error parsing command:", error);
    return {
      success: false,
      errorMessage: "Sorry, I couldn't process your request. Please try again."
    };
  }
}