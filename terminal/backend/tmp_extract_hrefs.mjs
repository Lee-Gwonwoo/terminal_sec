import * as cheerio from "cheerio";
const url = 'https://finnhub.io/api/news?id=a3a04b1df89592181038f64fe0cd4de2fa7d0e509f2a280d13fc7d01d5053760';
const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' } });
const html = await res.text();
const $ = cheerio.load(html);
const hrefs = new Set();
$('a[href]').each((_i, el) => {
  const href = String($(el).attr('href') ?? '').trim();
  if (!href) return;
  const abs = new URL(href, url).toString();
  if (abs.includes('finnhub.io') || abs.includes('static.finnhub.io')) return;
  hrefs.add(abs);
});
console.log(JSON.stringify([...hrefs], null, 2));
