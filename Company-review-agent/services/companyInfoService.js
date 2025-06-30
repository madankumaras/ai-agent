import puppeteer from 'puppeteer';
import cheerio from 'cheerio';
import { getReviewLinks } from './serpService.js';
import fs from 'fs';
import path from 'path';

const CACHE_FILE = path.resolve('cache', 'companyCache.json');

// Load cache
let cache = {};
if (fs.existsSync(CACHE_FILE)) {
  try {
    cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  } catch (err) {
    console.warn('⚠️ Failed to parse companyCache.json');
  }
}

// Save cache
function saveCache() {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

// Find "About" page link from homepage
async function findAboutPageUrl(homepage) {
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(homepage, { waitUntil: 'domcontentloaded', timeout: 15000 });

    const links = await page.$$eval('a', as =>
      as.map(a => ({ href: a.href, text: a.textContent?.toLowerCase() || '' }))
    );

    await browser.close();

    const aboutLink = links.find(link =>
      link.href.includes('about') ||
      link.text.includes('about') ||
      link.text.includes('company') ||
      link.text.includes('who we are')
    );

    return aboutLink?.href || homepage;
  } catch (err) {
    console.warn('⚠️ Failed to find About page:', err.message);
    return homepage;
  }
}

// Extract company details from HTML
function extractCompanyDetails(html) {
  const $ = cheerio.load(html);

  $('header, nav, footer, script, style').remove();

  const getMatch = (regex) => {
    const match = $.text().match(regex);
    return match ? match[1].trim() : null;
  };

  let ceo = null;

  // Look through each "team member" container for CEO
  $('div').each((_, el) => {
    const containerText = $(el).text();
    if (/Founder\s+and\s+CEO/i.test(containerText)) {
      const name = $(el).find('p, h1, h2, h3, h4, strong').first().text().trim();
      if (name) {
        ceo = name;
      }
    }
  });

  return {
    ceo,
    founded: getMatch(/(?:Founded|Established|management___header)[:\s]+(\d{4})/i),
    headquarters: getMatch(/Headquarters[:\s]+([A-Z][a-zA-Z,\s]+)/i),
    industry: getMatch(/Industry[:\s]+([A-Za-z\s]+)/i),
    description: $.text().replace(/\s+/g, ' ').trim().slice(0, 500) + '...'
  };
}




// Main function
export async function getCompanyInfo(company) {
  if (cache[company]) {
    return cache[company];
  }

  const blacklist = ['ambitionbox.com', 'glassdoor.com', 'indeed.com', 'linkedin.com', 'quora.com'];
  const searchResults = await getReviewLinks(`${company} official site`);

  let homepage = searchResults.find(link =>
    (link.includes('.com') || link.includes('.in')) &&
    !blacklist.some(bad => link.includes(bad))
  );

  if (!homepage) {
    homepage = `https://www.${company.toLowerCase().replace(/\s+/g, '')}.com`;
  }

  let finalHomepage = homepage;
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(finalHomepage, { waitUntil: 'domcontentloaded', timeout: 15000 });
  } catch (err) {
    console.warn(`⚠️ Failed to load ${finalHomepage}, trying .in alternative...`);
    const fallbackUrl = homepage.replace('.com', '.in');
    try {
      await page.goto(fallbackUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      finalHomepage = fallbackUrl;
    } catch (e) {
      console.error(`❌ Both .com and .in failed for ${company}`);
      await browser.close();
      const fallback = {
        name: company,
        website: homepage,
        aboutPage: homepage,
        ceo: null,
        founded: null,
        headquarters: null,
        industry: null,
        description: 'Website could not be reached.'
      };
      cache[company] = fallback;
      saveCache();
      return fallback;
    }
  }

  const aboutUrl = await findAboutPageUrl(finalHomepage);

  try {
    await page.goto(aboutUrl, { waitUntil: 'networkidle2', timeout: 15000 });
    await page.waitForSelector('main, section, body', { timeout: 10000 }).catch(() => {
      console.warn('⚠️ Could not find main/section/body tags in time');
    });

    const html = await page.content();
    await browser.close();

    const info = extractCompanyDetails(html);
    const result = {
      ...info,
      name: company,
      website: finalHomepage,
      aboutPage: aboutUrl
    };

    cache[company] = result;
    saveCache();

    return result;
  } catch (err) {
    await browser.close();
    console.error('❌ Error fetching company info from About page:', err.message);
    const fallback = {
      name: company,
      website: finalHomepage,
      aboutPage: aboutUrl,
      ceo: null,
      founded: null,
      headquarters: null,
      industry: null,
      description: 'Failed to extract company info from website.'
    };
    cache[company] = fallback;
    saveCache();
    return fallback;
  }
}
