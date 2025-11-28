// api/cron.js
export default async function handler(request, response) {
  // Replace with your actual backend URL
  const backendUrl = process.env.VITE_BACKEND_URL;
  
  try {
    const result = await fetch(backendUrl);
    const status = result.status;
    console.log(`Cron job pinged backend. Status: ${status}`);
    return response.status(200).json({ success: true, status });
  } catch (error) {
    console.error('Cron job failed:', error);
    return response.status(500).json({ success: false, error: error.message });
  }
}