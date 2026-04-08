import { useState, useRef, useEffect, useCallback } from "react";
// ─── SUPABASE ─────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://ymkuczyhmwgcbhrjmare.supabase.co";
const SUPABASE_KEY = "sb_publishable_A42anDirZklZS6_a9jSTdw_KjR2MZOw";

async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": options.prefer || "return=minimal",
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  if (res.status === 204 || res.headers.get("content-length") === "0") return null;
  return res.json();
}

// Users
async function sbGetUser(id) {
  const data = await sbFetch(`users?id=eq.${encodeURIComponent(id)}&select=*`);
  return data?.[0] || null;
}
async function sbCreateUser(user) {
  return sbFetch("users", { method: "POST", body: JSON.stringify(user), prefer: "return=representation" });
}
async function sbUpdateUser(user) {
  return sbFetch(`users?id=eq.${encodeURIComponent(user.id)}`, { method: "PATCH", body: JSON.stringify({ name: user.name, office: user.office }) });
}
async function sbGetAllUsers() {
  return sbFetch("users?select=*") || [];
}

// Predictions
async function sbGetPreds(userId) {
  const rows = await sbFetch(`predictions?user_id=eq.${encodeURIComponent(userId)}&select=*`);
  const map = {};
  (rows || []).forEach(r => { map[r.match_id] = { hg: r.hg, ag: r.ag }; });
  return map;
}
async function sbSavePred(userId, matchId, hg, ag) {
  return sbFetch("predictions", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, match_id: matchId, hg, ag }),
    headers: { "Prefer": "resolution=merge-duplicates,return=minimal" },
  });
}
async function sbSaveAllPreds(userId, preds) {
  const rows = Object.entries(preds).map(([match_id, p]) => ({ user_id: userId, match_id, hg: p.hg, ag: p.ag }));
  if (!rows.length) return;
  return sbFetch("predictions", {
    method: "POST",
    body: JSON.stringify(rows),
    headers: { "Prefer": "resolution=merge-duplicates,return=minimal" },
  });
}
async function sbGetAllPreds() {
  const rows = await sbFetch("predictions?select=*") || [];
  const byUser = {};
  rows.forEach(r => {
    if (!byUser[r.user_id]) byUser[r.user_id] = {};
    byUser[r.user_id][r.match_id] = { hg: r.hg, ag: r.ag };
  });
  return byUser;
}

// Results (group stage)
async function sbGetResults() {
  const rows = await sbFetch("results?select=*") || [];
  const map = {};
  rows.forEach(r => { map[r.match_id] = { hg: r.hg, ag: r.ag }; });
  return map;
}
async function sbSaveResult(matchId, hg, ag) {
  return sbFetch("results", {
    method: "POST",
    body: JSON.stringify({ match_id: matchId, hg, ag }),
    headers: { "Prefer": "resolution=merge-duplicates,return=minimal" },
  });
}
async function sbDeleteResult(matchId) {
  return sbFetch(`results?match_id=eq.${encodeURIComponent(matchId)}`, { method: "DELETE" });
}

// Keep localStorage for KO data (ko matches, ko results, ko preds) for now
// These are less critical and can be migrated later


// ─── DATA ─────────────────────────────────────────────────────────────────────

const OFFICES = [
  "Addis Ababa",
  "Almaty",
  "Astana",
  "Athens",
  "Baku",
  "Bangkok",
  "Beijing",
  "Belo Horizonte",
  "Bengaluru",
  "Bogotá",
  "Bucharest",
  "Budapest",
  "Buenos Aires",
  "Casablanca",
  "Chengdu",
  "Chennai",
  "Colombo",
  "Dublin",
  "Guatemala City",
  "Gurugram/Delhi",
  "Hanoi",
  "Herzliya",
  "Ho Chi Minh",
  "Hong Kong",
  "Istanbul",
  "Jakarta",
  "Johannesburg",
  "Karachi",
  "Kolkata",
  "Kuala Lumpur",
  "Kyiv",
  "Lagos",
  "Lima",
  "Luanda",
  "Manila",
  "Medellín",
  "Mexico City",
  "Monterrey",
  "Montevideo",
  "Mumbai",
  "Nairobi",
  "New Cairo",
  "Panama City",
  "Poznan",
  "Prague",
  "Quito",
  "Rio de Janeiro",
  "Salvador",
  "San José",
  "Santiago",
  "Santo Domingo",
  "Shanghai",
  "Shenzhen",
  "São Paulo",
  "Taipei",
  "Tel Aviv",
  "Warsaw",
  "Wroclaw",
  "Zagreb",
];

const GROUPS = {
  A: ["México", "Corea del Sur", "Sudáfrica", "República Checa"],
  B: ["Canadá", "Bosnia y Herzegovina", "Qatar", "Suiza"],
  C: ["Brasil", "Marruecos", "Haití", "Escocia"],
  D: ["Estados Unidos", "Paraguay", "Australia", "Turquía"],
  E: ["Alemania", "Curazao", "Costa de Marfil", "Ecuador"],
  F: ["Países Bajos", "Japón", "Suecia", "Túnez"],
  G: ["Bélgica", "Egipto", "Irán", "Nueva Zelanda"],
  H: ["España", "Cabo Verde", "Arabia Saudita", "Uruguay"],
  I: ["Francia", "Senegal", "Irak", "Noruega"],
  J: ["Argentina", "Argelia", "Austria", "Jordania"],
  K: ["Portugal", "Congo RD", "Uzbekistán", "Colombia"],
  L: ["Inglaterra", "Croacia", "Ghana", "Panamá"],
};

const FLAGS = {
  "México":"🇲🇽","Corea del Sur":"🇰🇷","Sudáfrica":"🇿🇦","República Checa":"🇨🇿",
  "Canadá":"🇨🇦","Bosnia y Herzegovina":"🇧🇦","Qatar":"🇶🇦","Suiza":"🇨🇭",
  "Brasil":"🇧🇷","Marruecos":"🇲🇦","Haití":"🇭🇹","Escocia":"🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  "Estados Unidos":"🇺🇸","Paraguay":"🇵🇾","Australia":"🇦🇺","Turquía":"🇹🇷",
  "Alemania":"🇩🇪","Curazao":"🇨🇼","Costa de Marfil":"🇨🇮","Ecuador":"🇪🇨",
  "Países Bajos":"🇳🇱","Japón":"🇯🇵","Suecia":"🇸🇪","Túnez":"🇹🇳",
  "Bélgica":"🇧🇪","Egipto":"🇪🇬","Irán":"🇮🇷","Nueva Zelanda":"🇳🇿",
  "España":"🇪🇸","Cabo Verde":"🇨🇻","Arabia Saudita":"🇸🇦","Uruguay":"🇺🇾",
  "Francia":"🇫🇷","Senegal":"🇸🇳","Irak":"🇮🇶","Noruega":"🇳🇴",
  "Argentina":"🇦🇷","Argelia":"🇩🇿","Austria":"🇦🇹","Jordania":"🇯🇴",
  "Portugal":"🇵🇹","Congo RD":"🇨🇩","Uzbekistán":"🇺🇿","Colombia":"🇨🇴",
  "Inglaterra":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","Croacia":"🇭🇷","Ghana":"🇬🇭","Panamá":"🇵🇦",
};

function generateGroupMatches() {
  const matches = {};
  Object.entries(GROUPS).forEach(([grp, teams]) => {
    matches[grp] = [];
    let n = 1;
    for (let i = 0; i < teams.length; i++)
      for (let j = i + 1; j < teams.length; j++)
        matches[grp].push({ id: `${grp}${n++}`, home: teams[i], away: teams[j] });
  });
  return matches;
}
const GROUP_MATCHES = generateGroupMatches();

// Results — se cargan desde localStorage por el admin
const MOCK_RESULTS = {};
function getResults() {
  try { return JSON.parse(localStorage.getItem("prode2026_results") || "{}"); } catch { return {}; }
}

const MOCK_USERS = [];
const MOCK_PREDS = {};
const ADMIN_PASSWORD = "Riquelme10!!";

// ─── KNOCKOUT PHASE CONFIG ────────────────────────────────────────────────────
// Bracket structure: each round knows how many slots it has
const BRACKET_ROUNDS = [
  { id: "r32", label: "Round of 32", slots: 16 },
  { id: "r16", label: "Round of 16",     slots: 8  },
  { id: "qf",  label: "Quarter-finals",     slots: 4  },
  { id: "sf",  label: "Semi-finals", slots: 2  },
  { id: "f",   label: "Final",       slots: 1  },
  { id: "tp",  label: "3rd place",  slots: 1  },
];

// Bracket unlocks when admin loads the r32 cruces (after June 27)
// Individual results unlock each round for scoring
const BRACKET_UNLOCK_DATE = "2026-06-27"; // after last group stage match
const BRACKET_DEADLINE    = "2026-06-28"; // before first r32 match

const LS_KO_MATCHES  = "prode2026_ko_matches";   // admin carga los cruces
const LS_KO_RESULTS  = "prode2026_ko_results";   // admin carga results
const LS_KO_PREDS    = "prode2026_ko_preds";     // predictions por usuario

function isBracketOpen() { return new Date() >= new Date(BRACKET_UNLOCK_DATE); }
function isBracketDeadlinePassed() { return new Date() >= new Date(BRACKET_DEADLINE); }
function loadKOMatches()  { try { return JSON.parse(localStorage.getItem(LS_KO_MATCHES) || "{}"); } catch { return {}; } }
function saveKOMatches(d) { try { localStorage.setItem(LS_KO_MATCHES, JSON.stringify(d)); } catch {} }
function loadKOResults()  { try { return JSON.parse(localStorage.getItem(LS_KO_RESULTS) || "{}"); } catch { return {}; } }
function saveKOResults(d) { try { localStorage.setItem(LS_KO_RESULTS, JSON.stringify(d)); } catch {} }
function loadKOPreds(uid) { try { return JSON.parse(localStorage.getItem(`${LS_KO_PREDS}_${uid}`) || "{}"); } catch { return {}; } }
function saveKOPreds(uid, d) { try { localStorage.setItem(`${LS_KO_PREDS}_${uid}`, JSON.stringify(d)); } catch {} }

function calcPoints(pred, result) {
  if (!pred || !result) return null;
  if (pred.hg === result.hg && pred.ag === result.ag) return 5;
  const po = pred.hg > pred.ag ? "H" : pred.hg < pred.ag ? "A" : "X";
  const ro = result.hg > result.ag ? "H" : result.hg < result.ag ? "A" : "X";
  return po === ro ? 3 : 0;
}

function userTotalPts(preds) {
  const results = loadResults();
  return Object.keys(results).reduce((s, mid) => {
    const p = preds[mid], r = results[mid];
    return s + (calcPoints(p, r) || 0);
  }, 0);
}


// ─── GROUP STANDINGS & R32 BRACKET ───────────────────────────────────────────

function calcGroupStandings(groupKey, results) {
  const teams = GROUPS[groupKey];
  const matches = GROUP_MATCHES[groupKey];
  const standings = {};
  teams.forEach(t => { standings[t] = { team: t, pts: 0, gf: 0, ga: 0, gd: 0, played: 0 }; });

  matches.forEach(m => {
    const r = results[m.id];
    if (!r) return;
    const h = standings[m.home], a = standings[m.away];
    h.gf += r.hg; h.ga += r.ag; h.gd += r.hg - r.ag; h.played++;
    a.gf += r.ag; a.ga += r.hg; a.gd += r.ag - r.hg; a.played++;
    if (r.hg > r.ag)      { h.pts += 3; }
    else if (r.hg < r.ag) { a.pts += 3; }
    else                   { h.pts += 1; a.pts += 1; }
  });

  return Object.values(standings).sort((a, b) =>
    b.pts - a.pts || b.gd - a.gd || b.gf - a.gf
  );
}

