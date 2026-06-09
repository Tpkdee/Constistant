/**
 * Shared drawing-data contract used by the Drawing Intelligence workflow.
 * These shapes mirror the element and beam-library structures the Gemini
 * responses are parsed into before they are rendered on the page.
 */
export const DRAWING_SCHEMA = {
  drawing_elements: 'Array of structural elements returned by Gemini',
  beam_library: 'Beam/column/slab records enriched with section details and length groups'
};
