import axios from 'axios';

export async function getReviewLinks(company) {
  const query = `${company} reviews site:ambitionbox.com OR site:glassdoor.com`;
  const serpApiUrl = 'https://serpapi.com/search.json';

  const response = await axios.get(serpApiUrl, {
    params: {
      q: query,
      api_key: process.env.SERPAPI_KEY,
      engine: 'google',
      num: 5,
    },
  });

  return response.data.organic_results?.map(r => r.link) || [];
}
