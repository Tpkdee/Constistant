// AI-assisted price-file parser placeholder for upload flow.
// The parser uses SheetJS when available and falls back to simple CSV parsing.

const PRICE_UPLOAD_KEY = 'constistant_price_override';

async function parseExcelFile(file) {
  const name = file?.name || 'upload';
  if (!file) return { fileName: name, rows: [], error: 'No file selected' };

  const lower = name.toLowerCase();
  if (lower.endsWith('.csv')) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    const headers = lines[0].split(',');
    const rows = lines.slice(1).map((line, index) => {
      const values = line.split(',');
      return Object.fromEntries(headers.map((h, i) => [h.trim(), values[i] ?? '']));
    });
    return { fileName: name, rows, source: 'csv' };
  }

  try {
    const xlsx = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');
    const data = await file.arrayBuffer();
    const workbook = xlsx.read(data, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(firstSheet, { defval: '' });
    return { fileName: name, rows, source: 'xlsx' };
  } catch (error) {
    console.warn('[price-parser] fallback parse used', error);
    return { fileName: name, rows: [], source: 'fallback', error: 'SheetJS unavailable in this session' };
  }
}

async function aiMapPriceRows(rows, materialKeys) {
  const mapped = [];
  const unmapped = [];

  rows.forEach((row, index) => {
    const label = String(row.label || row.item || row.name || row['ชื่อรายการ'] || '').trim();
    const price = Number(row.price || row.unit_price || row['ราคา/หน่วย'] || row['บาท/กก.'] || 0);
    const unit = String(row.unit || row['หน่วย'] || '');

    const match = materialKeys.find(key => label.toLowerCase().includes(key.toLowerCase()));
    if (match && Number.isFinite(price)) {
      mapped.push({ material_key: match, label_th: label, price, unit, confidence: 0.82, source_row: index + 2 });
    } else {
      unmapped.push({ original_label: label || `แถว ${index + 2}`, source_row: index + 2, reason: 'ไม่พบ material_key ที่ตรงกันใน catalog ปัจจุบัน' });
    }
  });

  return { mapped, unmapped, detected_source: 'upload', detected_date: new Date().toISOString().slice(0, 10) };
}

function showPriceParsePreview(mappedItems, unmappedItems) {
  const root = document.getElementById('material-catalog-app');
  if (!root) return;
  const summary = `พบ ${mappedItems.length} รายการที่สามารถจับคู่ได้ และ ${unmappedItems.length} รายการที่ยังไม่แมป`;
  alert(summary);
  return summary;
}

function confirmAndSaveParsedPrices(confirmedItems, sourceInfo = {}) {
  const store = JSON.parse(localStorage.getItem(PRICE_UPLOAD_KEY) || '{"version":"1.0","overrides":{}}');
  const updatedAt = new Date().toISOString();
  confirmedItems.forEach(item => {
    const key = item.material_key;
    store.overrides[key] = {
      price: Number(item.price),
      source: 'upload',
      note: sourceInfo.detected_source || 'อัปโหลดผ่าน AI Parse',
      updated_at: updatedAt,
    };
  });
  store.version = '1.0';
  store.updated_at = updatedAt;
  localStorage.setItem(PRICE_UPLOAD_KEY, JSON.stringify(store));
  return store;
}

async function uploadPriceFile(file) {
  const parsed = await parseExcelFile(file);
  const materialKeys = ['concrete.ready_mix_240', 'rebar.sd30_db12', 'formwork.column'];
  const aiResult = await aiMapPriceRows(parsed.rows, materialKeys);
  showPriceParsePreview(aiResult.mapped, aiResult.unmapped);
  return { parsed, aiResult };
}

export {
  parseExcelFile,
  aiMapPriceRows,
  showPriceParsePreview,
  confirmAndSaveParsedPrices,
  uploadPriceFile,
};

window.uploadPriceFile = uploadPriceFile;
window.confirmAndSaveParsedPrices = confirmAndSaveParsedPrices;
