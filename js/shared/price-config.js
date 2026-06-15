const PRICE_CONFIG_VERSION = '2026.1';

const MATERIAL_PRICES = {
  concrete: {
    ready_mix_180: { label: 'คอนกรีตผสมเสร็จ 180 ksc', unit: 'ลบ.ม.', price: 2449.40, price_vat: null, source: 'cgd_2026', source_label: 'ราคากลาง กรมบัญชีกลาง 2569', source_date: '2026-01-13', region: 'central', brand: null, notes: 'CGD 2026', supabase_id: null },
    ready_mix_210: { label: 'คอนกรีตผสมเสร็จ 210 ksc', unit: 'ลบ.ม.', price: 2434.20, price_vat: null, source: 'cgd_2026', source_label: 'ราคากลาง กรมบัญชีกลาง 2569', source_date: '2026-01-13', region: 'central', brand: null, notes: 'CGD 2026', supabase_id: null },
    ready_mix_240: { label: 'คอนกรีตผสมเสร็จ 240 ksc', unit: 'ลบ.ม.', price: 2470.60, price_vat: null, source: 'cgd_2026', source_label: 'ราคากลาง กรมบัญชีกลาง 2569', source_date: '2026-01-13', region: 'central', brand: null, notes: 'CGD 2026', supabase_id: null },
    ready_mix_280: { label: 'คอนกรีตผสมเสร็จ 280 ksc', unit: 'ลบ.ม.', price: 2507.00, price_vat: null, source: 'cgd_2026', source_label: 'ราคากลาง กรมบัญชีกลาง 2569', source_date: '2026-01-13', region: 'central', brand: null, notes: 'CGD 2026', supabase_id: null },
    ready_mix_320: { label: 'คอนกรีตผสมเสร็จ 320 ksc', unit: 'ลบ.ม.', price: 2680.00, price_vat: null, source: 'cgd_2026', source_label: 'ราคากลาง กรมบัญชีกลาง 2569', source_date: '2026-01-13', region: 'central', brand: null, notes: 'CGD 2026', supabase_id: null },
    ready_mix_350: { label: 'คอนกรีตผสมเสร็จ 350 ksc', unit: 'ลบ.ม.', price: 2850.00, price_vat: null, source: 'cgd_2026', source_label: 'ราคากลาง กรมบัญชีกลาง 2569', source_date: '2026-01-13', region: 'central', brand: null, notes: 'CGD 2026', supabase_id: null },
    lean_140: { label: 'คอนกรีตหยาบ (Lean) 140 ksc', unit: 'ลบ.ม.', price: 1900.00, price_vat: null, source: 'cgd_2026', source_label: 'ราคากลาง กรมบัญชีกลาง 2569', source_date: '2026-01-13', region: 'central', brand: null, notes: 'CGD 2026', supabase_id: null },
  },
  rebar: {
    sr24_6: { label: 'เหล็กเส้นกลม SR24 DB6', unit: 'กก.', price: 19.35, price_vat: null, source: 'cgd_2026', source_label: 'ราคากลาง กรมบัญชีกลาง 2569', source_date: '2026-01-13', region: 'central', brand: null, notes: 'CGD 2026', supabase_id: null },
    sr24_9: { label: 'เหล็กเส้นกลม SR24 DB9', unit: 'กก.', price: 18.60, price_vat: null, source: 'cgd_2026', source_label: 'ราคากลาง กรมบัญชีกลาง 2569', source_date: '2026-01-13', region: 'central', brand: null, notes: 'CGD 2026', supabase_id: null },
    sr24_12: { label: 'เหล็กเส้นกลม SR24 DB12', unit: 'กก.', price: 18.25, price_vat: null, source: 'cgd_2026', source_label: 'ราคากลาง กรมบัญชีกลาง 2569', source_date: '2026-01-13', region: 'central', brand: null, notes: 'CGD 2026', supabase_id: null },
    sr24_15: { label: 'เหล็กเส้นกลม SR24 DB15', unit: 'กก.', price: 18.05, price_vat: null, source: 'cgd_2026', source_label: 'ราคากลาง กรมบัญชีกลาง 2569', source_date: '2026-01-13', region: 'central', brand: null, notes: 'CGD 2026', supabase_id: null },
    sr24_19: { label: 'เหล็กเส้นกลม SR24 DB19', unit: 'กก.', price: 18.15, price_vat: null, source: 'cgd_2026', source_label: 'ราคากลาง กรมบัญชีกลาง 2569', source_date: '2026-01-13', region: 'central', brand: null, notes: 'CGD 2026', supabase_id: null },
    sr24_25: { label: 'เหล็กเส้นกลม SR24 DB25', unit: 'กก.', price: 18.15, price_vat: null, source: 'cgd_2026', source_label: 'ราคากลาง กรมบัญชีกลาง 2569', source_date: '2026-01-13', region: 'central', brand: null, notes: 'CGD 2026', supabase_id: null },
    sd30_10: { label: 'เหล็กข้ออ้อย SD30 DB10', unit: 'กก.', price: 18.50, price_vat: null, source: 'cgd_2026', source_label: 'ราคากลาง กรมบัญชีกลาง 2569', source_date: '2026-01-13', region: 'central', brand: null, notes: 'CGD 2026', supabase_id: null },
    sd30_12: { label: 'เหล็กข้ออ้อย SD30 DB12', unit: 'กก.', price: 18.45, price_vat: null, source: 'cgd_2026', source_label: 'ราคากลาง กรมบัญชีกลาง 2569', source_date: '2026-01-13', region: 'central', brand: null, notes: 'CGD 2026', supabase_id: null },
    sd30_16: { label: 'เหล็กข้ออ้อย SD30 DB16', unit: 'กก.', price: 18.30, price_vat: null, source: 'cgd_2026', source_label: 'ราคากลาง กรมบัญชีกลาง 2569', source_date: '2026-01-13', region: 'central', brand: null, notes: 'CGD 2026', supabase_id: null },
    sd40_12: { label: 'เหล็กข้ออ้อย SD40 DB12', unit: 'กก.', price: 18.70, price_vat: null, source: 'cgd_2026', source_label: 'ราคากลาง กรมบัญชีกลาง 2569', source_date: '2026-01-13', region: 'central', brand: null, notes: 'CGD 2026', supabase_id: null },
    sd40_16: { label: 'เหล็กข้ออ้อย SD40 DB16', unit: 'กก.', price: 18.50, price_vat: null, source: 'cgd_2026', source_label: 'ราคากลาง กรมบัญชีกลาง 2569', source_date: '2026-01-13', region: 'central', brand: null, notes: 'CGD 2026', supabase_id: null },
    sd40_20: { label: 'เหล็กข้ออ้อย SD40 DB20', unit: 'กก.', price: 18.50, price_vat: null, source: 'cgd_2026', source_label: 'ราคากลาง กรมบัญชีกลาง 2569', source_date: '2026-01-13', region: 'central', brand: null, notes: 'CGD 2026', supabase_id: null },
    sd40_25: { label: 'เหล็กข้ออ้อย SD40 DB25', unit: 'กก.', price: 18.50, price_vat: null, source: 'cgd_2026', source_label: 'ราคากลาง กรมบัญชีกลาง 2569', source_date: '2026-01-13', region: 'central', brand: null, notes: 'CGD 2026', supabase_id: null },
    sd40_28: { label: 'เหล็กข้ออ้อย SD40 DB28', unit: 'กก.', price: 18.60, price_vat: null, source: 'cgd_2026', source_label: 'ราคากลาง กรมบัญชีกลาง 2569', source_date: '2026-01-13', region: 'central', brand: null, notes: 'CGD 2026', supabase_id: null },
    sd40_32: { label: 'เหล็กข้ออ้อย SD40 DB32', unit: 'กก.', price: 18.60, price_vat: null, source: 'cgd_2026', source_label: 'ราคากลาง กรมบัญชีกลาง 2569', source_date: '2026-01-13', region: 'central', brand: null, notes: 'CGD 2026', supabase_id: null },
  },
  formwork: {
    column: { label: 'แบบหล่อเสา', unit: 'ตร.ม.', price: 280, price_vat: null, source: 'cgd_2026', source_label: 'ราคากลาง กรมบัญชีกลาง 2569', source_date: '2026-01', region: 'central', brand: null, notes: null, supabase_id: null },
    beam: { label: 'แบบหล่อคาน', unit: 'ตร.ม.', price: 300, price_vat: null, source: 'cgd_2026', source_label: 'ราคากลาง กรมบัญชีกลาง 2569', source_date: '2026-01', region: 'central', brand: null, notes: null, supabase_id: null },
    slab: { label: 'แบบหล่อพื้น', unit: 'ตร.ม.', price: 260, price_vat: null, source: 'cgd_2026', source_label: 'ราคากลาง กรมบัญชีกลาง 2569', source_date: '2026-01', region: 'central', brand: null, notes: null, supabase_id: null },
    wall: { label: 'แบบหล่อผนัง', unit: 'ตร.ม.', price: 270, price_vat: null, source: 'cgd_2026', source_label: 'ราคากลาง กรมบัญชีกลาง 2569', source_date: '2026-01', region: 'central', brand: null, notes: null, supabase_id: null },
    footing: { label: 'แบบหล่อฐานราก', unit: 'ตร.ม.', price: 250, price_vat: null, source: 'cgd_2026', source_label: 'ราคากลาง กรมบัญชีกลาง 2569', source_date: '2026-01', region: 'central', brand: null, notes: null, supabase_id: null },
  },
  labor: {
    concrete_pour: { label: 'ค่าแรงเทคอนกรีต', unit: 'ลบ.ม.', price: 450, price_vat: null, source: 'cgd_2026', source_label: 'ราคากลาง กรมบัญชีกลาง 2569', source_date: '2026-01', region: 'central', brand: null, notes: null, supabase_id: null },
    rebar_install: { label: 'ค่าแรงผูกเหล็ก', unit: 'กก.', price: 8, price_vat: null, source: 'cgd_2026', source_label: 'ราคากลาง กรมบัญชีกลาง 2569', source_date: '2026-01', region: 'central', brand: null, notes: null, supabase_id: null },
    formwork_install: { label: 'ค่าแรงติดตั้งแบบหล่อ', unit: 'ตร.ม.', price: 120, price_vat: null, source: 'cgd_2026', source_label: 'ราคากลาง กรมบัญชีกลาง 2569', source_date: '2026-01', region: 'central', brand: null, notes: null, supabase_id: null },
  },
};

