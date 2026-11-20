async function verifyAll() {
  console.log('--- Verifying Live Endpoints & Proxy ---');
  const urls = [
    { name: 'Frontend HTML', url: 'http://localhost:5173/' },
    { name: 'Vite Main Module', url: 'http://localhost:5173/src/main.jsx' },
    { name: 'Vite App Module', url: 'http://localhost:5173/src/App.jsx' },
    { name: 'Tailwind CSS Output', url: 'http://localhost:5173/src/index.css' },
    { name: 'Backend Health Direct', url: 'http://localhost:3002/api/health' },
    { name: 'Vite Proxy -> Auth Status', url: 'http://localhost:5173/api/auth/status' },
    { name: 'Vite Proxy -> Demo Emails', url: 'http://localhost:5173/api/emails?mode=demo' },
    { name: 'Vite Proxy -> Vouched Stats', url: 'http://localhost:5173/api/stats' }
  ];

  let allPassed = true;

  for (const item of urls) {
    try {
      const res = await fetch(item.url);
      const contentType = res.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const body = isJson ? await res.json() : await res.text();
      
      const preview = isJson ? JSON.stringify(body).slice(0, 100) : body.slice(0, 80).replace(/\s+/g, ' ');
      console.log(`✅ [${res.status}] ${item.name} (${item.url}) -> ${preview}...`);
      if (res.status !== 200) allPassed = false;
    } catch (err) {
      console.error(`❌ [FAIL] ${item.name} (${item.url}) -> ${err.message}`);
      allPassed = false;
    }
  }

  console.log('--- Summary: ' + (allPassed ? 'ALL ENDPOINTS OK' : 'SOME ENDPOINTS FAILED') + ' ---');
}

verifyAll();

