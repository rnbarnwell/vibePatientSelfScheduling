import { validateName, validateEmail } from "./validation.js";

    // ===== Element refs =====
    const monthLabel=document.getElementById('monthLabel');
    const daysGrid=document.getElementById('days');
    const slotList=document.getElementById('slotList');
    const slotDateHeading=document.getElementById('slotDateHeading');
    const apptSummary=document.getElementById('apptSummary');
    const prevBtn=document.getElementById('prev');
    const nextBtn=document.getElementById('next');
            const backTop=document.getElementById('backTop');
    let currentStep = 1;

    // Step 4 refs
    const confirmWhen = document.getElementById('confirmWhen');
    const confirmEmail = document.getElementById('confirmEmail');
    const scheduleAnother = document.getElementById('scheduleAnother');

    // Step 3 refs
    const patientForm = document.getElementById('patientForm');
    const scheduleBtn = document.getElementById('scheduleBtn');
    const dobMonthEl = document.getElementById('dobMonth');
    const dobDayEl   = document.getElementById('dobDay');
    const dobYearEl  = document.getElementById('dobYear');

    // ===== State =====
    let viewYear=2025, viewMonth=7; // August 2025
    window.selectedDateISO=null;
    window.selectedSlot=null;

    // Business hours (edit here to change slot window)
    const BUSINESS_START_HOUR = 8;  // 8:00 AM
    const BUSINESS_END_HOUR   = 20;  // 8:00 PM

    // Centralized config
    const SLOT_INTERVAL_MIN   = 15; // minutes between slots
    const SLOT_KEEP_RATIO_MOD = 2;  // keep ~1/mod slots (2=50%, 3=66%, 5=80%)
    const DISABLE_WEEKENDS    = false;

    // ===== Helpers =====
    function formatToAmPm(timeStr) {
      const [hStr, mStr] = String(timeStr).split(":");
      let h = parseInt(hStr, 10);
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12; if (h === 0) h = 12;
      return `${h}:${mStr || '00'} ${ampm}`;
    }

    // Friendly full-date formatter used across UI
    

    // Local date helpers (avoid UTC shifts for YYYY-MM-DD)
    const DATE_FMT = { weekday:'long', year:'numeric', month:'long', day:'numeric' };
    function parseYMDLocal(ymd){
      const [y,m,d] = ymd.split('-').map(Number);
      return new Date(y, m-1, d);
    }
    function friendlyDateLocal(ymdOrDate){
      if (typeof ymdOrDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ymdOrDate)){
        return parseYMDLocal(ymdOrDate).toLocaleDateString(undefined, DATE_FMT);
      }
      return new Date(ymdOrDate).toLocaleDateString(undefined, DATE_FMT);
    }

    // Mock availability: only from today onwards
    function mockDayHasAvailability(dateObj){
      // Only allow availability for today or future dates
      const d = new Date(dateObj); d.setHours(0,0,0,0);
      const today = new Date(); today.setHours(0,0,0,0);
      if (DISABLE_WEEKENDS && [0,6].includes(d.getDay())) return false;
      if (d < today) return false;
      // Simple deterministic pattern so not every day is available
      const seed = d.getFullYear()*10000 + (d.getMonth()+1)*100 + d.getDate();
      return (seed % 5) !== 0; // ~80% of future days available
    }

    // 15‑minute slots within business hours; filter to ~50% available; today starts from next quarter hour
    function generateSlotsForDate(iso){
      const date = parseYMDLocal(iso);
      const now  = new Date();
      const start = new Date(date); start.setHours(BUSINESS_START_HOUR, 0, 0, 0);
      const end   = new Date(date); end.setHours(BUSINESS_END_HOUR,   0, 0, 0);
      let cursor = new Date(start);
      if (date.toDateString() === now.toDateString()){
        const next = new Date(now);
        const addMin = (SLOT_INTERVAL_MIN - (next.getMinutes() % SLOT_INTERVAL_MIN)) % SLOT_INTERVAL_MIN;
        next.setMinutes(next.getMinutes() + addMin, 0, 0);
        if (next > cursor) cursor = next;
      }
      const all = [];
      while (cursor <= end){ all.push(new Date(cursor)); cursor = new Date(cursor.getTime() + SLOT_INTERVAL_MIN*60*1000); }
      const available = all.filter(dt => {
        const seed = date.getFullYear()*10000 + (date.getMonth()+1)*100 + date.getDate() + dt.getHours()*60 + dt.getMinutes();
        return (seed % SLOT_KEEP_RATIO_MOD) !== 0; // keep ~1/mod slots
      });
      const list = (available.length ? available : all.slice(0, Math.min(3, all.length)))
        .map(dt => formatToAmPm(`${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`));
      return list;
    }

    function renderSlots(iso){
      // Render the Step 2 list of time slots for a given YYYY-MM-DD d
      slotDateHeading.textContent = friendlyDateLocal(iso);
      slotList.innerHTML = '';

      const slots = generateSlotsForDate(iso);
      if (!slots.length){
        const p = document.createElement('p');
        p.className = 'helper';
        p.textContent = 'No times remaining for this date.';
        slotList.appendChild(p);
        return;
      }

      slots.forEach((t) => {
        const b = document.createElement('button');
        b.className = 'slot-btn';
        b.innerHTML = '<span class="txt">' + t + '</span>';
        b.addEventListener('click', () => {
          window.selectedSlot = t;
          apptSummary.textContent = friendlyDateLocal(iso) + ' at ' + t;
          gotoStep(3);
          if (typeof updateValidity === 'function') updateValidity();
        });
        slotList.appendChild(b);
      });
    }

