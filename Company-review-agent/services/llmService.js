import axios from 'axios';
import { readReviewsFromCSV } from './csvService.js';

export async function summarizeReviews(reviews, company) {
  const prompt = `Summarize these employee reviews for "${company}":\n\n${reviews.join('\n\n')}`;
  
  const response = await axios.post("http://localhost:11434/api/generate", {
    model: "llama3.2",
    prompt,
    stream: false,
  });

  return response.data.response.trim();
}

export async function answerQuestionFromReviews(question, company) {
  const context = readReviewsFromCSV(company);
  if (!context) return "⚠️ No reviews found. Please run /analyze first.";

  const prompt = `
You are a helpful assistant. Use the employee reviews of "${company}" below to answer the user's question.

Reviews:
${context}

Question: ${question}
Answer:
`;

  try {
    const response = await axios.post("http://localhost:11434/api/generate", {
      model: "llama3.2",
      prompt,
      stream: false,
    });

    return response.data.response.trim();
  } catch (err) {
    console.error("Ollama Error:", err.message);
    return "❌ Failed to get a response from the model.";
  }
}
