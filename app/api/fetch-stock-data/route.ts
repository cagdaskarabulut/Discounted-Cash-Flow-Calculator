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
    ];

    const fetchPromises = urls.map(async (targetUrl) => {
      try {
        const response = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Cache-Control': 'no-cache',
          },
        });
        
        if (!response.ok) {
          console.log(`Failed to fetch ${targetUrl}: ${response.status}`);
          return { url: targetUrl, html: '' };
        }
        
        const html = await response.text();
        return { url: targetUrl, html };
      } catch (error) {
        console.log(`Error fetching ${targetUrl}:`, error);
        return { url: targetUrl, html: '' };
      }
    });

    const results = await Promise.all(fetchPromises);
    const combinedData = parseStockAnalysisData(results);

    return NextResponse.json({ success: true, data: combinedData });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Veri çekilirken hata oluştu' }, { status: 500 });
  }
}

interface FetchResult {
  url: string;
  html: string;
}

interface ExtractedData {
  currentPrice?: string;
  beta?: string;
  fcf?: string[];
  sharesOutstanding?: string[];
  totalDebt?: string[];
  shareholdersEquity?: string[];
  cashAndShortTermInvestments?: string[];
  effectiveTaxRate?: string[];
  interestExpense?: string[];
  debtRate?: string;
}