// FIFA R32 bracket structure (fixed matches 73-88)
// Returns array of 16 matches [{home, away}] in order 73..88
// Third-place slots use "3X" notation resolved after knowing which 8 thirds qualify
function generateR32Bracket(allResults) {
  const groups = "ABCDEFGHIJKL".split("");
  const standings = {};
  groups.forEach(g => { standings[g] = calcGroupStandings(g, allResults); });

  // Check if all groups are fully played (6 matches each = 72 total)
  const totalPlayed = groups.reduce((s, g) =>
    s + GROUP_MATCHES[g].filter(m => allResults[m.id]).length, 0);
  if (totalPlayed < 72) return null; // not ready yet

  // Get 1st and 2nd of each group
  const first  = {}; groups.forEach(g => first[g]  = standings[g][0]?.team);
  const second = {}; groups.forEach(g => second[g] = standings[g][1]?.team);
  const thirds = {}; groups.forEach(g => thirds[g] = standings[g][2]);

  // Rank the 8 best third-placed teams
  const allThirds = groups.map(g => ({ ...thirds[g], group: g }))
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
  const best8 = allThirds.slice(0, 8);
  const best8groups = best8.map(t => t.group).sort().join(""); // e.g. "CDEFGHIJ"

  // FIFA pre-defined combinations table (Annex C) - key fields for our bracket:
  // We need to resolve which third goes to which slot (1A,1B,1D,1E,1G,1I,1K,1L)
  // The table maps combo -> [3for1A, 3for1B, 3for1D, 3for1E, 3for1G, 3for1I, 3for1K, 3for1L]
  // This is a simplified lookup for the most common combos
  const thirdSlots = resolveThirdSlots(best8groups, best8, thirds);

  // Fixed match structure (matches 73-88):
  return [
    { id:"r32_0",  home: second[`A`],         away: second[`B`]         }, // 73
    { id:"r32_1",  home: first[`E`],           away: thirdSlots["1E"]    }, // 74
    { id:"r32_2",  home: first[`F`],           away: second[`C`]         }, // 75
    { id:"r32_3",  home: first[`C`],           away: second[`F`]         }, // 76
    { id:"r32_4",  home: first[`I`],           away: thirdSlots["1I"]    }, // 77
    { id:"r32_5",  home: second[`E`],          away: second[`I`]         }, // 78
    { id:"r32_6",  home: first[`A`],           away: thirdSlots["1A"]    }, // 79
    { id:"r32_7",  home: first[`L`],           away: thirdSlots["1L"]    }, // 80
    { id:"r32_8",  home: first[`D`],           away: thirdSlots["1D"]    }, // 81
    { id:"r32_9",  home: first[`G`],           away: thirdSlots["1G"]    }, // 82
    { id:"r32_10", home: second[`K`],          away: second[`L`]         }, // 83
    { id:"r32_11", home: first[`H`],           away: second[`J`]         }, // 84
    { id:"r32_12", home: first[`B`],           away: thirdSlots["1B"]    }, // 85
    { id:"r32_13", home: first[`J`],           away: second[`H`]         }, // 86
    { id:"r32_14", home: first[`K`],           away: thirdSlots["1K"]    }, // 87
    { id:"r32_15", home: second[`D`],          away: second[`G`]         }, // 88
  ];
}

// Resolve which third-placed team goes to each slot based on which 8 thirds qualified
// Based on FIFA Annex C combinations table
function resolveThirdSlots(combo, best8, thirds) {
  // combo is sorted string of 8 group letters, e.g. "CDEFGHIJ"
  // We map to slots: 1A, 1B, 1D, 1E, 1G, 1I, 1K, 1L
  // This lookup covers the main combinations; fallback uses alphabetical order

  const thirdOf = (g) => best8.find(t => t.group === g)?.team || `3°${g}`;

  // FIFA Annex C - key combinations (groups D,E,F,G,H,I,J,K,L vary)
  // Format: "COMBOKEY": [1A_src, 1B_src, 1D_src, 1E_src, 1G_src, 1I_src, 1K_src, 1L_src]
  const table = {
    "EFGHIJKL": ["3E","3J","3I","3F","3H","3G","3L","3K"],
    "DFGHIJKL": ["3H","3G","3I","3D","3J","3F","3L","3K"],
    "DEGHIJKL": ["3E","3J","3I","3D","3H","3G","3L","3K"],
    "DEFHIJKL": ["3E","3J","3I","3D","3H","3F","3L","3K"],
    "DEFGIJKL": ["3E","3G","3I","3D","3J","3F","3L","3K"],
    "DEFGHJKL": ["3E","3G","3J","3D","3H","3F","3L","3K"],
    "DEFGHIKL": ["3E","3G","3I","3D","3H","3F","3L","3K"],
    "DEFGHIJL": ["3E","3G","3J","3D","3H","3F","3L","3I"],
    "DEFGHIJK": ["3E","3G","3J","3D","3H","3F","3I","3K"],
    "CFGHIJKL": ["3H","3G","3I","3C","3J","3F","3L","3K"],
    "CEGHIJKL": ["3E","3J","3I","3C","3H","3G","3L","3K"],
    "CEFHIJKL": ["3E","3J","3I","3C","3H","3F","3L","3K"],
    "CEFGIJKL": ["3E","3G","3I","3C","3J","3F","3L","3K"],
    "CEFGHJKL": ["3E","3G","3J","3C","3H","3F","3L","3K"],
    "CEFGHIKL": ["3E","3G","3I","3C","3H","3F","3L","3K"],
    "CEFGHIJL": ["3E","3G","3J","3C","3H","3F","3L","3I"],
    "CEFGHIJK": ["3E","3G","3J","3C","3H","3F","3I","3K"],
    "CDGHIJKL": ["3H","3G","3I","3C","3J","3D","3L","3K"],
    "CDFHIJKL": ["3C","3J","3I","3D","3H","3F","3L","3K"],
    "CDFGIJKL": ["3C","3G","3I","3D","3J","3F","3L","3K"],
    "CDFGHJKL": ["3C","3G","3J","3D","3H","3F","3L","3K"],
    "CDFGHIKL": ["3C","3G","3I","3D","3H","3F","3L","3K"],
    "CDFGHIJL": ["3C","3G","3J","3D","3H","3F","3L","3I"],
    "CDFGHIJK": ["3C","3G","3J","3D","3H","3F","3I","3K"],
    "CDEHIJKL": ["3E","3J","3I","3C","3H","3D","3L","3K"],
    "CDEGHIJK": ["3E","3G","3I","3C","3J","3D","3L","3K"],
  };

  const slots_order = ["1A","1B","1D","1E","1G","1I","1K","1L"];
  const row = table[combo];

  if (!row) {
    // Fallback: assign best8 in order to slots
    const result = {};
    slots_order.forEach((slot, i) => {
      result[slot] = best8[i]?.team || `3°?`;
    });
    return result;
  }

  // Resolve "3X" references to actual team names
  const result = {};
  slots_order.forEach((slot, i) => {
    const ref = row[i]; // e.g. "3E"
    const grp = ref[1]; // "E"
    result[slot] = thirds[grp]?.team || ref;
  });
  return result;
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;900&family=Source+Sans+3:wght@300;400;600;700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --navy:    #051C2C;
  --blue:    #061F79;
  --blue-md: #0A2FA0;
  --blue-lt: #1A45C0;
  --white:   #FFFFFF;
  --off-white: #F4F6FA;
  --silver:  #C8D0DC;
  --steel:   #8A9BB0;
  --dim:     #4A5F75;
  --border:  rgba(255,255,255,0.10);
  --border2: rgba(255,255,255,0.18);
  --green:   #1FAD6A;
  --green-bg: rgba(31,173,106,0.12);
  --amber:   #E8A020;
  --amber-bg: rgba(232,160,32,0.12);
  --red:     #D94040;
  --red-bg:  rgba(217,64,64,0.10);
  --card:    rgba(6,31,121,0.22);
  --card2:   rgba(255,255,255,0.04);
}

body {
  background: var(--navy);
  color: var(--white);
  font-family: 'Source Sans 3', sans-serif;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}
button { cursor: pointer; font-family: inherit; }
input, select { font-family: inherit; }

.app {
  max-width: 520px;
  margin: 0 auto;
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
}

/* Subtle grid overlay */
.app::before {
  content: '';
  position: fixed; inset: 0; pointer-events: none; z-index: 0;
  background:
    radial-gradient(ellipse 100% 50% at 50% 0%, rgba(6,31,121,0.6) 0%, transparent 70%),
    linear-gradient(180deg, rgba(6,31,121,0.15) 0%, transparent 60%);
}

/* ── UTILITIES ── */
.z1 { position: relative; z-index: 1; }
.serif { font-family: 'Playfair Display', Georgia, serif; }

/* ── LOGIN ── */
.login-wrap {
  min-height: 100vh;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 32px 24px; position: relative; z-index: 1;
}

.login-brand {
  text-align: center; margin-bottom: 40px;
}
.login-wordmark {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 15px; font-weight: 400; letter-spacing: 1px;
  color: var(--silver); margin-bottom: 20px;
  border-bottom: 1px solid var(--border2); padding-bottom: 16px;
}
.login-trophy { font-size: 52px; display: block; margin-bottom: 12px; }
.login-title {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 38px; font-weight: 900; line-height: 1.1;
  color: var(--white);
}
.login-subtitle {
  font-size: 13px; font-weight: 600; letter-spacing: 4px;
  text-transform: uppercase; color: var(--steel); margin-top: 6px;
}

.login-card {
  width: 100%;
  background: rgba(6, 31, 121, 0.30);
  border: 1px solid var(--border2);
  border-radius: 4px;
  padding: 32px 28px;
  backdrop-filter: blur(12px);
}
.login-card-title {
  font-family: 'Playfair Display', serif;
  font-size: 20px; font-weight: 700;
  margin-bottom: 24px; color: var(--white);
}