const PRICE_SOURCES = {
  cgd_2026: { label: 'กรมบัญชีกลาง 2569', authority: 'government', color: '#1a7a4a', icon: '🏛️' },
  tpso_market: { label: 'ราคาตลาด TPSO', authority: 'market', color: '#d97706', icon: '📊' },
  manual: { label: 'กรอกเอง', authority: 'user', color: '#6b7280', icon: '✏️' },
  upload: { label: 'อัปโหลดไฟล์', authority: 'user_file', color: '#7c3aed', icon: '📁' },
};

function normalizeMaterialKey(category, subtype) {
  if (category && subtype) return `${category}.${subtype}`;
  return category || null;
}

function getOverrideStore() {
  try {
    const raw = localStorage.getItem('constistant_price_override');
    return raw ? JSON.parse(raw) : { overrides: {} };
  } catch (e) {
    return { overrides: {} };
  }
}

function getPriceByCategory(category, subtype = null) {
  const key = normalizeMaterialKey(category, subtype);
  const [baseCategory, baseSubtype] = key.split('.');
  const bucket = MATERIAL_PRICES[baseCategory] || {};
  const entry = bucket[baseSubtype || key] || null;
  return entry ? { ...entry, material_key: key } : null;
}

function getConcretePrice(ksc) {
  const key = `ready_mix_${ksc}`;
  return MATERIAL_PRICES.concrete[key] || MATERIAL_PRICES.concrete.ready_mix_240;
}