function parseStockAnalysisData(results: FetchResult[]): string {
  const data: ExtractedData = {};
  
  results.forEach(({ url, html }) => {
    if (!html) return;
    
    const isMainPage = !url.includes('/financials') && !url.includes('/balance-sheet') && !url.includes('/cash-flow');
    
    const jsonData = extractJsonData(html);
    if (jsonData) {
      mergeJsonData(jsonData, data);
    }
    
    const cleanText = extractTextFromHtml(html);
    
    if (isMainPage) {
      const pricePatterns = [
        /(\d+\.\d{2})\s*[+\-−]?\d+\.\d+\s*\(/,
        /Real-Time Price[^]*?(\d+\.\d{2})/,
        /USD[^]*?(\d+\.\d{2})/,
      ];
      
      for (const pattern of pricePatterns) {
        const match = cleanText.match(pattern);
        if (match && match[1]) {
          data.currentPrice = match[1];
          break;
        }
      }
      
      const betaPatterns = [
        /Beta\s+([\d.]+)/i,
        /\|\s*Beta\s*\|\s*([\d.]+)/i,
      ];
      
      for (const pattern of betaPatterns) {
        const match = cleanText.match(pattern);
        if (match && match[1]) {
          data.beta = match[1];
          break;
        }
      }
    }
    
    const tableRows = extractTableData(html);
    
    tableRows.forEach(row => {
      const label = row.label.toLowerCase().trim();
      const values = row.values;
      
      if ((label === 'free cash flow' || label.match(/^free cash flow$/)) && values.length > 0) {
        if (!data.fcf || values.length > data.fcf.length) {
          data.fcf = values;
        }
      }
      
      if (label.includes('total common shares outstanding') || label === 'shares outstanding (diluted)') {
        if (!data.sharesOutstanding || values.length > data.sharesOutstanding.length) {
          data.sharesOutstanding = values;
        }
      }
      
      if (label === 'total debt') {
        if (!data.totalDebt || values.length > data.totalDebt.length) {
          data.totalDebt = values;
        }
      }
      
      if (label.includes("shareholders' equity") || label.includes('shareholders equity') || label === 'total equity') {
        if (!data.shareholdersEquity || values.length > data.shareholdersEquity.length) {
          data.shareholdersEquity = values;
        }
      }
      
      if (label.includes('cash & short-term investments') || label.includes('cash and short-term investments')) {
        if (!data.cashAndShortTermInvestments || values.length > data.cashAndShortTermInvestments.length) {
          data.cashAndShortTermInvestments = values;
        }
      }
      
      if (label.includes('effective tax rate')) {
        if (!data.effectiveTaxRate || values.length > data.effectiveTaxRate.length) {
          data.effectiveTaxRate = values;
        }
      }
      
      if (label === 'interest expense') {
        if (!data.interestExpense || values.length > data.interestExpense.length) {
          data.interestExpense = values;
        }
      }
    });
    
    parseTextBasedData(cleanText, data);
  });
  
  return formatOutput(data);
}

function parseTextBasedData(text: string, data: ExtractedData): void {
  const lines = text.split(/\n|(?<=\d)\s{2,}(?=[A-Z])/);
  
  const patterns: { regex: RegExp; key: keyof ExtractedData }[] = [
    { regex: /Free Cash Flow\s+([\d,.\-\s]+?)(?=\s*(?:Free Cash Flow|Upgrade|$|[A-Z][a-z]))/i, key: 'fcf' },
    { regex: /Total Common Shares Outstanding\s+([\d,.\s]+?)(?=\s*(?:Upgrade|$|[A-Z][a-z]))/i, key: 'sharesOutstanding' },
    { regex: /Shares Outstanding \(Diluted\)\s+([\d,.\s]+?)(?=\s*(?:Upgrade|$|[A-Z][a-z]))/i, key: 'sharesOutstanding' },
    { regex: /Total Debt\s+([\d,.\-\s]+?)(?=\s*(?:Net Cash|Upgrade|$|[A-Z][a-z]))/i, key: 'totalDebt' },
    { regex: /Shareholders['']?\s*Equity\s+([\d,.\-\s]+?)(?=\s*(?:Total|Upgrade|$|[A-Z][a-z]))/i, key: 'shareholdersEquity' },
    { regex: /Cash & Short-Term Investments\s+([\d,.\s]+?)(?=\s*(?:Cash Growth|Upgrade|$|[A-Z][a-z]))/i, key: 'cashAndShortTermInvestments' },
    { regex: /Cash and Short-Term Investments\s+([\d,.\s]+?)(?=\s*(?:Cash Growth|Upgrade|$|[A-Z][a-z]))/i, key: 'cashAndShortTermInvestments' },
    { regex: /Effective Tax Rate\s+([\d,.%\-\s]+?)(?=\s*(?:Advertising|Upgrade|$|[A-Z][a-z]))/i, key: 'effectiveTaxRate' },
    { regex: /Interest Expense\s+([\d,.\-\s]+?)(?=\s*(?:Interest &|Upgrade|$|[A-Z][a-z]))/i, key: 'interestExpense' },
  ];
  
  patterns.forEach(({ regex, key }) => {
    const match = text.match(regex);
    if (match && match[1]) {
      const values = extractNumbers(match[1]);
      if (values.length > 0) {
        const currentValues = data[key] as string[] | undefined;
        if (!currentValues || values.length > currentValues.length) {
          (data as any)[key] = values;
        }
      }
    }
  });
}

function extractNumbers(str: string): string[] {
  const numbers: string[] = [];
  const regex = /-?[\d,]+\.?\d*/g;
  let match;
  
  while ((match = regex.exec(str)) !== null) {
    const num = match[0].replace(/,/g, '');
    if (num && num !== '-' && !isNaN(parseFloat(num))) {
      numbers.push(num);
    }
  }
  
  return numbers.slice(0, 6);
}

function extractJsonData(html: string): any {
  try {
    const scriptMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (scriptMatch && scriptMatch[1]) {
      return JSON.parse(scriptMatch[1]);
    }
    
    const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdMatch) {
      for (const match of jsonLdMatch) {
        const jsonContent = match.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
        try {
          const parsed = JSON.parse(jsonContent);
          if (parsed) return parsed;
        } catch (e) {}
      }
    }
    
    const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});?\s*<\/script>/i) ||
                       html.match(/window\.__PRELOADED_STATE__\s*=\s*({[\s\S]*?});?\s*<\/script>/i);
    if (stateMatch && stateMatch[1]) {
      return JSON.parse(stateMatch[1]);
    }
  } catch (e) {
    console.log('JSON extraction error:', e);
  }
  return null;
}

function mergeJsonData(jsonData: any, data: ExtractedData): void {
  try {
    const searchPaths = [
      jsonData?.props?.pageProps?.data,
      jsonData?.props?.pageProps?.financials,
      jsonData?.props?.pageProps?.quote,
      jsonData?.data,
      jsonData?.financials,
      jsonData?.quote,
    ];
    
    for (const path of searchPaths) {
      if (!path) continue;
      
      if (path.price && !data.currentPrice) {
        data.currentPrice = String(path.price);
      }
      
      if (path.beta && !data.beta) {
        data.beta = String(path.beta);
      }
      
      if (path.freeCashFlow && !data.fcf) {
        data.fcf = Array.isArray(path.freeCashFlow) ? path.freeCashFlow.map(String) : [String(path.freeCashFlow)];
      }
      
      if (path.sharesOutstanding && !data.sharesOutstanding) {
        data.sharesOutstanding = Array.isArray(path.sharesOutstanding) ? path.sharesOutstanding.map(String) : [String(path.sharesOutstanding)];
      }
      
      if (path.totalDebt && !data.totalDebt) {
        data.totalDebt = Array.isArray(path.totalDebt) ? path.totalDebt.map(String) : [String(path.totalDebt)];
      }
      
      if (path.shareholdersEquity && !data.shareholdersEquity) {
        data.shareholdersEquity = Array.isArray(path.shareholdersEquity) ? path.shareholdersEquity.map(String) : [String(path.shareholdersEquity)];
      }
    }
  } catch (e) {
    console.log('JSON merge error:', e);
  }
}

