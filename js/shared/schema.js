/**
 * schema.js — Constistant Shared Data Contract
 *
 * RULE: ห้ามสร้าง object shape เองในทุก module
 * ทุก module ต้อง import factory function จากไฟล์นี้เท่านั้น
 * การเปลี่ยน schema ทำที่นี่ที่เดียว แล้ว propagate ทั้งระบบ
 *
 * Dependency chain:
 *   projects
 *     └── drawing_uploads
 *           ├── beam_library        (Pass 1: section detail sheets)
 *           └── drawing_elements    (Pass 2: floor plan counts)
 *                 ├── boq_items
 *                 │     └── bbs_items
 *                 │           └── schedule_tasks
 *                 │                 ├── weather_snapshots
 *                 │                 └── resource_items
 *                 └── readiness_checks
 */

// ─────────────────────────────────────────────
// TIER 0: Core entities
// ─────────────────────────────────────────────

/**
 * Project — root container สำหรับทุก entity
 * @param {Partial<Project>} overrides
 * @returns {Project}
 */
export function createProject(overrides = {}) {
  return {
    id: null,                      // uuid (Supabase)
    user_id: null,                 // uuid — FK to auth.users
    name: '',                      // ชื่อโครงการ
    client_name: '',               // ชื่อเจ้าของโครงการ
    location_lat: null,            // float — สำหรับ Open-Meteo
    location_lng: null,            // float — สำหรับ Open-Meteo
    location_label: '',            // string — "กรุงเทพฯ เขตลาดพร้าว"
    start_date: null,              // ISO date string
    building_type: 'residential',  // 'residential' | 'commercial' | 'mixed'
    floors_above_ground: null,     // int — จำนวนชั้นเหนือดิน (auto-filled จาก drawing)
    floors_below_ground: 0,        // int — basement
    total_area_sqm: null,          // float — พื้นที่รวม (auto-filled)
    status: 'draft',               // 'draft' | 'active' | 'completed'
    created_at: null,
    updated_at: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// TIER 1: Drawing upload
// ─────────────────────────────────────────────

/**
 * DrawingUpload — ไฟล์ PDF ที่ user upload
 * @param {Partial<DrawingUpload>} overrides
 */
export function createDrawingUpload(overrides = {}) {
  return {
    id: null,                   // uuid
    project_id: null,           // uuid FK
    file_name: '',              // original filename
    file_url: '',               // Supabase storage URL
    drawing_type: null,         // 'floor_plan' | 'section_detail' | 'combined'
    page_count: null,           // int
    extraction_status: 'pending', // 'pending' | 'processing' | 'done' | 'failed'
    extraction_error: null,     // string — error message ถ้า failed
    // NEW — wizard sheet classification (Step 1)
    sheet_type: null,           // 'floor_plan' | 'section_detail' | 'general_notes' | 'schedule_table' | 'unknown'
    sheet_confidence: null,     // float 0-1 — Gemini classifier confidence
    extracted_notes: null,      // { fc_ksc, fy_main_ksc, fy_stirrup_ksc, cover_mm } | null — Step 2 Panel B
    created_at: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// TIER 2: Drawing Intelligence outputs
// ─────────────────────────────────────────────

/**
 * BeamLibraryEntry — output ของ Gemini Pass 1
 * อ่านจาก section detail sheets → สร้าง library ของ element types
 *
 * element_id เช่น "B1", "B2", "C1", "G1", "S1"
 * element_type: beam=คาน, column=เสา, girder=คานหลัก, slab=พื้น, footing=ฐานราก
 *
 * @param {Partial<BeamLibraryEntry>} overrides
 */
export function createBeamLibraryEntry(overrides = {}) {
  return {
    id: null,                   // uuid
    project_id: null,           // uuid FK
    drawing_upload_id: null,    // uuid FK
    element_id: '',             // "B1", "C1", "S1"
    element_type: null,         // 'beam' | 'column' | 'girder' | 'slab' | 'footing' | 'staircase'
    floor_applicable: 'all',    // 'all' | 'F1' | 'F2' | 'RF' — ชั้นที่ใช้
    // มิติหน้าตัด
    width_mm: null,             // float
    height_mm: null,            // float (depth สำหรับคาน)
    // เหล็กแกน (main bars)
    main_bar_count: null,       // int — จำนวนเหล็กแกน
    main_bar_dia_mm: null,      // float — เส้นผ่านศูนย์กลาง เช่น 16, 20, 25
    main_bar_type: 'DB',        // 'DB' | 'RB' — deformed bar / round bar
    // เหล็กปลอก (stirrups)
    stirrup_dia_mm: null,       // float — ขนาดเหล็กปลอก เช่น 6, 9
    stirrup_type: 'RB',         // 'RB' | 'DB'
    stirrup_spacing_mm: null,   // float — ระยะห่างปลอกปกติ
    stirrup_spacing_dense_mm: null, // float — ระยะห่างปลอกในโซน dense (ปลายคาน)
    stirrup_dense_zone_mm: null,    // float — ระยะโซน dense จากหน้าเสา
    // คอนกรีต
    concrete_grade: null,       // 'M200' | 'M250' | 'M300' — กำลังคอนกรีต (WSD)
    steel_grade: null,          // 'SR24' | 'SD30' | 'SD40'
    // ค่าความมั่นใจจาก Gemini
    confidence_score: null,     // float 0-1
    confidence_flags: [],       // string[] — ['height_unclear', 'bar_count_ambiguous']
    raw_gemini_text: null,      // string — raw output ไว้ debug
    created_at: null,
    ...overrides,
  };
}

/**
 * DrawingElement — output ของ Gemini Pass 2
 * อ่านจาก floor plan → นับจำนวน element แต่ละประเภทต่อชั้น
 *
 * @param {Partial<DrawingElement>} overrides
 */
export function createDrawingElement(overrides = {}) {
  return {
    id: null,                   // uuid
    project_id: null,           // uuid FK
    drawing_upload_id: null,    // uuid FK
    beam_library_id: null,      // uuid FK → BeamLibraryEntry ที่ใช้
    floor_level: null,          // 'F1' | 'F2' | 'RF' | 'B1'
    floor_area_sqm: null,       // float — พื้นที่ชั้นนี้ (จาก floor plan)
    element_id: '',             // "B1", "C1" — reference กลับ beam_library
    element_type: null,         // 'beam' | 'column' | 'girder' | 'slab' | 'footing'
    grid_refs: [],              // string[] — ["A-1", "A-2"] grid ที่เจอ element นี้
    count: null,                // int — จำนวน element นี้ในชั้นนี้
    span_length_m: null,        // float — สำหรับ beam: ความยาวช่วงเฉลี่ย
    // status
    confidence_score: null,     // float 0-1
    confidence_flags: [],       // ['count_uncertain', 'span_estimated']
    is_manual_override: false,  // bool — user แก้ไข count เองหรือไม่
    manual_override_note: null, // string
    // NEW — wizard fields
    source: 'extracted',        // 'extracted' | 'manual' — set 'manual' by wz-manual-fallback.js
    user_verified: false,       // bool — set true by wz_verifyElementType()
    user_corrected_count: null, // int | null — set by wz_correctElementCount() at type-aggregate level
    created_at: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// TIER 3: QuantiTake — BOQ + BBS
// ─────────────────────────────────────────────

/**
 * BOQItem — Bill of Quantities line item
 * computed จาก drawing_elements + beam_library
 *
 * @param {Partial<BOQItem>} overrides
 */
export function createBOQItem(overrides = {}) {
  return {
    id: null,                   // uuid
    project_id: null,           // uuid FK
    drawing_element_id: null,   // uuid FK (null ถ้า manual)
    item_code: '',              // "STR-B1-F1" — รหัส BOQ
    description: '',            // "คาน B1 ชั้น 1 (300x600mm)"
    work_category: null,        // 'concrete' | 'rebar' | 'formwork' | 'masonry' | 'finishing'
    unit: '',                   // 'm3' | 'kg' | 'm2' | 'set'
    quantity: null,             // float
    unit_rate_thb: null,        // float — ราคาต่อหน่วย (บาท)
    amount_thb: null,           // float — computed: quantity × unit_rate
    floor_level: null,          // 'F1' | 'F2' | 'RF'
    element_type: null,         // 'beam' | 'column' | 'slab'
    is_manual: false,           // bool — ถ้า user เพิ่มเอง
    status: 'ok',                // 'ok' | 'needs_review' — flag เมื่อ confidence_score ของ drawing_element ต่ำ
    // NEW — Thai BOQ hierarchy (Engine 2)
    category_code: null,        // '1'..'7' or '3.1'/'3.2'/'3.3' — หมวดที่ตาม Thai BOQ convention
    category_label_th: null,    // 'งานโครงสร้าง คอนกรีตเสริมเหล็ก — เสา' etc.
    work_type: null,             // 'foundation' | 'structure' | 'roof' | 'mep' | 'finishing' | 'other'
    // NEW — pricing provenance
    unit_price_source: 'bq_standard_2567', // 'bq_standard_2567' | 'catalog' | 'manual'
    // NEW — review flagging (extends existing status:'ok'|'needs_review')
    review_reason: null,        // 'low_extraction_confidence' | 'element_count_unusual' | 'price_deviation_>20%' | null
    created_at: null,
    ...overrides,
  };
}

/**
 * BBSItem — Bar Bending Schedule entry
 * computed จาก BOQItem + BeamLibraryEntry
 *
 * shape_code: รหัสรูปดัด เช่น 00=ตรง, 11=ตัวแอล, 21=ตัวยู, 38=ปลอก
 *
 * @param {Partial<BBSItem>} overrides
 */
export function createBBSItem(overrides = {}) {
  return {
    id: null,                   // uuid
    project_id: null,           // uuid FK
    boq_item_id: null,          // uuid FK
    member_id: '',              // "2B1" — ระบุตำแหน่งโครงสร้าง
    bar_mark: '',               // "T1", "T2" — รหัสเหล็กแต่ละกลุ่ม
    bar_type: 'DB',             // 'DB' | 'RB'
    steel_grade: null,          // 'SR24' | 'SD30' | 'SD40'
    diameter_mm: null,          // float — เส้นผ่านศูนย์กลาง
    shape_code: '00',           // string — รหัสรูปดัดตาม วสท.
    // มิติดัด (เป็น null ถ้าไม่ใช้มิตินั้น)
    bend_a_mm: null,
    bend_b_mm: null,
    bend_c_mm: null,
    bend_d_mm: null,
    cut_length_mm: null,        // float — ความยาวตัดจริงต่อเส้น
    num_members: null,          // int — จำนวนชิ้นส่วนโครงสร้างในแบบ
    bars_per_member: null,      // int — จำนวนเหล็กต่อชิ้นส่วน
    total_bars: null,           // int — computed: num_members × bars_per_member
    total_length_m: null,       // float — computed: total_bars × cut_length / 1000
    unit_weight_kg_per_m: null, // float — ตาม diameter (ดึงจาก REBAR_UNIT_WEIGHT)
    total_weight_kg: null,      // float — computed: total_length × unit_weight
    created_at: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// TIER 4: Construction Planner
// ─────────────────────────────────────────────

/**
 * ScheduleTask — Gantt activity
 * computed จาก BOQItem (quantity → duration)
 *
 * @param {Partial<ScheduleTask>} overrides
 */
export function createScheduleTask(overrides = {}) {
  const inferredTrade = overrides.trade
    || overrides.resource_group?.primary_trade
    || overrides.resource_group?.crew_type
    || (overrides.work_type === 'structure' ? 'concrete' : null);

  const fallbackPercent = overrides.progress_pct ?? overrides.percent_complete ?? 0;

  return {
    id: null,                     // uuid
    project_id: null,             // uuid FK
    boq_item_id: null,            // uuid FK (null ถ้า task ไม่ linked BOQ)
    wbs_code: '',                 // "2.1.1" — Work Breakdown Structure
    activity_name: '',            // "Column Concrete Pour F1"
    work_category: null,          // 'structural' | 'architectural' | 'mep' | 'finishing'
    floor_level: null,
    floor: overrides.floor ?? overrides.floor_level ?? null,
    trade: inferredTrade,
    // ปริมาณงาน
    quantity: null,               // float
    unit: '',                     // 'm3' | 'kg' | 'm2'
    crew_size: null,              // int — จำนวนคนงาน
    productivity_rate: null,      // float — หน่วยต่อคนต่อวัน (จาก lookup table)
    // Duration
    base_duration_days: null,     // float — Quantity / (crew × productivity)
    weather_buffer_factor: null,  // float — 0.0-0.4 (จาก Open-Meteo)
    adjusted_duration_days: null, // float — base × (1 + weather_buffer)
    // Scheduling
    start_date: null,             // ISO date
    end_date: null,               // ISO date (adjusted)
    predecessor_task_ids: [],     // uuid[] — FK array
    lag_days: 0,                  // int — วันรอหลัง predecessor เสร็จ (cure time)
    is_critical: false,           // bool — อยู่บน critical path
    is_parallel: false,           // bool — ทำพร้อม task อื่นได้
    // สั่งวัสดุ
    material_order_date: null,    // ISO date — start_date - lead_time
    material_lead_time_days: null, // int

    // NEW — work classification (Engine 3 sets at generation time)
    work_type: null,             // 'foundation' | 'structure' | 'roof' | 'mep' | 'finishing' | 'other'
    period_month: null,          // int — 1-based month index from project start (for groupByTime)
    period_label: null,          // string — "เดือนที่ 1", computed from period_month

    // NEW — resourcing
    resource_group: {
      primary_trade: null,       // 'steel_fixer' | 'carpenter' | 'concrete_gang' | ... (CREW_TYPES key)
      crew_type: null,           // alias of primary_trade, kept for Resource Hub join convenience
      crew_count: null,          // int — same as crew_size, duplicated for resource_group consumers
    },

    // NEW — CPM (extends existing predecessor_task_ids/is_critical, does not replace)
    depends_on_task_ids: [],     // uuid[] — alias of predecessor_task_ids; computeSchedule() writes both identically
    is_critical_path: false,     // bool — alias of is_critical (new name used by Planner UI per spec)
    float_days: 0,               // float — slack time (CPM)

    // NEW — cost tracking
    task_cost_estimate: null,    // float THB — crew_size × CREW_TYPES[trade].day_rate × adjusted_duration_days
    task_cost_actual: null,      // float THB | null — filled from payroll_entries (Resource Hub)

    // NEW — progress tracking (Earned Value Management: EV = task_cost_estimate × percent_complete)
    percent_complete: fallbackPercent, // float 0-100 — % งานที่ทำเสร็จจริงหน้างาน (ผู้ใช้กรอกใน Planner)
    progress_pct: fallbackPercent,      // alias for UI that uses progress_pct

    created_at: null,
    ...overrides,
  };
}

/**
 * WeatherSnapshot — ข้อมูลสภาพอากาศ snapshot ณ เวลาที่สร้าง schedule
 * เก็บเฉพาะ derived output เท่านั้น ไม่เก็บ raw API response
 *
 * @param {Partial<WeatherSnapshot>} overrides
 */
export function createWeatherSnapshot(overrides = {}) {
  return {
    id: null,               // uuid
    project_id: null,       // uuid FK
    schedule_task_id: null, // uuid FK
    location_lat: null,     // float
    location_lng: null,     // float
    snapshot_date: null,    // ISO date — วันที่ดึงข้อมูล
    month_of_work: null,    // int 1-12 — เดือนที่ task นี้จะทำงาน
    avg_rain_days_per_month: null, // float — จาก historical data
    rain_delay_days: null,         // float — computed buffer
    adjusted_end_date: null,       // ISO date
    data_source: 'open-meteo',     // 'open-meteo' | 'manual'
    created_at: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// TIER 5: Resource Hub + Readiness Check
// ─────────────────────────────────────────────

/**
 * ResourceItem — manpower หรือ material ที่ linked กับ task
 *
 * @param {Partial<ResourceItem>} overrides
 */
export function createResourceItem(overrides = {}) {
  return {
    id: null,                     // uuid
    project_id: null,             // uuid FK
    schedule_task_id: null,       // uuid FK (null ถ้าเป็น project-level resource)
    resource_type: null,          // 'manpower' | 'material' | 'equipment' | 'contingency'
    name: '',                     // "mason", "rebar DB20", "concrete pump"
    unit: '',                     // 'person-day' | 'kg' | 'ton' | 'm3' | 'day'
    quantity: null,               // float
    unit_cost_thb: null,          // float
    total_cost_thb: null,         // float — computed
    supplier_id: null,            // uuid FK → Supplier (nullable)
    created_at: null,
    ...overrides,
  };
}

/**
 * Supplier — catalog ผู้จำหน่ายวัสดุ
 *
 * @param {Partial<Supplier>} overrides
 */
export function createSupplier(overrides = {}) {
  return {
    id: null,               // uuid
    project_id: null,       // uuid FK (null = global catalog)
    name: '',
    category: 'other',      // 'steel' | 'concrete' | 'formwork' | 'other'
    material_types: [],     // string[] — ['rebar', 'cement', 'aggregate']
    price_list: [],         // [{ item_name, unit, unit_price_thb }]
    contact: null,          // { phone, email, line, person } | null
    rating: null,           // float 0-5
    region: '',             // 'bangkok' | 'central' | 'north' | 'northeast' | 'south'
    contact_phone: null,
    contact_line: null,
    credit_days: null,      // int — เครดิต 7 | 15 | 30 วัน
    min_order_ton: null,    // float — order ขั้นต่ำ (สำหรับเหล็ก)
    created_at: null,
    ...overrides,
  };
}

/**
 * ResourceAllocation — แผนการจัดสรรกำลังคนต่อวัน/งาน
 *
 * @param {Partial<ResourceAllocation>} overrides
 * @returns {{id: string|null, project_id: string|null, task_id: string|null, trade: string, headcount_required: number, headcount_available: number, date: string|null, status: 'ok'|'overallocated'}}
 */
export function createResourceAllocation(overrides = {}) {
  return {
    id: null,
    project_id: null,
    task_id: null,
    trade: 'other',
    headcount_required: 0,
    headcount_available: 0,
    date: null,
    status: 'ok',
    ...overrides,
  };
}

/**
 * MaterialOrder — ใบสั่งวัสดุสำหรับ Resource Hub / procurement
 *
 * @param {Partial<MaterialOrder>} overrides
 * @returns {{id: string|null, project_id: string|null, boq_item_id: string|null, supplier_id: string|null, material_name: string, quantity: number, unit: string, order_date: string|null, expected_delivery_date: string|null, lead_time_days: number, status: 'pending'|'ordered'|'delivered'}}
 */
export function createMaterialOrder(overrides = {}) {
  return {
    id: null,
    project_id: null,
    boq_item_id: null,
    supplier_id: null,
    material_name: '',
    quantity: 0,
    unit: 'kg',
    order_date: null,
    expected_delivery_date: null,
    lead_time_days: 0,
    status: 'pending',
    ...overrides,
  };
}

/**
 * computeCriticalPath — คำนวณ critical path จาก predecessor chain
 *
 * @param {Array<{id: string, predecessor_task_ids?: string[], depends_on_task_ids?: string[], adjusted_duration_days?: number, base_duration_days?: number}>} scheduleTasks
 * @returns {string[]} critical task IDs
 */
export function computeCriticalPath(scheduleTasks = []) {
  const taskMap = new Map(scheduleTasks.map(task => [task.id, task]));
  const duration = task => Number(task.adjusted_duration_days ?? task.base_duration_days ?? 0);
  const preds = task => (task.predecessor_task_ids || task.depends_on_task_ids || []).filter(Boolean);
  const succs = task => scheduleTasks.filter(other => preds(other).includes(task.id)).map(t => t.id);

  const earliestStart = new Map();
  const earliestFinish = new Map();

  const visitForward = (taskId) => {
    if (earliestFinish.has(taskId)) return;
    const task = taskMap.get(taskId);
    if (!task) return;

    const predIds = preds(task);
    if (predIds.length) {
      predIds.forEach(visitForward);
      earliestStart.set(taskId, predIds.reduce((max, id) => Math.max(max, earliestFinish.get(id) || 0), 0));
    } else {
      earliestStart.set(taskId, 0);
    }

    earliestFinish.set(taskId, (earliestStart.get(taskId) || 0) + duration(task));
  };

  scheduleTasks.forEach(task => visitForward(task.id));

  const projectFinish = scheduleTasks.reduce((max, task) => Math.max(max, earliestFinish.get(task.id) || 0), 0);

  const latestFinish = new Map();
  const latestStart = new Map();
  scheduleTasks.forEach(task => latestFinish.set(task.id, projectFinish));

  const visitBackward = (taskId) => {
    if (latestStart.has(taskId)) return;
    const task = taskMap.get(taskId);
    if (!task) return;

    const nextIds = succs(task);
    if (nextIds.length) {
      const minNextStart = nextIds.reduce((min, id) => Math.min(min, latestStart.get(id) || projectFinish), projectFinish);
      latestFinish.set(taskId, minNextStart);
    }
    latestStart.set(taskId, (latestFinish.get(taskId) || projectFinish) - duration(task));
    nextIds.forEach(visitBackward);
  };

  scheduleTasks
    .filter(task => !succs(task).length)
    .forEach(task => visitBackward(task.id));

  return scheduleTasks
    .filter(task => {
      const slack = (latestStart.get(task.id) || 0) - (earliestStart.get(task.id) || 0);
      return Math.abs(slack) < 1e-9;
    })
    .map(task => task.id);
}

/**
 * computeManpowerDemand — คำนวณความต้องการกำลังคนต่อวันจาก productivity rate
 *
 * @param {Array<{id: string, quantity?: number, unit?: string, trade?: string, resource_group?: {primary_trade?: string}, duration_days?: number, adjusted_duration_days?: number, base_duration_days?: number}>} scheduleTasks
 * @param {Record<string, number>} productivityRates
 * @returns {{date: string|null, trade: string, headcount_required: number}[]}
 */
export function computeManpowerDemand(scheduleTasks = [], productivityRates = PRODUCTIVITY_RATES) {
  const byDate = new Map();

  scheduleTasks.forEach(task => {
    const date = task.start_date || null;
    const trade = task.trade || task.resource_group?.primary_trade || task.resource_group?.crew_type || 'other';
    const duration = Number(task.adjusted_duration_days ?? task.base_duration_days ?? task.duration_days ?? 1);
    const volume = Number(task.quantity || 0);
    const unit = String(task.unit || '').toLowerCase();
    const rebarWeightFactor = unit === 'kg' && task.diameter_mm != null && REBAR_UNIT_WEIGHT[task.diameter_mm]
      ? REBAR_UNIT_WEIGHT[task.diameter_mm]
      : 1;

    let rate = productivityRates[trade] ?? productivityRates[`${trade}_${unit}`] ?? null;

    if (!rate) {
      if (unit === 'kg') {
        rate = productivityRates.column_rebar_kg ?? productivityRates.beam_rebar_kg ?? productivityRates.slab_rebar_kg ?? 1;
      } else if (unit === 'm2') {
        rate = productivityRates.formwork_column_m2 ?? productivityRates.formwork_beam_m2 ?? productivityRates.formwork_slab_m2 ?? 1;
      } else if (unit === 'm3') {
        rate = productivityRates.column_concrete_m3 ?? productivityRates.beam_concrete_m3 ?? productivityRates.slab_concrete_m3 ?? 1;
      }
    }

    const normalizedVolume = unit === 'kg' ? volume / rebarWeightFactor : volume;
    const headcount = duration > 0 && rate > 0 ? normalizedVolume / (duration * rate) : 0;
    const key = `${date || 'unknown'}::${trade}`;
    const current = byDate.get(key) || { date, trade, headcount_required: 0 };
    current.headcount_required = parseFloat((current.headcount_required + headcount).toFixed(2));
    byDate.set(key, current);
  });

  return Array.from(byDate.values()).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}

/*
SQL migration snippet (Supabase-style):

create table if not exists public.resource_allocations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  task_id uuid references public.schedule_tasks(id) on delete cascade,
  trade text not null default 'other',
  headcount_required numeric not null default 0,
  headcount_available numeric not null default 0,
  date date,
  status text not null default 'ok',
  created_at timestamptz default now()
);

create table if not exists public.material_orders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  boq_item_id uuid references public.boq_items(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  material_name text not null,
  quantity numeric not null default 0,
  unit text not null default 'kg',
  order_date date,
  expected_delivery_date date,
  lead_time_days integer default 0,
  status text not null default 'pending',
  created_at timestamptz default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null,
  category text not null default 'other',
  price_list jsonb not null default '[]'::jsonb,
  contact jsonb,
  rating numeric,
  created_at timestamptz default now()
);
*/

/**
 * PayrollEntry — ค่าแรงรายวัน สำหรับ Resource Hub
 *
 * @param {Partial<PayrollEntry>} overrides
 */
export function createPayrollEntry(overrides = {}) {
  return {
    id: null,               // uuid
    project_id: null,       // uuid FK
    resource_item_id: null, // uuid FK
    worker_name: '',
    work_date: null,        // ISO date
    regular_hours: 8,       // float
    ot_hours: 0,            // float
    daily_rate_thb: null,   // float — ค่าแรงปกติ
    ot_multiplier: 1.5,     // float — 1.5× weekday, 3.0× holiday
    total_pay_thb: null,    // float — computed
    sso_deduction_thb: null, // float — ประกันสังคม 5% (max ฐาน 15,000)
    net_pay_thb: null,      // float
    created_at: null,
    ...overrides,
  };
}

/**
 * ReadinessCheck — RAG status ต่อ check category
 * Background verification ที่ระบบรันให้อัตโนมัติ
 *
 * check_type categories (จาก research6):
 *   'permit'         — ใบอนุญาตก่อสร้าง
 *   'setback'        — ระยะร่น (จากแนวเขตที่ดิน)
 *   'drawing_complete' — แบบแปลนครบถ้วน
 *   'bbs_ready'      — BBS พร้อมก่อนเริ่มเหล็ก
 *   'material_lead'  — สั่งวัสดุทันก่อน activity
 *   'crew_available' — มีคนงานพอ
 *   'weather_risk'   — ความเสี่ยงฝนในช่วงโครงสร้าง
 *   'timeline_risk'  — ระยะเวลาที่ผู้ใช้กำหนดสั้นกว่าประมาณการขั้นต่ำ (จาก project_config.timeline)
 *   'weather_overlap' — งานโครงสร้าง/ฐานรากตรงกับฤดูฝน (จาก project_config.timeline.rainy_season_months)
 *
 * @param {Partial<ReadinessCheck>} overrides
 */
export function createReadinessCheck(overrides = {}) {
  return {
    id: null,               // uuid
    project_id: null,       // uuid FK
    check_type: null,       // string — ดูรายการด้านบน
    status: null,           // 'green' | 'yellow' | 'red'
    title: '',              // "ใบอนุญาตก่อสร้าง"
    detail: '',             // คำอธิบาย เช่น "ยังไม่ได้แนบเอกสาร"
    recommendation: '',     // สิ่งที่ควรทำต่อ
    linked_entity_type: null, // 'schedule_task' | 'boq_item' | 'drawing_upload'
    linked_entity_id: null, // uuid — FK ไปยัง entity ที่เกี่ยวข้อง
    checked_at: null,       // ISO datetime
    auto_generated: true,   // bool — ระบบสร้าง หรือ user เพิ่มเอง
    created_at: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// LOOKUP TABLES (constants ไม่เก็บใน Supabase)
// ─────────────────────────────────────────────

/**
 * น้ำหนักเหล็กต่อเมตร (kg/m) ตาม diameter
 * อ้างอิง: มาตรฐาน วสท. + TIS 24-2548
 */
export const REBAR_UNIT_WEIGHT = {
  6:  0.222,
  9:  0.499,
  12: 0.888,
  16: 1.578,
  20: 2.466,
  25: 3.853,
  28: 4.834,
  32: 6.313,
};

/**
 * Productivity rates (หน่วยต่อ crew ต่อวัน)
 * อ้างอิง: research4 Thai construction productivity benchmarks
 */
export const PRODUCTIVITY_RATES = {
  column_concrete_m3:     12,   // m3/crew/day (by pump)
  beam_concrete_m3:       10,
  slab_concrete_m3:       15,
  column_rebar_kg:        225,  // kg/steel-fixer/day
  beam_rebar_kg:          200,
  slab_rebar_kg:          300,
  formwork_column_m2:     20,
  formwork_beam_m2:       18,
  formwork_slab_m2:       25,
  masonry_m2:             8,
  plastering_m2:          15,
  tiling_m2:              10,
};

/**
 * Concrete cure lag days ก่อนถอดแบบ / เริ่มงานชั้นถัดไป
 * อ้างอิง: ACI 318 + Thai SME practice (research4)
 */
export const CURE_LAG_DAYS = {
  foundation:  7,
  column:      3,
  beam:        7,
  slab:        14,  // ก่อนถอด shoring
};

/**
 * Weather buffer factors รายเดือน (กรุงเทพฯ / ภาคกลาง)
 * 0.0 = ไม่มี buffer, 0.4 = เพิ่ม duration 40%
 * อ้างอิง: Open-Meteo historical data + research4
 */
export const WEATHER_BUFFER_BKK = {
  1:  0.05,  // ม.ค. — หน้าแล้ง
  2:  0.05,
  3:  0.10,
  4:  0.15,
  5:  0.25,  // เริ่มฝน
  6:  0.35,
  7:  0.40,  // หน้าฝนสูงสุด
  8:  0.40,
  9:  0.35,
  10: 0.30,
  11: 0.20,
  12: 0.08,
};

/**
 * ตัวคูณเผื่อเสีย (waste factor) — คูณกับ quantity ก่อนคิดราคาใน BOQ
 * อ้างอิง: research4 Thai SME procurement practice
 */
export const CONCRETE_WASTE_FACTOR = 1.03; // เผื่อหกหล่น/เทเกิน ~3%
export const REBAR_WASTE_FACTOR = 1.08;    // เผื่อเศษตัด/ปลายเหล็ก ~8%

/**
 * ตัวคูณ/สัดส่วนต้นทุนเสริม สำหรับ Resource Hub rollup
 */
export const EQUIPMENT_COST_FACTOR = 0.08;   // ค่าเครื่องจักร = 8% ของต้นทุนวัสดุรวม
export const CONTINGENCY_FACTOR = 0.10;      // เผื่อ 10% ของ (วัสดุ + แรงงาน + เครื่องจักร)
export const OVERTIME_COST_MULTIPLIER = 1.5; // ค่าแรง OT = 1.5x อัตราปกติ

/**
 * Lap splice factor ตามชั้นเหล็ก (steel_grade) — ความยาวทาบ = lap_factor_d × diameter (mm)
 * เหล็กข้ออ้อย (SD) ทาบยาวกว่าเหล็กกลมผิวเรียบ (SR)
 * อ้างอิง: มยผ. 1103 / ACI 318
 */
export const REBAR_GRADES = {
  SR24: { lap_factor_d: 30, label: 'SR24 (เหล็กกลมผิวเรียบ)' },
  SD30: { lap_factor_d: 40, label: 'SD30 (เหล็กข้ออ้อย 3000 ksc)' },
  SD40: { lap_factor_d: 40, label: 'SD40 (เหล็กข้ออ้อย 4000 ksc)' },
  SD50: { lap_factor_d: 45, label: 'SD50 (เหล็กข้ออ้อย 5000 ksc)' },
};

/**
 * ตัวหักความยาวจากมุมดัด (bend deduction) — หน่วย × diameter (mm)
 * ใช้ปรับ cut length ของเหล็กที่มีการดัดมุมให้ใกล้เคียงความจริง
 * อ้างอิง: มยผ. 1103 ตารางหักความยาวมุมดัด
 */
export const BEND_DEDUCTION_D = {
  bend_90: 2,         // มุมดัด 90° หัก 2D ต่อมุม
  bend_180: 4,        // มุมดัด 180° (hook ปลาย) หัก 4D ต่อมุม
  stirrup_closed: 4,  // ปลอกปิด (2 มุมตะขอ 90°) หักรวม 4D ต่อปลอก
};

/**
 * Concrete grade (ksc) -> ราคารวมวัสดุต่อ m3 (อ้างอิงตลาด กทม./ปริมณฑล)
 * ใช้เมื่อ beam_library ระบุ concrete_grade; ถ้าไม่ระบุ pipeline.js จะ fallback ไปใช้ CONCRETE_RATE_THB ตาม element_type เดิม
 */
export const CONCRETE_GRADES = {
  180: { rate_thb_per_m3: 2000, label: 'Fc180 — งาน Lean/ไม่รับน้ำหนัก' },
  240: { rate_thb_per_m3: 2200, label: 'Fc240 — งานทั่วไป (คาน/เสา/พื้น)' },
  280: { rate_thb_per_m3: 2450, label: 'Fc280 — โครงสร้างหลัก' },
  320: { rate_thb_per_m3: 2700, label: 'Fc320 — โครงสร้างพิเศษ/เสาเอก' },
};

/**
 * ทีมงาน (crew types) สำหรับ Resource Hub — ค่าแรงรายวัน (THB/person-day) + หน่วยผลิตภาพ
 * อ้างอิง: research5 Construction Resource Management — Thai Labor Market
 * หมายเหตุ: steel_fixer / carpenter / concrete_gang ใช้ค่าเดียวกับ LABOR_RATE_THB เดิมใน pipeline.js
 * (550 / 500 / 450) เพื่อไม่ให้ตัวเลขขัดกันระหว่างหน้า BOQ/Resource — ประเภทอื่นเป็นค่าประมาณตลาด SME
 */
export const CREW_TYPES = {
  surveyor:      { name_th: 'ช่างสำรวจ',           icon: '📐', day_rate_thb: 800,  productivity_unit: '-' },
  piling:        { name_th: 'ทีมตอกเสาเข็ม',        icon: '🪵', day_rate_thb: 900,  productivity_unit: '-' },
  steel_fixer:   { name_th: 'ช่างเหล็ก',            icon: '🔧', day_rate_thb: 550,  productivity_unit: 'kg/คน/วัน' },
  carpenter:     { name_th: 'ช่างไม้แบบหล่อ',       icon: '🪚', day_rate_thb: 500,  productivity_unit: 'm²/คน/วัน' },
  concrete_gang: { name_th: 'ทีมเทคอนกรีต',         icon: '🏗️', day_rate_thb: 450,  productivity_unit: 'm³/ทีม/วัน' },
  mason:         { name_th: 'ช่างปูน/ก่อผนัง',      icon: '🧱', day_rate_thb: 500,  productivity_unit: 'm²/คน/วัน' },
  electrician:   { name_th: 'ช่างไฟฟ้า',            icon: '💡', day_rate_thb: 600,  productivity_unit: 'จุด/วัน' },
  plumber:       { name_th: 'ช่างประปา',            icon: '🚰', day_rate_thb: 550,  productivity_unit: 'จุด/วัน' },
  painter:       { name_th: 'ช่างสี',               icon: '🎨', day_rate_thb: 450,  productivity_unit: 'm²/คน/วัน' },
  site_foreman:  { name_th: 'โฟร์แมนควบคุมงาน',     icon: '👷', day_rate_thb: 1000, productivity_unit: '-' },
};

/**
 * เครื่องจักร/อุปกรณ์ก่อสร้าง สำหรับ Resource Hub
 * `condition` เป็น hint ข้อความให้ UI ตัดสินใจว่าจะแสดง card นี้หรือไม่ (ดู resource-index.js)
 */
export const EQUIPMENT_TYPES = {
  concrete_mixer: { name_th: 'เครื่องผสมคอนกรีต',     icon: '🌀', condition: 'always' },
  vibrator:       { name_th: 'เครื่องสั่นคอนกรีต',     icon: '📳', condition: 'always' },
  concrete_pump:  { name_th: 'ปั๊มคอนกรีต',           icon: '🚛', condition: 'floors_above_ground >= 2' },
  pile_driver:    { name_th: 'เครื่องตอกเสาเข็ม',      icon: '🔨', condition: 'has_piling' },
  tower_crane:    { name_th: 'เครนติดตั้งประจำที่',    icon: '🏗️', condition: 'total_area_sqm > 200' },
  mobile_crane:   { name_th: 'เครนเคลื่อนที่',         icon: '🚚', condition: 'total_area_sqm > 200' },
};

/** ค่าเช่ารายวัน (THB/day) ต่อเครื่องจักรแต่ละประเภท — อ้างอิงราคาตลาด กทม./ปริมณฑล */
export const EQUIPMENT_RATES = {
  concrete_mixer: 800,
  vibrator: 500,
  concrete_pump: 15000,
  pile_driver: 12000,
  tower_crane: 8000,
  mobile_crane: 6000,
};

/**
 * Lead time สั่งวัสดุล่วงหน้า (วัน) ตาม work_category — ใช้คู่กับ recommended_order_date ใน Resource Hub
 * ค่าเดียวกับ MATERIAL_LEAD_DAYS ใน pipeline.js (เก็บไว้ที่นี่เพื่อให้ feature module อื่น import ได้โดยไม่ต้องพึ่ง pipeline.js)
 */
export const MATERIAL_LEAD_TIMES = {
  rebar: 7,
  formwork: 5,
  concrete: 2,
};

// ─────────────────────────────────────────────
// VALIDATION HELPERS
// ─────────────────────────────────────────────

/**
 * ตรวจว่า DrawingElement พร้อมส่งต่อให้ BOQ engine หรือไม่
 * @param {DrawingElement} el
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateDrawingElement(el) {
  const errors = [];
  if (!el.project_id)       errors.push('project_id is required');
  if (!el.floor_level)      errors.push('floor_level is required');
  if (!el.element_type)     errors.push('element_type is required');
  if (el.count === null)    errors.push('count is required');
  if (el.confidence_score !== null && el.confidence_score < 0.5) {
    errors.push(`confidence_score ${el.confidence_score} is below threshold (0.5)`);
  }
  return { valid: errors.length === 0, errors };
}

/**
 * ตรวจว่า BOQItem มีข้อมูลพอสำหรับคำนวณ amount หรือไม่
 * @param {BOQItem} item
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateBOQItem(item) {
  const errors = [];
  if (!item.project_id)           errors.push('project_id is required');
  if (!item.description)          errors.push('description is required');
  if (!item.unit)                 errors.push('unit is required');
  if (item.quantity === null)     errors.push('quantity is required');
  if (item.unit_rate_thb === null) errors.push('unit_rate_thb is required');
  return { valid: errors.length === 0, errors };
}

/**
 * ตรวจว่า ReadinessCheck status ถูกต้องหรือไม่
 * @param {ReadinessCheck} check
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateReadinessCheck(check) {
  const VALID_STATUSES = ['green', 'yellow', 'red'];
  const errors = [];
  if (!VALID_STATUSES.includes(check.status)) {
    errors.push(`status "${check.status}" must be one of: ${VALID_STATUSES.join(', ')}`);
  }
  if (!check.check_type) errors.push('check_type is required');
  if (!check.project_id) errors.push('project_id is required');
  return { valid: errors.length === 0, errors };
}

// ─────────────────────────────────────────────
// COMPUTED HELPERS
// ─────────────────────────────────────────────

/**
 * คำนวณน้ำหนักเหล็กเส้น (kg)
 * @param {number} diameter_mm
 * @param {number} total_length_m
 * @returns {number|null}
 */
export function calcRebarWeight(diameter_mm, total_length_m) {
  const unitWeight = REBAR_UNIT_WEIGHT[diameter_mm];
  if (!unitWeight) return null;
  return parseFloat((total_length_m * unitWeight).toFixed(3));
}

/**
 * คำนวณ duration หลัง weather adjustment
 * @param {number} base_duration_days
 * @param {number} month — 1-12
 * @param {string} region — 'bkk' เท่านั้นตอนนี้
 * @returns {number}
 */
export function calcAdjustedDuration(base_duration_days, month, region = 'bkk') {
  const buffer = region === 'bkk' ? (WEATHER_BUFFER_BKK[month] ?? 0) : 0;
  return parseFloat((base_duration_days * (1 + buffer)).toFixed(1));
}

/**
 * คำนวณประกันสังคม (SSO) ฝ่ายนายจ้าง
 * ฐาน max 15,000 THB (จนถึงปี 2568), 17,500 THB ปี 2569+
 * @param {number} daily_rate_thb
 * @param {number} days
 * @param {number} base_cap_thb — default 15000
 * @returns {number}
 */
export function calcSSODeduction(daily_rate_thb, days, base_cap_thb = 15000) {
  const monthly_wage = daily_rate_thb * days;
  const taxable = Math.min(monthly_wage, base_cap_thb);
  return parseFloat((taxable * 0.05).toFixed(2));
}

/**
 * RateLibraryEntry — unit rate library (global หรือ per-project override)
 * ดู supabase/schema.sql: rate_library
 *
 * @param {Partial<RateLibraryEntry>} overrides
 */
export function createRateLibraryEntry(overrides = {}) {
  return {
    id: null,             // uuid
    project_id: null,     // uuid FK (null = global rate)
    work_section: null,   // 'earthwork' | 'concrete' | 'rebar' | 'formwork' | 'masonry' | 'mep' | 'finishing' | 'steel'
    item_name: '',        // "คอนกรีต M250 (เทปั๊ม)"
    unit: '',             // 'm3' | 'kg' | 'm2'
    price_thb: null,      // float
    region: 'bangkok',    // 'bangkok' | 'central' | 'north' | 'northeast' | 'south'
    source: 'manual',     // 'eit_standard' | 'market' | 'manual'
    effective_date: null, // ISO date
    created_at: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// EXTENDED SCHEMA (v2) — multi-building, phased, hybrid projects
// ดู supabase/schema.sql + supabase/SCHEMA.md สำหรับ ER diagram และ rationale
// ─────────────────────────────────────────────

// --- Tier 0: Project & Site Context -----------------------------------

/**
 * ProjectPhase — เฟสของโครงการ (สำหรับโครงการที่แบ่งสร้างเป็นเฟส)
 * @param {Partial<ProjectPhase>} overrides
 */
export function createProjectPhase(overrides = {}) {
  return {
    id: null,                // uuid
    project_id: null,        // uuid FK
    phase_name: '',          // "Phase 1 - Building A & B"
    phase_order: 1,          // int
    planned_start: null,     // ISO date
    planned_finish: null,    // ISO date
    status: 'planned',       // 'planned' | 'active' | 'completed'
    created_at: null,
    ...overrides,
  };
}

/**
 * Building — อาคารแต่ละหลังในโครงการ (โครงการอาจมีหลายอาคาร)
 * @param {Partial<Building>} overrides
 */
export function createBuilding(overrides = {}) {
  return {
    id: null,                   // uuid
    project_id: null,           // uuid FK
    phase_id: null,             // uuid FK (nullable)
    name: 'Building A',
    building_type: 'residential_rc', // 'residential_rc' | 'commercial_rc' | 'industrial_steel' | 'mixed_use' | 'hybrid'
    structural_system: null,    // free text: "RC frame" | "steel frame" | "RC-steel hybrid"
    floors_above_ground: 1,     // int
    floors_below_ground: 0,     // int
    typical_floor_height_mm: null,
    total_gfa_sqm: null,        // float
    footprint_sqm: null,        // float
    type_specific: {},          // jsonb — e.g. {"typical_span_m":12,"crane_capacity_ton":5}
    created_at: null,
    updated_at: null,
    ...overrides,
  };
}

/**
 * SiteConditions — สภาพดิน/แผ่นดินไหว/น้ำท่วม/ทิศทาง ของไซต์หรืออาคาร
 * @param {Partial<SiteConditions>} overrides
 */
export function createSiteConditions(overrides = {}) {
  return {
    id: null,                       // uuid
    project_id: null,               // uuid FK
    building_id: null,              // uuid FK (nullable — null = ทั้งไซต์)
    soil_class: null,               // "Bangkok Soft Clay (0-15m)"
    soil_bearing_capacity_ksc: null, // float
    seismic_zone: null,             // EIT 1301/1302 zone
    seismic_design_standard: 'EIT', // 'ACI318' | 'EIT' | 'WSD'
    flood_zone: null,               // 'high' | 'medium' | 'low' | 'none'
    flood_design_level_m: null,     // float
    wind_speed_ms: null,            // float
    site_orientation_deg: null,     // 0-360
    groundwater_level_m: null,      // float
    extra_data: {},                 // jsonb
    created_at: null,
    updated_at: null,
    ...overrides,
  };
}

// --- Tier 1: Drawing Registry & Structural Element Library --------------

/**
 * DrawingFile — ไฟล์แบบที่ upload (รองรับหลาย revision ต่อ drawing_number)
 * @param {Partial<DrawingFile>} overrides
 */
export function createDrawingFile(overrides = {}) {
  return {
    id: null,               // uuid
    project_id: null,       // uuid FK
    building_id: null,      // uuid FK (nullable)
    file_name: '',
    file_url: '',
    drawing_number: null,   // "S-101"
    revision: 'A',
    sheet_type: null,       // 'plan' | 'section' | 'detail' | 'schedule' | 'elevation' | 'combined'
    discipline: null,       // 'architectural' | 'structural' | 'mep' | 'civil'
    floor_level: null,
    page_count: null,       // int
    is_active: true,        // bool — revision ที่ active feed extraction/BOQ
    superseded_by: null,    // uuid FK self (revision ใหม่กว่า)
    uploaded_at: null,
    created_at: null,
    ...overrides,
  };
}

/**
 * DrawingExtractionJob — การรัน Gemini extraction หนึ่งครั้งต่อไฟล์แบบ
 * insert ใหม่ทุกครั้ง ไม่ overwrite — รักษา lineage ของ BOQ/BBS เดิม
 * @param {Partial<DrawingExtractionJob>} overrides
 */
export function createDrawingExtractionJob(overrides = {}) {
  return {
    id: null,                  // uuid
    project_id: null,          // uuid FK
    drawing_file_id: null,     // uuid FK
    pass_number: 1,            // 1 = section/detail sheet, 2 = floor plan counts
    status: 'pending',         // 'pending' | 'processing' | 'done' | 'failed'
    confidence_score: null,    // float 0-1
    raw_gemini_response: null, // jsonb — full response, debug/reprocess
    processing_log: [],        // jsonb[] — [{ts, level, message}]
    error_message: null,
    started_at: null,
    completed_at: null,
    created_at: null,
    ...overrides,
  };
}

/**
 * ElementType — design template ของ element (mark เช่น "C1","B2","SB1")
 * แทนที่ BeamLibraryEntry — รองรับทั้ง RC และ steel (hybrid building)
 * @param {Partial<ElementType>} overrides
 */
export function createElementType(overrides = {}) {
  return {
    id: null,                    // uuid
    project_id: null,            // uuid FK
    building_id: null,           // uuid FK
    extraction_job_id: null,     // uuid FK (nullable)
    element_type: null,          // 'column'|'beam'|'girder'|'slab'|'footing'|'staircase'|'wall'|'steel_beam'|'steel_column'|'bracing'
    mark: '',                    // "C1","B2","SB1"
    design_standard: 'EIT',      // 'ACI318' | 'EIT' | 'WSD'
    section_dimensions: {},      // jsonb — {width_mm,height_mm,thickness_mm,...} ขึ้นกับ element_type
    concrete_grade: null,        // FK-ish → concrete_grades.grade_label, e.g. "M250"
    steel_grade: null,           // 'SR24' | 'SD30' | 'SD40' (rebar)
    steel_section_profile: null, // FK-ish → steel_sections.profile (steel elements)
    connection_type: null,       // steel only: 'bolted' | 'welded' | 'pinned' | 'moment'
    confidence_score: null,      // float 0-1
    confidence_flags: [],
    is_manual_override: false,
    raw_source: null,            // jsonb
    created_at: null,
    updated_at: null,
    ...overrides,
  };
}

/**
 * StructuralElementInstance — จำนวน element ต่อชั้น (แทนที่ DrawingElement)
 * @param {Partial<StructuralElementInstance>} overrides
 */
export function createStructuralElementInstance(overrides = {}) {
  return {
    id: null,                     // uuid
    project_id: null,             // uuid FK
    building_id: null,            // uuid FK
    element_type_id: null,        // uuid FK → ElementType
    drawing_file_id: null,        // uuid FK (nullable)
    floor_level: null,            // 'F1' | 'F2' | 'RF' | 'B1'
    grid_refs: [],                // string[] — ["A-1","A-2"]
    count: 0,                     // int
    span_length_m: null,          // float — beams/girders
    floor_area_sqm: null,         // float — slabs
    confidence_score: null,       // float 0-1
    confidence_flags: [],
    is_manual_override: false,
    manual_override_note: null,
    created_at: null,
    updated_at: null,
    ...overrides,
  };
}

/**
 * RebarScheduleItem — รายการเหล็กเสริมต่อ ElementType (bar mark, shape, bend dims)
 * @param {Partial<RebarScheduleItem>} overrides
 */
export function createRebarScheduleItem(overrides = {}) {
  return {
    id: null,                  // uuid
    project_id: null,          // uuid FK
    element_type_id: null,     // uuid FK → ElementType
    bar_mark: '',              // "T1","T2"
    bar_role: null,            // 'main' | 'stirrup' | 'top' | 'bottom' | 'extra' | 'distribution'
    diameter_mm: null,         // float — FK-ish → rebar_unit_weights.diameter_mm
    bar_type: 'DB',            // 'DB' | 'RB'
    spacing_mm: null,          // float
    length_mm: null,           // float
    quantity: 1,               // int
    shape_code: '00',          // FK-ish → shape_codes.shape_code (BS8666/EIT)
    bend_dimensions: {},        // jsonb — {a,b,c,d,radius,...} ขึ้นกับ shape_code
    created_at: null,
    ...overrides,
  };
}

/**
 * LoadData — load design (dead/live/wind/seismic) ต่อชั้น/โซน
 * @param {Partial<LoadData>} overrides
 */
export function createLoadData(overrides = {}) {
  return {
    id: null,               // uuid
    project_id: null,       // uuid FK
    building_id: null,      // uuid FK
    floor_level: null,
    zone: null,             // "Zone A" | "Roof" | null = ทั้งชั้น
    load_type: null,        // 'dead' | 'live' | 'wind' | 'seismic'
    value_kpa: null,        // float — kN/m2
    design_standard: 'EIT', // 'ACI318' | 'EIT' | 'WSD'
    extra_data: {},         // jsonb
    notes: null,
    created_at: null,
    ...overrides,
  };
}

// --- Tier 2: BOQ revisions & BBS bundles --------------------------------

/**
 * BOQRevision — เวอร์ชันของ BOQ (recompute ใหม่ทุกครั้งที่ promote drawing revision)
 * @param {Partial<BOQRevision>} overrides
 */
export function createBOQRevision(overrides = {}) {
  return {
    id: null,              // uuid
    project_id: null,      // uuid FK
    building_id: null,     // uuid FK (nullable)
    phase_id: null,        // uuid FK (nullable)
    version_number: 1,     // int
    change_log: [],        // jsonb[] — [{field, old_value, new_value, reason}]
    is_active: true,       // bool — เฉพาะ revision นี้ feed planner
    created_by: null,      // uuid → auth.users
    created_at: null,
    ...overrides,
  };
}

/**
 * BBSBundle — กลุ่มเหล็กตาม diameter สำหรับสั่งซื้อ/cutting optimization
 * @param {Partial<BBSBundle>} overrides
 */
export function createBBSBundle(overrides = {}) {
  return {
    id: null,                  // uuid
    project_id: null,          // uuid FK
    bundle_code: '',           // "DB20-BUNDLE-01"
    diameter_mm: null,         // float
    standard_length_mm: 12000, // float — ความยาวเหล็กตามท้องตลาด (10m/12m)
    total_weight_kg: 0,        // float
    supplier_id: null,         // uuid FK → Supplier (nullable)
    order_status: 'planned',   // 'planned' | 'ordered' | 'delivered'
    created_at: null,
    ...overrides,
  };
}

// --- Tier 3: Schedule, dependencies, milestones, deliveries -------------

/**
 * WBSActivityLibrary — มาตรฐาน activity ต่อ phase พร้อม default productivity
 * @param {Partial<WBSActivityLibrary>} overrides
 */
export function createWBSActivityLibrary(overrides = {}) {
  return {
    id: null,                   // uuid
    wbs_code: '',               // "2.1.1"
    activity_name: '',
    phase: null,                // 'preliminary' | 'structure' | 'architectural' | 'mep' | 'external'
    work_type: null,            // matches productivity_rates.work_type
    default_unit: null,         // 'm3' | 'kg' | 'm2'
    default_productivity: {},   // jsonb — {output_per_day, unit, crew_size}
    cure_lag_days: 0,           // int
    created_at: null,
    ...overrides,
  };
}

/**
 * ScheduleActivity — instance ของ activity ในโครงการ (แทนที่ ScheduleTask)
 * @param {Partial<ScheduleActivity>} overrides
 */
export function createScheduleActivity(overrides = {}) {
  return {
    id: null,                     // uuid
    project_id: null,             // uuid FK
    building_id: null,            // uuid FK (nullable)
    phase_id: null,               // uuid FK (nullable)
    wbs_activity_library_id: null, // uuid FK (nullable)
    boq_item_id: null,            // uuid FK (nullable)
    wbs_code: '',                 // "2.1.1"
    activity_name: '',
    activity_phase: null,         // 'preliminary' | 'structure' | 'architectural' | 'mep' | 'external'
    work_type: null,              // matches productivity_rates.work_type
    floor_level: null,
    planned_start: null,          // ISO date
    planned_finish: null,         // ISO date
    actual_start: null,           // ISO date
    actual_finish: null,          // ISO date
    duration_days: null,          // float
    float_days: null,             // float
    is_critical: false,           // bool
    crew_size: null,              // int
    productivity_rate: null,      // float — snapshot ของ output_per_day ที่ใช้คำนวณ
    created_at: null,
    updated_at: null,
    ...overrides,
  };
}

/**
 * ActivityDependency — ความสัมพันธ์ระหว่าง activity (แทนที่ predecessor_task_ids array)
 * @param {Partial<ActivityDependency>} overrides
 */
export function createActivityDependency(overrides = {}) {
  return {
    id: null,               // uuid
    project_id: null,       // uuid FK
    activity_id: null,      // uuid FK → ScheduleActivity (successor)
    predecessor_id: null,   // uuid FK → ScheduleActivity
    dependency_type: 'FS',  // 'FS' | 'SS' | 'FF' | 'SF'
    lag_days: 0,            // int — เช่น cure time
    created_at: null,
    ...overrides,
  };
}

/**
 * Milestone — วันสำคัญของโครงการ
 * @param {Partial<Milestone>} overrides
 */
export function createMilestone(overrides = {}) {
  return {
    id: null,                 // uuid
    project_id: null,         // uuid FK
    building_id: null,        // uuid FK (nullable)
    milestone_name: '',       // "Foundation Complete"
    target_date: null,        // ISO date
    actual_date: null,        // ISO date
    status: 'pending',        // 'pending' | 'on_track' | 'at_risk' | 'done'
    linked_activity_id: null, // uuid FK (nullable)
    created_at: null,
    ...overrides,
  };
}

/**
 * MaterialDelivery — ตารางส่งวัสดุ ผูกกับ BOQItem
 * @param {Partial<MaterialDelivery>} overrides
 */
export function createMaterialDelivery(overrides = {}) {
  return {
    id: null,                    // uuid
    project_id: null,            // uuid FK
    boq_item_id: null,           // uuid FK
    schedule_activity_id: null,  // uuid FK (nullable)
    material_type: '',           // "rebar DB20", "ready-mix M250"
    quantity_needed: null,       // float
    unit: '',                    // 'kg' | 'm3' | 'ton'
    supplier_id: null,           // uuid FK (nullable)
    order_date: null,            // ISO date
    lead_time_days: null,        // int
    delivery_date: null,         // ISO date
    delivery_status: 'pending',  // 'pending' | 'ordered' | 'in_transit' | 'delivered' | 'delayed'
    created_at: null,
    updated_at: null,
    ...overrides,
  };
}

// --- Tier 4: Resource Hub ------------------------------------------------

/**
 * Worker — คนงาน (project_id null = shared labor pool)
 * @param {Partial<Worker>} overrides
 */
export function createWorker(overrides = {}) {
  return {
    id: null,              // uuid
    project_id: null,      // uuid FK (nullable)
    name: '',
    trade: '',             // 'carpenter' | 'steel_fixer' | 'mason' | 'electrician' | ...
    daily_rate_thb: null,  // float
    phone: null,
    created_at: null,
    ...overrides,
  };
}

/**
 * CrewAssignment — ทีมงานที่ผูกกับ ScheduleActivity
 * @param {Partial<CrewAssignment>} overrides
 */
export function createCrewAssignment(overrides = {}) {
  return {
    id: null,           // uuid
    project_id: null,   // uuid FK
    activity_id: null,  // uuid FK → ScheduleActivity
    trade: '',
    crew_size: 1,       // int
    start_date: null,   // ISO date
    end_date: null,     // ISO date
    created_at: null,
    ...overrides,
  };
}

/**
 * WorkerAssignment — ช่วงเวลาที่ worker (shared pool) ถูก assign เข้าโครงการ/ทีม
 * @param {Partial<WorkerAssignment>} overrides
 */
export function createWorkerAssignment(overrides = {}) {
  return {
    id: null,                  // uuid
    project_id: null,          // uuid FK
    worker_id: null,           // uuid FK → Worker
    crew_assignment_id: null,  // uuid FK (nullable)
    start_date: null,          // ISO date
    end_date: null,            // ISO date
    created_at: null,
    ...overrides,
  };
}

/**
 * ProductivityRate — trade × work_type × region → output/day (global หรือ project override)
 * @param {Partial<ProductivityRate>} overrides
 */
export function createProductivityRate(overrides = {}) {
  return {
    id: null,                // uuid
    project_id: null,        // uuid FK (null = global default)
    trade: '',
    work_type: '',
    region: 'bangkok',       // 'bangkok' | 'central' | 'north' | 'northeast' | 'south'
    unit: '',                // 'm3' | 'kg' | 'm2'
    output_per_day: null,    // float
    source: 'standard',      // 'standard' | 'regional' | 'project_override'
    is_override: false,
    created_at: null,
    ...overrides,
  };
}

// --- Tier 5: Readiness Check (versioned) ---------------------------------

/**
 * ReadinessCheckVersion — snapshot ของ readiness ณ วันที่กำหนด
 * @param {Partial<ReadinessCheckVersion>} overrides
 */
export function createReadinessCheckVersion(overrides = {}) {
  return {
    id: null,             // uuid
    project_id: null,     // uuid FK
    snapshot_date: null,  // ISO date
    overall_status: null, // 'red' | 'amber' | 'green'
    created_at: null,
    ...overrides,
  };
}

/**
 * ReadinessDocument — เอกสารแนบต่อ ReadinessCheck item
 * @param {Partial<ReadinessDocument>} overrides
 */
export function createReadinessDocument(overrides = {}) {
  return {
    id: null,             // uuid
    check_item_id: null,  // uuid FK → ReadinessCheck
    file_name: '',
    file_url: '',
    uploaded_at: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// TIER 6: Onboarding Wizard + Timeline Engine
// ─────────────────────────────────────────────

/**
 * ProjectConfig — ตั้งค่าโครงการจาก Onboarding Wizard (1 row ต่อโปรเจกต์)
 * สร้างครั้งเดียวที่ wizard Step 3 ("สร้างภาพรวมโครงการ"); แก้ไขได้ภายหลังจาก Planner (date drag)
 *
 * @param {Partial<ProjectConfig>} overrides
 */
export function createProjectConfig(overrides = {}) {
  return {
    id: null,                      // uuid
    project_id: null,               // uuid FK (1:1 with projects)

    // Section A — Project Identity
    project_name: '',
    building_type: 'residential',  // 'residential' | 'commercial' | 'industrial' | 'institutional'
    floor_count: null,             // int
    total_area_sqm: null,          // float

    // Section B — Design Standard
    design_standard: 'WSD',        // 'WSD' | 'ACI318'
    design_standard_overrides: null, // { fc_ksc, fy_main_ksc, fy_stirrup_ksc, cover_mm } | null — from wizard Step 2 Panel B

    // Section C — Site Location
    site_province: null,           // string — key into PROVINCIAL_WEATHER
    site_district: null,           // string | null
    site_lat: null,                // float | null
    site_lng: null,                // float | null

    // Section D — Timeline
    timeline: {
      estimated_min_days: null,
      estimated_recommended_days: null,
      estimated_max_days: null,
      user_start_date: null,       // ISO date
      user_end_date: null,         // ISO date
      user_duration_days: null,    // int — computed from user dates
      weather_buffer_days: null,   // float
      rainy_season_months: [],     // int[] 1-12 — from PROVINCIAL_WEATHER[site_province]
      estimation_basis: {
        element_counts: {},        // { [work_type]: { extracted: N, corrected: N|null } }
        productivity_rates_used: null, // snapshot of EARLY_ESTIMATE_RATES at estimation time
        crew_size_used: 8,
        weather_source: 'provincial_table', // 'provincial_table' | 'open_meteo' | 'manual'
      },
    },

    // Budget impact (Section D continued)
    budget_impact: {
      baseline_cost_estimate: null,  // float THB — at estimated_recommended_days
      current_cost_estimate: null,   // float THB — at user_duration_days
      delta_cost: null,               // float THB — current - baseline
      delta_reason: null,             // 'compressed_schedule' | 'extended_schedule' | null
      extra_crew_needed: 0,           // int
      rain_risk_extra_days: 0,        // float
      risk_level: 'none',             // 'none' | 'low' | 'medium' | 'high'
    },

    // Section E — Material Pricing
    pricing_source: 'standard_bq',  // 'standard_bq' | 'catalog' | 'manual'
    catalog_supplier_ids: [],       // uuid[] — FK → suppliers (catalog-seed.js)

    // Wizard state
    wizard_completed_at: null,      // ISO datetime | null
    wizard_step_reached: 1,         // int 1-4

    created_at: null,
    updated_at: null,
    ...overrides,
  };
}

/**
 * TimelineEstimate — append-only log ของการประมาณ timeline (audit trail)
 * บันทึกทุกครั้งที่มีการคำนวณ/recalculate ระยะเวลาโครงการ
 *
 * @param {Partial<TimelineEstimate>} overrides
 */
export function createTimelineEstimate(overrides = {}) {
  return {
    id: null,                    // uuid
    project_id: null,            // uuid FK
    estimated_at: null,          // ISO datetime
    trigger: 'wizard_step3',     // 'wizard_step3' | 'planner_recalc' | 'province_change'
    method: 'engine',            // 'engine' | 'early_rates'
    estimated_min_days: null,
    estimated_recommended_days: null,
    estimated_max_days: null,
    weather_buffer_days: null,   // float
    rainy_season_months: [],     // int[] 1-12
    inputs: {
      element_counts: {},        // { [work_type]: number }
      productivity_rates_used: null, // snapshot of rates used (EARLY_ESTIMATE_RATES or PRODUCTIVITY_RATES)
      cure_lags_used: null,      // snapshot of cure/lag days used
      province: null,            // string — site_province at estimation time
      weather_source: 'provincial_table', // 'provincial_table' | 'open_meteo' | 'manual'
      crew_assumptions: null,    // snapshot of crew sizes used
    },
    created_at: null,
    ...overrides,
  };
}

/**
 * TimelineViewState — UI state ของ Planner (grouping/sort/filter), 1 row ต่อโปรเจกต์
 *
 * @param {Partial<TimelineViewState>} overrides
 */
export function createTimelineViewState(overrides = {}) {
  return {
    id: null,                  // uuid
    project_id: null,          // uuid FK
    grouping_mode: 'time',     // 'time' | 'work_type' | 'resource'
    sort_order: 'asc',         // 'asc' | 'desc'
    collapsed_groups: [],      // string[] — group keys collapsed by user
    date_filter: {
      from_date: null,         // ISO date | null
      to_date: null,           // ISO date | null
    },
    updated_at: null,
    ...overrides,
  };
}

/**
 * WORK_TYPE_HIERARCHY — Thai BOQ category mapping (หมวดที่ 1-7) + scheduling defaults
 * ใช้โดย computeBOQ() (category_code/category_label_th), timeline-engine.js (groupByWorkType),
 * และ Readiness (weather-overlap check ดูจาก typical_month_start)
 */
export const WORK_TYPE_HIERARCHY = {
  foundation: {
    category_code: '2',
    category_label_th: 'งานฐานราก',
    label_th: 'ฐานราก',
    typical_month_start: 1,
    element_types: ['footing'],
  },
  structure: {
    category_code: '3',
    category_label_th: 'งานโครงสร้าง คอนกรีตเสริมเหล็ก',
    label_th: 'โครงสร้าง',
    typical_month_start: 2,
    element_types: ['column', 'beam', 'girder', 'slab', 'staircase'],
    sub_categories: {
      column: { category_code: '3.1', category_label_th: 'งานเสา' },
      beam: { category_code: '3.2', category_label_th: 'งานคาน' },
      girder: { category_code: '3.2', category_label_th: 'งานคาน' },
      slab: { category_code: '3.3', category_label_th: 'งานพื้น' },
    },
  },
  roof: {
    category_code: '4',
    category_label_th: 'งานหลังคา',
    label_th: 'หลังคา',
    typical_month_start: 4,
    element_types: ['roof_truss', 'roof_covering'],
  },
  mep: {
    category_code: '6',
    category_label_th: 'งานระบบไฟฟ้าและสุขาภิบาล',
    label_th: 'งานระบบ',
    typical_month_start: 4,
    element_types: ['electrical', 'plumbing', 'hvac'],
  },
  finishing: {
    category_code: '7',
    category_label_th: 'งานตกแต่งและงานสถาปัตยกรรม',
    label_th: 'ตกแต่ง',
    typical_month_start: 5,
    element_types: ['masonry', 'plastering', 'tiling', 'painting'],
  },
  other: {
    category_code: '1',
    category_label_th: 'งานเตรียมพื้นที่และงานดิน',
    label_th: 'อื่นๆ',
    typical_month_start: 1,
    element_types: [],
  },
};

/** ส่งคืน work_type จาก element_type — ใช้โดย computeBOQ/computeSchedule */
export function workTypeFromElementType(elementType) {
  for (const [workType, def] of Object.entries(WORK_TYPE_HIERARCHY)) {
    if (def.element_types.includes(elementType)) return workType;
  }
  return elementType === 'column' || elementType === 'beam' || elementType === 'slab'
    ? 'structure'
    : 'other';
}

/**
 * EARLY_ESTIMATE_RATES — coarse productivity rates สำหรับ wizard Step 3
 * (ก่อนมี BOQ จริง — ใช้ element_counts ดิบจาก drawing_elements)
 * แยกจาก PRODUCTIVITY_RATES (ใช้หลังมี BOQ, ละเอียดกว่า, ขับเคลื่อน computeSchedule)
 */
export const EARLY_ESTIMATE_RATES = {
  foundation: { rate: 8, unit: 'm3/crew-day' },
  column:     { rate: 4, unit: 'units/crew-day' },
  beam:       { rate: 3, unit: 'units/crew-day' },
  slab:       { rate: 25, unit: 'm2/crew-day' },
  masonry:    { rate: 12, unit: 'm2/crew-day' },
  finishing:  { rate: 15, unit: 'm2/crew-day' },
};

export const EARLY_ESTIMATE_CREW_SIZE_DEFAULT = 8;

/**
 * PROVINCIAL_WEATHER — ฤดูฝนและจำนวนวันฝนเฉลี่ยต่อเดือน รายจังหวัด
 * อ้างอิง: Open-Meteo historical climate data (1991-2020 average), aggregated by region
 * rainy_months: เดือนที่ avg_rain_days_per_month >= 15 (เกณฑ์ "ฤดูฝน")
 * ครอบคลุม 24 จังหวัด (ตัวแทนแต่ละภาค) — จังหวัดที่เหลือใช้ค่าเฉลี่ยภาคใกล้เคียงผ่าน PROVINCE_REGION_FALLBACK
 */
export const PROVINCIAL_WEATHER = {
  'กรุงเทพมหานคร':   { region: 'central',   rainy_months: [5,6,7,8,9,10],   avg_rain_days_per_month: [3,4,7,15,16,17,18,18,19,16,5,2] },
  'นนทบุรี':         { region: 'central',   rainy_months: [5,6,7,8,9,10],   avg_rain_days_per_month: [3,4,7,15,16,17,18,18,19,16,5,2] },
  'ปทุมธานี':        { region: 'central',   rainy_months: [5,6,7,8,9,10],   avg_rain_days_per_month: [3,4,7,15,16,17,18,18,19,16,5,2] },
  'สมุทรปราการ':     { region: 'central',   rainy_months: [5,6,7,8,9,10],   avg_rain_days_per_month: [3,4,7,14,15,16,17,17,18,15,5,2] },
  'นครปฐม':          { region: 'central',   rainy_months: [5,6,7,8,9,10],   avg_rain_days_per_month: [3,4,7,14,15,16,17,17,18,15,5,2] },
  'พระนครศรีอยุธยา':  { region: 'central',   rainy_months: [5,6,7,8,9,10],   avg_rain_days_per_month: [3,4,7,14,15,16,17,17,18,15,5,2] },
  'ชลบุรี':          { region: 'east',      rainy_months: [5,6,7,8,9,10],   avg_rain_days_per_month: [3,3,5,12,16,17,18,18,20,18,7,2] },
  'ระยอง':           { region: 'east',      rainy_months: [5,6,7,8,9,10],   avg_rain_days_per_month: [3,3,5,11,16,17,19,19,21,18,7,2] },
  'จันทบุรี':         { region: 'east',      rainy_months: [5,6,7,8,9,10],   avg_rain_days_per_month: [4,4,6,13,18,19,21,21,22,20,8,3] },
  'เชียงใหม่':       { region: 'north',     rainy_months: [5,6,7,8,9],      avg_rain_days_per_month: [2,2,4,8,15,16,18,19,17,10,4,1] },
  'เชียงราย':        { region: 'north',     rainy_months: [5,6,7,8,9],      avg_rain_days_per_month: [2,2,4,8,16,17,19,20,17,10,4,1] },
  'ลำปาง':           { region: 'north',     rainy_months: [5,6,7,8,9],      avg_rain_days_per_month: [2,2,4,8,15,16,17,18,16,9,3,1] },
  'พิษณุโลก':        { region: 'north',     rainy_months: [5,6,7,8,9,10],   avg_rain_days_per_month: [2,3,5,9,15,15,16,17,17,12,4,1] },
  'นครสวรรค์':       { region: 'central',   rainy_months: [5,6,7,8,9,10],   avg_rain_days_per_month: [2,3,5,10,15,15,16,17,17,13,4,1] },
  'ขอนแก่น':         { region: 'northeast', rainy_months: [5,6,7,8,9],      avg_rain_days_per_month: [2,3,5,9,15,15,16,16,16,11,3,1] },
  'นครราชสีมา':      { region: 'northeast', rainy_months: [5,6,7,8,9,10],   avg_rain_days_per_month: [2,3,5,9,15,14,15,16,17,12,4,1] },
  'อุดรธานี':        { region: 'northeast', rainy_months: [5,6,7,8,9],      avg_rain_days_per_month: [2,3,5,9,16,16,17,17,17,11,3,1] },
  'อุบลราชธานี':     { region: 'northeast', rainy_months: [5,6,7,8,9,10],   avg_rain_days_per_month: [2,3,5,10,16,15,16,17,18,13,4,1] },
  'สุราษฎร์ธานี':    { region: 'south_gulf',  rainy_months: [10,11,12],      avg_rain_days_per_month: [6,4,5,8,14,13,13,14,16,19,19,12] },
  'นครศรีธรรมราช':   { region: 'south_gulf',  rainy_months: [10,11,12],      avg_rain_days_per_month: [8,5,5,8,14,12,13,14,16,20,21,15] },
  'สงขลา':           { region: 'south_gulf',  rainy_months: [11,12],         avg_rain_days_per_month: [9,5,5,7,12,11,11,12,14,17,20,16] },
  'ภูเก็ต':          { region: 'south_andaman', rainy_months: [5,6,7,8,9,10], avg_rain_days_per_month: [5,4,6,11,19,19,18,19,21,19,12,6] },
  'กระบี่':          { region: 'south_andaman', rainy_months: [5,6,7,8,9,10], avg_rain_days_per_month: [5,4,6,11,20,19,18,19,21,19,12,6] },
  'ระนอง':           { region: 'south_andaman', rainy_months: [5,6,7,8,9,10], avg_rain_days_per_month: [7,6,9,16,24,24,23,23,24,22,15,8] },
};

/** ภาคของแต่ละจังหวัด — ใช้ fallback สำหรับจังหวัดที่ไม่อยู่ใน PROVINCIAL_WEATHER โดยตรง */
export const PROVINCE_REGION_FALLBACK = {
  // จังหวัดอื่นๆ ที่ไม่ได้ระบุ -> ใช้ค่าเฉลี่ยของภาคที่อยู่ใกล้เคียงที่สุดจาก PROVINCIAL_WEATHER ภาคเดียวกัน
  // ตัวแทนภาค: central='กรุงเทพมหานคร', east='ชลบุรี', north='เชียงใหม่', northeast='ขอนแก่น',
  //            south_gulf='สุราษฎร์ธานี', south_andaman='ภูเก็ต'
  default_region_representative: {
    central: 'กรุงเทพมหานคร',
    east: 'ชลบุรี',
    north: 'เชียงใหม่',
    northeast: 'ขอนแก่น',
    south_gulf: 'สุราษฎร์ธานี',
    south_andaman: 'ภูเก็ต',
  },
};

/**
 * คืนค่า weather profile ของจังหวัด — ใช้ PROVINCIAL_WEATHER โดยตรงถ้ามี
 * ไม่งั้น fallback ไปจังหวัดตัวแทนของภาค (ต้องระบุ region เอง ถ้าไม่ทราบ default เป็น 'central')
 */
export function getProvincialWeather(province, fallbackRegion = 'central') {
  if (PROVINCIAL_WEATHER[province]) return PROVINCIAL_WEATHER[province];
  const rep = PROVINCE_REGION_FALLBACK.default_region_representative[fallbackRegion];
  return PROVINCIAL_WEATHER[rep];
}