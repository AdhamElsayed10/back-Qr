async function testApi() {
  // Login to production
  const res = await fetch('https://qrpdf02backend-production.up.railway.app/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'Admin@123123' })
  });
  
  if (!res.ok) {
    console.log('Login failed', await res.text());
    return;
  }
  const data = await res.json();
  const token = data.token;
  
  // Fetch documents from production API
  const docsRes = await fetch('https://qrpdf02backend-production.up.railway.app/api/documents', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!docsRes.ok) {
    console.log('Docs fetch failed', await docsRes.text());
    return;
  }
  const docs = await docsRes.json();
  console.log('Docs from API:', docs);
}

testApi().catch(console.error);
