/**
 * Calls the Gemini API for the Drawing Intelligence passes and normalizes
 * the structural-analysis responses returned by Google Generative AI.
 */

export async function qt_callGeminiParts(key, prompt, parts, maxRetry = 5) {
  let lastErr;
  let attempt = 0;
  while (attempt < maxRetry) {
    attempt++;
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, ...parts] }], generationConfig: { temperature: 0.05, maxOutputTokens: 8192 } })
        }
      );
      const data = await res.json();
      if (res.status === 429) {
        const msg = data?.error?.message || '';
        const waitMatch = msg.match(/retry in ([\d.]+)s/i);
        const waitSec = waitMatch ? Math.ceil(parseFloat(waitMatch[1])) + 2 : 20;
        globalThis.qt_setProgress?.(`⏳ Quota หมด — รอ ${waitSec}s แล้ว retry (${attempt}/${maxRetry})…`);
        await new Promise(r => setTimeout(r, waitSec * 1000));
        continue;
      }
      if (res.status === 503) {
        const waitSec = Math.min(10 * attempt, 60);
        globalThis.qt_setProgress?.(`⚠️ Server busy — รอ ${waitSec}s แล้ว retry (${attempt}/${maxRetry})…`);
        await new Promise(r => setTimeout(r, waitSec * 1000));
        continue;
      }
      if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
      const raw = normalizeGeminiRaw(data);
      return raw;
    } catch (err) {
      lastErr = err;
      if (err.message.includes('API key') || err.message.includes('invalid')) break;
      if (attempt >= maxRetry) break;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw lastErr || new Error('เกิดข้อผิดพลาด');
}

function normalizeGeminiRaw(data) {
  let raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  raw = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  const s = raw.indexOf('{');
  const e = raw.lastIndexOf('}');
  if (s !== -1 && e > s) raw = raw.slice(s, e + 1);
  try { return JSON.parse(raw); }
  catch (_e) {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch (__e) { }
    }
    throw new Error('AI ตอบกลับไม่ถูก format');
  }
}

export async function qt_callGemini(key, prompt, base64, mime, maxRetry = 3) {
  return qt_callGeminiParts(key, prompt, [{ inline_data: { mime_type: mime, data: base64 } }], maxRetry);
}

export function qt_getMime(f) {
  if (f.type === 'application/pdf') return 'application/pdf';
  if (f.type === 'image/png') return 'image/png';
  if (f.type === 'image/webp') return 'image/webp';
  return 'image/jpeg';
}

/**
 * Classifies a single drawing page image into a sheet_type for the onboarding wizard
 * (Step 1 thumbnail grid). Returns { sheet_type, confidence } — falls back to
 * { sheet_type: 'unknown', confidence: 0 } if the model can't answer.
 *
 * @param {string} key - Gemini API key
 * @param {string} imageDataUrl - data URL, e.g. "data:image/jpeg;base64,...."
 * @returns {Promise<{ sheet_type: 'floor_plan'|'section_detail'|'general_notes'|'schedule_table'|'unknown', confidence: number }>}
 */
export async function qt_classifySheet(key, imageDataUrl) {
  const prompt = `You are a structural engineer reviewing a single page from a construction drawing set.\nClassify this page into ONE category:\n- "floor_plan": structural/architectural floor or layout plan showing element positions (columns, beams, slabs in plan view)\n- "section_detail": section/elevation/detail sheet showing beam/column sections with dimensions and rebar callouts\n- "general_notes": general notes, legend, specifications, or cover sheet\n- "schedule_table": column/beam/footing schedule table\n- "unknown": none of the above, or unreadable\nReturn ONLY valid JSON: {"sheet_type":"floor_plan","confidence":0.9}`;
  const mime = imageDataUrl.slice(5, imageDataUrl.indexOf(';'));
  const data = imageDataUrl.split(',')[1];
  try {
    const result = await qt_callGeminiParts(key, prompt, [{ inline_data: { mime_type: mime, data } }], 2);
    const sheetType = ['floor_plan', 'section_detail', 'general_notes', 'schedule_table', 'unknown'].includes(result?.sheet_type)
      ? result.sheet_type : 'unknown';
    const confidence = typeof result?.confidence === 'number' ? Math.max(0, Math.min(1, result.confidence)) : 0;
    return { sheet_type: sheetType, confidence };
  } catch (e) {
    console.error('[qt_classifySheet] error:', e.message);
    return { sheet_type: 'unknown', confidence: 0 };
  }
}
