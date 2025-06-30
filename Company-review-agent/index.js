import express from 'express';
import dotenv from 'dotenv';
import { getReviewLinks } from './services/serpService.js';
import { scrapeReviewsFromURL } from './services/scraper.js';
import { saveReviewsToCSV, readReviewsFromCSV } from './services/csvService.js';
import { summarizeReviews, answerQuestionFromReviews } from './services/llmService.js';
import { getCompanyInfo } from './services/companyInfoService.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const folderPath = path.join(__dirname, 'company_reviews');
if (!fs.existsSync(folderPath)) {
  fs.mkdirSync(folderPath, { recursive: true });
}

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/analyze', async (req, res) => {
  const company = req.query.company?.trim();

  if (!company) {
    return res.status(400).send('❌ Company name is required as a query parameter.');
  }

  try {
    const existingCSV = readReviewsFromCSV(company);
    let reviewsToUse = [];

    if (existingCSV) {
      console.log(`📁 CSV found for "${company}", loading from file...`);
      reviewsToUse = existingCSV
        .map(line => line.trim())
        .filter(Boolean)
        .slice(0, 10); // limit to 10 reviews
    } else {
      console.log(`🌐 No CSV found for "${company}", scraping...`);
      const reviewLinks = await getReviewLinks(company);
      if (reviewLinks.length === 0) {
        return res.status(404).send('❌ No review links found.');
      }

      const allReviews = [];
      for (const url of reviewLinks) {
        const reviews = await scrapeReviewsFromURL(url, company);
        allReviews.push(...reviews);
      }

      reviewsToUse = allReviews.slice(0, 10);
      if (reviewsToUse.length === 0) {
        return res.status(404).send('❌ No reviews extracted.');
      }

      await saveReviewsToCSV(reviewsToUse, company);
    }

    const summary = await summarizeReviews(reviewsToUse, company);
    const companyInfo = await getCompanyInfo(company);

    res.send(`
      <h2>📝 Review Summary for <em>${company}</em></h2>
      <p>${summary}</p>

      <h3>🏢 Company Info</h3>
      ${companyInfo ? `
      <ul>
        ${companyInfo.name ? `<li><strong>Name:</strong> ${companyInfo.name}</li>` : ''}
        ${companyInfo.ceo ? `<li><strong>CEO:</strong> ${companyInfo.ceo}</li>` : ''}
        ${companyInfo.founded ? `<li><strong>Founded:</strong> ${companyInfo.founded}</li>` : ''}
        ${companyInfo.headquarters ? `<li><strong>Headquarters:</strong> ${companyInfo.headquarters}</li>` : ''}
        ${companyInfo.description ? `<li><strong>About:</strong> ${companyInfo.description}</li>` : ''}
        ${companyInfo.website ? `<li><strong>Website:</strong> <a href="${companyInfo.website}" target="_blank">${companyInfo.website}</a></li>` : ''}
      </ul>
      ` : `<p>⚠️ No company information found.</p>`}
    `);
  } catch (err) {
    console.error('❌ Error:', err.message);
    res.status(500).send('Something went wrong.');
  }
});

app.post('/ask', async (req, res) => {
  const { question, company } = req.body;

  if (!question || !company) {
    return res.status(400).send('❌ Both "question" and "company" are required in the request body.');
  }

  try {
    const answer = await answerQuestionFromReviews(question, company);
    res.send({ answer });
  } catch (err) {
    console.error('❌ QA Error:', err.message);
    res.status(500).send('Something went wrong answering your question.');
  }
});

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