function getRebarPrice(grade, diameter_mm) {
  const normalizedGrade = String(grade || 'SD40').toLowerCase();
  const normalizedDia = String(diameter_mm || '').replace(/[^0-9]/g, '');
  const key = `${normalizedGrade}_${normalizedDia ? `db${normalizedDia}` : 'db16'}`;
  const direct = MATERIAL_PRICES.rebar[key] || MATERIAL_PRICES.rebar[Object.keys(MATERIAL_PRICES.rebar).find(k => k.startsWith(normalizedGrade) && k.includes(normalizedDia || '16'))];
  return direct || MATERIAL_PRICES.rebar.sd40_db16;
}

function getFormworkPrice(element_type) {
  return MATERIAL_PRICES.formwork[element_type] || MATERIAL_PRICES.formwork.beam;
}

function getPriceSourceInfo(source_code) {
  return PRICE_SOURCES[source_code] || { label: source_code || 'unknown', authority: 'unknown', color: '#6b7280', icon: '•' };
}

function getEffectivePrice(material_key) {
  const base = getPriceByCategory(material_key.split('.')[0], material_key.split('.')[1]) || MATERIAL_PRICES.concrete.ready_mix_240;
  const overrides = getOverrideStore();
  const override = overrides.overrides?.[material_key];
  return override ? { ...base, ...override, source: override.source || base.source, price: Number(override.price ?? base.price), is_overridden: true } : { ...base, is_overridden: false };
}

function exportPriceConfigForSupabase() {
  const rows = [];
  Object.entries(MATERIAL_PRICES).forEach(([category, items]) => {
    Object.entries(items).forEach(([key, item]) => {
      rows.push({
        material_key: `${category}.${key}`,
        category,
        label_th: item.label,
        unit: item.unit,
        price: item.price,
        price_vat: item.price_vat,
        source_code: item.source,
        source_label: item.source_label,
        source_date: item.source_date,
        region: item.region,
        brand: item.brand,
        notes: item.notes,
        is_active: true,
      });
    });
  });
  return rows;
}

const priceConfig = {
  PRICE_CONFIG_VERSION,
  MATERIAL_PRICES,
  PRICE_SOURCES,
  getPriceByCategory,
  getConcretePrice,
  getRebarPrice,
  getFormworkPrice,
  getPriceSourceInfo,
  getEffectivePrice,
  exportPriceConfigForSupabase,
};

export {
  PRICE_CONFIG_VERSION,
  MATERIAL_PRICES,
  PRICE_SOURCES,
  getPriceByCategory,
  getConcretePrice,
  getRebarPrice,
  getFormworkPrice,
  getPriceSourceInfo,
  getEffectivePrice,
  exportPriceConfigForSupabase,
};

export default priceConfig;

window.getPriceByCategory = getPriceByCategory;
window.getConcretePrice = getConcretePrice;
window.getRebarPrice = getRebarPrice;
window.getFormworkPrice = getFormworkPrice;
window.getPriceSourceInfo = getPriceSourceInfo;
window.getEffectivePrice = getEffectivePrice;
window.exportPriceConfigForSupabase = exportPriceConfigForSupabase;