// Step 3 helpers: populate DOB selects and validate form (Canvas-safe)
function daysInMonth(y,m){ const yy=Number(y)||new Date().getFullYear(); const mm=(Number(m)||1)-1; return new Date(yy,mm+1,0).getDate(); }
function populateMonths(){ /* pre-populated in HTML */ }

function capDaysForMonthYear(){
  const dayEl = document.getElementById('dobDay');
  const yearEl = document.getElementById('dobYear');
  const monthEl = document.getElementById('dobMonth');
  if(!dayEl) return;
  const y = (yearEl?.value || new Date().getFullYear());
  const m = (monthEl?.value || 1);
  const max = daysInMonth(y,m);
  // Disable days beyond max
  const opts = Array.from(dayEl.querySelectorAll('md-select-option'));
  opts.forEach((opt, idx) => {
    const d = idx+1;
    if (d > max) opt.setAttribute('disabled','');
    else opt.removeAttribute('disabled');
  });
  if (dayEl.value && Number(dayEl.value) > max) dayEl.value = '';
}

    
function gv(id){ const el=document.getElementById(id); return (el && el.value ? String(el.value).trim() : ''); }
function setFieldError(id, ok, msg){
  const el = document.getElementById(id);
  if(!el) return;
  if(ok){ el.removeAttribute('error'); el.removeAttribute('error-text'); }
  else { el.setAttribute('error',''); el.setAttribute('error-text', msg); }
}
function setTextError(id, ok, msg){
  const p = document.getElementById(id);
  if(!p) return;
  p.textContent = ok ? '' : msg;
}
    
function updateValidity(){
  const btn = document.getElementById('scheduleBtn');
  if(!btn) return;
  const v = gv;

  const firstOk = validateName(v('firstName')); setFieldError('firstName', firstOk, 'First name is required');
  const lastOk  = validateName(v('lastName'));  setFieldError('lastName',  lastOk,  'Last name is required');

  const emailOk = validateEmail(v('email')); setFieldError('email', emailOk, 'Enter a valid email');

  const addrOk  = !!v('addr1'); setFieldError('addr1', addrOk, 'Street address is required');
  const cityOk  = !!v('city');  setFieldError('city',  cityOk,  'City is required');
  const stateOk = !!v('state'); setFieldError('state', stateOk, 'Select a state');

  const zipOk = /^\d{5}(-\d{4})?$/.test(v('zip')); setFieldError('zip', zipOk, 'Enter ZIP (5 digits or ZIP+4)');

  const insOk = !!v('insurance'); setFieldError('insurance', insOk, 'Enter insurance or "none"');

  const sexOk = Array.from(document.querySelectorAll('md-radio[name="sex"]')).some(r => r.checked);
  setTextError('sexError', sexOk, 'Please select Legal Sex');

  const reasonOk = Array.from(document.querySelectorAll('md-radio[name="reason"]')).some(r => r.checked);
  setTextError('reasonError', reasonOk, 'Please select a reason');

  const yearOk = /^\d{4}$/.test(v('dobYear')); setFieldError('dobYear', yearOk, 'Enter a 4-digit year');
  const monthOk = !!v('dobMonth'); setFieldError('dobMonth', monthOk, 'Select month'); const dayOk   = !!v('dobDay');   setFieldError('dobDay',   dayOk,   'Select day');

  const ccVal = document.getElementById('countryCode')?.value || '';
  const ccOk  = !!ccVal; setFieldError('countryCode', ccOk, 'Select country code'); const phoneDigits = (v('phone').replace(/\D/g,''));
  const phoneOk = ccOk ? (ccVal === '+1' ? phoneDigits.length === 10 : phoneDigits.length >= 6) : false;
  setFieldError('phone', phoneOk, 'Enter a valid phone number');

  const stepOk = !!(window.selectedDateISO && window.selectedSlot);

  const allOk = firstOk && lastOk && emailOk && addrOk && cityOk && stateOk && zipOk && insOk &&
                sexOk && reasonOk && yearOk && monthOk && dayOk && ccOk && phoneOk && stepOk;
  btn.disabled = !allOk;
}


