// Seeds the sabrXwatches premium catalog through the bulk API.
// Brand is "Unbranded" and unverified specifications are intentionally left blank so the
// server stores "Not Specified" — nothing here invents a brand, a movement or a water rating.
// Each row carries its own generated placeholder artwork; the admin replaces it with the
// real product photo from the watch form at any time.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
const line = env.split(/\r?\n/).find(l => l.startsWith('ADMIN_PASSKEY='));
const PASSKEY = line.slice(line.indexOf('=') + 1).trim();
const BASE = process.env.BASE || 'http://127.0.0.1:5000';

const artwork = (label, body, accent) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
<rect width="400" height="400" fill="#0F172A"/>
<rect x="180" y="26" width="40" height="110" rx="12" fill="${accent}" opacity="0.45"/>
<rect x="180" y="264" width="40" height="110" rx="12" fill="${accent}" opacity="0.45"/>
<circle cx="200" cy="200" r="96" fill="${body}" stroke="${accent}" stroke-width="7"/>
<circle cx="200" cy="200" r="78" fill="none" stroke="${accent}" stroke-width="2" opacity="0.5"/>
<path d="M200 150v50l32 20" fill="none" stroke="${accent}" stroke-width="7" stroke-linecap="round"/>
<text x="200" y="342" fill="#C9A96E" font-family="Georgia,serif" font-size="19" letter-spacing="1" text-anchor="middle">${label}</text>
<text x="200" y="368" fill="#6B7280" font-family="sans-serif" font-size="13" text-anchor="middle">sabrXwatches preview - replace with product photo</text>
</svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg.replace(/\n/g, ''));
};

