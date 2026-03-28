const url = 'https://finnhub.io/api/news?id=a3a04b1df89592181038f64fe0cd4de2fa7d0e509f2a280d13fc7d01d5053760';
const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' } });
const text = await res.text();
const matches = [...text.matchAll(/https?:\\/\\/[^\"'\\s<>()]+/g)].map(m => m[0]);
const unique = [...new Set(matches)].filter(v => !v.includes('static.finnhub.io') && !v.includes('googletagmanager') && !v.includes('googleapis') && !v.includes('bootstrapcdn') && !v.includes('cdnjs') && !v.includes('jsdelivr') && !v.includes('stripe.com') && !v.includes('finnhub.io/')); 
console.log(JSON.stringify(unique.slice(0, 100), null, 2));
