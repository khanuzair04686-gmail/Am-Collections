// Reports which admin rows would break the inline onclick that passes the title as a
// JS string literal (apostrophes in product names are very common in this catalog).
const fs = require('fs');
const http = require('http');

http.get('http://localhost:5000/api/products?includeHidden=true', (res) => {
  let d = '';
  res.on('data', (c) => { d += c; });
  res.on('end', () => {
    const rows = JSON.parse(d);
    const risky = rows.filter((p) => /['"`\\]/.test(`${p.brand} ${p.model}`));
    console.log(`admin rows: ${rows.length}`);
    console.log(`rows whose Delete onclick is broken by a quote: ${risky.length}`);
    risky.forEach((p) => console.log(`   ${p.id} -> ${p.brand} ${p.model}`));
    const zero = rows.filter((p) => !(Number(p.price) > 0));
    console.log(`rows with missing/zero price: ${zero.length}`);
    zero.forEach((p) => console.log(`   ${p.id} -> price ${JSON.stringify(p.price)} mrp ${JSON.stringify(p.originalPrice)} | ${p.model}`));
  });
});
