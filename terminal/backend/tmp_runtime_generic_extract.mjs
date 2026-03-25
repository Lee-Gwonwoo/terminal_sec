import { extractByDomain } from './dist/src/services/fulltextExtractors.js';

globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  text: async () => `
    <html>
      <body>
        <main>
          <article>
            <p>Generic article runtime verification paragraph one with enough length to satisfy the extractor threshold in a real Node execution.</p>
            <p>Paragraph two confirms that unsupported publishers now go through a generic article scrape path before fallback is used.</p>
            <p>Paragraph three ensures the extracted text is long enough to be treated as a success result rather than a fallback body reuse.</p>
          </article>
        </main>
      </body>
    </html>
  `,
});

const unsupportedResult = await extractByDomain('https://finance.yahoo.com/news/runtime-check.html', 'YAHOO', 'short fallback body');
const finnhubResult = await extractByDomain('https://finnhub.io/api/news?id=runtime-check', 'FINNHUB', 'short fallback body');
console.log(JSON.stringify({ unsupportedResult, finnhubResult }, null, 2));
