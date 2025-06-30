import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';

/**
 * Scrape reviews using Axios.
 */
async function scrapeWithAxios(url, company) {
  const reviews = [];

  try {
    const { data: html } = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    const $ = cheerio.load(html);
    $('div, p, span, li').each((_, el) => {
      const text = $(el).text().trim();
      if (text.toLowerCase().includes(company.toLowerCase()) && text.length > 30) {
        reviews.push(text);
      }
    });
  } catch (err) {
    console.warn(`⚠️ Axios scrape failed for ${url}: ${err.message}`);
  }

  return reviews;
}

/**
 * Scrape reviews using Puppeteer if Axios fails.
 */
async function scrapeWithPuppeteer(url, company) {
  const reviews = [];

  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 0 });

    const pageContent = await page.content();
    const $ = cheerio.load(pageContent);

    $('div, p, span, li').each((_, el) => {
      const text = $(el).text().trim();
      if (text.toLowerCase().includes(company.toLowerCase()) && text.length > 30) {
        reviews.push(text);
      }
    });

    await browser.close();
  } catch (err) {
    console.warn(`⚠️ Puppeteer scrape failed for ${url}: ${err.message}`);
  }

  return reviews;
}

/**
 * Master function to scrape a single URL using both methods.
 */
export async function scrapeReviewsFromURL(url, company) {
  let reviews = await scrapeWithAxios(url, company);
  if (reviews.length === 0) {
    reviews = await scrapeWithPuppeteer(url, company);
  }
  return reviews;
}
