import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createObjectCsvWriter } from 'csv-writer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const reviewsDir = path.join(__dirname, '../company_reviews');

// Ensure directory exists
if (!fs.existsSync(reviewsDir)) {
  fs.mkdirSync(reviewsDir, { recursive: true });
}

/**
 * Save reviews to CSV file (one per company)
 */
export async function saveReviewsToCSV(reviews, company) {
  const filePath = path.join(reviewsDir, `reviews_${company}.csv`);

  const writer = createObjectCsvWriter({
    path: filePath,
    header: [{ id: 'review', title: 'Review' }],
  });

  // Clean and deduplicate reviews
  const cleanReviews = [...new Set(reviews.map(r => r.trim()).filter(r => r.length > 0))];

  await writer.writeRecords(cleanReviews.map(r => ({ review: r })));
}

/**
 * Read reviews from a company's CSV (return plain array)
 */
export function readReviewsFromCSV(company) {
  const filePath = path.join(reviewsDir, `reviews_${company}.csv`);
  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, 'utf-8');

  const lines = content
    .split('\n')
    .slice(1) // skip header
    .map(line => line.trim())
    .filter(Boolean);

  return lines.slice(0, 20); // return first 20 cleaned reviews
}