const CATALOG = [
  {
    productName: 'Onyx Steel Precision Analog Watch',
    category: 'analog', tagline: 'Matte black dial on a polished steel-tone bracelet',
    sellingPrice: 1299, badge: 'BEST SELLER', dialColor: 'Black', caseColor: 'Silver',
    strapColor: 'Silver', dialShape: 'Round', stockCount: 25,
    description: 'A quiet statement piece. The deep black dial sits inside a slim polished case and rides a linked steel-tone bracelet, so it reads as easily with a shirt cuff as with a kurta on a festive evening. Marker indices are kept large and legible, and the hands sweep clean across the dial for effortless everyday time reading. An dependable first choice for collectors building a premium wardrobe from the ground up.',
    keyFeatures: 'High-contrast black dial with luminous marker indices|Slim polished case profile that slides under a cuff|Linked steel-tone bracelet with a secure folding clasp|Scratch-conscious mineral-style face finish|Unisex sizing for 15-20 cm wrists|Ready to gift in premium protective packing'
  },
  {
    productName: 'Octavia Eight-Sided Frame Analog Watch',
    category: 'analog', tagline: 'Distinctive octagon case with a sunburst dial',
    sellingPrice: 1499, badge: 'PREMIUM', dialColor: 'Blue', caseColor: 'Gold-tone',
    strapColor: 'Gold-tone', dialShape: 'Octagon', stockCount: 20,
    description: 'The octagon case is the whole story here: eight clean facets catch light from every angle while a sunburst blue dial shifts tone as the wrist moves. Applied indices and a printed minute track lend it a dressy, considered look without shouting for attention. Choose this one when you want a watch that people recognise from across the room.',
    keyFeatures: 'Eye-catching octagonal bezel with faceted polishing|Sunburst blue dial that shifts colour in daylight|Applied stick indices with a fine printed minute track|Dressy gold-tone case and bracelet pairing|Concealed clasp keeps the bracelet line unbroken|A confident choice for weddings and evening wear'
  },
  {
    productName: 'Vista Open-Work Skeleton Analog Watch',
    category: 'skeleton', tagline: 'Layered open dial with visible inner mechanics',
    sellingPrice: 1699, badge: 'SKELETON', dialColor: 'Gunmetal', caseColor: 'Silver',
    strapColor: 'Black', dialShape: 'Round', stockCount: 15,
    description: 'An open-work dial turns the watch into a small piece of engineering on your wrist, with layered bridges and cut-out indices that let you follow the movement underneath. The gunmetal finishing keeps it modern rather than ornate, and the dark strap stops the whole thing from feeling too dressy. This is the conversation-starting pick for anyone who likes detail over logo.',
    keyFeatures: 'Cut-out open-work dial showing the inner architecture|Gunmetal bridges and indices for a contemporary finish|Textured dark strap that balances the busy dial|Screw-down style case back with a see-through window|Statement sizing for medium to large wrists|Arrives packed with extra links ready for adjustment'
  },
  {
    productName: 'Aurelia Chain-Link Gold-Tone Watch',
    category: 'analog', tagline: 'Warm gold-tone dial on a jewelry-style chain bracelet',
    sellingPrice: 1399, badge: 'GOLD', dialColor: 'Gold', caseColor: 'Gold-tone',
    strapColor: 'Gold-tone', dialShape: 'Round', stockCount: 22,
    description: 'A gold-tone dial and a fine chain bracelet give this piece the feel of jewellery first and a watch second. The Roman numeral ring keeps it grounded and readable, and the slim profile means it stacks neatly with a bangle or a fitness band. A natural pick for festive season gifting and wedding-season wardrobes.',
    keyFeatures: 'All-over warm gold-tone finish from dial to bracelet|Slim chain bracelet that sits softly on the wrist|Roman numeral track for a classic dress look|Light-reflecting fluted bezel detail|Adjustable links for a close, comfortable fit|Packed in a gift-ready protective case'
  },
  {
    productName: 'Duet Two-Tone Classic Analog Watch',
    category: 'analog', tagline: 'Silver and gold two-tone case with a clean white dial',
    sellingPrice: 1349, badge: 'TWO-TONE', dialColor: 'White', caseColor: 'Two-tone',
    strapColor: 'Two-tone', dialShape: 'Round', stockCount: 24,
    description: 'Two-tone is the easiest way to wear gold without committing to it: silver links carry the bracelet while gold accents frame the bezel and indices. The bright white dial with slim baton markers keeps things crisp for office hours, and the date aperture at three o clock adds a practical note. A safe, handsome all-rounder for daily Indian wear.',
    keyFeatures: 'Silver-and-gold two-tone bracelet and bezel|Bright white dial with slim baton indices|Date window positioned at three o clock|Polished centre links with brushed outer links|Secure double-push folding clasp|Comfortable 38-40 mm visual proportion on wrist'
  },
  {
    productName: 'Noir Leather-Strap Formal Watch',
    category: 'analog', tagline: 'Black dial paired with a textured leather-style strap',
    sellingPrice: 1199, badge: 'FORMAL', dialColor: 'Black', caseColor: 'Silver',
    strapColor: 'Black', dialShape: 'Round', stockCount: 26,
    description: 'A restrained formal watch: silver case, matte black dial, and a textured black strap that keeps the watch light on the wrist through long days. Nothing on the dial competes with anything else, which is exactly why it works with formals, smart-casuals and office shirts alike. The strap is quick to swap when you fancy a change.',
    keyFeatures: 'Understated matte black dial with polished hands|Textured black leather-style strap with stitching|Lightweight silver-tone round case|Quick-release style strap for easy changes|Buckle clasp with adjustable hole spacing|An ideal first formal watch under fifteen hundred'
  },
  {
    productName: 'Verdant Green-Strap Sport Skeleton Watch',
    category: 'skeleton', tagline: 'Fresh green silicone-style strap with an open dial',
    sellingPrice: 1599, badge: 'TRENDING', dialColor: 'Black', caseColor: 'Silver',
    strapColor: 'Green', dialShape: 'Round', stockCount: 18,
    description: 'The green strap makes this one unmistakable in a crowd. Underneath the open-work dial you can watch the mechanics move, while the flexible sports strap keeps it comfortable through monsoon commutes and weekend plans. Bold, casual and made for people who are bored of black.',
    keyFeatures: 'Vivid green flexible sports strap|Open-work dial with visible gear bridges|Dark dial ring for strong contrast and legibility|Silver-tone case with a brushed finish|Water-friendly silicone-style strap material|Sized for a confident, sporty statement look'
  },
  {
    productName: 'Saffron Yellow-Strap Skeleton Watch',
    category: 'skeleton', tagline: 'Sunbright yellow strap with a modern cut-out dial',
    sellingPrice: 1549, badge: 'NEW', dialColor: 'Silver', caseColor: 'Black',
    strapColor: 'Yellow', dialShape: 'Round', stockCount: 18,
    description: 'A sunbright yellow strap against a black case gives this skeleton watch a sporty, festival-ready personality. The cut-out dial keeps the mechanics visible while the light indices make sure the time still reads at a glance. Perfect for college students, weekend travel and anyone building a casual watch rotation.',
    keyFeatures: 'Cheerful yellow strap with a soft matte texture|Black-coated case for sharp contrast|Cut-out dial revealing the movement architecture|Broad luminous hands for quick reading|Pin buckle with extra adjustment holes|Great as a everyday casual or gift purchase'
  },
  {
    productName: 'Minima Bare-Minimal Analog Watch',
    category: 'analog', tagline: 'Bare dial, hairline markers, nothing extra',
    sellingPrice: 1099, badge: 'MINIMAL', dialColor: 'White', caseColor: 'Rose-tone',
    strapColor: 'Brown', dialShape: 'Round', stockCount: 30,
    description: 'Everything unnecessary has been removed: a plain pale dial, hairline markers, two slim hands and a small seconds sub-dial. The rose-tone case warms it up and the brown strap keeps it friendly rather than corporate. This is the watch for people who want their timepiece to disappear into an outfit.',
    keyFeatures: 'Clutter-free dial with hairline minute markers|Warm rose-tone slim round case|Small seconds sub-dial at six o clock|Brown strap with a soft worn-in feel|Feather-light on the wrist for all-day wear|Pairs with minimal, Scandinavian-style wardrobes'
  },
  {
    productName: 'Strato Black-Dial Chronograph-Style Watch',
    category: 'analog', tagline: 'Sporty sub-dial layout with a bold tachymeter ring',
    sellingPrice: 1799, badge: 'SPORT', dialColor: 'Black', caseColor: 'Black',
    strapColor: 'Black', dialShape: 'Round', stockCount: 20,
    description: 'A full-black sports look with three contrasting sub-dial rings and an engraved bezel scale that reads like a proper chronograph. Broad luminous hands and blocky indices keep the time obvious at speed, and the dark bracelet shrugs off gym bags and two-wheeler rides. Sporty without needing a logo to prove it.',
    keyFeatures: 'Tri-sub-dial sport layout on a matte black face|Engraved bezel scale for a technical look|Wide luminous hands and block indices|All-black case and bracelet combination|Push-button style side profile|Built for gym, travel and everyday wear'
  },
  {
    productName: 'Heritage Classic Formal Analog Watch',
    category: 'analog', tagline: 'Cream dial with Roman numerals and a slim case',
    sellingPrice: 1249, badge: 'CLASSIC', dialColor: 'Cream', caseColor: 'Gold-tone',
    strapColor: 'Black', dialShape: 'Round', stockCount: 24,
    description: 'Roman numerals on a cream lacquer dial, framed by a slim gold-tone case and finished with a black strap: a genuinely traditional look that suits formals, interviews and family functions. The dial is quiet enough to read instantly, and the case slips under a shirt cuff without resistance. Timeless in the most literal sense.',
    keyFeatures: 'Cream lacquer dial with printed Roman numerals|Slim gold-tone case that disappears under a cuff|Black strap with a classic pin buckle|Small-seconds dial for a traditional layout|Lightweight dress watch proportions|A dependable choice for formal occasions'
  },
  {
    productName: 'Lumiere Luxury-Style Skeleton Dress Watch',
    category: 'skeleton', tagline: 'Dressy open dial with a gold-tone framework',
    sellingPrice: 1899, badge: 'LUXURY', dialColor: 'Skeleton', caseColor: 'Gold-tone',
    strapColor: 'Brown', dialShape: 'Round', stockCount: 16,
    description: 'The most dressed-up skeleton in the range: a gold-tone framework over exposed bridges, with a brown strap that keeps it evening-appropriate. Light moves through the open dial all day, so the watch never looks flat in photographs or in person. Made for the person who already owns two normal watches.',
    keyFeatures: 'Gold-tone open-work framework with layered bridges|Exposed mechanics visible from dial and back|Brown strap chosen for evening wear|Domed crystal for depth and light play|Statement dress sizing with a slim profile|Positioned as the collection flagship piece'
  }
];

