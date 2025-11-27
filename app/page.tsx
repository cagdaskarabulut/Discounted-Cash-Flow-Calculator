'use client';

import React, { useState } from "react";

export default function DCFCalculator() {
  const [fcf, setFcf] = useState("");
  const [projectionYears, setProjectionYears] = useState("5");
  const [fcfGrowthRate, setFcfGrowthRate] = useState("15");
  const [terminalGrowth, setTerminalGrowth] = useState("3.0");
  const [sharesOutstanding, setSharesOutstanding] = useState("");
  const [riskFreeRate, setRiskFreeRate] = useState("4.5");
  const [beta, setBeta] = useState("");
  const [equityRiskPremium, setEquityRiskPremium] = useState("5.5");
  const [debt, setDebt] = useState("");
  const [equity, setEquity] = useState("");
  const [cash, setCash] = useState("");
  const [debtRate, setDebtRate] = useState("3.5");
  const [taxRate, setTaxRate] = useState("");
  const [currentMarketPrice, setCurrentMarketPrice] = useState("");

  const [dcfResult, setDcfResult] = useState<number | null>(null);
  const [breakdown, setBreakdown] = useState<any>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [importText, setImportText] = useState("");
  const [infoPopup, setInfoPopup] = useState<{title: string, desc: string, keyword: string, url: string, urlLabel?: string} | null>(null);

  const calculateWACC = () => {
    const Re = parseFloat(riskFreeRate) + parseFloat(beta) * parseFloat(equityRiskPremium);
    const D = parseFloat(debt);
    const E = parseFloat(equity);
    if (!D || !E) return NaN;
    const V = D + E;
    const Rd = parseFloat(debtRate) * (1 - parseFloat(taxRate)/100);
    return (E / V) * Re + (D / V) * Rd;
  }

  const handleCalculate = () => {
    const wacc = calculateWACC() / 100;
    const fcfNum = parseFloat(fcf);
    const growthRate = parseFloat(fcfGrowthRate) / 100;
    const tgNum = parseFloat(terminalGrowth) / 100;
    const sharesNum = parseFloat(sharesOutstanding);
    const years = parseInt(projectionYears);
    const totalDebt = parseFloat(debt);
    const cashNum = parseFloat(cash) || 0;
  
    if (!fcfNum || !sharesNum || isNaN(wacc)) {
      alert("Lütfen tüm zorunlu alanları doğru girin!");
      return;
    }
  
    if (tgNum > 0.20) {
      alert("Terminal büyüme oranı çok yüksek! Maksimum %20 olmalıdır. Genellikle 2-5% aralığında kullanılır.");
      return;
    }
  
    if (wacc <= tgNum) {
      alert("WACC, terminal büyüme oranından büyük olmalıdır!");
      return;
    }
  
    let projectedFCFs = [];
    let pvOfProjectedFCFs = 0;
    
    for (let i = 1; i <= years; i++) {
      const projectedFCF = fcfNum * Math.pow(1 + growthRate, i);
      const pv = projectedFCF / Math.pow(1 + wacc, i);
      pvOfProjectedFCFs += pv;
      projectedFCFs.push({
        year: i,
        fcf: projectedFCF,
        pv: pv
      });
    }
  
    const lastYearFCF = fcfNum * Math.pow(1 + growthRate, years);
    const terminalValue = (lastYearFCF * (1 + tgNum)) / (wacc - tgNum);
    const pvTerminalValue = terminalValue / Math.pow(1 + wacc, years);
  
    const enterpriseValue = pvOfProjectedFCFs + pvTerminalValue;
    const netDebt = totalDebt - cashNum;
    const equityValue = enterpriseValue - netDebt;
    const dcf = equityValue / sharesNum;
  
    // DOĞRU HESAPLAMA: Projeksiyon yılını artırarak kaç yılda mevcut fiyata ulaşır?
    let yearsToReachCurrentPrice = null;
    const marketPrice = parseFloat(currentMarketPrice);
  
    if (marketPrice && marketPrice > 0 && dcf < marketPrice) {
      // İteratif olarak DCF hesabını yaparak kaç yılda market price'ı geçtiğini bul
      let testYear = years;
      let testDcf = dcf;
      const maxYears = 50; // Maksimum test yılı (sonsuz döngü önlemi)
      
      while (testDcf < marketPrice && testYear < maxYears) {
        testYear++;
        
        // Her test yılı için DCF'yi yeniden hesapla
        let testPvOfProjectedFCFs = 0;
        for (let i = 1; i <= testYear; i++) {
          const projectedFCF = fcfNum * Math.pow(1 + growthRate, i);
          const pv = projectedFCF / Math.pow(1 + wacc, i);
          testPvOfProjectedFCFs += pv;
        }
        
        const testLastYearFCF = fcfNum * Math.pow(1 + growthRate, testYear);
        const testTerminalValue = (testLastYearFCF * (1 + tgNum)) / (wacc - tgNum);
        const testPvTerminalValue = testTerminalValue / Math.pow(1 + wacc, testYear);
        
        const testEnterpriseValue = testPvOfProjectedFCFs + testPvTerminalValue;
        const testEquityValue = testEnterpriseValue - netDebt;
        testDcf = testEquityValue / sharesNum;
      }
      
      if (testYear < maxYears) {
        yearsToReachCurrentPrice = testYear;
      } else {
        // 50 yıl içinde ulaşılamazsa null bırak
        yearsToReachCurrentPrice = null;
      }
    }
  
    setDcfResult(dcf);
    setBreakdown({
      wacc: wacc * 100,
      projectedFCFs,
      pvOfProjectedFCFs,
      terminalValue,
      pvTerminalValue,
      enterpriseValue,
      netDebt,
      equityValue,
      yearsToReachCurrentPrice,
      currentMarketPrice: marketPrice
    });
  }

  const handleImport = () => {
    const lines = importText.split("\n");
    let currentMetric: string | null = null;
    setProjectionYears("5");
    // Normalize helper: başlıkları küçük harf, işaretsiz, çoklu boşlukları teke indir
    const normalize = (s: string) => s.toLowerCase()
      .replace(/&/g, ' and ')        // & yerine and yaz
      .replace(/[^a-zA-ZğüşöçıİĞÜŞÖÇ0-9\s']/g, '') // özel karakterleri at
      .replace(/\s+/g, ' ')         // çoklu boşlukları teke indir
      .trim();

    // Eşleştirmede kullanılacak başlıklar ve olası alternatifleri
    const metricMap: { [key: string]: string[] } = {
      fcf: ["free cash flow", "fcf", "serbest nakit akışı"].map(normalize),
      sharesOutstanding: ["total common shares outstanding", "shares outstanding (diluted)", "shares outstanding", "hisse sayısı"].map(normalize),
      debt: ["total debt", "borç", "toplam borç"].map(normalize),
      equity: ["shareholders' equity", "total equity", "özsermaye", "toplam özsermaye"].map(normalize),
      cash: [
        "cash & short-term investments",
        "cash and short-term investments",
        "cash short-term investments",
        "cash and cash equivalents",
        "cash equivalents",
        "nakit ve nakit benzerleri"
      ].map(normalize),
      taxRate: ["effective tax rate", "tax rate", "vergi oranı", "efektif vergi oranı", "vergiler"].map(normalize),
      beta: ["beta"].map(normalize),
      equityRiskPremium: ["equity risk premium", "özsermaye risk primi"].map(normalize),
      riskFreeRate: ["risk free rate", "risksiz faiz oranı"].map(normalize),
      debtRate: ["debt interest rate", "debt rate", "borç faiz oranı"].map(normalize),
      terminalGrowth: ["terminal growth rate", "terminal büyüme oranı"].map(normalize),
    };

    const setMetric = (metric: string, value: string) => {
      value = value.replace(/[%‰‱,]/g,"") // yüzde, permil işaretleri ve virgülleri ayıkla
                 .replace(/\s/g,"")        // boşlukları ayıkla
                 .replace(/\(.*\)/,"")     // parantez içinde bilgi varsa kaldır
                 .replace(/\$/g, "")        // $ işareti varsa kaldır
                 ;
      switch(metric) {
        case "fcf": setFcf(value); break;
        case "sharesOutstanding": setSharesOutstanding(value); break;
        case "debt": setDebt(value); break;
        case "equity": setEquity(value); break;
        case "cash": setCash(value); break;
        case "taxRate": setTaxRate(value); break;
        case "beta": setBeta(value); break;
        case "equityRiskPremium": setEquityRiskPremium(value); break;
        case "riskFreeRate": setRiskFreeRate(value); break;
        case "debtRate": setDebtRate(value); break;
        case "terminalGrowth": setTerminalGrowth(value); break;
        default:
      }
    };

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.toLowerCase() === "upgrade") return;

      const split = trimmed.split(/[:\t]+|  +/);
      if (split.length >= 2) {
        let key = normalize(split[0]);
        let value = split.slice(1).join(' ').trim();
        // Free Cash Flow satırı ise hem fcf hem büyüme oranını yaz
        if (metricMap.fcf.includes(key)) {
          // FCF'yi atayınca ilk değeri state'e koy
          const fcfArr = value.split(/\s+/).map(v => parseFloat(v.replace(/[,]/g, ''))).filter(x => !isNaN(x));
          if (fcfArr.length > 0) setFcf(fcfArr[0].toString());
          if (fcfArr.length > 1 && fcfArr[1] !== 0) {
            const growth = ((fcfArr[0] - fcfArr[1]) / Math.abs(fcfArr[1])) * 100 ;//0,8 ile çarparak bulunan katsayıyı %20 düşürerek kötümser senaryoda ne olacağını bulduk.
            console.log(growth);
            setFcfGrowthRate(growth.toFixed(2));
          }
          return;
        }
        for (const [metric, aliases] of Object.entries(metricMap)) {
          if (aliases.some(alias => key === alias)) {
            setMetric(metric, value);
            return;
          }
        }
      }

      // Eski mantıkla başlık satırı arama
      let lc = normalize(trimmed);
      for(const [metric, aliases] of Object.entries(metricMap)) {
        if(aliases.includes(lc)) {
          currentMetric = metric;
          return;
        }
      }

      // Sadece sayısal veri içeren satır yakala (ör: başlık satırından sonra gelen değer satırı)
      if (currentMetric) {
        if (currentMetric === "fcf") {
          let fcfArr = trimmed.split(/\s+/).map(v => parseFloat(v.replace(/[,]/g, ''))).filter(x => !isNaN(x));
          if (fcfArr.length > 0) setFcf(fcfArr[0].toString());
          if (fcfArr.length > 1 && fcfArr[1] !== 0) {
            const growth = ((fcfArr[0] - fcfArr[1]) / Math.abs(fcfArr[1])) * 100;
            setFcfGrowthRate(growth.toFixed(2));
          }
        } else {
          let num = trimmed.replace(/[%‰,\$]/g, "").trim().split(/\s+/)[0];
          setMetric(currentMetric, num);
        }
        currentMetric = null;
      }

    });

    // handleImport fonksiyonu içinde, aşağıdaki kod parçalarını lines.forEach'in altına ekle (tüm satırlar parse edildikten sonra, ilgili hesaplara bakılır)

    // --- Terminal Büyüme Oranı otomatik doldur ---
    // Eğer veri arasında 'Terminal Growth Rate' satırı veya varyasyonu varsa onu kullan,
    // yoksa son birkaç yılın FCF büyümesinin ortalamasını al, başka türlü ABD için 2.5 bırak.
    let foundTerminalGrowth = false;
    for (let l of lines) {
      if (/terminal growth rate/i.test(l)) {
        foundTerminalGrowth = true;
        // Satır başlığı veya altındaki sayı satırı olarak çöz
        let idx = lines.indexOf(l);
        let numLine = lines[idx+1] || l;
        let vals = numLine.match(/[-+]?\d+[\d,\.\s]*/g);
        if(vals && vals[0]) {
          let num = parseFloat(vals[0].replace(/,/,''));
          if(!isNaN(num)) setTerminalGrowth(num.toString());
        }
      }
    }
    if (!foundTerminalGrowth) {
      // Free Cash Flow satırındaki büyüme ortalamasını bul
      let fcfLines = lines.filter(l => /free cash flow/i.test(l));
      if(fcfLines.length) {
        let idx = lines.indexOf(fcfLines[0]);
        let valLine = lines[idx+1] || '';
        let arr = valLine.split(/\s+/).map(v=>parseFloat(v.replace(/,/,''))).filter(v=>!isNaN(v));
        if (arr.length >= 3) {
          // Sadece son 3 yılın büyümesini al (daha stabil)
          let recentGrowths = [];
          for (let i = 0; i < Math.min(3, arr.length - 1); i++) {
            const growth = (arr[i] - arr[i + 1]) / Math.abs(arr[i + 1]) * 100;
            recentGrowths.push(growth);
          }
          let avgRecent = recentGrowths.reduce((a, b) => a + b, 0) / recentGrowths.length;
        
          // Terminal büyüme için mantıklı aralık: 0% - 8%
          let suggestedTerminal = Math.max(0, Math.min(4, avgRecent)); // 0-8% arası sıkıştır
          setTerminalGrowth(suggestedTerminal.toFixed(2));
        } else {
          setTerminalGrowth("3.0"); // default güvenli değer
        }
      }
    }

    // Varsayılanlar ve sayısal tanımlayıcılar
    let defaultRF = "4.5";
    let defaultERP = "5.5";
    let foundRiskFreeRate = null, foundEquityRP = null, foundDebtRate: {interest?: number; debt?: number} = {};
    // Faiz Oranı: Önce Risk Free Rate, 'Risk Free Rate' veya '10-Year Treasury yield' bul
    for (let i = 0; i < lines.length; i++) {
      let l = lines[i];
      try {
        // Risksiz Faiz Oranı
        if (/risk[\s-]?free[\s-]?rate|10[- ]?year.*treasury.*yield/i.test(l)) {
          // Aynı satır veya alt satırda sayı bul
          let vals = l.match(/\d+[\d,\.]*/) || (lines[i+1]||'').match(/\d+[\d,\.]*/);
          if(vals && vals[0]) {
            foundRiskFreeRate = vals[0].replace(/,/g,'');
          }
        }
        // Interest Expense
        if (/interest expense/i.test(l)) {
          let nums = l.split(/\s+/).concat((lines[i+1]||'').split(/\s+/));
          let n = nums.map(x => parseFloat(x.replace(/,/g,''))).find(x=>!isNaN(x));
          if(typeof n === 'number' && n !== 0) foundDebtRate = {interest:n};
        }
        // Total Debt
        if (/total debt/i.test(l)) {
          let nums = l.split(/\s+/).concat((lines[i+1]||'').split(/\s+/));
          let n = nums.map(x => parseFloat(x.replace(/,/g,''))).find(x=>!isNaN(x));
          if(typeof n === 'number' && n !== 0) {
            if(!foundDebtRate) foundDebtRate = {};
            foundDebtRate.debt = n;
          }
        }
      } catch(e) {}
    }
    if(foundRiskFreeRate) setRiskFreeRate(foundRiskFreeRate);
    else setRiskFreeRate(defaultRF);

    // Borç Faiz Oranı hesapla
    if(foundDebtRate.interest !== undefined && foundDebtRate.debt !== undefined) {
      setDebtRate(((Math.abs(foundDebtRate.interest)/foundDebtRate.debt)*100).toFixed(2));
    } else {
      setDebtRate("");
    }
    // Equity Risk Premium
    if(foundRiskFreeRate) setEquityRiskPremium((10-parseFloat(foundRiskFreeRate)).toFixed(2));
    else setEquityRiskPremium(defaultERP);
    
    // Current Market Price - "Compare" satırından sonraki fiyat değerini bul
    for (let i = 0; i < lines.length; i++) {
      let l = lines[i];
      if (/^compare$/i.test(l.trim())) {
        // Bir sonraki satırda fiyat değerini ara
        let nextLine = lines[i+1] || '';
        // İlk sayısal değeri bul (ör: 180.26)
        let priceMatch = nextLine.match(/^(\d+\.?\d*)/);
        if (priceMatch && priceMatch[1]) {
          setCurrentMarketPrice(priceMatch[1]);
          break;
        }
        // Eğer bir sonraki satırda bulamazsa, aynı satırda da ara
        let sameLineMatch = l.match(/(\d+\.?\d*)/);
        if (sameLineMatch && sameLineMatch[1]) {
          setCurrentMarketPrice(sameLineMatch[1]);
          break;
        }
      }
    }
    
    setShowPopup(false);
    //alert("Veriler başarıyla aktarıldı!");
  }

  // Temizle fonksiyonu
  const handleClear = () => {
    setCurrentMarketPrice("");
    setFcf("");
    setProjectionYears("");
    setFcfGrowthRate("");
    setTerminalGrowth("");
    setSharesOutstanding("");
    setRiskFreeRate("");
    setBeta("");
    setEquityRiskPremium("");
    setDebt("");
    setEquity("");
    setCash("");
    setDebtRate("");
    setTaxRate("");
    setDcfResult(null);
    setBreakdown(null);
    setImportText("");
    setShowPopup(false);
  };

  return (
    <div style={{ fontFamily: 'Arial', maxWidth: '700px', margin: '20px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', boxShadow: '0px 4px 8px rgba(0,0,0,0.1)' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#0070f3' }}>DCF Hesaplayıcı</h2>
      
      <div style={{ background: '#f0f8ff', padding: '15px', borderRadius: '5px', marginBottom: '20px', fontSize: '14px' }}>
        <p><strong>DCF Formülleri:</strong></p>
        <p>1. Gelecek yıllar için FCF projeksiyon: FCF × (1 + g)^t</p>
        <p>2. Her yılın bugünkü değeri: FCF_t / (1 + WACC)^t</p>
        <p>3. Terminal Value = FCF_son × (1 + g_terminal) / (WACC - g_terminal)</p>
        <p>4. Enterprise Value = Σ PV(FCF) + PV(Terminal Value)</p>
        <p>5. Equity Value = Enterprise Value - Net Borç</p>
        <p>6. Hisse Başı Değer = Equity Value / Hisse Sayısı</p>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
          Mevcut Piyasa Fiyatı ($)
          <span
            onClick={() => setInfoPopup({
              title: 'Mevcut Piyasa Fiyatı',
              desc: 'Hissenin şu anki piyasa fiyatını girin. Bu, DCF hedef fiyatına kaç yılda ulaşılabileceğini hesaplamak için kullanılacaktır.',
              keyword: 'stock current market price',
              url: 'https://www.investing.com',
              urlLabel: 'Investing.com',
            })}
            style={{ cursor: 'pointer', backgroundColor: '#0070f3', color: 'white', borderRadius: '50%', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold', userSelect: 'none' }}
            title="Hissenin şu anki piyasa fiyatını girin"
          >?</span>
        </label>
        <input 
          type="number" 
          value={currentMarketPrice} 
          onChange={e => setCurrentMarketPrice(e.target.value)} 
          placeholder="Örn: 180" 
          style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ccc', borderRadius: '4px'}}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ fontWeight: 'bold', color: '#dc3545' }}>Mevcut Yıllık Free Cash Flow - Milyon (Free Cash Flow)</label>
        <input type="number" value={fcf} onChange={e => setFcf(e.target.value)} placeholder="Örn: 77324" style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ccc', borderRadius: '4px'}}/>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
          Projeksiyon Yılı Sayısı
          <span
            onClick={() => setInfoPopup({
              title: 'Projeksiyon Yılı Sayısı',
              desc: 'DCF analizinde kaç yıl ileriye projeksiyon yapmak istediğinizi belirleyin. Genellikle 5-10 yıl kullanılır. Daha uzun dönemler için belirsizlik artar.',
              keyword: 'DCF projection period best practice',
              url: 'https://www.investopedia.com/terms/d/dcf.asp',
              urlLabel: 'Investopedia',
            })}
            style={{ cursor: 'pointer', backgroundColor: '#0070f3', color: 'white', borderRadius: '50%', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold', userSelect: 'none' }}
            title="DCF analizinde kaç yıl ileriye projeksiyon yapmak istediğinizi belirleyin. Genellikle 5-10 yıl kullanılır. Daha uzun dönemler için belirsizlik artar."
          >?</span>
        </label>
        <input type="number" value={projectionYears} onChange={e => setProjectionYears(e.target.value)} placeholder="Örn: 5" style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ccc', borderRadius: '4px'}}/>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
          Yıllık FCF Büyüme Oranı (%)
          <span title="Şirketin gelecek yıllarda serbest nakit akışının yıllık olarak ne kadar büyüyeceğini tahmin edin. Geçmiş büyüme oranlarına, sektör ortalamasına ve şirketin büyüme stratejisine bakabilirsiniz. Konservatif olmak önemlidir."
            onClick={() => setInfoPopup({
              title: 'Yıllık FCF Büyüme Oranı',
              desc: 'Şirketin gelecek yıllarda serbest nakit akışının yıllık olarak ne kadar büyüyeceğini tahmin edin. Geçmiş büyüme oranlarına, sektör ortalamasına ve şirketin büyüme stratejisine bakabilirsiniz. Konservatif olmak önemlidir.',
              keyword: 'FCF growth rate estimate method',
              url: 'https://corporatefinanceinstitute.com/resources/valuation/discounted-cash-flow-dcf/',
              urlLabel: 'Corporate Finance Institute',
            })}
            style={{ cursor: 'pointer', backgroundColor: '#0070f3', color: 'white', borderRadius: '50%', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold', userSelect: 'none' }}>
            ?
          </span>
        </label>
        <input type="number" value={fcfGrowthRate} onChange={e => setFcfGrowthRate(e.target.value)} placeholder="Örn: 10" style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ccc', borderRadius: '4px'}}/>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
          Terminal Büyüme Oranı (%)
          <span title="Projeksiyon dönemi sonrası şirketin kalıcı büyüme oranı. Genellikle ekonominin uzun vadeli büyüme oranına (GSYİH büyümesi) yakın olmalı. ABD için 2-3%, gelişmekte olan ülkeler için biraz daha yüksek olabilir."
            onClick={() => setInfoPopup({
              title: 'Terminal Büyüme Oranı',
              desc: 'Projeksiyon dönemi sonrası şirketin kalıcı büyüme oranı. Genellikle ekonominin uzun vadeli büyüme oranına (GSYİH büyümesi) yakın olmalı. ABD için 2-3%, gelişmekte olan ülkeler için biraz daha yüksek olabilir.',
              keyword: 'terminal growth rate economy GDP',
              url: 'https://www.wallstreetprep.com/knowledge/dcf-terminal-value/',
              urlLabel: 'WallStreetPrep',
            })}
            style={{ cursor: 'pointer', backgroundColor: '#0070f3', color: 'white', borderRadius: '50%', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold', userSelect: 'none' }}>
            ?
          </span>
        </label>
        <input 
  type="number" 
  value={terminalGrowth} 
  onChange={e => setTerminalGrowth(e.target.value)} 
  placeholder="Örn: 3" 
  max="10"  // EKLE
  step="0.1"  // EKLE
  style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ccc', borderRadius: '4px'}}
/>      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ fontWeight: 'bold', color: '#dc3545' }}>Hisse Sayısı - Milyon (Total Common Shares Outstanding)</label>
        <input type="number" value={sharesOutstanding} onChange={e => setSharesOutstanding(e.target.value)} placeholder="Örn: 24305" style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ccc', borderRadius: '4px'}}/>
      </div>

      <hr style={{ margin: '20px 0' }}/>

      <h3 style={{ marginBottom: '15px' }}>WACC Parametreleri</h3>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
          Risksiz Faiz Oranı (%)
          <span title="10 yıllık devlet tahvili faiz oranını kullanın. ABD için 10-Year Treasury yield, Türkiye için 10 yıllık gösterge tahvil faizi. Bloomberg, Investing.com veya merkez bankası sitelerinden güncel değeri bulabilirsiniz."
            onClick={() => setInfoPopup({
              title: 'Risksiz Faiz Oranı',
              desc: '10 yıllık devlet tahvili faiz oranını kullanın. ABD için 10-Year Treasury yield, Türkiye için 10 yıllık gösterge tahvil faizi. Bloomberg, Investing.com veya merkez bankası sitelerinden güncel değeri bulabilirsiniz.',
              keyword: '10 year treasury yield current',
              url: 'https://www.investing.com/rates-bonds/u.s.-10-year-bond-yield',
              urlLabel: 'Investing.com',
            })}
            style={{ cursor: 'pointer', backgroundColor: '#0070f3', color: 'white', borderRadius: '50%', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold', userSelect: 'none' }}>
            ?
          </span>
        </label>
        <input type="number" value={riskFreeRate} onChange={e => setRiskFreeRate(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ccc', borderRadius: '4px'}}/>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ fontWeight: 'bold', color: '#dc3545' }}>Beta (Beta)</label>
        <input type="number" value={beta} onChange={e => setBeta(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ccc', borderRadius: '4px'}}/>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
          Özsermaye Risk Primi (%)
          <span title="Piyasanın beklenen getirisi ile risksiz faiz oranı arasındaki fark. ABD piyasası için tarihsel ortalama ~5-6%, gelişmekte olan piyasalar için 6-8% aralığında kullanılabilir. Damodaran'ın sitesinden güncel değerleri bulabilirsiniz."
            onClick={() => setInfoPopup({
              title: 'Özsermaye Risk Primi',
              desc: 'Piyasanın beklenen getirisi ile risksiz faiz oranı arasındaki fark. ABD piyasası için tarihsel ortalama ~5-6%, gelişmekte olan piyasalar için 6-8% aralığında kullanılabilir. Damodaran\'ın sitesinden güncel değerleri bulabilirsiniz.',
              keyword: 'equity risk premium average by country',
              url: 'https://pages.stern.nyu.edu/~adamodar/',
              urlLabel: 'NYU Stern School of Business',
            })}
            style={{ cursor: 'pointer', backgroundColor: '#0070f3', color: 'white', borderRadius: '50%', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold', userSelect: 'none' }}>
            ?
          </span>
        </label>
        <input type="number" value={equityRiskPremium} onChange={e => setEquityRiskPremium(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ccc', borderRadius: '4px'}}/>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ fontWeight: 'bold', color: '#dc3545' }}>Toplam Borç - Milyon (Total Debt)</label>
        <input type="number" value={debt} onChange={e => setDebt(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ccc', borderRadius: '4px'}}/>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ fontWeight: 'bold', color: '#dc3545' }}>Toplam Özsermaye - Milyon (Shareholders' Equity)</label>
        <input type="number" value={equity} onChange={e => setEquity(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ccc', borderRadius: '4px'}}/>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ fontWeight: 'bold', color: '#dc3545' }}>Nakit ve Nakit Benzerleri - Milyon (Cash & Short-Term Investments)</label>
        <input type="number" value={cash} onChange={e => setCash(e.target.value)} placeholder="Örn: 0" style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ccc', borderRadius: '4px'}}/>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
          Borç Faiz Oranı (%)
          <span title="Şirketin borç maliyeti. Gelir tablosunda faiz giderleri varsa: (Faiz Gideri / Toplam Borç) x 100 formülü ile hesaplayabilirsiniz. Alternatif olarak şirketin tahvil getirisini veya benzer şirketlerin borçlanma maliyetini kullanabilirsiniz."
            onClick={() => setInfoPopup({
              title: 'Borç Faiz Oranı',
              desc: 'Şirketin borç maliyeti. Gelir tablosunda faiz giderleri varsa: (Faiz Gideri / Toplam Borç) x 100 formülü ile hesaplayabilirsiniz. Alternatif olarak şirketin tahvil getirisini veya benzer şirketlerin borçlanma maliyetini kullanabilirsiniz.',
              keyword: 'company cost of debt calculation',
              url: 'https://www.investopedia.com/terms/c/costofdebt.asp',
              urlLabel: 'Investopedia',
            })}
            style={{ cursor: 'pointer', backgroundColor: '#0070f3', color: 'white', borderRadius: '50%', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold', userSelect: 'none' }}>
            ?
          </span>
        </label>
        <input type="number" value={debtRate} onChange={e => setDebtRate(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ccc', borderRadius: '4px'}}/>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ fontWeight: 'bold', color: '#dc3545' }}>
          Efektif Vergi Oranı (%) (Effective Tax Rate)
        </label>
        <input type="number" value={taxRate} onChange={e => setTaxRate(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '5px', border: '1px solid #ccc', borderRadius: '4px'}}/>
      </div>

      <button onClick={handleCalculate} style={{ width: '100%', padding: '12px', marginTop: '10px', backgroundColor: '#0070f3', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>Hesapla</button>
      {/* Temizle butonu */}
      <button onClick={handleClear} style={{ width: '100%', padding: '12px', marginTop: '10px', backgroundColor: '#f8e731', color: '#333', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>Temizle</button>

      {dcfResult && (
        <div style={{ marginTop: '25px', padding: '20px', background: '#e8f5e9', borderRadius: '8px' }}>
          <h3 style={{ color: '#2e7d32', textAlign: 'center', marginBottom: '10px', fontSize: '28px' }}>
            DCF Hedef Fiyatı: ${Math.round(dcfResult).toLocaleString('en-US')}
          </h3>
          <p style={{ textAlign: 'center', color: '#666', fontSize: '14px', marginTop: '5px' }}>
            Tam değer: ${dcfResult.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
          </p>
          
          {breakdown && (
            <div style={{ marginTop: '20px', padding: '15px', background: '#fff3cd', borderRadius: '5px', border: '1px solid #ffc107' }}>
              <h4 style={{ color: '#856404', marginBottom: '10px', fontSize: '18px' }}>
                ⏰ Zaman Analizi
              </h4>
              <p style={{ fontSize: '14px', lineHeight: '1.6', color: '#856404' }}>
                <strong>Mevcut Piyasa Fiyatı:</strong> ${breakdown.currentMarketPrice.toFixed(2)}
              </p>
              <p style={{ fontSize: '14px', lineHeight: '1.6', color: '#856404' }}>
                <strong>DCF Hedef Fiyatı:</strong> ${dcfResult.toFixed(2)}
              </p>
              {dcfResult < breakdown.currentMarketPrice && breakdown.yearsToReachCurrentPrice && (
                <p style={{ fontSize: '16px', lineHeight: '1.6', color: '#856404', marginTop: '10px', fontWeight: 'bold' }}>
                  📊 Mevcut büyüme varsayımlarıyla DCF değerinin piyasa fiyatına ulaşması için: 
                  <span style={{ fontSize: '20px', color: '#d9534f' }}> {breakdown.yearsToReachCurrentPrice} yıl</span>
                </p>
              )}
              
              <p><strong>WACC:</strong> {breakdown.wacc.toFixed(2)}%</p>
              <p><strong>Projekte Edilen FCF'lerin Bugünkü Değeri:</strong> ${breakdown.pvOfProjectedFCFs.toLocaleString('en-US', {maximumFractionDigits: 2})} Milyon</p>
              <p><strong>Terminal Value:</strong> ${breakdown.terminalValue.toLocaleString('en-US', {maximumFractionDigits: 2})} Milyon</p>
              <p><strong>Terminal Value (Bugünkü Değer):</strong> ${breakdown.pvTerminalValue.toLocaleString('en-US', {maximumFractionDigits: 2})} Milyon</p>
              <p><strong>Enterprise Value:</strong> ${breakdown.enterpriseValue.toLocaleString('en-US', {maximumFractionDigits: 2})} Milyon</p>
              <p><strong>Net Borç:</strong> ${breakdown.netDebt.toLocaleString('en-US', {maximumFractionDigits: 2})} Milyon</p>
              <p><strong>Equity Value:</strong> ${breakdown.equityValue.toLocaleString('en-US', {maximumFractionDigits: 2})} Milyon</p>
            </div>
          )}
        </div>
      )}

      <button onClick={() => setShowPopup(true)} style={{ marginTop: '15px', width: '100%', padding: '10px', backgroundColor: '#555', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Dışarıdan Veri Aktar</button>

      {showPopup && (
        <div style={{ position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex: 1000 }}>
          <div style={{ background:'#fff', padding:'20px', borderRadius:'8px', width:'80%', maxWidth:'600px', maxHeight: '80vh', overflow: 'auto' }}>
            <h3>Toplu Veri Yapıştır</h3>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '10px' }}>
              Finansal verileri (başlıklar ve değerlerle birlikte) buraya yapıştırın. İlk sütun TTM değerleri olmalıdır.
            </p>
            <textarea value={importText} onChange={e=>setImportText(e.target.value)} rows={15} style={{ width:'100%', padding:'8px', border: '1px solid #ccc', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px' }} placeholder="Örnek:
Free Cash Flow
77324  60853  27021
Total Debt
10481  10270  11056
..."></textarea>
            <button onClick={handleImport} style={{ marginTop:'10px', padding:'10px', width:'100%', backgroundColor:'#0070f3', color:'#fff', border:'none', borderRadius:'5px', cursor:'pointer' }}>Aktar</button>
            <button onClick={()=>setShowPopup(false)} style={{ marginTop:'10px', padding:'10px', width:'100%', backgroundColor:'#aaa', color:'#fff', border:'none', borderRadius:'5px', cursor:'pointer' }}>İptal</button>
          </div>
        </div>
      )}
      {infoPopup && (
        <div style={{ position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex: 2000 }}>
          <div style={{ background:'#fff', padding:'24px', borderRadius:'10px', minWidth:'320px', maxWidth:'420px', boxShadow: '0 6px 24px rgba(0,0,0,0.20)' }}>
            <h4 style={{marginBottom:'8px'}}>{infoPopup.title}</h4>
            <div style={{ fontSize: '15px', color: '#333', marginBottom:8 }}>{infoPopup.desc}</div>
            <div style={{ fontSize:'13px', marginBottom:4 }}><b>Google Arama:</b> <span style={{color:'#045'}}>{infoPopup.keyword}</span></div>
            <div style={{ fontSize:'13px' }}><b>Kaynak:</b> <a href={infoPopup.url} target='_blank' rel='noopener noreferrer'>{infoPopup.urlLabel || infoPopup.url}</a></div>
            <button onClick={()=>setInfoPopup(null)} style={{ marginTop:'18px', width:'100%', padding:'10px', backgroundColor:'#aaa', color:'#fff', border:'none', borderRadius:'5px', cursor:'pointer' }}>Kapat</button>
          </div>
        </div>
      )}
    </div>
  )
}