// wz-step4.js — Onboarding Wizard Step 4: generate BOQ/BBS/schedule/resources/readiness
//
// Runs runPipeline() with a progress callback that ticks off a checklist; on success
// hides the wizard and switches to the Overview tab. On failure, offers inline retry
// or a non-blocking link to Overview (so the user isn't stuck behind the overlay).

import { runPipeline } from '../shared/pipeline.js';
import { wz_hide, wz_prevStep } from './wz-index.js';

const TASKS = [
  { key: 'elements', label: 'อ่านข้อมูลแบบ (drawing elements + beam library)' },
  { key: 'boq', label: 'คำนวณ BOQ' },
  { key: 'bbs', label: 'สร้าง BBS (ตารางตัด-ดัดเหล็ก)' },
  { key: 'schedule', label: 'วางแผนงานก่อสร้าง (Planner)' },
  { key: 'resources', label: 'ประเมินทรัพยากร (Resource Hub)' },
  { key: 'readiness', label: 'อัปเดต Readiness Check' },
];

export function wz_renderStep4(root) {
  root.innerHTML = `
    <div class="wz-step">
      <h2 class="wz-step__title">ขั้นตอนที่ 4 — สร้างแผนงาน</h2>
      <p class="wz-step__desc">ระบบกำลังคำนวณ BOQ, BBS, แผนงาน, ทรัพยากร และ Readiness Check จากข้อมูลที่ตั้งค่าไว้</p>

      <ul class="wz-checklist" id="wz4-checklist">
        ${TASKS.map(t => `<li data-task="${t.key}" class="wz-checklist__item"><span class="wz-checklist__icon">⏳</span><span>${t.label}</span></li>`).join('')}
      </ul>

      <div class="wz-status" id="wz4-status"></div>

      <div class="wz-actions" id="wz4-actions" hidden>
        <button type="button" class="fp-btn-secondary" id="wz4-back">ย้อนกลับ</button>
        <div class="wz-actions__spacer"></div>
        <button type="button" class="fp-btn-primary" id="wz4-retry">ลองอีกครั้ง</button>
        <button type="button" class="fp-btn-secondary" id="wz4-skip">ไปที่ภาพรวม</button>
      </div>
    </div>
  `;

  root.querySelector('#wz4-back')?.addEventListener('click', () => wz_prevStep());
  root.querySelector('#wz4-retry')?.addEventListener('click', () => wz_step4_run(root));
  root.querySelector('#wz4-skip')?.addEventListener('click', () => {
    wz_hide();
    window.constistant_setActiveTab?.('Overview');
  });

  wz_step4_run(root);
}

async function wz_step4_run(root) {
  const list = root.querySelector('#wz4-checklist');
  const status = root.querySelector('#wz4-status');
  const actions = root.querySelector('#wz4-actions');
  actions.hidden = true;
  status.textContent = '';
  list.querySelectorAll('li').forEach(li => {
    li.classList.remove('wz-checklist__item--done', 'wz-checklist__item--active');
    li.querySelector('.wz-checklist__icon').textContent = '⏳';
  });

  try {
    const result = await runPipeline((label, step, total) => {
      list.querySelectorAll('li').forEach((li, i) => {
        const icon = li.querySelector('.wz-checklist__icon');
        if (i < step - 1) { li.classList.add('wz-checklist__item--done'); li.classList.remove('wz-checklist__item--active'); icon.textContent = '✅'; }
        else if (i === step - 1) { li.classList.add('wz-checklist__item--active'); icon.textContent = '⏳'; }
      });
      status.textContent = `(${step}/${total}) ${label}…`;
    });

    list.querySelectorAll('li').forEach(li => {
      li.classList.add('wz-checklist__item--done');
      li.classList.remove('wz-checklist__item--active');
      li.querySelector('.wz-checklist__icon').textContent = '✅';
    });
    status.textContent = `✅ เสร็จสิ้น — BOQ ฿${result.totals.boq_amount_thb.toLocaleString('th-TH')} | แผนงาน ${result.totals.schedule_days} วัน`;

    await new Promise(r => setTimeout(r, 600));
    wz_hide();
    window.constistant_setActiveTab?.('Overview');
  } catch (err) {
    console.error('[wizard step4] pipeline failed', err);
    status.textContent = `❌ คำนวณไม่สำเร็จ: ${err.message}`;
    actions.hidden = false;
  }
}