const rows = CATALOG.map(p => ({
  productName: p.productName,
  brandName: 'Unbranded',
  category: p.category,
  tagline: p.tagline,
  sellingPrice: p.sellingPrice,
  referenceMRP: p.sellingPrice,
  badge: p.badge,
  dialColor: p.dialColor,
  caseColor: p.caseColor,
  strapColor: p.strapColor,
  dialShape: p.dialShape,
  stockCount: p.stockCount,
  description: p.description,
  keyFeatures: p.keyFeatures,
  image: artwork(p.productName.split(' ').slice(0, 2).join(' ').toUpperCase(), p.dialColor === 'Skeleton' ? '#16202E' : (p.dialColor === 'Black' ? '#111827' : p.dialColor === 'Gunmetal' ? '#1F2937' : p.dialColor === 'Blue' ? '#1E3A8A' : p.dialColor === 'Cream' ? '#F3EAD8' : p.dialColor === 'White' ? '#F8FAFC' : '#B08D57'), p.caseColor === 'Gold-tone' || p.caseColor === 'Rose-tone' ? '#C9A96E' : '#94A3B8')
}));

(async () => {
  const res = await fetch(`${BASE}/api/products/bulk`, {
    method: 'POST',
    headers: { 'x-admin-passkey': PASSKEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ products: rows })
  });
  const data = await res.json();
  console.log('HTTP', res.status);
  console.log('created', (data.created || []).length, '| skipped', (data.skipped || []).length, '| invalid', (data.invalid || []).length);
  if (data.error) console.log('error:', data.error);
  (data.invalid || []).forEach(x => console.log('  invalid row', x.row, x.error));

  const list = await (await fetch(`${BASE}/api/products?includeHidden=true`)).json();
  const arr = Array.isArray(list) ? list : list.products;
  console.log('catalog total', arr.length);
  const images = arr.map(p => p.image);
  console.log('every product image unique:', new Set(images).size === images.length);
})();