.field { margin-bottom: 18px; }
.field label {
  display: block; font-size: 11px; font-weight: 700;
  letter-spacing: 2px; text-transform: uppercase;
  color: var(--steel); margin-bottom: 7px;
}
.field input, .field select {
  width: 100%;
  background: rgba(255,255,255,0.06);
  border: 1px solid var(--border2);
  border-radius: 2px;
  padding: 12px 14px;
  color: var(--white);
  font-size: 15px; font-weight: 400;
  outline: none;
  transition: border-color 0.2s, background 0.2s;
}
.field input::placeholder { color: var(--dim); }
.field input:focus, .field select:focus {
  border-color: rgba(255,255,255,0.45);
  background: rgba(255,255,255,0.09);
}
.field select option { background: #051C2C; }

.login-btn {
  width: 100%; margin-top: 4px;
  padding: 14px;
  background: var(--blue);
  border: 1px solid var(--blue-lt);
  border-radius: 2px;
  font-family: 'Source Sans 3', sans-serif;
  font-size: 14px; font-weight: 700; letter-spacing: 3px;
  text-transform: uppercase; color: var(--white);
  transition: background 0.2s, transform 0.1s;
}
.login-btn:hover { background: var(--blue-md); }
.login-btn:active { transform: scale(0.99); }
.login-btn:disabled { opacity: 0.35; pointer-events: none; }

.login-toggle {
  text-align: center; margin-top: 16px;
  font-size: 13px; color: var(--steel);
}
.login-toggle span {
  color: var(--silver); cursor: pointer;
  border-bottom: 1px solid rgba(200,208,220,0.4);
}

.error-msg {
  background: var(--red-bg);
  border: 1px solid rgba(217,64,64,0.3);
  border-radius: 2px; padding: 10px 14px;
  font-size: 13px; color: #FF8080;
  margin-bottom: 16px;
}

/* ── HEADER ── */
.header {
  background: rgba(5,28,44,0.95);
  border-bottom: 1px solid var(--border2);
  padding: 0 20px;
  position: sticky; top: 0; z-index: 100;
  backdrop-filter: blur(16px);
}
.header-inner {
  display: flex; align-items: center;
  justify-content: space-between;
  height: 56px;
}
.header-brand {
  display: flex; align-items: center; gap: 12px;
}
.header-logo-text {
  font-family: 'Playfair Display', serif;
  font-size: 13px; font-weight: 400; color: var(--silver);
  letter-spacing: 0.5px; line-height: 1.3;
  border-right: 1px solid var(--border2);
  padding-right: 12px;
}
.header-event {
  font-size: 12px; font-weight: 700; letter-spacing: 2px;
  text-transform: uppercase; color: var(--white);
}
.header-user {
  display: flex; align-items: center; gap: 10px;
}
.avatar {
  width: 32px; height: 32px; border-radius: 50%;
  background: var(--blue);
  border: 1.5px solid rgba(255,255,255,0.25);
  display: flex; align-items: center; justify-content: center;
  font-family: 'Playfair Display', serif;
  font-size: 13px; font-weight: 700; color: var(--white);
}
.user-name-sm { font-size: 13px; font-weight: 600; }
.user-office-sm { font-size: 10px; color: var(--steel); letter-spacing: 0.5px; }
.logout-btn {
  background: none;
  border: 1px solid var(--border);
  border-radius: 2px; padding: 4px 10px;
  font-size: 11px; letter-spacing: 1px; text-transform: uppercase;
  color: var(--steel); transition: all 0.2s;
}
.logout-btn:hover { border-color: var(--red); color: var(--red); }

/* ── HOME ── */
.home {
  padding: 28px 20px 40px;
  position: relative; z-index: 1;
  overflow-y: auto; max-height: calc(100vh - 56px);
}
.home-greeting {
  font-size: 12px; font-weight: 700; letter-spacing: 3px;
  text-transform: uppercase; color: var(--steel); margin-bottom: 4px;
}
.home-name {
  font-family: 'Playfair Display', serif;
  font-size: 32px; font-weight: 700; line-height: 1.1;
  margin-bottom: 28px;
}

/* Deadline strip */
.deadline-strip {
  display: flex; align-items: center; gap: 14px;
  background: rgba(6,31,121,0.35);
  border: 1px solid var(--border2);
  border-left: 3px solid var(--blue-lt);
  border-radius: 2px; padding: 14px 16px;
  margin-bottom: 24px;
}
.deadline-icon { font-size: 24px; }
.deadline-title { font-size: 13px; font-weight: 700; color: var(--white); }
.deadline-sub { font-size: 11px; color: var(--steel); margin-top: 2px; letter-spacing: 0.3px; }

/* Progress */
.progress-wrap { margin-bottom: 28px; }
.progress-meta {
  display: flex; justify-content: space-between;
  font-size: 11px; font-weight: 700; letter-spacing: 2px;
  text-transform: uppercase; color: var(--steel); margin-bottom: 8px;
}
.progress-track {
  height: 3px; background: rgba(255,255,255,0.08); border-radius: 2px;
}
.progress-fill {
  height: 100%; border-radius: 2px;
  background: linear-gradient(90deg, var(--blue-lt), #4A80FF);
  transition: width 0.6s ease;
}

/* Home cards */
.home-cards { display: flex; flex-direction: column; gap: 10px; }
.home-card {
  display: flex; align-items: center; gap: 16px;
  background: var(--card2);
  border: 1px solid var(--border);
  border-radius: 2px; padding: 18px 20px;
  cursor: pointer; transition: all 0.2s; position: relative;
}
.home-card:hover {
  background: rgba(6,31,121,0.35);
  border-color: rgba(255,255,255,0.25);
  transform: translateX(2px);
}
.home-card.disabled { opacity: 0.4; pointer-events: none; }
.home-card-icon {
  width: 44px; height: 44px; border-radius: 2px;
  background: var(--blue); border: 1px solid var(--blue-lt);
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; flex-shrink: 0;
}
.home-card-text { flex: 1; }
.home-card-title {
  font-family: 'Playfair Display', serif;
  font-size: 18px; font-weight: 700;
}
.home-card-sub { font-size: 12px; color: var(--steel); margin-top: 3px; }
.home-card-arrow { color: var(--steel); font-size: 18px; }
.home-card-badge {
  position: absolute; top: 12px; right: 12px;
  font-size: 10px; font-weight: 700; letter-spacing: 1px;
  text-transform: uppercase; padding: 2px 8px; border-radius: 20px;
}
.badge-warn { background: rgba(232,160,32,0.15); color: var(--amber); border: 1px solid rgba(232,160,32,0.3); }
.badge-ok   { background: var(--green-bg); color: var(--green); border: 1px solid rgba(31,173,106,0.3); }
.badge-pts  { background: rgba(6,31,121,0.5); color: var(--silver); border: 1px solid var(--border2); }

/* ── SECTION SHELL ── */
.section { display: flex; flex-direction: column; height: calc(100vh - 56px); position: relative; z-index:1; }
.section-topbar {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 20px;
  background: rgba(5,28,44,0.9);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  backdrop-filter: blur(12px);
}
.back-btn {
  background: none; border: none; color: var(--steel);
  font-size: 22px; line-height: 1; padding: 0;
  transition: color 0.2s;
}
.back-btn:hover { color: var(--white); }
.section-title {
  font-family: 'Playfair Display', serif;
  font-size: 20px; font-weight: 700; flex: 1;
}
.section-scroll { flex: 1; overflow-y: auto; padding: 20px; }

/* ── GROUP PRODE ── */
.group-nav-bar {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px;
}
.group-nav-btn {
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--border2); border-radius: 2px;
  padding: 8px 16px; font-size: 12px; font-weight: 700;
  letter-spacing: 1.5px; text-transform: uppercase; color: var(--silver);
  transition: all 0.2s;
}
.group-nav-btn:hover:not(:disabled) {
  background: rgba(6,31,121,0.5);
  border-color: rgba(255,255,255,0.35);
  color: var(--white);
}
.group-nav-btn:disabled { opacity: 0.25; }
.group-title-block { text-align: center; }
.group-label {
  font-size: 11px; font-weight: 700; letter-spacing: 3px;
  text-transform: uppercase; color: var(--steel);
}
.group-name {
  font-family: 'Playfair Display', serif;
  font-size: 28px; font-weight: 900;
}
.group-teams-sm { font-size: 11px; color: var(--steel); margin-top: 2px; }

/* Group dots */
.group-dots {
  display: flex; gap: 5px; justify-content: center;
  flex-wrap: wrap; margin-bottom: 20px;
}
.g-dot {
  width: 30px; height: 30px; border-radius: 2px;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 800; letter-spacing: 0;
  cursor: pointer; transition: all 0.15s;
  border: 1px solid var(--border);
  color: var(--dim);
  font-family: 'Source Sans 3', sans-serif;
}
.g-dot:hover { border-color: var(--border2); color: var(--steel); }
.g-dot.done  { background: var(--green-bg); border-color: rgba(31,173,106,0.4); color: var(--green); }
.g-dot.partial { background: var(--amber-bg); border-color: rgba(232,160,32,0.3); color: var(--amber); }
.g-dot.current { background: var(--blue); border-color: var(--blue-lt); color: var(--white); }

/* Match prediction card */
.match-card {
  background: var(--card2);
  border: 1px solid var(--border);
  border-radius: 2px; margin-bottom: 10px;
  overflow: hidden; transition: border-color 0.2s;
}
.match-card.filled { border-color: rgba(31,173,106,0.25); }
.match-card-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 6px 14px;
  background: rgba(255,255,255,0.03);
  border-bottom: 1px solid var(--border);
  font-size: 10px; font-weight: 700; letter-spacing: 2px;
  text-transform: uppercase; color: var(--dim);
}
.match-card-header .filled-tag {
  color: var(--green); font-size: 10px;
}

.match-body {
  padding: 14px 16px;
  display: flex; align-items: center; gap: 10px;
}
.team-block { flex: 1; display: flex; align-items: center; gap: 8px; }
.team-block.away { justify-content: flex-end; flex-direction: row-reverse; }
.team-flag-sm { font-size: 22px; flex-shrink: 0; }
.team-name-sm {
  font-family: 'Playfair Display', serif;
  font-size: 14px; font-weight: 600; line-height: 1.2;
}

