import * as cheerio from "cheerio";
const url = 'https://finnhub.io/api/news?id=a3a04b1df89592181038f64fe0cd4de2fa7d0e509f2a280d13fc7d01d5053760';
const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' } });
const html = await res.text();
const $ = cheerio.load(html);
const bodyText = $('body').text();
const snippets = bodyText.split(/\n+/).map(s => s.trim()).filter(Boolean).filter(s => /source|read|continue|alpha|yahoo|benzinga|watch|reuters|marketwatch/i.test(s));
console.log(JSON.stringify(snippets.slice(0, 80), null, 2));
