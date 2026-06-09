/**
 * Converts Gemini responses into the beam/element structures used by the
 * review cards and quantity takeoff flow.
 */

export function qt_normalizeGeminiResponse(data) {
  return data || { warnings: [], elements: [] };
}

export function qt_buildBeamLibrary(elements = []) {
  return elements.map((el, idx) => ({
    id: el.id || `EL${idx + 1}`,
    type: el.type || 'beam',
    width: el.width || 0,
    height: el.height || 0,
    estimated: Boolean(el.estimated),
    sections: el.sections || [],
    length_groups: el.length_groups || []
  }));
}