/* Score input — the star of the show */
.score-widget {
  display: flex; align-items: center; gap: 6px; flex-shrink: 0;
}
.score-col { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.score-step-btn {
  width: 22px; height: 18px; border-radius: 2px;
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--border);
  color: var(--steel); font-size: 12px; line-height: 1;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.score-step-btn:hover { background: var(--blue); border-color: var(--blue-lt); color: var(--white); }
.score-input {
  width: 44px; height: 44px;
  background: rgba(6,31,121,0.3);
  border: 1.5px solid var(--border2);
  border-radius: 2px; text-align: center;
  font-family: 'Playfair Display', serif;
  font-size: 26px; font-weight: 700; color: var(--white);
  outline: none; transition: border-color 0.2s, background 0.2s;
  -moz-appearance: textfield;
}
.score-input::-webkit-outer-spin-button,
.score-input::-webkit-inner-spin-button { -webkit-appearance: none; }
.score-input:focus {
  border-color: rgba(255,255,255,0.5);
  background: rgba(6,31,121,0.5);
}
.score-input.set {
  border-color: rgba(31,173,106,0.5);
  background: rgba(31,173,106,0.07);
}
.score-sep {
  font-family: 'Playfair Display', serif;
  font-size: 20px; color: var(--dim); padding: 0 2px;
  align-self: center; margin-top: 22px;
}

/* Outcome pill */
.outcome-pill {
  text-align: center; padding: 6px 0 2px;
  font-size: 11px; font-weight: 600; letter-spacing: 1px;
  text-transform: uppercase;
}
.outcome-pill.home { color: #6AADFF; }
.outcome-pill.away { color: #FF9A6A; }
.outcome-pill.draw { color: var(--steel); }
.outcome-pill.empty { color: var(--dim); }

/* Save button */
.save-btn {
  width: 100%; margin-top: 12px; padding: 14px;
  background: var(--blue); border: 1px solid var(--blue-lt);
  border-radius: 2px;
  font-size: 13px; font-weight: 700; letter-spacing: 3px;
  text-transform: uppercase; color: var(--white);
  transition: all 0.2s;
}
.save-btn:hover { background: var(--blue-md); }
.save-btn.saved { background: rgba(31,173,106,0.2); border-color: rgba(31,173,106,0.4); color: var(--green); }
.save-btn-next {
  width: 100%; margin-top: 8px; padding: 12px;
  background: transparent;
  border: 1px solid var(--border2); border-radius: 2px;
  font-size: 12px; font-weight: 700; letter-spacing: 2px;
  text-transform: uppercase; color: var(--silver);
  transition: all 0.2s;
}
.save-btn-next:hover { border-color: rgba(255,255,255,0.3); color: var(--white); }

/* ── TABS ── */
.tabs-row {
  display: flex;
  border-bottom: 1px solid var(--border);
  background: rgba(5,28,44,0.8);
  flex-shrink: 0;
}
.tab-btn {
  flex: 1; padding: 13px 0;
  background: none; border: none;
  font-size: 11px; font-weight: 700; letter-spacing: 2px;
  text-transform: uppercase; color: var(--dim);
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}
.tab-btn.active { color: var(--white); border-bottom-color: var(--white); }

/* ── RESULTS ── */
.results-group {
  margin-bottom: 28px;
}
.results-group-label {
  font-size: 10px; font-weight: 700; letter-spacing: 3px;
  text-transform: uppercase; color: var(--steel);
  margin-bottom: 10px; display: flex; align-items: center; gap: 10px;
}
.results-group-label::after {
  content: ''; flex: 1; height: 1px; background: var(--border);
}
.result-row {
  display: flex; align-items: center;
  padding: 11px 14px;
  background: var(--card2); border: 1px solid var(--border);
  border-radius: 2px; margin-bottom: 6px;
  gap: 10px;
}
.result-teams { flex: 1; font-size: 13px; }
.result-teams .tn { font-weight: 600; }
.result-teams .vs { color: var(--dim); margin: 0 5px; font-size: 11px; }
.my-pred-sm { font-size: 10px; color: var(--steel); margin-top: 2px; }
.result-score {
  font-family: 'Playfair Display', serif;
  font-size: 20px; font-weight: 700; color: var(--white);
  background: rgba(6,31,121,0.4); border: 1px solid var(--border2);
  padding: 2px 12px; border-radius: 2px;
}
.pts-chip {
  font-size: 13px; font-weight: 700;
  padding: 2px 10px; border-radius: 20px;
  min-width: 36px; text-align: center;
}
.pts-5 { background: var(--green-bg); color: var(--green); border: 1px solid rgba(31,173,106,0.3); }
.pts-3 { background: var(--amber-bg); color: var(--amber); border: 1px solid rgba(232,160,32,0.3); }
.pts-0 { background: var(--red-bg); color: var(--red); border: 1px solid rgba(217,64,64,0.25); }
.pts-null { background: rgba(255,255,255,0.04); color: var(--dim); border: 1px solid var(--border); }

.no-results {
  text-align: center; padding: 48px 0;
  color: var(--steel);
}
.no-results-icon { font-size: 40px; margin-bottom: 12px; }
.no-results-title {
  font-family: 'Playfair Display', serif;
  font-size: 18px; font-weight: 700; margin-bottom: 6px;
}
.no-results-sub { font-size: 13px; }

/* ── LEADERBOARD ── */
.lb-controls {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 14px;
}
.lb-heading {
  font-family: 'Playfair Display', serif;
  font-size: 16px; font-weight: 700;
}
.lb-filter {
  font-size: 11px; font-weight: 700; letter-spacing: 1.5px;
  text-transform: uppercase; padding: 5px 12px;
  background: transparent; border: 1px solid var(--border2);
  border-radius: 2px; color: var(--steel);
  transition: all 0.2s;
}
.lb-filter.on { border-color: rgba(255,255,255,0.4); color: var(--white); background: rgba(6,31,121,0.4); }

.lb-row {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 14px;
  background: var(--card2); border: 1px solid var(--border);
  border-radius: 2px; margin-bottom: 8px;
  position: relative; overflow: hidden; transition: all 0.2s;
}
.lb-row::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 2px; }
.lb-row.r1::before { background: #D4AF37; }
.lb-row.r2::before { background: #A8A8A8; }
.lb-row.r3::before { background: #A07040; }
.lb-row.me { border-color: rgba(255,255,255,0.2); background: rgba(6,31,121,0.25); }
.lb-rank {
  font-family: 'Playfair Display', serif;
  font-size: 20px; font-weight: 700; color: var(--dim);
  width: 28px; text-align: center; flex-shrink: 0;
}
.lb-rank.gold { color: #D4AF37; }
.lb-av {
  width: 36px; height: 36px; border-radius: 50%;
  background: var(--blue); border: 1px solid rgba(255,255,255,0.15);
  display: flex; align-items: center; justify-content: center;
  font-family: 'Playfair Display', serif;
  font-size: 14px; font-weight: 700; flex-shrink: 0;
}
.lb-info { flex: 1; }
.lb-name { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
.me-tag {
  font-size: 9px; font-weight: 700; letter-spacing: 1px;
  background: rgba(6,31,121,0.6); color: var(--silver);
  border: 1px solid var(--border2); padding: 1px 6px; border-radius: 20px;
}
.lb-sub { font-size: 11px; color: var(--steel); margin-top: 2px; }
.lb-pts-num {
  font-family: 'Playfair Display', serif;
  font-size: 28px; font-weight: 900; color: var(--white); line-height: 1;
}
.lb-pts-lbl {
  font-size: 9px; font-weight: 700; letter-spacing: 1.5px;
  text-transform: uppercase; color: var(--steel); text-align: right;
}

/* ── HISTORY ── */
.history-card {
  background: var(--card2); border: 1px solid var(--border);
  border-radius: 2px; padding: 20px;
}
.history-total {
  display: flex; align-items: baseline; gap: 8px; margin-bottom: 20px;
}
.history-total-num {
  font-family: 'Playfair Display', serif;
  font-size: 48px; font-weight: 900; line-height: 1;
}
.history-total-lbl { font-size: 13px; color: var(--steel); font-weight: 600; }
.chart-wrap {
  display: flex; align-items: flex-end;
  gap: 6px; height: 72px; margin-bottom: 8px;
}
.chart-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; }
.chart-bar-inner {
  width: 100%; border-radius: 1px 1px 0 0; min-height: 2px;
  transition: height 0.5s ease;
}
.chart-bar-inner.c5 { background: var(--green); }
.chart-bar-inner.c3 { background: var(--amber); }
.chart-bar-inner.c0 { background: var(--red); }
.chart-bar-inner.c-null { background: var(--border); }
.chart-id { font-size: 9px; color: var(--dim); }
.chart-legend {
  display: flex; gap: 16px; margin-top: 16px;
  padding-top: 14px; border-top: 1px solid var(--border);
}
.legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--steel); }
.legend-dot { width: 8px; height: 8px; border-radius: 1px; }

/* ── LOCKED PHASE ── */
.locked-phase {
  margin: 32px 20px; text-align: center;
  padding: 32px; border: 1px solid var(--border); border-radius: 2px;
}
.locked-icon { font-size: 36px; margin-bottom: 12px; }
.locked-title {
  font-family: 'Playfair Display', serif;
  font-size: 20px; font-weight: 700; margin-bottom: 8px;
}
.locked-sub { font-size: 13px; color: var(--steel); line-height: 1.5; }

/* ── TOAST ── */
.toast {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  background: var(--green); color: #001A0A;
  padding: 10px 24px; border-radius: 2px;
  font-size: 13px; font-weight: 700; letter-spacing: 1px;
  z-index: 999; white-space: nowrap;
  animation: toast-in 0.3s ease, toast-out 0.3s ease 1.7s forwards;
}
@keyframes toast-in { from { opacity:0; transform:translateX(-50%) translateY(10px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
@keyframes toast-out { to { opacity:0; transform:translateX(-50%) translateY(10px); } }
/* ── BRACKET ── */
.bracket-waiting { text-align:center; padding:3rem 1rem; color:var(--fog); }
.bracket-progress-bar { position:relative; height:6px; background:rgba(255,255,255,0.08); border-radius:3px; margin-bottom:1rem; overflow:hidden; }
.bracket-progress-fill { height:100%; background:#061F79; border-radius:3px; transition:width .4s; }
.bracket-progress-label { position:absolute; right:0; top:-20px; font-size:11px; color:var(--fog); }
.bracket-closed-banner { background:rgba(220,50,50,0.15); border:1px solid rgba(220,50,50,0.3); border-radius:3px; padding:10px 16px; font-size:13px; color:#ff8a80; text-align:center; margin-bottom:1rem; }
.bracket-tabs { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:1rem; }
.bracket-tab { background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:var(--fog); font-size:12px; padding:7px 14px; border-radius:3px; cursor:pointer; transition:all .2s; position:relative; }
.bracket-tab.active { background:#061F79; border-color:#061F79; color:#fff; }
.bracket-tab.done { border-color:rgba(76,175,80,0.4); }
.bracket-tab-check { margin-left:5px; color:#4caf50; }
.ko-match-card { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:4px; padding:16px; margin-bottom:12px; transition:border-color .2s; }
.ko-match-card.has-result { border-color:rgba(6,31,121,0.5); background:rgba(6,31,121,0.1); }
.ko-match-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
.ko-match-num { font-size:11px; color:var(--fog); letter-spacing:.08em; text-transform:uppercase; }
.ko-match-body { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.ko-team { flex:1; font-size:14px; font-weight:600; }
.ko-team.placeholder { color:var(--fog); font-style:italic; font-weight:400; font-size:12px; }
.ko-score-row { display:flex; align-items:center; gap:8px; }
.ko-winner-pick { margin-top:12px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.08); }
.ko-winner-btns { display:flex; gap:8px; margin-top:8px; }
.ko-winner-btn { flex:1; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.15); color:var(--fog); font-size:12px; padding:8px; border-radius:2px; cursor:pointer; transition:all .2s; }
.ko-winner-btn.selected { background:#061F79; border-color:#061F79; color:#fff; }
.admin-login-card { opacity:0.7; }
.office-rank-toggle { display:flex; border:1px solid rgba(255,255,255,0.12); border-radius:3px; overflow:hidden; margin-bottom:1rem; }
.office-rank-btn { flex:1; background:transparent; border:none; color:var(--fog); font-size:12px; padding:8px; cursor:pointer; transition:all .2s; }
.office-rank-btn.active { background:#061F79; color:#fff; }
.office-av { font-size:16px; }
.standings-seg { display:flex; gap:6px; margin-bottom:1.2rem; }
.standings-seg-btn { flex:1; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--fog); font-size:12px; padding:9px 6px; cursor:pointer; transition:all .2s; font-weight:500; }
.standings-seg-btn.active { background:#061F79; border-color:#0A2FA0; color:#fff; font-weight:700; }
.standings-seg-btn:hover:not(.active) { background:rgba(255,255,255,0.08); }
.standings-heading { font-size:18px; font-weight:700; margin-bottom:1rem; letter-spacing:.02em; }
.lb-pts-block { text-align:right; min-width:40px; }
.lb-empty { text-align:center; color:var(--fog); font-size:13px; padding:2rem; }

/* ── ADMIN UX ── */
.admin-group-nav { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:1.5rem; }
.admin-gnav-btn { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:4px; padding:8px 12px; cursor:pointer; text-align:left; transition:all .2s; min-width:90px; }
.admin-gnav-btn:hover { background:rgba(255,255,255,0.08); }
.admin-gnav-btn.active { background:#061F79; border-color:#0A2FA0; }
.admin-gnav-btn.done { border-color:rgba(31,173,106,0.5); background:rgba(31,173,106,0.08); }
.admin-gnav-btn.done.active { background:#061F79; }
.admin-gnav-btn.partial { border-color:rgba(232,160,32,0.4); }
.admin-gnav-letter { display:block; font-size:13px; font-weight:700; color:#fff; }
.admin-gnav-status { display:block; font-size:11px; color:var(--fog); margin-top:2px; }
.admin-gnav-btn.done .admin-gnav-status { color:#4caf50; }
.admin-gnav-btn.partial .admin-gnav-status { color:var(--amber); }

.admin-group-header { margin-bottom:1.2rem; padding-bottom:1rem; border-bottom:1px solid rgba(255,255,255,0.08); }
.admin-group-title { font-size:22px; font-weight:900; letter-spacing:2px; margin-bottom:4px; }
.admin-group-teams { font-size:12px; color:var(--fog); margin-bottom:6px; }
.admin-group-progress { font-size:12px; color:var(--amber); font-weight:600; }

.admin-matches-list { display:flex; flex-direction:column; gap:10px; }
.admin-match-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:6px; overflow:hidden; transition:border-color .2s; }
.admin-match-card.has-result { border-color:rgba(31,173,106,0.3); background:rgba(31,173,106,0.05); }
.admin-match-inner { display:flex; align-items:center; padding:12px 14px; gap:8px; position:relative; }
.admin-team-col { flex:1; display:flex; align-items:center; gap:8px; }
.admin-team-col.away { flex-direction:row-reverse; text-align:right; }
.admin-flag { font-size:22px; line-height:1; }
.admin-team-name { font-size:13px; font-weight:600; color:#fff; line-height:1.2; }
.admin-score-col { display:flex; align-items:center; gap:8px; flex-shrink:0; }
.admin-score-inp { width:48px; height:44px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); border-radius:4px; color:#fff; font-size:20px; font-weight:700; text-align:center; -moz-appearance:textfield; }
.admin-score-inp::-webkit-outer-spin-button, .admin-score-inp::-webkit-inner-spin-button { -webkit-appearance:none; }
.admin-score-inp:focus { outline:none; border-color:#061F79; background:rgba(6,31,121,0.3); }
.admin-score-inp::placeholder { color:rgba(255,255,255,0.2); font-size:16px; }
.admin-score-dash { font-size:20px; color:var(--fog); font-weight:300; }
.admin-clear-match { position:absolute; top:8px; right:8px; background:transparent; border:none; color:rgba(255,255,255,0.2); font-size:12px; cursor:pointer; padding:2px 4px; border-radius:2px; }
.admin-clear-match:hover { color:#ff6b6b; background:rgba(255,100,100,0.1); }
.admin-match-status { padding:6px 14px; font-size:11px; font-weight:700; letter-spacing:.05em; color:#4caf50; border-top:1px solid rgba(31,173,106,0.15); background:rgba(31,173,106,0.05); }
.admin-card { border-color:rgba(184,134,11,0.4) !important; }
.badge-admin { background:#b8860b; color:#fff; }
.modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.65); z-index:200; display:flex; align-items:center; justify-content:center; padding:1rem; }
.modal-box { background:#0d1f38; border:1px solid rgba(255,255,255,0.15); border-radius:6px; padding:2rem; width:100%; max-width:360px; }
.modal-title { font-size:1.2rem; font-weight:700; margin-bottom:0.25rem; }

`;

// ─── SCORE INPUT ──────────────────────────────────────────────────────────────

function ScoreInput({ value, onChange }) {
  const ref = useRef(null);
  const v = value ?? "";

  const handleChange = (e) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
    if (raw === "") { onChange(undefined); return; }
    const n = parseInt(raw, 10);
    onChange(isNaN(n) ? undefined : Math.min(n, 20));
  };

  const step = (delta) => {
    const cur = value ?? 0;
    onChange(Math.max(0, Math.min(20, cur + delta)));
  };

  return (
    <div className="score-col">
      <button className="score-step-btn" onClick={() => step(1)}>▲</button>
      <input
        ref={ref}
        className={`score-input ${value !== undefined ? "set" : ""}`}
        type="number"
        min="0" max="20"
        value={v}
        onChange={handleChange}
        onFocus={e => e.target.select()}
        placeholder="·"
      />
      <button className="score-step-btn" onClick={() => step(-1)}>▼</button>
    </div>
  );
}

// ─── OUTCOME LABEL ────────────────────────────────────────────────────────────

function OutcomeLabel({ home, away, hg, ag }) {
  if (hg === undefined || ag === undefined) return <div className="outcome-pill empty">—</div>;
  if (hg > ag) return <div className="outcome-pill home">Wins {home.split(" ")[0]}</div>;
  if (ag > hg) return <div className="outcome-pill away">Wins {away.split(" ")[0]}</div>;
  return <div className="outcome-pill draw">Draw</div>;
}

// ─── TOAST ────────────────────────────────────────────────────────────────────

function Toast({ msg }) {
  if (!msg) return null;
  return <div className="toast">✓ {msg}</div>;
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────

function LoginPage({ onLogin, onRegister, checkUserExists }) {
  const [mode, setMode] = useState("register");
  const [id, setId] = useState(""); const [name, setName] = useState(""); const [office, setOffice] = useState(""); const [err, setErr] = useState(""); const [submitting, setSubmitting] = useState(false);
  const valid = mode === "register" ? id.trim() && name.trim() && office : id.trim();

  const submit = async () => {
    if (submitting) return;
    setErr(""); setSubmitting(true);
    try {
      if (mode === "register") {
        if (!office) { setErr("Please select your office."); return; }
        const exists = await checkUserExists(id.trim());
        if (exists) { setErr("An account with this ID already exists. Please sign in."); return; }
        const newUser = { id: id.trim(), name: name.trim(), office };
        await onRegister(newUser);
        await onLogin(newUser);
        return;
      }
      const found = await checkUserExists(id.trim());
      if (found) await onLogin(found);
      else setErr("ID not found. Would you like to register?");
    } catch(e) {
      setErr("Connection error. Please try again.");
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-brand">
        <div className="login-wordmark">Frontier Markets</div>
        <span className="login-trophy">🏆</span>
        <div className="login-title serif">Prode<br/>Mundial 2026</div>
        <div className="login-subtitle">Internal Tournament</div>
      </div>
      <div className="login-card">
        <div className="login-card-title">{mode === "register" ? "Create account" : "Sign in"}</div>
        <div className="field">
          <label>Employee ID</label>
          <input value={id} onChange={e => setId(e.target.value)} placeholder="ej. 12345" onKeyDown={e => e.key === "Enter" && submit()} />
        </div>
        {mode === "register" && <>
          <div className="field">
            <label>Full Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="First and last name" onKeyDown={e => e.key === "Enter" && submit()} />
          </div>
          <div className="field">
            <label>Office</label>
            <input
              list="offices-list"
              value={office}
              onChange={e => setOffice(e.target.value)}
              placeholder="Type or select your office"
              autoComplete="off"
            />
            <datalist id="offices-list">
              {OFFICES.map(o => <option key={o} value={o} />)}
            </datalist>
          </div>
        </>}
        {err && <div className="error-msg">{err}</div>}
        <button className="login-btn" onClick={submit} disabled={!valid}>
          {submitting ? "Loading..." : mode === "register" ? "Register and sign in" : "Sign in →"}
        </button>
        <div className="login-toggle">
          {mode === "register"
            ? <>Already have an account? <span onClick={() => { setMode("login"); setErr(""); }}>Sign in here</span></>
            : <>First time? <span onClick={() => { setMode("register"); setErr(""); }}>Register</span></>
          }
        </div>
      </div>
    </div>
  );
}

// ─── HEADER ──────────────────────────────────────────────────────────────────

function Header({ user, onLogout }) {
  const initials = user.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="header">
      <div className="header-inner">
        <div className="header-brand">
          <div className="header-logo-text">Frontier<br/>Markets</div>
          <div className="header-event">Prode 2026</div>
        </div>
        <div className="header-user">
          <div>
            <div className="user-name-sm">{user.name.split(" ")[0]}</div>
            <div className="user-office-sm">{user.office}</div>
          </div>
          <div className="avatar">{initials}</div>
          <button className="logout-btn" onClick={onLogout}>Sign out</button>
        </div>
      </div>
    </div>
  );
}

// ─── HOME ─────────────────────────────────────────────────────────────────────

function HomePage({ user, predictions, onSection, isAdmin, onSetAdmin }) {
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPwdInput, setAdminPwdInput] = useState("");
  const [adminErr, setAdminErr] = useState("");

  const tryAdmin = () => {
    if (adminPwdInput === ADMIN_PASSWORD) {
      onSetAdmin(true);
      setShowAdminLogin(false);
      setAdminPwdInput("");
      setAdminErr("");
    } else {
      setAdminErr("Incorrect password.");
    }
  };
  const allMatches = Object.values(GROUP_MATCHES).flat();
  const filled = allMatches.filter(m => predictions[m.id]).length;
  const total = allMatches.length;
  const pct = total ? Math.round(filled / total * 100) : 0;
  const myPts = userTotalPts(predictions);

  return (
    <div className="home z1">
      <div className="home-greeting">Welcome</div>
      <div className="home-name serif">{user.name}</div>

      <div className="deadline-strip">
        <div className="deadline-icon">⏰</div>
        <div>
          <div className="deadline-title">Predictions deadline</div>
          <div className="deadline-sub">Wednesday June 11, 2026 · 12:00 PM (Buenos Aires time)</div>
        </div>
      </div>

      <div className="progress-wrap">
        <div className="progress-meta">
          <span>Predictions progress</span>
          <span>{filled} / {total} matches — {pct}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: pct + "%" }} />
        </div>
      </div>

      <div className="home-cards">
        <div className="home-card" onClick={() => onSection("prode")}>
          <div className="home-card-icon">📋</div>
          <div className="home-card-text">
            <div className="home-card-title">My Predictions</div>
            <div className="home-card-sub">Enter your predictions for each group stage match</div>
          </div>
          <div className="home-card-arrow">›</div>
          {filled < total
            ? <div className="home-card-badge badge-warn">{total - filled} pending</div>
            : <div className="home-card-badge badge-ok">✓ Complete</div>
          }
        </div>

        <div className="home-card" onClick={() => onSection("results")}>
          <div className="home-card-icon">📊</div>
          <div className="home-card-text">
            <div className="home-card-title">Results & Standings</div>
            <div className="home-card-sub">Live results, standings and score evolution</div>
          </div>
          <div className="home-card-arrow">›</div>
          <div className="home-card-badge badge-pts">{myPts} pts</div>
        </div>

        {(() => {
          const unlocked = isBracketOpen();
          return unlocked ? (
            <div className="home-card" onClick={() => onSection("bracket")}>
              <div className="home-card-icon">⚡</div>
              <div className="home-card-text">
                <div className="home-card-title">Knockout Stage</div>
                <div className="home-card-sub">Round of 32 · Round of 16 · Quarters · Semis · Final</div>
              </div>
              <div className="home-card-arrow">›</div>
              <div className="home-card-badge badge-ok">ACTIVE</div>
            </div>
          ) : (
            <div className="home-card disabled">
              <div className="home-card-icon">🔒</div>
              <div className="home-card-text">
                <div className="home-card-title">Knockout Stage</div>
                <div className="home-card-sub">Activates June 28 · Round of 32</div>
              </div>
              <div className="home-card-arrow">›</div>
            </div>
          );
        })()}

        <div className="home-card" onClick={() => onSection("profile")}>
          <div className="home-card-icon">👤</div>
          <div className="home-card-text">
            <div className="home-card-title">My Profile</div>
            <div className="home-card-sub">Update your name or office</div>
          </div>
          <div className="home-card-arrow">›</div>
        </div>

        {isAdmin ? (
          <div className="home-card admin-card" onClick={() => onSection("admin")}>
            <div className="home-card-icon">⚙️</div>
            <div className="home-card-text">
              <div className="home-card-title">Admin Panel</div>
              <div className="home-card-sub">Load match results</div>
            </div>
            <div className="home-card-arrow">›</div>
            <div className="home-card-badge badge-admin">ADMIN</div>
          </div>
        ) : (
          <div className="home-card admin-login-card" onClick={() => { setShowAdminLogin(true); setAdminErr(""); setAdminPwdInput(""); }}>
            <div className="home-card-icon">🔐</div>
            <div className="home-card-text">
              <div className="home-card-title">Admin Access</div>
              <div className="home-card-sub">Administrators only</div>
            </div>
            <div className="home-card-arrow">›</div>
          </div>
        )}
      </div>

      {/* Admin password modal */}
      {showAdminLogin && (
        <div className="modal-overlay" onClick={() => setShowAdminLogin(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title serif">Admin Access</div>
            <div className="field" style={{marginTop:"1rem"}}>
              <label>Contraseña</label>
              <input
                type="password"
                value={adminPwdInput}
                onChange={e => { setAdminPwdInput(e.target.value); setAdminErr(""); }}
                onKeyDown={e => e.key === "Enter" && tryAdmin()}
                placeholder="••••••••"
                autoFocus
              />
            </div>
            {adminErr && <div className="error-msg">{adminErr}</div>}
            <div style={{display:"flex",gap:"10px",marginTop:"1rem"}}>
              <button className="login-btn" style={{flex:1,margin:0}} onClick={tryAdmin}>Enter</button>
              <button className="back-btn" style={{flex:1}} onClick={() => setShowAdminLogin(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PRODE SECTION ────────────────────────────────────────────────────────────

function ProdeSection({ onBack, predictions, onSave }) {
  const groupKeys = Object.keys(GROUPS);
  const [gIdx, setGIdx] = useState(0);
  const [local, setLocal] = useState({ ...predictions });
  const [toast, setToast] = useState("");
  const scrollRef = useRef(null);

  const grp = groupKeys[gIdx];
  const matches = GROUP_MATCHES[grp];

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  };

  const setScore = (mid, side, val) => {
    setLocal(prev => {
      const cur = prev[mid] || { hg: 0, ag: 0 };
      return { ...prev, [mid]: { ...cur, [side]: val } };
    });
  };

  const save = (next = false) => {
    onSave(local);
    showToast(`Grupo ${grp} saved`);
    if (next && gIdx < groupKeys.length - 1) {
      setTimeout(() => {
        setGIdx(i => i + 1);
        scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      }, 300);
    }
  };

  const groupStatus = (g) => {
    const ms = GROUP_MATCHES[g];
    const n = ms.filter(m => {
      const p = local[m.id];
      return p && p.hg !== undefined && p.ag !== undefined;
    }).length;
    if (n === ms.length) return "done";
    if (n > 0) return "partial";
    return "empty";
  };

  const allFilled = matches.every(m => {
    const p = local[m.id];
    return p && p.hg !== undefined && p.ag !== undefined;
  });

  return (
    <div className="section z1">
      <div className="section-topbar">
        <button className="back-btn" onClick={onBack}>←</button>
        <div className="section-title">My Predictions</div>
      </div>

      <div className="section-scroll" ref={scrollRef}>
        {/* Group selector dots */}
        <div className="group-dots">
          {groupKeys.map((g, i) => {
            const st = groupStatus(g);
            return (
              <div
                key={g}
                className={`g-dot ${st === "done" ? "done" : st === "partial" ? "partial" : ""} ${i === gIdx ? "current" : ""}`}
                onClick={() => { setGIdx(i); scrollRef.current?.scrollTo({ top: 0 }); }}
                title={`Grupo ${g}: ${GROUPS[g].join(", ")}`}
              >{g}</div>
            );
          })}
        </div>

        {/* Group nav */}
        <div className="group-nav-bar">
          <button className="group-nav-btn" onClick={() => setGIdx(i => i - 1)} disabled={gIdx === 0}>← Previous</button>
          <div className="group-title-block">
            <div className="group-label">Grupo</div>
            <div className="group-name serif">{grp}</div>
            <div className="group-teams-sm">{GROUPS[grp].join(" · ")}</div>
          </div>
          <button className="group-nav-btn" onClick={() => setGIdx(i => i + 1)} disabled={gIdx === groupKeys.length - 1}>Next →</button>
        </div>

        {/* Match cards */}
        {matches.map((m, idx) => {
          const pred = local[m.id] || {};
          const filled = pred.hg !== undefined && pred.ag !== undefined;
          return (
            <div key={m.id} className={`match-card ${filled ? "filled" : ""}`}>
              <div className="match-card-header">
                <span>Partido {idx + 1} · Grupo {grp}</span>
                {filled && <span className="filled-tag">✓ Cargado</span>}
              </div>
              <div className="match-body">
                <div className="team-block">
                  <div className="team-flag-sm">{FLAGS[m.home]}</div>
                  <div className="team-name-sm">{m.home}</div>
                </div>
                <div className="score-widget">
                  <ScoreInput
                    value={pred.hg}
                    onChange={v => setScore(m.id, "hg", v)}
                  />
                  <div className="score-sep">–</div>
                  <ScoreInput
                    value={pred.ag}
                    onChange={v => setScore(m.id, "ag", v)}
                  />
                </div>
                <div className="team-block away">
                  <div className="team-flag-sm">{FLAGS[m.away]}</div>
                  <div className="team-name-sm">{m.away}</div>
                </div>
              </div>
              <OutcomeLabel home={m.home} away={m.away} hg={pred.hg} ag={pred.ag} />
              <div style={{ height: 10 }} />
            </div>
          );
        })}

        <button
          className={`save-btn ${allFilled ? "saved" : ""}`}
          onClick={() => save(false)}
        >
          {allFilled ? "✓ Save Group " + grp : "Save Group " + grp}
        </button>

        {gIdx < groupKeys.length - 1 && (
          <button className="save-btn-next" onClick={() => save(true)}>
            Save and go to Group {groupKeys[gIdx + 1]} →
          </button>
        )}

        <div style={{ height: 32 }} />
      </div>

      <Toast msg={toast} />
    </div>
  );
}

// ─── OFFICE RANKINGS ──────────────────────────────────────────────────────────

function OfficeRankings({ byTotal, byAvg, myOffice }) {
  const [mode, setMode] = useState("total");
  const list = mode === "total" ? byTotal : byAvg;

  return (
    <div>
      <div className="office-rank-toggle">
        <button className={`office-rank-btn ${mode==="total"?"active":""}`} onClick={() => setMode("total")}>
          Σ Total pts
        </button>
        <button className={`office-rank-btn ${mode==="avg"?"active":""}`} onClick={() => setMode("avg")}>
          x̄ Avg pts/person
        </button>
      </div>
      {list.length === 0 ? (
        <div style={{textAlign:"center",color:"var(--fog)",padding:"2rem",fontSize:13}}>
          No office data yet — points will appear as participants make predictions.
        </div>
      ) : list.map((o, i) => {
        const rank = i + 1;
        const isMyOffice = o.office === myOffice;
        return (
          <div key={o.office} className={`lb-row ${isMyOffice?"me":""}`}>
            <div className={`lb-rank ${rank===1?"gold":""}`}>
              {rank===1?"🥇":rank===2?"🥈":rank===3?"🥉":rank}
            </div>
            <div className="lb-av office-av">🏢</div>
            <div className="lb-info">
              <div className="lb-name">
                {o.office}
                {isMyOffice && <span className="me-tag">YOU</span>}
              </div>
              <div className="lb-sub">{o.members} {o.members === 1 ? "member" : "members"} · {mode === "total" ? `avg ${o.avg} pts/person` : `total ${o.total} pts`}</div>
            </div>
            <div>
              <div className="lb-pts-num">{mode === "total" ? o.total : o.avg}</div>
              <div className="lb-pts-lbl">pts</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── RESULTS SECTION ──────────────────────────────────────────────────────────

function ResultsSection({ onBack, user, predictions }) {
  const [tab, setTab] = useState("results");
  const [officeOnly, setOfficeOnly] = useState(false);
  const [RESULTS, setRESULTS] = useState({});

  useEffect(() => {
    sbGetResults().then(r => setRESULTS(r)).catch(console.error);
  }, []);

  const [allUsers, setAllUsers] = useState([]);
  const [loadingStandings, setLoadingStandings] = useState(true);

  useEffect(() => {
    async function loadStandings() {
      try {
        const [users, allPreds] = await Promise.all([sbGetAllUsers(), sbGetAllPreds()]);
        const built = users.map(u => {
          const preds = allPreds[u.id] || {};
          return {
            ...u,
            isMe: u.id === user.id,
            preds,
            pts: userTotalPts(preds),
            exact: Object.keys(RESULTS).filter(mid => calcPoints(preds[mid], RESULTS[mid]) === 5).length,
          };
        }).sort((a, b) => b.pts - a.pts);
        setAllUsers(built);
      } catch(e) { console.error(e); }
      finally { setLoadingStandings(false); }
    }
    loadStandings();
  }, []);

  const displayed = officeOnly ? allUsers.filter(u => u.office === user.office) : allUsers;
  const myPts = userTotalPts(predictions);
  const maxPts = Math.max(...Object.keys(RESULTS).map(() => 5), 1);

  const hasResults = Object.keys(RESULTS).length > 0;

  return (
    <div className="section z1">
      <div className="section-topbar">
        <button className="back-btn" onClick={onBack}>←</button>
        <div className="section-title">Results & Standings</div>
      </div>

      <div className="tabs-row">
        {[["results","Results"],["tabla","Standings"],["history","History"]].map(([k,l]) => (
          <button key={k} className={`tab-btn ${tab===k?"active":""}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      <div className="section-scroll">
        {/* ── RESULTADOS ── */}
        {tab === "results" && (
          <>
            {!hasResults ? (
              <div className="no-results">
                <div className="no-results-icon">⏳</div>
                <div className="no-results-title serif">El torneo aún no comenzó</div>
                <div className="no-results-sub">Results will appear here as matches are played.</div>
              </div>
            ) : (
              Object.keys(GROUPS).map(grp => {
                const played = GROUP_MATCHES[grp].filter(m => RESULTS[m.id]);
                if (!played.length) return null;
                return (
                  <div key={grp} className="results-group">
                    <div className="results-group-label">Grupo {grp}</div>
                    {played.map(m => {
                      const res = RESULTS[m.id];
                      const pred = predictions[m.id];
                      const pts = calcPoints(pred, res);
                      return (
                        <div key={m.id} className="result-row">
                          <div className="result-teams">
                            <div>
                              {FLAGS[m.home]} <span className="tn">{m.home}</span>
                              <span className="vs">vs</span>
                              <span className="tn">{m.away}</span> {FLAGS[m.away]}
                            </div>
                            {pred && <div className="my-pred-sm">Your prediction: {pred.hg}–{pred.ag}</div>}
                          </div>
                          <div className="result-score">{res.hg}–{res.ag}</div>
                          <div className={`pts-chip ${pts===5?"pts-5":pts===3?"pts-3":pts===0?"pts-0":"pts-null"}`}>
                            {pts===null ? "—" : pts===5 ? "+5" : pts===3 ? "+3" : "0"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </>
        )}

        {/* ── TABLA ── */}
        {tab === "tabla" && (() => {
          const officeMap = {};
          allUsers.forEach(u => {
            if (!u.office) return;
            if (!officeMap[u.office]) officeMap[u.office] = { office: u.office, members: 0, total: 0 };
            officeMap[u.office].members++;
            officeMap[u.office].total += u.pts;
          });
          const officeRankings = Object.values(officeMap)
            .map(o => ({ ...o, avg: Math.round((o.total / o.members) * 10) / 10 }));
          const byTotal = [...officeRankings].sort((a, b) => b.total - a.total);
          const byAvg   = [...officeRankings].sort((a, b) => b.avg - a.avg);

          const viewLabels = {
            false:     "🌍 Overall",
            "mine":    "🏢 My Office",
            "offices": "🏆 Offices",
          };

          return (
            <>
              {/* Segmented control */}
              <div className="standings-seg">
                {[false, "mine", "offices"].map(v => (
                  <button
                    key={String(v)}
                    className={`standings-seg-btn ${officeOnly === v ? "active" : ""}`}
                    onClick={() => setOfficeOnly(v)}
                  >
                    {viewLabels[v]}
                  </button>
                ))}
              </div>

              {/* Section title */}
              <div className="standings-heading serif">
                {officeOnly === false && "Individual Rankings"}
                {officeOnly === "mine" && `${user.office}`}
                {officeOnly === "offices" && "Office Rankings"}
              </div>

              {/* Individual lists */}
              {(officeOnly === false || officeOnly === "mine") && (() => {
                const list = officeOnly === "mine"
                  ? allUsers.filter(u => u.office === user.office)
                  : allUsers;
                if (list.length === 0) return (
                  <div className="lb-empty">No participants yet.</div>
                );
                return list.map(u => {
                  const rank = allUsers.findIndex(x => x.id === u.id) + 1;
                  return (
                    <div key={u.id} className={`lb-row r${rank<=3?rank:""} ${u.isMe?"me":""}`}>
                      <div className={`lb-rank ${rank===1?"gold":""}`}>
                        {rank===1?"🥇":rank===2?"🥈":rank===3?"🥉":rank}
                      </div>
                      <div className="lb-av">{u.name[0]}</div>
                      <div className="lb-info">
                        <div className="lb-name">
                          {u.name}
                          {u.isMe && <span className="me-tag">YOU</span>}
                        </div>
                        <div className="lb-sub">{u.office} · ⭐ {u.exact} exact</div>
                      </div>
                      <div className="lb-pts-block">
                        <div className="lb-pts-num">{u.pts}</div>
                        <div className="lb-pts-lbl">pts</div>
                      </div>
                    </div>
                  );
                });
              })()}

              {/* Office rankings */}
              {officeOnly === "offices" && (
                <OfficeRankings byTotal={byTotal} byAvg={byAvg} myOffice={user.office} />
              )}
            </>
          );
        })()}

        {/* ── HISTORIAL ── */}
        {tab === "history" && (
          <div className="history-card">
            <div className="history-total">
              <div className="history-total-num serif">{myPts}</div>
              <div className="history-total-lbl">total points accumulated</div>
            </div>

            {!hasResults ? (
              <div style={{ color: "var(--steel)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>
                No matches played yet.
              </div>
            ) : (
              <>
                <div className="chart-wrap">
                  {Object.keys(RESULTS).map(mid => {
                    const pts = calcPoints(predictions[mid], RESULTS[mid]);
                    const pct = pts === null ? 0 : (pts / 5) * 100;
                    const cls = pts === 5 ? "c5" : pts === 3 ? "c3" : pts === 0 ? "c0" : "c-null";
                    return (
                      <div key={mid} className="chart-col">
                        <div className={`chart-bar-inner ${cls}`} style={{ height: Math.max(pct, 4) + "%" }} />
                        <div className="chart-id">{mid}</div>
                      </div>
                    );
                  })}
                </div>

                <div className="chart-legend">
                  <div className="legend-item">
                    <div className="legend-dot" style={{ background: "var(--green)" }} />
                    <span>+5 exacto</span>
                  </div>
                  <div className="legend-item">
                    <div className="legend-dot" style={{ background: "var(--amber)" }} />
                    <span>+3 ganador</span>
                  </div>
                  <div className="legend-item">
                    <div className="legend-dot" style={{ background: "var(--red)" }} />
                    <span>0 fallo</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <div style={{ height: 32 }} />
      </div>
    </div>
  );
}

// ─── STORAGE HELPERS ──────────────────────────────────────────────────────────

const LS_USERS = "prode2026_users";
const LS_PREDS = "prode2026_preds";

function loadUsers() {
  try { return JSON.parse(localStorage.getItem(LS_USERS) || "[]"); } catch { return []; }
}
function saveUsers(users) {
  try { localStorage.setItem(LS_USERS, JSON.stringify(users)); } catch {}
}
function loadPreds(userId) {
  try { return JSON.parse(localStorage.getItem(`${LS_PREDS}_${userId}`) || "{}"); } catch { return {}; }
}
function savePreds(userId, preds) {
  try { localStorage.setItem(`${LS_PREDS}_${userId}`, JSON.stringify(preds)); } catch {}
}


// ─── PROFILE SECTION ──────────────────────────────────────────────────────────

function ProfileSection({ user, onBack, onUpdateUser }) {
  const [name, setName] = useState(user.name);
  const [office, setOffice] = useState(user.office);
  const [toast, setToast] = useState("");
  const [err, setErr] = useState("");

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const save = async () => {
    if (!name.trim()) { setErr("Name cannot be empty."); return; }
    setErr("");
    const updated = { ...user, name: name.trim(), office };
    try {
      await sbUpdateUser(updated);
      onUpdateUser(updated);
      showToast("Profile updated");
    } catch(e) {
      showToast("Error saving profile");
      console.error(e);
    }
  };

  return (
    <div className="section-wrap z1">
      <Toast msg={toast} />
      <div className="section-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div className="section-title serif">My Profile</div>
      </div>
      <div className="profile-card">
        <div className="profile-avatar-big">{name.trim().split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}</div>
        <div className="profile-id-label">Employee ID: <strong>{user.id}</strong></div>

        <div className="field" style={{marginTop:"1.5rem"}}>
          <label>Full Name</label>
          <input value={name} onChange={e => { setName(e.target.value); setErr(""); }} placeholder="First and last name" />
        </div>
        <div className="field">
          <label>Office</label>
          <input
            list="offices-list-profile"
            value={office}
            onChange={e => setOffice(e.target.value)}
            placeholder="Type or select your office"
            autoComplete="off"
          />
          <datalist id="offices-list-profile">
            {OFFICES.map(o => <option key={o} value={o} />)}
          </datalist>
        </div>
        {err && <div className="error-msg">{err}</div>}
        <button className="login-btn" style={{marginTop:"1rem"}} onClick={save}>Save changes</button>
      </div>
    </div>
  );
}


// ─── ADMIN SECTION ────────────────────────────────────────────────────────────

const LS_RESULTS = "prode2026_results";

function loadResults() {
  try { return JSON.parse(localStorage.getItem(LS_RESULTS) || "{}"); } catch { return {}; }
}
function saveResults(results) {
  try { localStorage.setItem(LS_RESULTS, JSON.stringify(results)); } catch {}
}

function AdminSection({ onBack }) {
  const groupKeys = Object.keys(GROUPS);
  const [gIdx, setGIdx] = useState(0);
  const [results, setResults] = useState({});
  useEffect(() => { sbGetResults().then(r => setResults(r)).catch(console.error); }, []);
  const [toast, setToast] = useState("");
  const [adminTab, setAdminTab] = useState("grupos");
  const [koMatches, setKoMatchesState] = useState(loadKOMatches());
  const [koResults, setKoResultsState] = useState(loadKOResults());
  const [editRound, setEditRound] = useState(null);
  const [newHome, setNewHome] = useState("");
  const [newAway, setNewAway] = useState("");

  const grp = groupKeys[gIdx];
  const matches = GROUP_MATCHES[grp];

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2000); };

  const setScore = (mid, side, val) => {
    const num = parseInt(val);
    if (isNaN(num) || num < 0) return;
    setResults(prev => {
      const cur = prev[mid] || { hg: 0, ag: 0 };
      return { ...prev, [mid]: { ...cur, [side]: num } };
    });
  };

  const clearResult = (mid) => {
    setResults(prev => {
      const next = { ...prev };
      delete next[mid];
      return next;
    });
  };

  const save = () => {
    saveResults(results);
    showToast("Results saveds ✓");
  };

  const groupComplete = (g) => GROUP_MATCHES[g].every(m => results[m.id] !== undefined);
  const groupPartial = (g) => GROUP_MATCHES[g].some(m => results[m.id] !== undefined);

  return (
    <div className="section-wrap z1">
      <Toast msg={toast} />
      <div className="section-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div className="section-title serif">⚙️ Admin Panel</div>
      </div>

      <div className="admin-notice">
        Load the real results for each match. Points are calculated automatically for all participants.
      </div>
      <div className="admin-tabs">
        <button className={`admin-tab ${adminTab==="grupos"?"active":""}`} onClick={() => setAdminTab("grupos")}>⚽ Groups</button>
        <button className={`admin-tab ${adminTab==="eliminatoria"?"active":""}`} onClick={() => setAdminTab("eliminatoria")}>⚡ Knockout</button>
      </div>

      {adminTab === "grupos" && <>
        {/* Group selector */}
        <div className="admin-group-nav">
          {groupKeys.map((g, i) => {
            const done = groupComplete(g);
            const partial = groupPartial(g);
            return (
              <button
                key={g}
                className={`admin-gnav-btn ${i === gIdx ? "active" : ""} ${done ? "done" : partial ? "partial" : ""}`}
                onClick={() => setGIdx(i)}
              >
                <span className="admin-gnav-letter">Grupo {g}</span>
                <span className="admin-gnav-status">
                  {done ? "✓ Complete" : partial ? `${GROUP_MATCHES[g].filter(m => results[m.id]).length}/6` : "Pending"}
                </span>
              </button>
            );
          })}
        </div>

        {/* Group header */}
        <div className="admin-group-header">
          <div className="admin-group-title serif">GROUP {grp}</div>
          <div className="admin-group-teams">{GROUPS[grp].map(t => `${FLAGS[t]} ${t}`).join(" · ")}</div>
          <div className="admin-group-progress">
            {matches.filter(m => results[m.id]).length}/{matches.length} results loaded
          </div>
        </div>

        {/* Matches */}
        <div className="admin-matches-list">
          {matches.map(m => {
            const r = results[m.id];
            const hasResult = r !== undefined;
            return (
              <div key={m.id} className={`admin-match-card ${hasResult ? "has-result" : ""}`}>
                <div className="admin-match-inner">
                  <div className="admin-team-col home">
                    <span className="admin-flag">{FLAGS[m.home]}</span>
                    <span className="admin-team-name">{m.home}</span>
                  </div>
                  <div className="admin-score-col">
                    <input
                      type="number" min="0" max="20"
                      className="admin-score-inp"
                      value={hasResult ? r.hg : ""}
                      placeholder="–"
                      onChange={e => { setScore(m.id, "hg", e.target.value); saveResults({...results}); }}
                    />
                    <span className="admin-score-dash">—</span>
                    <input
                      type="number" min="0" max="20"
                      className="admin-score-inp"
                      value={hasResult ? r.ag : ""}
                      placeholder="–"
                      onChange={e => { setScore(m.id, "ag", e.target.value); saveResults({...results}); }}
                    />
                  </div>
                  <div className="admin-team-col away">
                    <span className="admin-flag">{FLAGS[m.away]}</span>
                    <span className="admin-team-name">{m.away}</span>
                  </div>
                  {hasResult && (
                    <button className="admin-clear-match" onClick={() => clearResult(m.id)} title="Clear">✕</button>
                  )}
                </div>
                {hasResult && (
                  <div className="admin-match-status">
                    {r.hg > r.ag ? `Wins ${m.home}` : r.ag > r.hg ? `Wins ${m.away}` : "Draw"}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button className="login-btn" style={{marginTop:"1rem"}} onClick={save}>
          Save group {grp}
        </button>
      </>}

      {adminTab === "eliminatoria" && (
        <div className="ko-admin-wrap">
          {/* ── AUTO R32 BRACKET ── */}
          {(() => {
            const allGroupResults = loadResults();
            const totalPlayed = "ABCDEFGHIJKL".split("").reduce((s, g) =>
              s + GROUP_MATCHES[g].filter(m => allGroupResults[m.id]).length, 0);
            const bracket = generateR32Bracket(allGroupResults);
            const alreadySaved = (koMatches["r32"]||[]).length === 16;

            if (totalPlayed < 72) {
              return (
                <div className="admin-notice" style={{textAlign:"center"}}>
                  <div style={{fontSize:"2rem",marginBottom:8}}>⏳</div>
                  <div style={{fontWeight:700,marginBottom:4}}>Faltan results de grupos</div>
                  <div style={{fontSize:12,color:"var(--fog)"}}>
                    You've loaded {totalPlayed} of 72 group stage matches.<br/>
                    Once all are complete, the bracket is generated automatically.
                  </div>
                </div>
              );
            }

            if (alreadySaved) {
              return (
                <div>
                  <div className="ko-admin-round-header" style={{marginBottom:12}}>
                    <span style={{color:"#4caf50"}}>✓ Round of 32 generated and active</span>
                    <button className="admin-clear-btn" onClick={() => {
                      setKoMatchesState({...koMatches, r32:[]}); saveKOMatches({...koMatches, r32:[]});
                      showToast("Bracket reset");
                    }}>Reset</button>
                  </div>
                  {(koMatches["r32"]||[]).map((m,i) => (
                    <div key={m.id} className="admin-match-row has-result">
                      <div className="admin-teams">
                        <span style={{fontSize:11,color:"var(--fog)",minWidth:20}}>{i+1}.</span>
                        <span>{m.home}</span><span className="vs-label">vs</span><span>{m.away}</span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            }

            return (
              <div>
                <div className="admin-notice">
                  ✅ All 72 group stage matches are loaded. The Round of 32 bracket was automatically generated using the official FIFA schedule.
                </div>
                {bracket && bracket.map((m,i) => (
                  <div key={m.id} className="admin-match-row">
                    <div className="admin-teams">
                      <span style={{fontSize:11,color:"var(--fog)",minWidth:20}}>{i+1}.</span>
                      <span>{m.home}</span><span className="vs-label">vs</span><span>{m.away}</span>
                    </div>
                  </div>
                ))}
                <button className="login-btn" style={{marginTop:"1rem"}} onClick={() => {
                  const updated = {...koMatches, r32: bracket};
                  setKoMatchesState(updated); saveKOMatches(updated);
                  showToast("Bracket activated ✓ — all participants can now make predictions");
                }}>
                  ⚡ Activate bracket for everyone
                </button>
              </div>
            );
          })()}

          {/* ── STEP 2: KO Results ── */}

          {/* ── STEP 2: Load results as matches are played ── */}
          {(koMatches["r32"]||[]).length === 16 && (
            <div className="ko-admin-round" style={{marginTop:"2rem"}}>
              <div className="ko-admin-round-header"><span>Results eliminatoria</span></div>
              <div style={{fontSize:12,color:"var(--fog)",marginBottom:12}}>
                Load results as matches are played.
              </div>
              {["r32","r16","qf","sf","f","tp"].map(roundId => {
                const rLabel = BRACKET_ROUNDS.find(r=>r.id===roundId)?.label || roundId;
                const matches = koMatches[roundId] || [];
                if (matches.length === 0 && roundId !== "r32") return null;
                // For rounds after r32, we need to figure out which matches exist from users' preds
                // Admin just enters results for r32 matches; later rounds need match info too
                // Simple approach: admin can add results for any match ID
                return (
                  <div key={roundId} style={{marginBottom:"1.5rem"}}>
                    <div style={{fontWeight:700,fontSize:12,letterSpacing:".05em",textTransform:"uppercase",color:"var(--fog)",marginBottom:8}}>{rLabel}</div>
                    {matches.map(m => {
                      const r = koResults[m.id];
                      return (
                        <div key={m.id} className={`admin-match-row ${r?"has-result":""}`}>
                          <div className="admin-teams"><span>{m.home}</span><span className="vs-label">vs</span><span>{m.away}</span></div>
                          <div className="admin-score-row">
                            <input type="number" min="0" className="score-input" value={r?.hg??""} placeholder="–"
                              onChange={e => {
                                const num = parseInt(e.target.value); if(isNaN(num)) return;
                                const upd = {...koResults,[m.id]:{...(koResults[m.id]||{hg:0,ag:0}),hg:num}};
                                setKoResultsState(upd); saveKOResults(upd);
                              }} />
                            <span className="score-sep">–</span>
                            <input type="number" min="0" className="score-input" value={r?.ag??""} placeholder="–"
                              onChange={e => {
                                const num = parseInt(e.target.value); if(isNaN(num)) return;
                                const upd = {...koResults,[m.id]:{...(koResults[m.id]||{hg:0,ag:0}),ag:num}};
                                setKoResultsState(upd); saveKOResults(upd);
                              }} />
                          </div>
                        </div>
                      );
                    })}
                    {roundId !== "r32" && (
                      <div style={{display:"flex",gap:8,marginTop:8}}>
                        <input style={{flex:1,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:2,color:"#fff",padding:"6px 10px",fontSize:12}} placeholder="Local" value={editRound===roundId?newHome:""} onChange={e=>{setEditRound(roundId);setNewHome(e.target.value)}} />
                        <input style={{flex:1,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:2,color:"#fff",padding:"6px 10px",fontSize:12}} placeholder="Visitante" value={editRound===roundId?newAway:""} onChange={e=>{setEditRound(roundId);setNewAway(e.target.value)}} />
                        <button className="admin-clear-btn" onClick={() => {
                          if(!newHome.trim()||!newAway.trim()) return;
                          const mid = `${roundId}_${(koMatches[roundId]||[]).length}`;
                          const upd = {...koMatches,[roundId]:[...(koMatches[roundId]||[]),{id:mid,home:newHome.trim(),away:newAway.trim()}]};
                          setKoMatchesState(upd); saveKOMatches(upd); setNewHome(""); setNewAway(""); setEditRound(null);
                          showToast("Partido agregado ✓");
                        }}>+ Partido</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ─── BRACKET SECTION ──────────────────────────────────────────────────────────

function BracketSection({ user, onBack }) {
  const koMatches   = loadKOMatches();
  const koResults   = loadKOResults();
  const [preds, setPreds] = useState(loadKOPreds(user.id));
  const [activeRound, setActiveRound] = useState("r32");
  const [toast, setToast] = useState("");
  const deadlinePassed = isBracketDeadlinePassed();

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const r32Matches = koMatches["r32"] || [];
  const bracketReady = r32Matches.length === 16;

  // Derive bracket matches from preds for rounds after r32
  // Each pair of r32 matches produces one r16 match, etc.
  function getWinner(matchId) {
    const p = preds[matchId];
    if (!p) return null;
    if (p.hg > p.ag) return preds[matchId + "_home"] || koMatches["r32"]?.find(m => m.id === matchId)?.home;
    if (p.ag > p.hg) return preds[matchId + "_away"] || koMatches["r32"]?.find(m => m.id === matchId)?.away;
    return null; // draw — need to pick
  }

  // Build derived matches for r16, qf, sf, f from predictions
  function buildDerivedMatch(roundId, slotIdx) {
    return { id: `${roundId}_${slotIdx}`, home: null, away: null, derived: true };
  }

  // Get predicted winner of a match (home name, away name stored alongside score)
  function getPredWinner(matchId, matchHome, matchAway) {
    const p = preds[matchId];
    if (!p || p.hg == null || p.ag == null) return null;
    if (p.hg > p.ag) return matchHome;
    if (p.ag > p.hg) return matchAway;
    return p.winner || null; // draw — user must pick winner separately
  }

  const setScore = (matchId, side, val, home, away) => {
    const num = parseInt(val);
    if (isNaN(num) || num < 0 || deadlinePassed) return;
    setPreds(prev => ({
      ...prev,
      [matchId]: { ...(prev[matchId] || { hg: 0, ag: 0 }), [side]: num, home, away }
    }));
  };

  const setWinner = (matchId, winner) => {
    if (deadlinePassed) return;
    setPreds(prev => ({
      ...prev,
      [matchId]: { ...(prev[matchId] || { hg: 0, ag: 0 }), winner }
    }));
  };

  const save = () => {
    saveKOPreds(user.id, preds);
    showToast("Bracket saved ✓");
  };

  // For each round, build the match list with team names derived from previous round preds
  function getMatchesForRound(roundId) {
    if (roundId === "r32") return koMatches["r32"] || [];
    if (roundId === "tp") {
      // Third place: losers of sf
      const sfMatches = getMatchesForRound("sf");
      const l1 = getSFLoser(sfMatches[0]);
      const l2 = getSFLoser(sfMatches[1]);
      return [{ id: "tp_0", home: l1 || "Semi-final 1", away: l2 || "Semi-final 2" }];
    }
    const prevRound = { r16: "r32", qf: "r16", sf: "qf", f: "sf" }[roundId];
    const prevMatches = getMatchesForRound(prevRound);
    const matches = [];
    for (let i = 0; i < prevMatches.length; i += 2) {
      const m1 = prevMatches[i];
      const m2 = prevMatches[i + 1];
      if (!m1 || !m2) break;
      const w1 = getPredWinner(m1.id, m1.home, m1.away);
      const w2 = getPredWinner(m2.id, m2.home, m2.away);
      matches.push({
        id: `${roundId}_${i/2}`,
        home: w1 || `Match winner ${i+1}`,
        away: w2 || `Match winner ${i+2}`,
        derived: true
      });
    }
    return matches;
  }

  function getSFLoser(m) {
    if (!m) return null;
    const p = preds[m.id];
    if (!p) return null;
    if (p.hg > p.ag) return m.away;
    if (p.ag > p.hg) return m.home;
    const w = p.winner;
    if (w === m.home) return m.away;
    if (w === m.away) return m.home;
    return null;
  }

  // Count total predicted + total matches
  const allRounds = ["r32","r16","qf","sf","f","tp"];
  let totalMatches = 0, totalPred = 0;
  allRounds.forEach(rid => {
    const ms = getMatchesForRound(rid);
    totalMatches += ms.length;
    ms.forEach(m => { if (preds[m.id]) totalPred++; });
  });

  if (!bracketReady) {
    return (
      <div className="section-wrap z1">
        <div className="section-header">
          <button className="back-btn" onClick={onBack}>← Back</button>
          <div className="section-title serif">Knockout Stage</div>
        </div>
        <div className="bracket-waiting">
          <div style={{fontSize:"3rem",marginBottom:"1rem"}}>⏳</div>
          <div style={{fontSize:"1.1rem",fontWeight:700,marginBottom:"8px"}}>Waiting for fixtures</div>
          <div style={{color:"var(--fog)",fontSize:"13px",lineHeight:1.6}}>
            El bracket se habilita cuando el admin cargue los 16 cruces de la Round of 32.<br/>
            Esto sucede al terminar la fase de grupos (27 de junio).
          </div>
        </div>
      </div>
    );
  }

  const currentMatches = getMatchesForRound(activeRound);
  const roundLabel = BRACKET_ROUNDS.find(r => r.id === activeRound)?.label || activeRound;

  return (
    <div className="section-wrap z1">
      <Toast msg={toast} />
      <div className="section-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div className="section-title serif">Knockout Stage</div>
      </div>

      {!deadlinePassed && (
        <div className="bracket-progress-bar">
          <div className="bracket-progress-fill" style={{width: `${totalMatches ? (totalPred/totalMatches)*100 : 0}%`}} />
          <span className="bracket-progress-label">{totalPred}/{totalMatches} predicted</span>
        </div>
      )}

      {deadlinePassed && (
        <div className="bracket-closed-banner">🔒 Bracket closed — deadline was June 28</div>
      )}

      {/* Round tabs */}
      <div className="bracket-tabs">
        {BRACKET_ROUNDS.map(r => {
          const ms = getMatchesForRound(r.id);
          const done = ms.every(m => preds[m.id]);
          return (
            <button
              key={r.id}
              className={`bracket-tab ${activeRound === r.id ? "active" : ""} ${done ? "done" : ""}`}
              onClick={() => setActiveRound(r.id)}
            >
              {r.label}
              {done && <span className="bracket-tab-check">✓</span>}
            </button>
          );
        })}
      </div>

      {/* Matches for active round */}
      <div style={{marginTop:"1rem"}}>
        {currentMatches.map((m, idx) => {
          const p = preds[m.id] || {};
          const result = koResults[m.id];
          const pts = result && preds[m.id] ? calcPoints(preds[m.id], result) : null;
          const isDraw = p.hg != null && p.ag != null && p.hg === p.ag;
          const homeIsPlaceholder = m.home?.startsWith("Ganador") || m.home?.startsWith("Semifinal");
          const awayIsPlaceholder = m.away?.startsWith("Ganador") || m.away?.startsWith("Semifinal");
          const locked = deadlinePassed || homeIsPlaceholder || awayIsPlaceholder;

          return (
            <div key={m.id} className={`ko-match-card ${result ? "has-result" : ""}`}>
              <div className="ko-match-header">
                <span className="ko-match-num">{activeRound.toUpperCase()} · Partido {idx+1}</span>
                {pts !== null && (
                  <span className={`pts-chip ${pts===5?"pts5":pts===3?"pts3":"pts0"}`}>+{pts}</span>
                )}
              </div>
              <div className="ko-match-body">
                <div className={`ko-team ${homeIsPlaceholder?"placeholder":""}`}>{m.home}</div>
                {result ? (
                  <div className="result-box">{result.hg}–{result.ag}</div>
                ) : (
                  <div className="ko-score-row">
                    <input type="number" min="0" className="score-input"
                      value={p.hg ?? ""} placeholder="0"
                      disabled={locked}
                      onChange={e => setScore(m.id, "hg", e.target.value, m.home, m.away)} />
                    <span className="score-sep">–</span>
                    <input type="number" min="0" className="score-input"
                      value={p.ag ?? ""} placeholder="0"
                      disabled={locked}
                      onChange={e => setScore(m.id, "ag", e.target.value, m.home, m.away)} />
                  </div>
                )}
                <div className={`ko-team ${awayIsPlaceholder?"placeholder":""}`}>{m.away}</div>
              </div>
              {/* If draw, must pick winner (for knockout, draws go to extra time/penalties) */}
              {isDraw && !result && !locked && (
                <div className="ko-winner-pick">
                  <span style={{fontSize:12,color:"var(--fog)"}}>Draw → ¿quién avanza?</span>
                  <div className="ko-winner-btns">
                    <button
                      className={`ko-winner-btn ${p.winner===m.home?"selected":""}`}
                      onClick={() => setWinner(m.id, m.home)}
                    >{m.home}</button>
                    <button
                      className={`ko-winner-btn ${p.winner===m.away?"selected":""}`}
                      onClick={() => setWinner(m.id, m.away)}
                    >{m.away}</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!deadlinePassed && (
        <button className="login-btn" style={{marginTop:"1.5rem"}} onClick={save}>
          Save bracket
        </button>
      )}
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState(null);
  const [section, setSection] = useState("home");
  const [predictions, setPredictions] = useState({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");

  const handleUpdateUser = async (updated) => {
    await sbUpdateUser(updated);
    setUser(updated);
  };

  const handleRegister = async (newUser) => {
    await sbCreateUser(newUser);
  };

  const checkUserExists = async (id) => {
    return await sbGetUser(id);
  };

  const handleLogin = async (u) => {
    setLoading(true);
    setLoadingMsg("Loading your predictions...");
    try {
      const saved = await sbGetPreds(u.id);
      setUser(u);
      setPredictions(saved);
      setSection("home");
    } catch(e) {
      console.error(e);
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  const handleSave = async (preds) => {
    setPredictions(preds);
    if (user) {
      try { await sbSaveAllPreds(user.id, preds); } catch(e) { console.error(e); }
    }
  };

  const handleLogout = () => {
    setUser(null);
    setPredictions({});
    setSection("home");
  };

  if (loading) return (
    <>
      <style>{CSS}</style>
      <div className="app" style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh"}}>
        <div style={{textAlign:"center",color:"var(--fog)"}}>
          <div style={{fontSize:"2rem",marginBottom:"1rem"}}>⏳</div>
          <div style={{fontSize:"14px"}}>{loadingMsg}</div>
        </div>
      </div>
    </>
  );

  if (!user) return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <LoginPage
          onLogin={handleLogin}
          onRegister={handleRegister}
          checkUserExists={checkUserExists}
        />
      </div>
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <Header user={user} onLogout={handleLogout} />
        {section === "home" && <HomePage user={user} predictions={predictions} onSection={setSection} isAdmin={isAdmin} onSetAdmin={setIsAdmin} />}
        {section === "prode" && <ProdeSection onBack={() => setSection("home")} predictions={predictions} onSave={handleSave} />}
        {section === "results" && <ResultsSection onBack={() => setSection("home")} user={user} predictions={predictions} />}
        {section === "profile" && <ProfileSection user={user} onBack={() => setSection("home")} onUpdateUser={handleUpdateUser} />}
        {section === "admin" && <AdminSection onBack={() => setSection("home")} />}
        {section === "bracket" && <BracketSection user={user} onBack={() => setSection("home")} />}
      </div>
    </>
  );
}
