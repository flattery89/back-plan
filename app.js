(() => {
  const KEY = "backplan.v1";
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // ---------- storage ----------
  const blank = () => ({ stage: 0, stageStart: todayKey(), flareUntil: null, done: {}, log: [] });
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && typeof s === "object") return Object.assign(blank(), s);
    } catch (e) {}
    return blank();
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  // ---------- dates ----------
  function todayKey(d = new Date()) {
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  function parseKey(k) { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); }
  function daysBetween(a, b) { return Math.round((parseKey(b) - parseKey(a)) / 86400000); }
  function niceDate(k) {
    return parseKey(k).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let state = load();
  let tab = "today";
  const view = document.getElementById("view");

  // ---------- helpers ----------
  const stage = () => STAGES[state.stage] || STAGES[0];
  const isFlare = () => state.flareUntil && state.flareUntil >= todayKey();

  function dayType(date = new Date()) {
    if (stage().everyDay) return "every";
    const dow = date.getDay();
    return dow === 1 || dow === 3 || dow === 5 ? "strength" : "mobility";
  }

  let viewOffset = 0; // days from today shown on the Today tab
  const viewDate = () => { const d = new Date(); d.setDate(d.getDate() + viewOffset); return d; };

  function listFor(date) {
    if (viewOffset === 0 && isFlare()) return FLARE.list;
    const s = stage();
    if (s.everyDay) return s.strength;
    return dayType(date) === "strength" ? s.strength : s.mobility;
  }

  function weekStrip() {
    // Monday-first week containing the viewed day
    const base = new Date(); const dow = (base.getDay() + 6) % 7;
    const monday = new Date(base); monday.setDate(base.getDate() - dow);
    let html = `<div class="week">`;
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      const off = Math.round((parseKey(todayKey(d)) - parseKey(todayKey())) / 86400000);
      const t = stage().everyDay ? "every" : dayType(d);
      const label = t === "strength" ? "Strength" : t === "mobility" ? "Mobility" : "Daily";
      const done = (state.done[todayKey(d)] || []).length > 0;
      html += `<button type="button" class="wd ${off === viewOffset ? "sel" : ""} ${off === 0 ? "today" : ""} ${t}" data-off="${off}">
        <span class="wd-name">${DAY_NAMES[d.getDay()].slice(0, 3)}</span>
        <span class="wd-num">${d.getDate()}</span>
        <span class="wd-type">${label}${done ? " ✓" : ""}</span></button>`;
    }
    return html + `</div>`;
  }

  function exerciseCard(item, idx, checkable) {
    const e = EXERCISES[item.ex];
    const doneList = state.done[todayKey()] || [];
    const key = `${isFlare() ? "f" : state.stage}-${dayType()}-${item.ex}`;
    checkable = checkable && viewOffset === 0;
    const done = doneList.includes(key);
    const links = [];
    if (e.video) links.push(`<a class="vid" href="${e.video}" target="_blank" rel="noopener">▶ Watch how</a>`);
    if (e.alt) links.push(`<a class="vid ghost" href="${e.alt.video}" target="_blank" rel="noopener">${esc(e.alt.label)}</a>`);
    const vid = ytId(e.video);
    let media = "";
    if (e.img) {
      media = `<button type="button" class="media ${e.hold ? "hold" : "loop"}" ${vid ? `data-play="${vid}"` : ""} aria-label="Show ${esc(e.name)}">
        <img src="img/${e.img}-0.jpg" alt="" loading="lazy"><img class="f2" src="img/${e.img}-1.jpg" alt="" loading="lazy">
        ${vid ? `<span class="play">▶</span>` : ""}</button>`;
    } else if (vid) {
      media = `<button type="button" class="media" data-play="${vid}" aria-label="Play ${esc(e.name)} video">
        <img src="https://i.ytimg.com/vi/${vid}/mqdefault.jpg" alt="" loading="lazy"><span class="play">▶</span></button>`;
    }
    return `
      <div class="card ex ${done ? "done" : ""}">
        ${checkable ? `<input type="checkbox" data-key="${key}" ${done ? "checked" : ""} aria-label="Done: ${esc(e.name)}">` : ""}
        <div class="body">
          <div class="ex-top"><div class="ex-text">
          <h3>${esc(e.name)}</h3>
          <div class="dose">${esc(item.dose)}</div>
          <div class="cue">${esc(e.cue)}</div>
          </div>${media}</div>
          <div class="player" hidden></div>
          ${e.joe ? `<div class="joe"><b>For your L4–L5:</b> ${esc(e.joe)}</div>` : ""}
          ${e.swap ? `<div class="swap">${esc(e.swap)}</div>` : ""}
          ${links.length ? `<div class="links">${links.join("")}</div>` : ""}
        </div>
      </div>`;
  }

  function ytId(url) {
    const m = url && url.match(/(?:shorts\/|v=)([\w-]{11})/);
    return m ? m[1] : null;
  }

  function togglePlayer(btn) {
    const card = btn.closest(".card");
    const player = card.querySelector(".player");
    if (!player.hidden) { player.innerHTML = ""; player.hidden = true; btn.classList.remove("open"); return; }
    document.querySelectorAll(".player:not([hidden])").forEach((p) => { p.innerHTML = ""; p.hidden = true; });
    document.querySelectorAll(".media.open").forEach((m) => m.classList.remove("open"));
    const id = btn.dataset.play;
    const isShort = /shorts\//.test(card.querySelector("a.vid")?.href || "");
    player.className = "player" + (isShort ? " tall" : "");
    player.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&playsinline=1&rel=0&modestbranding=1"
      title="Exercise demo" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>
      <button type="button" class="close-player">Close video</button>`;
    player.hidden = false; btn.classList.add("open");
  }

  // ---------- trend (centralization) ----------
  function trend() {
    const log = [...state.log].sort((a, b) => a.date.localeCompare(b.date));
    if (log.length < 4) return null;
    const avg = (arr) => arr.reduce((t, x) => t + x.reach, 0) / arr.length;
    const recent = log.slice(-3), before = log.slice(-6, -3);
    const diff = avg(recent) - avg(before);
    const legDiff = recent.reduce((t, x) => t + x.leg, 0) / 3 - before.reduce((t, x) => t + x.leg, 0) / before.length;
    if (diff <= -0.5) return { cls: "green", text: "Leg pain is moving up toward your back. That is the main sign the disc is settling. Keep going." };
    if (diff >= 0.5) return { cls: "red", text: "Leg pain is spreading further down your leg. Turn on Flare-up and drop back one stage for a few days." };
    if (legDiff <= -1) return { cls: "green", text: "Leg pain is easing. Keep going." };
    if (legDiff >= 1.5) return { cls: "yellow", text: "Leg pain is creeping up. Hold this stage and don't add anything new this week." };
    return { cls: "accent", text: "Leg pain is holding steady." };
  }

  // ---------- views ----------
  function renderToday() {
    const s = stage();
    const today = todayKey();
    const vd = viewDate();
    const isToday = viewOffset === 0;
    const list = listFor(vd);
    const doneList = state.done[today] || [];
    const keys = list.map((i) => `${isFlare() ? "f" : state.stage}-${dayType()}-${i.ex}`);
    const doneCount = keys.filter((k) => doneList.includes(k)).length;
    const entry = state.log.find((l) => l.date === today);
    const t = trend();

    let heading;
    if (isToday && isFlare()) heading = "Flare-up day";
    else if (s.everyDay) heading = isToday ? "Today's routine" : "Daily routine";
    else heading = dayType(vd) === "strength" ? "Strength day" : "Mobility day";

    let html = "";
    if (!state.quizDone && !state.log.length) {
      html += `<div class="card"><h3>Where should you start?</h3>
        <p class="muted">Three quick questions put you on the right stage. You don't have to start where Matt did.</p>
        <button class="btn" data-act="quiz">Find my starting stage</button></div>`;
    }
    html += weekStrip();
    if (!isToday) {
      html += `<div class="banner accent">Preview of ${DAY_NAMES[vd.getDay()]}. You can check items off on the day itself.
        <button class="btn ghost" style="margin-top:8px" data-act="backToday">Back to today</button></div>`;
    }
    if (isToday && isFlare()) html += `<div class="banner red"><b>Flare-up mode.</b> ${esc(FLARE.intro)}</div>`;
    if (isToday && t) html += `<div class="banner ${t.cls}">${esc(t.text)}</div>`;

    if (isToday) html += `<div class="card">
      <h3>How's it feeling today?</h3>
      ${entry
        ? `<p class="muted">Back ${entry.back}/10 · Leg ${entry.leg}/10 · Reaches: ${esc(REACH[entry.reach])}</p>
           <button class="btn ghost" data-act="checkin">Update today's check-in</button>`
        : `<p class="muted">10 seconds. It's how you'll see whether the leg pain is retreating.</p>
           <button class="btn" data-act="checkin">Log today's pain</button>`}
    </div>`;

    html += `<h2>${heading}</h2>
      <p class="muted">${DAY_NAMES[vd.getDay()]} · Stage ${s.id}: ${esc(s.name)}${
        !s.everyDay && !(isToday && isFlare()) ? (dayType(vd) === "strength" ? " · 10–15 min" : isToday ? " · Next strength day: " + nextStrength() : "") : ""
      }</p>
      ${isToday ? `<div class="progress"><div style="width:${list.length ? (doneCount / list.length) * 100 : 0}%"></div></div>` : ""}`;
    html += list.map((it, i) => exerciseCard(it, i, true)).join("");
    if (isToday && doneCount === list.length && list.length) html += `<div class="banner green"><b>Done for today.</b> Small wins make big wins.</div>`;
    if (s.caution && !isFlare()) html += `<div class="banner yellow">${esc(s.caution)}</div>`;
    view.innerHTML = html;
  }

  function nextStrength() {
    const d = new Date();
    for (let i = 1; i <= 7; i++) {
      const n = new Date(d); n.setDate(d.getDate() + i);
      if ([1, 3, 5].includes(n.getDay())) return DAY_NAMES[n.getDay()];
    }
    return "";
  }

  function renderCheckin() {
    const today = todayKey();
    const e = state.log.find((l) => l.date === today) || { back: null, leg: null, reach: null, note: "" };
    const scale = (name, val) => `<div class="scale" data-name="${name}">${
      Array.from({ length: 11 }, (_, i) => `<button type="button" data-v="${i}" class="${val === i ? "on" : ""}">${i}</button>`).join("")
    }</div>`;
    view.innerHTML = `
      <h2>Today's check-in</h2>
      <div class="card">
        <label class="field">Lower back pain (0 = none, 10 = worst)</label>
        ${scale("back", e.back)}
        <label class="field">Right leg pain</label>
        ${scale("leg", e.leg)}
        <label class="field">How far down the leg does it reach?</label>
        <div class="chips" data-name="reach">${REACH.map((r, i) => `<button type="button" data-v="${i}" class="${e.reach === i ? "on" : ""}">${r}</button>`).join("")}</div>
        <label class="field">Notes (optional)</label>
        <textarea id="note" placeholder="What helped, what hurt">${esc(e.note || "")}</textarea>
      </div>
      <div class="row">
        <button class="btn ghost" data-act="cancel">Cancel</button>
        <button class="btn" data-act="saveCheckin">Save</button>
      </div>
      <p class="muted" style="margin-top:12px">If numbness reaches your groin or inner thighs, or you have new trouble with your bladder or bowels, go to the ER now.</p>`;
    view.querySelectorAll(".scale, .chips").forEach((group) => {
      group.addEventListener("click", (ev) => {
        const b = ev.target.closest("button"); if (!b) return;
        group.querySelectorAll("button").forEach((x) => x.classList.remove("on"));
        b.classList.add("on");
      });
    });
  }

  function saveCheckin() {
    const pick = (name) => { const b = view.querySelector(`[data-name="${name}"] button.on`); return b ? Number(b.dataset.v) : null; };
    const back = pick("back"), leg = pick("leg"), reach = pick("reach");
    if (back === null || leg === null || reach === null) { alertInline("Pick a number for back, leg, and how far it reaches."); return; }
    const note = view.querySelector("#note").value.trim();
    const today = todayKey();
    state.log = state.log.filter((l) => l.date !== today);
    state.log.push({ date: today, back, leg, reach, note });
    save();
    tab = "today"; render();
  }

  function alertInline(msg) {
    let el = view.querySelector(".banner.red.inline");
    if (!el) { el = document.createElement("div"); el.className = "banner red inline"; view.prepend(el); }
    el.textContent = msg;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const QUIZ = [
    { q: "Can you walk for 20 minutes without your leg pain getting worse or spreading further down?",
      a: ["Yes", "No"] },
    { q: "Right now, how far down your right leg does the pain or tingling reach?",
      a: ["No leg pain", "Buttock or thigh", "Knee or below"] },
    { q: "Lie face down, propped on your elbows, for 1 minute. Does your leg pain stay the same or ease?",
      hint: "Try it now if you haven't. Stop if the leg pain spreads.",
      a: ["Stays the same or eases", "It spreads down the leg", "Can't try right now"] },
  ];
  let quizAnswers = [];

  function quizResult() {
    const [walk, reach, prone] = quizAnswers;
    if (walk === 1) return { stage: 0, why: "Walking 20 minutes still aggravates the leg, so start by calming it down. You'll likely move up within a week or two." };
    if (reach === 2) return { stage: 1, why: "The pain still reaches your knee or below, which means the nerve is still irritated. Stage 1 is gentle enough not to stir it up." };
    if (prone !== 0) return { stage: 1, why: "Until you know lying face-down doesn't push the pain down your leg, start with the gentler routine." };
    return { stage: 2, why: "You walk fine, the leg pain stays above the knee, and the face-down test doesn't aggravate it. That's roughly where Matt was around week 3–4. Stage 2 is his core Mon/Wed/Fri routine." };
  }

  function renderQuiz() {
    const i = quizAnswers.length;
    if (i < QUIZ.length) {
      const item = QUIZ[i];
      view.innerHTML = `<h2>Where should you start?</h2>
        <p class="muted">Question ${i + 1} of ${QUIZ.length}</p>
        <div class="card"><h3>${esc(item.q)}</h3>${item.hint ? `<p class="muted">${esc(item.hint)}</p>` : ""}
        ${item.a.map((a, n) => `<button class="btn ghost" style="margin-top:8px" data-act="quizAnswer" data-n="${n}">${esc(a)}</button>`).join("")}</div>
        <button class="btn ghost" data-act="cancel">Cancel</button>`;
      return;
    }
    const r = quizResult(); const s = STAGES[r.stage];
    view.innerHTML = `<h2>Start at Stage ${s.id}: ${esc(s.name)}</h2>
      <div class="card"><p>${esc(r.why)}</p>
      <p style="font-size:14px"><b>You'll move up when:</b> ${esc(s.gate)}</p></div>
      <button class="btn" data-act="quizStart" data-stage="${s.id}">Start Stage ${s.id}</button>
      <button class="btn ghost" data-act="quiz">Answer again</button>
      <p class="muted" style="margin-top:12px">Starting lower than you need costs you a week at most. Starting too high can cause a flare that costs much more.</p>`;
  }

  function renderPlan() {
    let html = `<button class="btn ghost" style="margin-bottom:14px" data-act="quiz">Not sure which stage? Take the 3-question check</button>
      <h2>Your plan</h2>
      <p class="muted">Based on Matt Carmona's rehab of three herniated discs, adapted for your right-side L4–L5 herniation. The weeks are a guide. Move to the next stage only when you pass its check, not because a week went by.</p>`;
    html += STAGES.map((s) => {
      const cur = s.id === state.stage;
      const listItems = (arr) => arr.map((i) => `<li>${esc(EXERCISES[i.ex].name)} — ${esc(i.dose)}</li>`).join("");
      return `<div class="card stage ${cur ? "current" : ""}">
        <div class="stage-head"><h3>Stage ${s.id}: ${esc(s.name)}</h3><span class="pill">${cur ? "You are here" : esc(s.when)}</span></div>
        <p class="muted">${esc(s.goal)}</p>
        <p style="font-size:14px"><b>Move on when:</b> ${esc(s.gate)}</p>
        <details><summary>See exercises</summary>
          ${s.everyDay ? `<ul class="plain">${listItems(s.strength)}</ul>` : `
          <p style="margin:8px 0 0;font-size:14px"><b>Mon / Wed / Fri — strength</b></p><ul class="plain">${listItems(s.strength)}</ul>
          <p style="margin:8px 0 0;font-size:14px"><b>Other days — mobility</b></p><ul class="plain">${listItems(s.mobility)}</ul>`}
          <p class="muted" style="margin-top:8px">${esc(s.matt)}</p>
        </details>
        ${cur ? `<p class="muted" style="margin-top:10px">Day ${daysBetween(state.stageStart, todayKey()) + 1} of this stage.</p>`
              : `<button class="btn ghost" style="margin-top:10px" data-act="setStage" data-stage="${s.id}">Start this stage</button>`}
      </div>`;
    }).join("");
    view.innerHTML = html;
  }

  function renderLog() {
    const log = [...state.log].sort((a, b) => a.date.localeCompare(b.date));
    let html = `<h2>Pain log</h2>`;
    const t = trend();
    if (t) html += `<div class="banner ${t.cls}">${esc(t.text)}</div>`;
    if (!log.length) {
      html += `<div class="card"><p class="muted">No check-ins yet. Log one from the Today tab each day.</p></div>`;
    } else {
      html += `<div class="card">${chart(log.slice(-30))}
        <div class="legend"><span><i style="background:var(--accent)"></i>Leg pain</span><span><i style="background:var(--muted)"></i>Back pain</span><span><i style="background:var(--yellow)"></i>How far down</span></div></div>`;
      html += `<div class="card">${log.slice().reverse().map((l) => `
        <div class="log-row"><div><b>${niceDate(l.date)}</b>${l.note ? `<div class="muted">${esc(l.note)}</div>` : ""}</div>
        <div style="text-align:right;white-space:nowrap">Back ${l.back} · Leg ${l.leg}<div class="muted">${esc(REACH[l.reach])}</div></div></div>`).join("")}</div>`;
    }
    html += `<h2>Backup</h2>
      <p class="muted">Your log is saved on this phone only. Save a backup file now and then so you don't lose it.</p>
      <div class="row"><button class="btn ghost" data-act="export">Save backup</button>
      <button class="btn ghost" data-act="import">Restore backup</button></div>
      <input type="file" id="importFile" accept="application/json" hidden>`;
    view.innerHTML = html;
  }

  function chart(log) {
    const W = 320, H = 160, pad = 22;
    const n = log.length;
    const x = (i) => n === 1 ? W / 2 : pad + (i * (W - pad * 2)) / (n - 1);
    const y = (v) => H - pad - (v / 10) * (H - pad * 2);
    const yR = (v) => H - pad - (v / 5) * (H - pad * 2);
    const line = (key, col) => `<polyline fill="none" stroke="${col}" stroke-width="2.5" stroke-linejoin="round" points="${log.map((l, i) => `${x(i)},${y(l[key])}`).join(" ")}"/>` +
      log.map((l, i) => `<circle cx="${x(i)}" cy="${y(l[key])}" r="3" fill="${col}"/>`).join("");
    const bars = log.map((l, i) => `<rect x="${x(i) - 3}" y="${yR(l.reach)}" width="6" height="${H - pad - yR(l.reach)}" fill="var(--yellow)" opacity=".35" rx="2"/>`).join("");
    const grid = [0, 5, 10].map((v) => `<line x1="${pad}" x2="${W - pad}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="4" y="${y(v) + 4}" font-size="10" fill="var(--muted)">${v}</text>`).join("");
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Pain over time">${grid}${bars}${line("back", "var(--muted)")}${line("leg", "var(--accent)")}
      <text x="${pad}" y="${H - 4}" font-size="10" fill="var(--muted)">${niceDate(log[0].date)}</text>
      <text x="${W - pad}" y="${H - 4}" font-size="10" fill="var(--muted)" text-anchor="end">${niceDate(log[n - 1].date)}</text></svg>`;
  }

  function renderRules() {
    view.innerHTML = `
      <h2>Stop and get help</h2>
      <div class="banner red"><b>Go to the ER now</b> if you get numbness in your groin, inner thighs, or between your legs, or new trouble controlling your bladder or bowels.</div>
      <div class="banner yellow"><b>Call your doctor the same day</b> if your right foot gets weaker (it slaps when you walk, or you can't walk on your heels), numbness keeps spreading, or the pain is severe and nothing eases it.</div>

      <h2>Pain during exercise</h2>
      <div class="card">
        <div class="light"><span class="dot" style="background:var(--green)"></span><div><b>0–2 out of 10:</b> fine, keep going.</div></div>
        <div class="light"><span class="dot" style="background:var(--yellow)"></span><div><b>3–4:</b> OK only if it settles within an hour and isn't worse the next morning.</div></div>
        <div class="light"><span class="dot" style="background:var(--red)"></span><div><b>5 or more, or pain spreading down the leg:</b> stop that exercise. Go back to the easier version.</div></div>
        <p class="muted" style="margin-top:6px">Matt's version: "tease" the pain. Go up to the edge of it, then back off. Never push through.</p>
      </div>

      <h2>The one sign to watch</h2>
      <div class="card">
        <p>Where your right-leg pain reaches matters more than how much it hurts.</p>
        <p><b>Moving up</b> toward your back (foot → calf → knee → buttock) means the disc is settling, even if your back aches more for a while.</p>
        <p style="margin:0"><b>Spreading down</b> the leg means something is aggravating it. Back off. Matt's sciatica went from his foot to above his knee by week 5.</p>
      </div>

      <h2>For an L4–L5 disc on the right</h2>
      <div class="card"><ul class="plain">
        <li>Bending forward and rounding your back, especially while lifting, is the movement most likely to irritate it. Use a hip hinge to pick things up.</li>
        <li>Sitting is harder on this disc than standing or walking. Get up every 20–30 minutes.</li>
        <li>Avoid sit-ups, toe touches, and twisting while lifting until Stage 3.</li>
        <li>Sleep on your side with a pillow between your knees, or on your back with a pillow under your knees.</li>
        <li>Walk every day. Short and often is better than one long walk.</li>
        <li>Lying face down and propping on your elbows helps many people with this injury. Keep it only if the leg pain stays the same or moves up.</li>
      </ul></div>

      <h2>Matt's rules</h2>
      <div class="card"><ul class="plain">
        <li>Start early. Resting for months made his first recovery take 6 months. Moving early got him to the same place in 6 weeks.</li>
        <li>Stretching alone won't fix it. Strength, mobility, and walking together.</li>
        <li>When you start feeling better is the danger zone. Don't add too much at once.</li>
        <li>Everyone heals at a different speed. Don't compare.</li>
      </ul></div>

      <h2>About this plan</h2>
      <p class="muted">Built from Matt Carmona's (@bigmona_fit) videos documenting his rehab of three herniated discs, adapted for a right-side L4–L5 herniation. It is not medical advice. Show it to your doctor or a physical therapist, and follow them where they differ.</p>
      <p class="muted">Exercise photos: Free Exercise DB (public domain). Videos belong to their YouTube creators.</p>`;
  }

  // ---------- render + events ----------
  function render() {
    document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
    document.getElementById("flareBtn").classList.toggle("on", !!isFlare());
    document.getElementById("headerSub").textContent = `Stage ${stage().id}: ${stage().name} · day ${daysBetween(state.stageStart, todayKey()) + 1}`;
    ({ today: renderToday, plan: renderPlan, log: renderLog, rules: renderRules, checkin: renderCheckin, quiz: renderQuiz }[tab])();
  }

  document.querySelector(".tabs").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    tab = b.dataset.tab; viewOffset = 0; render(); window.scrollTo(0, 0);
  });

  document.getElementById("flareBtn").addEventListener("click", () => {
    if (isFlare()) { state.flareUntil = null; }
    else {
      const d = new Date(); d.setDate(d.getDate() + 3);
      state.flareUntil = todayKey(d);
    }
    save(); tab = "today"; render(); window.scrollTo(0, 0);
  });

  view.addEventListener("change", (e) => {
    const cb = e.target.closest("input[type=checkbox][data-key]"); if (!cb) return;
    const k = todayKey();
    const list = new Set(state.done[k] || []);
    cb.checked ? list.add(cb.dataset.key) : list.delete(cb.dataset.key);
    state.done[k] = [...list];
    save(); render();
  });

  view.addEventListener("click", (e) => {
    const play = e.target.closest(".media[data-play]");
    if (play) { togglePlayer(play); return; }
    const close = e.target.closest(".close-player");
    if (close) { togglePlayer(close.closest(".card").querySelector(".media")); return; }
    const wd = e.target.closest(".wd[data-off]");
    if (wd) { viewOffset = Number(wd.dataset.off); render(); return; }
    const b = e.target.closest("[data-act]"); if (!b) return;
    const act = b.dataset.act;
    if (act === "backToday") { viewOffset = 0; render(); }
    if (act === "quiz") { quizAnswers = []; tab = "quiz"; render(); window.scrollTo(0, 0); }
    if (act === "quizAnswer") { quizAnswers.push(Number(b.dataset.n)); render(); window.scrollTo(0, 0); }
    if (act === "quizStart") {
      state.stage = Number(b.dataset.stage); state.stageStart = todayKey(); state.flareUntil = null; state.quizDone = true;
      save(); tab = "today"; viewOffset = 0; render(); window.scrollTo(0, 0);
    }
    if (act === "checkin") { tab = "checkin"; render(); window.scrollTo(0, 0); }
    if (act === "cancel") { tab = "today"; render(); }
    if (act === "saveCheckin") saveCheckin();
    if (act === "setStage") {
      state.stage = Number(b.dataset.stage); state.stageStart = todayKey(); state.flareUntil = null; state.quizDone = true;
      save(); tab = "today"; viewOffset = 0; render(); window.scrollTo(0, 0);
    }
    if (act === "export") {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = `back-plan-backup-${todayKey()}.json`;
      document.body.appendChild(a); a.click(); a.remove();
    }
    if (act === "import") view.querySelector("#importFile").click();
  });

  view.addEventListener("change", (e) => {
    if (e.target.id !== "importFile" || !e.target.files[0]) return;
    e.target.files[0].text().then((txt) => {
      try {
        const s = JSON.parse(txt);
        if (!Array.isArray(s.log)) throw new Error("bad");
        state = Object.assign(blank(), s); save(); render();
      } catch (err) { alertInline("That file isn't a Back Plan backup."); }
    });
  });

  const fromHash = location.hash.slice(1);
  if (["today", "plan", "log", "rules", "checkin"].includes(fromHash)) tab = fromHash;
  render();

  if ("serviceWorker" in navigator) {
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      // A newer version just took over: reload once so the new files show.
      if (hadController && !reloaded) { reloaded = true; location.reload(); }
    });
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then((r) => r.update()).catch(() => {}));
  }
})();
