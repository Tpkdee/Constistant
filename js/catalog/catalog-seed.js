// Pre-built material price catalog packs ("Catalog สำเร็จรูป")
//
// Developer-provided catalog content that users can "install" into their
// own material_prices rows (Supabase) — see js/catalog/material-catalog.js.
// Item lists are placeholders ("เร็วๆ นี้") until real supplier prices are sourced.

/**
 * @typedef {Object} CatalogPack
 * @property {string} id            - stable id, also used as catalog_source prefix ('catalog_' + id)
 * @property {string} icon
 * @property {string} name
 * @property {string} provider
 * @property {string} description
 * @property {string} last_updated  - ISO date
 * @property {Array<Object>} items  - rows shaped like material_prices (without id/user_id/timestamps)
 */

/** @type {CatalogPack[]} */
export const CATALOG_PACKS = [
  {
    id: 'scg',
    icon: '🏭',
    name: 'SCG Building Materials 2025',
    provider: 'SCG',
    description: 'หมวดปูนซีเมนต์ คอนกรีตผสมเสร็จ และแผ่นพื้นสำเร็จรูป',
    last_updated: '2026-01-15',
    items: [
      { material_type: 'concrete', material_subtype: 'ready_mix_concrete', brand: 'SCG', trade_name: 'คอนกรีตผสมเสร็จ SCG (เร็วๆ นี้)', unit: 'm3', unit_price: null, supplier_name: 'SCG', notes: 'เร็วๆ นี้ — ยังไม่เปิดราคา' },
      { material_type: 'concrete', material_subtype: 'precast_slab', brand: 'SCG', trade_name: 'แผ่นพื้นสำเร็จรูป SCG (เร็วๆ นี้)', unit: 'm2', unit_price: null, supplier_name: 'SCG', notes: 'เร็วๆ นี้ — ยังไม่เปิดราคา' },
      { material_type: 'masonry', material_subtype: 'cement_block', brand: 'SCG', trade_name: 'ปูนซีเมนต์ถุง SCG (เร็วๆ นี้)', unit: 'kg', unit_price: null, supplier_name: 'SCG', notes: 'เร็วๆ นี้ — ยังไม่เปิดราคา' },
    ],
  },
  {
    id: 'siam_steel',
    icon: '⚙️',
    name: 'Siam Steel / บางสะพานบาร์',
    provider: 'Siam Steel',
    description: 'หมวดเหล็กเส้นเสริมคอนกรีต และเหล็กโครงสร้างรูปพรรณ',
    last_updated: '2026-01-10',
    items: [
      { material_type: 'rebar', material_subtype: 'deformed_bar', brand: 'Siam Steel', trade_name: 'เหล็กเส้นกลม RB6 (เร็วๆ นี้)', unit: 'kg', unit_price: null, supplier_name: 'บางสะพานบาร์', notes: 'เร็วๆ นี้ — ยังไม่เปิดราคา' },
      { material_type: 'rebar', material_subtype: 'deformed_bar', brand: 'Siam Steel', trade_name: 'เหล็กข้ออ้อย DB12 (เร็วๆ นี้)', unit: 'kg', unit_price: null, supplier_name: 'บางสะพานบาร์', notes: 'เร็วๆ นี้ — ยังไม่เปิดราคา' },
      { material_type: 'rebar', material_subtype: 'structural_steel', brand: 'Siam Steel', trade_name: 'เหล็กรูปพรรณ H-Beam (เร็วๆ นี้)', unit: 'ton', unit_price: null, supplier_name: 'บางสะพานบาร์', notes: 'เร็วๆ นี้ — ยังไม่เปิดราคา' },
    ],
  },
  {
    id: 'government',
    icon: '🏛️',
    name: 'ราคากลางรัฐบาล (BOQ มาตรฐานกรมบัญชีกลาง)',
    provider: 'Government (BOI)',
    description: 'ราคากลางวัสดุก่อสร้าง อ้างอิงกรมบัญชีกลาง ใช้สำหรับงานราชการ',
    last_updated: '2026-01-01',
    items: [
      { material_type: 'concrete', material_subtype: 'ready_mix_concrete', brand: null, trade_name: 'คอนกรีตผสมเสร็จ ราคากลาง (เร็วๆ นี้)', unit: 'm3', unit_price: null, supplier_name: 'กรมบัญชีกลาง', notes: 'เร็วๆ นี้ — ยังไม่เปิดราคา' },
      { material_type: 'rebar', material_subtype: 'deformed_bar', brand: null, trade_name: 'เหล็กเสริมคอนกรีต ราคากลาง (เร็วๆ นี้)', unit: 'kg', unit_price: null, supplier_name: 'กรมบัญชีกลาง', notes: 'เร็วๆ นี้ — ยังไม่เปิดราคา' },
      { material_type: 'formwork', material_subtype: 'plywood_formwork', brand: null, trade_name: 'แบบหล่อไม้อัด ราคากลาง (เร็วๆ นี้)', unit: 'm2', unit_price: null, supplier_name: 'กรมบัญชีกลาง', notes: 'เร็วๆ นี้ — ยังไม่เปิดราคา' },
    ],
  },
  {
    id: 'sme_starter',
    icon: '🧰',
    name: 'วัสดุก่อสร้างทั่วไป (SME Starter Pack)',
    provider: 'Constistant',
    description: 'รายการราคาเฉลี่ยตลาดกรุงเทพฯ สำหรับผู้เริ่มต้นใช้งาน',
    last_updated: '2026-02-01',
    items: [
      { material_type: 'concrete', material_subtype: 'ready_mix_concrete', brand: null, trade_name: 'คอนกรีตผสมเสร็จ fc=240 ksc (เร็วๆ นี้)', unit: 'm3', unit_price: null, supplier_name: null, notes: 'เร็วๆ นี้ — ยังไม่เปิดราคา' },
      { material_type: 'rebar', material_subtype: 'deformed_bar', brand: null, trade_name: 'เหล็กเส้นเสริมคอนกรีต ทั่วไป (เร็วๆ นี้)', unit: 'kg', unit_price: null, supplier_name: null, notes: 'เร็วๆ นี้ — ยังไม่เปิดราคา' },
      { material_type: 'formwork', material_subtype: 'plywood_formwork', brand: null, trade_name: 'แบบหล่อไม้อัด ทั่วไป (เร็วๆ นี้)', unit: 'm2', unit_price: null, supplier_name: null, notes: 'เร็วๆ นี้ — ยังไม่เปิดราคา' },
      { material_type: 'masonry', material_subtype: 'cement_block', brand: null, trade_name: 'อิฐมอญ/บล็อกก่อผนัง ทั่วไป (เร็วๆ นี้)', unit: 'piece', unit_price: null, supplier_name: null, notes: 'เร็วๆ นี้ — ยังไม่เปิดราคา' },
      { material_type: 'finishing', material_subtype: 'tile', brand: null, trade_name: 'กระเบื้องปูพื้น ทั่วไป (เร็วๆ นี้)', unit: 'm2', unit_price: null, supplier_name: null, notes: 'เร็วๆ นี้ — ยังไม่เปิดราคา' },
      { material_type: 'mep', material_subtype: 'electrical_wire', brand: null, trade_name: 'สายไฟฟ้า ทั่วไป (เร็วๆ นี้)', unit: 'set', unit_price: null, supplier_name: null, notes: 'เร็วๆ นี้ — ยังไม่เปิดราคา' },
    ],
  },
];

export function getCatalogPack(id) {
  return CATALOG_PACKS.find(pack => pack.id === id) || null;
}