// Initialize Step 3 once when shown

    function updateProgress(n){
      const c1=document.getElementById('circle1');
      const c2=document.getElementById('circle2');
      const c3=document.getElementById('circle3');
      const c4=document.getElementById('circle4');
      const l1=document.getElementById('line1');
      const l2=document.getElementById('line2');
      const l3=document.getElementById('line3');
      [c1,c2,c3,c4,l1,l2,l3].forEach(el=>el && el.classList.remove('active'));
      if(n>=1){ c1?.classList.add('active'); }
      if(n>=2){ c2?.classList.add('active'); l1?.classList.add('active'); }
      if(n>=3){ c3?.classList.add('active'); l2?.classList.add('active'); }
      if(n>=4){ c4?.classList.add('active'); l3?.classList.add('active'); }
    }

    function gotoStep(n){
      document.getElementById('step1').hidden = n!==1;
      document.getElementById('step2').hidden = n!==2;
      document.getElementById('step3').hidden = n!==3;
      document.getElementById('step4').hidden = n!==4;
      currentStep = n;
      if (backTop){
        if (n === 1 || n === 4){ backTop.hidden = true; backTop.style.display = 'none'; }
        else { backTop.hidden = false; backTop.style.display = 'inline-flex'; }
      }

      updateProgress(n);

      // a11y: move focus to current step title for screen readers/keyboard users
      const stepTitle = document.querySelector(`#step${n} > h2`);
      if (stepTitle){ stepTitle.setAttribute('tabindex','-1'); stepTitle.focus(); }
    }

    // ===== Calendar =====
    function renderMonth() {
      monthLabel.textContent=new Date(viewYear,viewMonth,1).toLocaleDateString(undefined,{month:'long',year:'numeric'});
      const firstWeekday=new Date(viewYear,viewMonth,1).getDay();
      const daysInMonth=new Date(viewYear,viewMonth+1,0).getDate();
      daysGrid.innerHTML='';
      for(let i=0;i<firstWeekday;i++){daysGrid.appendChild(document.createElement('div'))}
      const today = new Date(); today.setHours(0,0,0,0);
      for(let d=1;d<=daysInMonth;d++){
        const btn=document.createElement('button');
        btn.type='button';
        const dateObj = new Date(viewYear,viewMonth,d);
                const isAvail = mockDayHasAvailability(dateObj);
        btn.textContent=d;btn.className='daybtn';
        btn.setAttribute('aria-label', dateObj.toDateString() + (isAvail ? ' — Available' : ' — Unavailable'));
        if (!isAvail) {
          btn.disabled = true;
        } else {
          btn.addEventListener('click',()=>{
            window.selectedDateISO = `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}-${String(dateObj.getDate()).padStart(2,'0')}`;
            renderSlots(window.selectedDateISO);
            gotoStep(2);
          });
        }
        daysGrid.appendChild(btn);
      }
    }

    prevBtn.addEventListener('click',()=>{viewMonth--;if(viewMonth<0){viewMonth=11;viewYear--;}renderMonth()});
    nextBtn.addEventListener('click',()=>{viewMonth++;if(viewMonth>11){viewMonth=0;viewYear++;}renderMonth()});
            backTop?.addEventListener('click', ()=>{ if (currentStep===3) gotoStep(2); else gotoStep(1); });

    // Step 3 listeners (unconditional)
    document.getElementById('dobMonth')?.addEventListener('change', ()=>{ capDaysForMonthYear(); updateValidity(); });
    document.getElementById('dobYear')?.addEventListener('input',  ()=>{ capDaysForMonthYear(); updateValidity(); });
    document.getElementById('patientForm')?.addEventListener('input',  updateValidity);
    document.getElementById('patientForm')?.addEventListener('change', updateValidity);
    document.querySelectorAll('md-radio[name="sex"], md-radio[name="reason"]').forEach(r=> r.addEventListener('change', updateValidity));
    document.getElementById('countryCode')?.addEventListener('change', updateValidity);
    document.getElementById('state')?.addEventListener('change', updateValidity);

    // Init calendar and validity
    renderMonth();
    gotoStep(1);
    capDaysForMonthYear();
    updateValidity();
    // Handle scheduling: prevent default form submit, populate confirmation, go to Step 4
    scheduleBtn?.addEventListener('click', (e)=>{
      e.preventDefault();
      if (scheduleBtn.disabled) return;
      const whenTxt = friendlyDateLocal(window.selectedDateISO) + (window.selectedSlot?(' at '+window.selectedSlot):'');
      if (confirmWhen) confirmWhen.textContent = whenTxt;
      if (confirmEmail) confirmEmail.textContent = (document.getElementById('email')?.value||'').trim();
      gotoStep(4);
    });

    scheduleAnother?.addEventListener('click', ()=>{ window.selectedDateISO=null; window.selectedSlot=null; gotoStep(1); updateProgress(1); });

    