function extractTableData(html: string): { label: string; values: string[] }[] {
  const rows: { label: string; values: string[] }[] = [];
  
  const tableRowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;
  
  while ((match = tableRowRegex.exec(html)) !== null) {
    const rowHtml = match[1];
    
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    const cells: string[] = [];
    let cellMatch;
    
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      let cellContent = cellMatch[1];
      cellContent = cellContent.replace(/<[^>]+>/g, ' ');
      cellContent = cellContent.replace(/&nbsp;/g, ' ');
      cellContent = cellContent.replace(/&amp;/g, '&');
      cellContent = cellContent.replace(/&#39;/g, "'");
      cellContent = cellContent.replace(/&quot;/g, '"');
      cellContent = cellContent.replace(/\s+/g, ' ');
      cellContent = cellContent.trim();
      cells.push(cellContent);
    }
    
    if (cells.length >= 2) {
      const label = cells[0];
      const values = cells.slice(1).filter(v => {
        const trimmed = v.trim();
        return trimmed && 
               trimmed !== '-' && 
               trimmed !== 'Upgrade' && 
               !trimmed.includes('2015') &&
               !trimmed.includes('Period') &&
               !trimmed.includes('Fiscal');
      });
      
      if (label && values.length > 0) {
        rows.push({ label, values });
      }
    }
  }
  
  return rows;
}

function extractTextFromHtml(html: string): string {
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ');
  text = text.replace(/<[^>]+>/g, '\n');
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec)));
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n\s*\n/g, '\n');
  return text.trim();
}

function formatOutput(data: ExtractedData): string {
  const lines: string[] = [];
  
  if (data.currentPrice) {
    lines.push('Compare');
    lines.push(data.currentPrice);
  }
  
  if (data.beta) {
    lines.push(`Beta\t${data.beta}`);
  }
  
  if (data.fcf && data.fcf.length > 0) {
    lines.push('Free Cash Flow');
    lines.push(data.fcf.join('\t'));
  }
  
  if (data.sharesOutstanding && data.sharesOutstanding.length > 0) {
    lines.push('Total Common Shares Outstanding');
    lines.push(data.sharesOutstanding.join('\t'));
  }
  
  if (data.totalDebt && data.totalDebt.length > 0) {
    lines.push('Total Debt');
    lines.push(data.totalDebt.join('\t'));
  }
  
  if (data.shareholdersEquity && data.shareholdersEquity.length > 0) {
    lines.push("Shareholders' Equity");
    lines.push(data.shareholdersEquity.join('\t'));
  }
  
  if (data.cashAndShortTermInvestments && data.cashAndShortTermInvestments.length > 0) {
    lines.push('Cash & Short-Term Investments');
    lines.push(data.cashAndShortTermInvestments.join('\t'));
  }
  
  if (data.effectiveTaxRate && data.effectiveTaxRate.length > 0) {
    lines.push('Effective Tax Rate');
    lines.push(data.effectiveTaxRate.map(v => v.replace(/%/g, '')).join('\t'));
  }
  
  if (data.interestExpense && data.interestExpense.length > 0) {
    lines.push('Interest Expense');
    lines.push(data.interestExpense.join('\t'));
  }
  
  if (data.interestExpense && data.interestExpense.length > 0 && 
      data.totalDebt && data.totalDebt.length > 0) {
    const interestValue = Math.abs(parseFloat(data.interestExpense[0].replace(/,/g, '')));
    const debtValue = parseFloat(data.totalDebt[0].replace(/,/g, ''));
    if (!isNaN(interestValue) && !isNaN(debtValue) && debtValue > 0) {
      const debtRate = ((interestValue / debtValue) * 100).toFixed(2);
      lines.push('Debt Interest Rate');
      lines.push(debtRate);
    }
  }
  
  return lines.join('\n');
}
