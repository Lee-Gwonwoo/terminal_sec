const url = 'https://finnhub.io/api/news?id=a3a04b1df89592181038f64fe0cd4de2fa7d0e509f2a280d13fc7d01d5053760';
const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' } });
const text = await res.text();
console.log(text.slice(0, 4000));
