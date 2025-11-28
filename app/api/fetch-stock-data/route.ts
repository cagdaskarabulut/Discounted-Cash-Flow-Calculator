import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL gerekli' }, { status: 400 });
    }

    let baseUrl = url.trim();
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
    }

    const urls = [
      baseUrl,
      `${baseUrl}/financials/`,
      `${baseUrl}/financials/cash-flow-statement/`,
      `${baseUrl}/financials/balance-sheet/`,
      `${baseUrl}/forecast/`,
    ];

    const fetchPromises = urls.map(async (targetUrl) => {
      try {
        const response = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
          },
        });
        
        if (!response.ok) {
          console.log(`Failed to fetch ${targetUrl}: ${response.status}`);
          return '';
        }
        
        const html = await response.text();
        return html;
      } catch (error) {
        console.log(`Error fetching ${targetUrl}:`, error);
        return '';
      }
    });

    const results = await Promise.all(fetchPromises);
    const combinedData = parseStockData(results, baseUrl);

    return NextResponse.json({ success: true, data: combinedData });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Veri çekilirken hata oluştu' }, { status: 500 });
  }
}

function parseStockData(htmlPages: string[], baseUrl: string): string {
  let extractedData: string[] = [];
  
  htmlPages.forEach((html, index) => {
    if (!html) return;
    
    const textContent = extractTextFromHtml(html);
    
    const patterns = [
      { regex: /Free Cash Flow[\s\S]*?(-?[\d,]+(?:\.\d+)?(?:\s+-?[\d,]+(?:\.\d+)?)*)/i, label: 'Free Cash Flow' },
      { regex: /Total Common Shares Outstanding[\s\S]*?([\d,]+(?:\.\d+)?(?:\s+[\d,]+(?:\.\d+)?)*)/i, label: 'Total Common Shares Outstanding' },
      { regex: /Shares Outstanding \(Diluted\)[\s\S]*?([\d,]+(?:\.\d+)?)/i, label: 'Shares Outstanding (Diluted)' },
      { regex: /Total Debt[\s\S]*?([\d,]+(?:\.\d+)?(?:\s+[\d,]+(?:\.\d+)?)*)/i, label: 'Total Debt' },
      { regex: /Shareholders['']?\s*Equity[\s\S]*?(-?[\d,]+(?:\.\d+)?(?:\s+-?[\d,]+(?:\.\d+)?)*)/i, label: "Shareholders' Equity" },
      { regex: /Total Equity[\s\S]*?(-?[\d,]+(?:\.\d+)?)/i, label: 'Total Equity' },
      { regex: /Cash\s*(?:&|and)\s*Short-Term Investments[\s\S]*?([\d,]+(?:\.\d+)?)/i, label: 'Cash & Short-Term Investments' },
      { regex: /Cash and Cash Equivalents[\s\S]*?([\d,]+(?:\.\d+)?)/i, label: 'Cash and Cash Equivalents' },
      { regex: /Effective Tax Rate[\s\S]*?(-?[\d.]+%?(?:\s+-?[\d.]+%?)*)/i, label: 'Effective Tax Rate' },
      { regex: /Beta[\s\S]*?([\d.]+)/i, label: 'Beta' },
      { regex: /Interest Expense[\s\S]*?(-?[\d,]+(?:\.\d+)?)/i, label: 'Interest Expense' },
    ];
    
    patterns.forEach(({ regex, label }) => {
      const match = textContent.match(regex);
      if (match && match[1]) {
        const existingIndex = extractedData.findIndex(d => d.startsWith(label));
        if (existingIndex === -1) {
          extractedData.push(`${label}\t${match[1].trim()}`);
        }
      }
    });

    const priceMatch = html.match(/<span[^>]*class="[^"]*price[^"]*"[^>]*>[\s\S]*?\$?([\d,]+\.?\d*)/i) ||
                       html.match(/data-price="([\d.]+)"/i) ||
                       html.match(/class="[^"]*quote[^"]*"[^>]*>[\s\S]*?\$?([\d,]+\.?\d*)/i);
    
    if (priceMatch && priceMatch[1] && index === 0) {
      const price = priceMatch[1].replace(/,/g, '');
      if (!extractedData.some(d => d.startsWith('Compare'))) {
        extractedData.push(`Compare`);
        extractedData.push(price);
      }
    }

    const betaMatch = html.match(/Beta[^<]*<[^>]*>[^<]*<[^>]*>([\d.]+)/i) ||
                      html.match(/"beta"[^:]*:\s*([\d.]+)/i) ||
                      textContent.match(/Beta\s*(?:\(5Y Monthly\))?\s*([\d.]+)/i);
    
    if (betaMatch && betaMatch[1]) {
      const existingBeta = extractedData.findIndex(d => d.startsWith('Beta'));
      if (existingBeta === -1) {
        extractedData.push(`Beta\t${betaMatch[1]}`);
      }
    }
  });

  return extractedData.join('\n');
}

function extractTextFromHtml(html: string): string {
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec));
  text = text.replace(/\s+/g, ' ');
  return text.trim();
}
