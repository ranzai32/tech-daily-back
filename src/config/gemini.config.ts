export default () => ({
  apiKey: process.env.GEMINI_API_KEY,
  model: (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim() || 'gemini-2.5-flash',
});
