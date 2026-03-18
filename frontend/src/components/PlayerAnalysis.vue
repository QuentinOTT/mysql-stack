<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import {
  Chart as ChartJS, ArcElement, BarElement, PointElement, LineElement,
  CategoryScale, LinearScale, RadialLinearScale, Tooltip, Legend, Filler,
} from 'chart.js'
import { Bar, Doughnut, Scatter, Radar } from 'vue-chartjs'

ChartJS.register(
  ArcElement, BarElement, PointElement, LineElement,
  CategoryScale, LinearScale, RadialLinearScale, Tooltip, Legend, Filler,
)

/* ══════════════════════ TYPES ══════════════════════ */
interface Player {
  id: number; player: string; nation: string; pos: string; squad: string
  comp: string; age: number; born: number; mp: number; starts: number
  min: number; nineties: number; gls: number; ast: number; g_a: number
  xg: number; xag: number; npxg: number; g_pk: number; tkl: number
  tklw: number; blocks: number; interceptions: number; tkl_int: number
  clr: number; err: number; prgp: number; prgc: number; kp: number
  cmp_pct: number; ast_passing: number; xa: number; ppa: number
  ga: number; saves: number; save_pct: number; cs: number; cs_pct: number
  pka: number; pksv: number; touches: number; carries: number
  prgr: number; mis: number; dis: number; crdy: number; crdr: number
  pkwon: number; pkcon: number; recov: number
}
interface OverviewStats {
  totalPlayers: number; totalGoals: number
  topScorer: { player: string; gls: number } | null
  bestLeague: { comp: string; totalGls: number } | null
}
interface TableMeta { total: number; page: number; limit: number; pages: number }

const API = 'http://localhost:3000'
async function useFetch<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

/* ══════════════════════ STATE ══════════════════════ */
const loading = ref(true)
const error = ref<string | null>(null)
const activeTab = ref<'overview' | 'comparateur' | 'classements' | 'analyse' | 'tableau'>('overview')

/* ══════════════════════ TOAST ══════════════════════ */
const toastMsg = ref<string | null>(null)
function toast(msg: string) { toastMsg.value = msg; setTimeout(() => { toastMsg.value = null }, 3500) }

/* ══════════════════════ OVERVIEW ══════════════════════ */
const overview = ref<OverviewStats>({ totalPlayers: 0, totalGoals: 0, topScorer: null, bestLeague: null })
const playersByPos = ref<Record<string, number>>({})
const goalsByComp = ref<{ comp: string; gls: number }[]>([])
const topClubs = ref<{ squad: string; count: number }[]>([])
const topNations = ref<{ nation: string; count: number }[]>([])

async function loadDashboard() {
  const [ov, charts] = await Promise.all([
    useFetch<OverviewStats>(`${API}/stats/overview`),
    useFetch<{ byPos: Record<string, number>; goalsByComp: { comp: string; gls: number }[]; topClubs: { squad: string; count: number }[] }>(`${API}/stats/overview-charts`),
  ])
  overview.value = ov
  playersByPos.value = charts.byPos
  goalsByComp.value = charts.goalsByComp
  topClubs.value = charts.topClubs
  const allP = await useFetch<Player[]>(`${API}/players?limit=9999`)
  const nationMap: Record<string, number> = {}
  allP.forEach(p => { nationMap[p.nation] = (nationMap[p.nation] || 0) + 1 })
  topNations.value = Object.entries(nationMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([nation, count]) => ({ nation, count }))
}

/* ══════════════════════ FILTERS ══════════════════════ */
const comps = ref<string[]>([])
const positions = ref<string[]>([])

/* ══════════════════════ COMPARATOR ══════════════════════ */
const cmpSearch1 = ref(''); const cmpSearch2 = ref('')
const cmpResults1 = ref<Player[]>([]); const cmpResults2 = ref<Player[]>([])
const cmpShow1 = ref(false); const cmpShow2 = ref(false)
const cmpPlayer1 = ref<Player | null>(null); const cmpPlayer2 = ref<Player | null>(null)
let cmpT1: ReturnType<typeof setTimeout>; let cmpT2: ReturnType<typeof setTimeout>

function onCmpSearch(n: 1 | 2) {
  const s = n === 1 ? cmpSearch1 : cmpSearch2
  const r = n === 1 ? cmpResults1 : cmpResults2
  const sh = n === 1 ? cmpShow1 : cmpShow2
  clearTimeout(n === 1 ? cmpT1 : cmpT2)
  if (!s.value.trim()) { r.value = []; sh.value = false; return }
  const t = setTimeout(async () => {
    try { r.value = await useFetch<Player[]>(`${API}/players?search=${encodeURIComponent(s.value)}&limit=6`); sh.value = true }
    catch { r.value = [] }
  }, 250)
  if (n === 1) cmpT1 = t; else cmpT2 = t
}
function selectCmp(n: 1 | 2, p: Player) {
  if (n === 1) { cmpPlayer1.value = p; cmpSearch1.value = p.player; cmpShow1.value = false }
  else { cmpPlayer2.value = p; cmpSearch2.value = p.player; cmpShow2.value = false }
}
function blurCmpSearch(n: 1 | 2) { window.setTimeout(() => { if (n === 1) cmpShow1.value = false; else cmpShow2.value = false }, 200) }

const radarLabels = ['Buts', 'Passes D.', 'xG', 'Tacles', 'Intercept.', 'Passes Prog.']
const radarKeys: (keyof Player)[] = ['gls', 'ast', 'xg', 'tkl', 'interceptions', 'prgp']
function normalize(val: number, max: number): number { return max > 0 ? Math.round((val / max) * 100) : 0 }

const radarData = computed(() => {
  const p1 = cmpPlayer1.value; const p2 = cmpPlayer2.value
  if (!p1 || !p2) return null
  const maxVals = radarKeys.map(k => Math.max(p1[k] as number, p2[k] as number, 1))
  return {
    labels: radarLabels,
    datasets: [
      { label: p1.player, data: radarKeys.map((k, i) => normalize(p1[k] as number, maxVals[i])), backgroundColor: 'rgba(0,212,170,0.15)', borderColor: '#00d4aa', pointBackgroundColor: '#00d4aa', borderWidth: 2 },
      { label: p2.player, data: radarKeys.map((k, i) => normalize(p2[k] as number, maxVals[i])), backgroundColor: 'rgba(255,107,107,0.15)', borderColor: '#ff6b6b', pointBackgroundColor: '#ff6b6b', borderWidth: 2 },
    ],
  }
})

const cmpStats: { label: string; key: keyof Player }[] = [
  { label: 'Buts', key: 'gls' }, { label: 'Passes D.', key: 'ast' },
  { label: 'B+PD', key: 'g_a' }, { label: 'xG', key: 'xg' },
  { label: 'xAG', key: 'xag' }, { label: 'Tacles', key: 'tkl' },
  { label: 'Interceptions', key: 'interceptions' }, { label: 'Dégagements', key: 'clr' },
  { label: 'Passes prog.', key: 'prgp' }, { label: 'Touches', key: 'touches' },
  { label: 'Cartons J.', key: 'crdy' }, { label: 'Minutes', key: 'min' },
]
const cmpWinner = computed(() => {
  if (!cmpPlayer1.value || !cmpPlayer2.value) return null
  let w1 = 0, w2 = 0
  cmpStats.forEach(s => {
    const v1 = cmpPlayer1.value![s.key] as number; const v2 = cmpPlayer2.value![s.key] as number
    if (s.key === 'crdy') { if (v1 < v2) w1++; else if (v2 < v1) w2++ }
    else { if (v1 > v2) w1++; else if (v2 > v1) w2++ }
  })
  return { w1, w2 }
})

/* ══════════════════════ RANKINGS ══════════════════════ */
const rkTab = ref<string>('scorers')
const rkTabs = [
  { id: 'scorers', label: '⚽ Buteurs', sort: 'gls', key: 'gls' as keyof Player, unit: 'buts' },
  { id: 'assisters', label: '🅰️ Passeurs', sort: 'ast', key: 'ast' as keyof Player, unit: 'PD' },
  { id: 'defenders', label: '🛡 Défenseurs', sort: 'tkl', key: 'tkl' as keyof Player, unit: 'tacles' },
  { id: 'gk', label: '🧤 Gardiens', sort: 'saves', key: 'saves' as keyof Player, unit: 'arrêts' },
]
const rkPlayers = ref<Player[]>([])
const rkComp = ref(''); const rkAgeMin = ref<number | ''>(''); const rkAgeMax = ref<number | ''>('')
const rkLoading = ref(false)

async function loadRankings() {
  rkLoading.value = true
  const t = rkTabs.find(t => t.id === rkTab.value)!
  let url = `${API}/players?sort=${t.sort}&order=desc&limit=20`
  if (t.id === 'gk') url += '&pos=GK'
  if (rkComp.value) url += `&comp=${encodeURIComponent(rkComp.value)}`
  if (rkAgeMin.value !== '') url += `&age_min=${rkAgeMin.value}`
  if (rkAgeMax.value !== '') url += `&age_max=${rkAgeMax.value}`
  try { rkPlayers.value = await useFetch<Player[]>(url) }
  catch { toast('Erreur chargement classement') }
  finally { rkLoading.value = false }
}
watch([rkTab, rkComp, rkAgeMin, rkAgeMax], loadRankings)

/* ══════════════════════ ANALYSIS ══════════════════════ */
const anComp = ref(''); const anPos = ref('')
const anScatterXG = ref<Player[]>([]); const anScatterDef = ref<Player[]>([])
const anTopAst = ref<Player[]>([]); const anLoading = ref(false)

async function loadAnalysis() {
  anLoading.value = true
  try {
    let base = `${API}/players?limit=300&order=desc`
    if (anComp.value) base += `&comp=${encodeURIComponent(anComp.value)}`
    if (anPos.value) base += `&pos=${encodeURIComponent(anPos.value)}`
    const [xgData, defData, astData] = await Promise.all([
      useFetch<Player[]>(`${base}&sort=gls`),
      useFetch<Player[]>(`${API}/players?sort=tkl&order=desc&limit=200${anComp.value ? '&comp=' + encodeURIComponent(anComp.value) : ''}`),
      useFetch<Player[]>(`${base}&sort=ast`),
    ])
    anScatterXG.value = xgData.filter(p => p.xg > 0 || p.gls > 0)
    anScatterDef.value = defData.filter(p => p.tkl > 0 || p.interceptions > 0)
    anTopAst.value = astData.slice(0, 15)
  } catch { toast('Erreur chargement analyse') }
  finally { anLoading.value = false }
}
watch([anComp, anPos], loadAnalysis)

/* ══════════════════════ TABLE ══════════════════════ */
const tblPlayers = ref<Player[]>([]); const tblMeta = ref<TableMeta>({ total: 0, page: 1, limit: 25, pages: 0 })
const tblSearch = ref(''); const tblComp = ref(''); const tblPos = ref('')
const tblAgeMin = ref<number | ''>(''); const tblAgeMax = ref<number | ''>('')
const tblSort = ref('gls'); const tblOrder = ref<'asc' | 'desc'>('desc')
const tblLoading = ref(false)

async function loadTable() {
  tblLoading.value = true
  const p = new URLSearchParams()
  p.set('page', String(tblMeta.value.page)); p.set('limit', '25')
  p.set('sort', tblSort.value); p.set('order', tblOrder.value)
  if (tblSearch.value) p.set('search', tblSearch.value)
  if (tblComp.value) p.set('comp', tblComp.value)
  if (tblPos.value) p.set('pos', tblPos.value)
  if (tblAgeMin.value !== '') p.set('age_min', String(tblAgeMin.value))
  if (tblAgeMax.value !== '') p.set('age_max', String(tblAgeMax.value))
  try {
    const d = await useFetch<{ players: Player[]; meta: TableMeta }>(`${API}/players/table?${p}`)
    tblPlayers.value = d.players; tblMeta.value = d.meta
  } catch { toast('Erreur chargement tableau') }
  finally { tblLoading.value = false }
}
function tblSortBy(col: string) {
  if (tblSort.value === col) tblOrder.value = tblOrder.value === 'desc' ? 'asc' : 'desc'
  else { tblSort.value = col; tblOrder.value = 'desc' }
  tblMeta.value.page = 1; loadTable()
}
function tblGoPage(n: number) { tblMeta.value.page = n; loadTable() }
let tblST: ReturnType<typeof setTimeout>
function onTblSearch() { clearTimeout(tblST); tblST = setTimeout(() => { tblMeta.value.page = 1; loadTable() }, 300) }
function onTblFilter() { tblMeta.value.page = 1; loadTable() }

function exportCSV() {
  const cols = ['player','nation','pos','squad','comp','age','mp','gls','ast','g_a','xg','xag','tkl','interceptions','clr','saves','crdy','crdr']
  let csv = cols.join(',') + '\n'
  tblPlayers.value.forEach(p => {
    csv += cols.map(c => { const v = (p as any)[c]; return typeof v === 'string' && v.includes(',') ? `"${v}"` : v ?? '' }).join(',') + '\n'
  })
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  a.download = 'players.csv'; a.click(); URL.revokeObjectURL(a.href)
}

const tblCols: { key: string; label: string }[] = [
  { key: 'player', label: 'Joueur' }, { key: 'pos', label: 'Pos' },
  { key: 'squad', label: 'Club' }, { key: 'comp', label: 'Ligue' },
  { key: 'age', label: 'Âge' }, { key: 'mp', label: 'MJ' },
  { key: 'gls', label: 'Buts' }, { key: 'ast', label: 'PD' },
  { key: 'g_a', label: 'B+PD' }, { key: 'xg', label: 'xG' },
  { key: 'tkl', label: 'Tkl' }, { key: 'interceptions', label: 'Int' },
  { key: 'crdy', label: 'CJ' },
]
const tblPages = computed(() => {
  const c = tblMeta.value.page, t = tblMeta.value.pages, a: (number | '...')[] = []
  if (t <= 7) { for (let i = 1; i <= t; i++) a.push(i) }
  else { a.push(1); if (c > 3) a.push('...'); for (let i = Math.max(2, c - 1); i <= Math.min(t - 1, c + 1); i++) a.push(i); if (c < t - 2) a.push('...'); a.push(t) }
  return a
})

/* ══════════════════════ MODAL ══════════════════════ */
const showModal = ref(false); const modalPlayer = ref<Player | null>(null)
function openModal(p: Player) { modalPlayer.value = p; showModal.value = true }
function closeModal() { showModal.value = false }

const modalSections = [
  { title: 'Général', stats: [
    { key: 'nation', label: 'Nationalité', icon: '🌍' }, { key: 'pos', label: 'Poste', icon: '📍' },
    { key: 'squad', label: 'Club', icon: '🏟' }, { key: 'comp', label: 'Ligue', icon: '🏆' },
    { key: 'age', label: 'Âge', icon: '🎂' }, { key: 'born', label: 'Né en', icon: '📅' },
  ]},
  { title: 'Apparitions', stats: [
    { key: 'mp', label: 'Matchs joués', icon: '⚽' }, { key: 'starts', label: 'Titulaire', icon: '▶️' },
    { key: 'min', label: 'Minutes', icon: '⏱' }, { key: 'nineties', label: 'Équiv. 90 min', icon: '🔢' },
  ]},
  { title: 'Attaque', stats: [
    { key: 'gls', label: 'Buts', icon: '🥅' }, { key: 'ast', label: 'Passes D.', icon: '🅰️' },
    { key: 'g_a', label: 'B+PD', icon: '📊' }, { key: 'xg', label: 'xG', icon: '📈' },
    { key: 'xag', label: 'xAG', icon: '📉' }, { key: 'npxg', label: 'npxG', icon: '🎯' },
    { key: 'g_pk', label: 'Buts hors PK', icon: '⚡' },
  ]},
  { title: 'Défense', stats: [
    { key: 'tkl', label: 'Tacles', icon: '🦶' }, { key: 'tklw', label: 'Tacles gagnés', icon: '✅' },
    { key: 'blocks', label: 'Contres', icon: '🧱' }, { key: 'interceptions', label: 'Interceptions', icon: '🖐' },
    { key: 'clr', label: 'Dégagements', icon: '🧹' }, { key: 'err', label: 'Erreurs', icon: '❌' },
    { key: 'recov', label: 'Récupérations', icon: '🔄' },
  ]},
  { title: 'Possession', stats: [
    { key: 'touches', label: 'Touches', icon: '👆' }, { key: 'carries', label: 'Conduits', icon: '🏃' },
    { key: 'prgp', label: 'Passes prog.', icon: '↗️' }, { key: 'prgc', label: 'Conduits prog.', icon: '⬆️' },
    { key: 'prgr', label: 'Réceptions prog.', icon: '📥' }, { key: 'kp', label: 'Passes clés', icon: '🔑' },
    { key: 'cmp_pct', label: 'Passes réussies %', icon: '📐' },
  ]},
  { title: 'Discipline', stats: [
    { key: 'crdy', label: 'Cartons jaunes', icon: '🟨' }, { key: 'crdr', label: 'Cartons rouges', icon: '🟥' },
    { key: 'pkwon', label: 'PK obtenus', icon: '🎁' }, { key: 'pkcon', label: 'PK concédés', icon: '😤' },
  ]},
  { title: 'Gardien', stats: [
    { key: 'ga', label: 'Buts encaissés', icon: '😞' }, { key: 'saves', label: 'Arrêts', icon: '🧤' },
    { key: 'save_pct', label: '% Arrêts', icon: '📊' }, { key: 'cs', label: 'Clean sheets', icon: '🧼' },
    { key: 'pka', label: 'PK face', icon: '🎯' }, { key: 'pksv', label: 'PK arrêtés', icon: '🛡' },
  ]},
]

/* ══════════════════════ CHART CONFIG ══════════════════════ */
const PAL = [
  '#00d4aa', '#ff6b6b', '#4ecdc4', '#ffe66d', '#a29bfe',
  '#fd79a8', '#0984e3', '#6c5ce7', '#ffeaa7', '#55efc4',
  '#e17055', '#74b9ff', '#b2bec3', '#dfe6e9', '#fab1a0',
]

const cf = { family: "'JetBrains Mono', 'Fira Code', monospace", size: 10 }
const gc = 'rgba(255,255,255,0.03)'
const tc = '#64748b'

const tooltipStyle = {
  backgroundColor: '#0f172a',
  titleFont: { ...cf, size: 11 },
  bodyFont: cf,
  borderColor: '#1e293b',
  borderWidth: 1,
  padding: 12,
  cornerRadius: 8,
  displayColors: true,
}

const dOpts: any = {
  responsive: true, maintainAspectRatio: false, cutout: '62%',
  plugins: {
    legend: { position: 'bottom', labels: { color: '#94a3b8', font: cf, padding: 16, usePointStyle: true, pointStyleWidth: 10 } },
    tooltip: tooltipStyle,
  },
}

const radarOpts: any = {
  responsive: true, maintainAspectRatio: false,
  scales: { r: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.06)' }, angleLines: { color: 'rgba(255,255,255,0.06)' }, pointLabels: { color: '#94a3b8', font: cf }, ticks: { display: false } } },
  plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: cf, padding: 14 } }, tooltip: tooltipStyle },
}

function barO(axis: 'x' | 'y' = 'x'): any {
  return {
    indexAxis: axis, responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: tooltipStyle },
    scales: {
      x: { grid: { color: axis === 'y' ? gc : 'transparent' }, ticks: { color: tc, font: cf, maxRotation: 45 } },
      y: { grid: { color: axis === 'x' ? gc : 'transparent' }, ticks: { color: tc, font: cf } },
    },
  }
}

function scatterO(xl: string, yl: string): any {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { ...tooltipStyle, callbacks: { label: (c: any) => `${c.raw.label} — ${xl}: ${c.raw.x}, ${yl}: ${c.raw.y}` } } },
    scales: {
      x: { title: { display: true, text: xl, color: tc, font: cf }, grid: { color: gc }, ticks: { color: tc, font: cf } },
      y: { title: { display: true, text: yl, color: tc, font: cf }, grid: { color: gc }, ticks: { color: tc, font: cf } },
    },
  }
}

/* ══════════════════════ CHART DATA ══════════════════════ */
const posData = computed(() => {
  const l = Object.keys(playersByPos.value)
  return { labels: l, datasets: [{ data: Object.values(playersByPos.value), backgroundColor: l.map((_, i) => PAL[i % PAL.length]), borderWidth: 0, hoverOffset: 8 }] }
})

const compGoalsData = computed(() => ({
  labels: goalsByComp.value.map(c => c.comp),
  datasets: [{
    data: goalsByComp.value.map(c => c.gls),
    backgroundColor: goalsByComp.value.map((_, i) => PAL[i % PAL.length]),
    borderRadius: 6, borderSkipped: false, barThickness: 36,
  }]
}))

const clubsData = computed(() => ({
  labels: topClubs.value.map(c => c.squad),
  datasets: [{
    data: topClubs.value.map(c => c.count),
    backgroundColor: '#00d4aa',
    borderRadius: 6, borderSkipped: false, barThickness: 18,
  }]
}))

const xgScatter = computed(() => ({
  datasets: [{
    data: anScatterXG.value.map(p => ({ x: p.xg, y: p.gls, label: p.player })),
    backgroundColor: '#00d4aa88', pointRadius: 4.5, pointHoverRadius: 7,
    pointBorderColor: '#00d4aa', pointBorderWidth: 1,
  }]
}))

const defScatter = computed(() => ({
  datasets: [{
    data: anScatterDef.value.map(p => ({ x: p.tkl, y: p.interceptions, label: p.player })),
    backgroundColor: '#ff6b6b88', pointRadius: 4.5, pointHoverRadius: 7,
    pointBorderColor: '#ff6b6b', pointBorderWidth: 1,
  }]
}))

const astBarData = computed(() => ({
  labels: anTopAst.value.map(p => p.player),
  datasets: [{
    data: anTopAst.value.map(p => p.ast),
    backgroundColor: '#ffe66d', borderRadius: 5, borderSkipped: false, barThickness: 22,
  }]
}))

/* ══════════════════════ INIT ══════════════════════ */
const loaded = reactive<Record<string, boolean>>({})

onMounted(async () => {
  try {
    const [, filters] = await Promise.all([
      loadDashboard(),
      useFetch<{ comps: string[]; positions: string[] }>(`${API}/stats/filters`),
    ])
    comps.value = filters.comps
    positions.value = filters.positions
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Erreur de chargement'
  } finally {
    loading.value = false
  }
})

watch(activeTab, async (tab) => {
  if (loaded[tab]) return
  try {
    if (tab === 'classements') await loadRankings()
    else if (tab === 'analyse') await loadAnalysis()
    else if (tab === 'tableau') await loadTable()
    loaded[tab] = true
  } catch (e: unknown) { toast(e instanceof Error ? e.message : 'Erreur') }
})
</script>

<template>
<div class="dash">

  <!-- LOADING / ERROR -->
  <div v-if="loading" class="state">
    <div class="loader"></div>
    <p>Chargement des données football…</p>
  </div>
  <div v-else-if="error" class="state">
    <p class="err">⚠ {{ error }}</p>
  </div>

  <template v-else>

    <!-- ════════════ HEADER ════════════ -->
    <header class="header">
      <div class="header__left">
        <h1 class="title">
          <span class="title__icon">⚽</span>
          Analyse Football
          <span class="title__badge">{{ overview.totalPlayers.toLocaleString() }} joueurs</span>
        </h1>
        <p class="subtitle">Analyse complète des Big 5 ligues européennes · saison en cours</p>
      </div>
    </header>

    <!-- ════════════ TABS ════════════ -->
    <nav class="tabs">
      <button
        v-for="t in [
          { id: 'overview',     label: '◉ Vue d\'ensemble' },
          { id: 'comparateur',  label: '◆ Comparateur'     },
          { id: 'classements',  label: '◇ Classements'     },
          { id: 'analyse',      label: '▣ Analyse'         },
          { id: 'tableau',      label: '▤ Tableau'         },
        ]"
        :key="t.id"
        :class="['tab', { 'tab--active': activeTab === t.id }]"
        @click="activeTab = t.id as any"
      >{{ t.label }}</button>
    </nav>

    <!-- ═══════════════════════════════════════════════
         TAB: OVERVIEW
    ═══════════════════════════════════════════════ -->
    <div v-if="activeTab === 'overview'" class="content">

      <div class="kpi-grid">
        <div class="kpi"
          v-for="(k, i) in [
            { val: overview.totalPlayers.toLocaleString(), lbl: 'Joueurs', icon: '⬡', accent: '#00d4aa' },
            { val: overview.totalGoals.toLocaleString(),   lbl: 'Buts totaux', icon: '◈', accent: '#ff6b6b' },
            { val: overview.topScorer?.player || '—',      lbl: `Meilleur buteur · ${overview.topScorer?.gls ?? 0} buts`, icon: '★', accent: '#ffe66d', sm: true },
            { val: overview.bestLeague?.comp || '—',       lbl: `Meilleure ligue · ${overview.bestLeague?.totalGls ?? 0} buts`, icon: '◆', accent: '#4ecdc4', sm: true },
          ]"
          :key="i"
          :style="{ '--accent': k.accent, '--delay': i * 0.05 + 's' }"
        >
          <span class="kpi__icon">{{ k.icon }}</span>
          <span class="kpi__val" :class="{ 'kpi__val--sm': (k as any).sm }">{{ k.val }}</span>
          <span class="kpi__lbl">{{ k.lbl }}</span>
        </div>
      </div>

      <div class="grid-3">
        <div class="card">
          <h3 class="card__h">Répartition par poste</h3>
          <div class="chart-box chart-box--md">
            <Doughnut v-if="Object.keys(playersByPos).length" :data="posData" :options="dOpts" />
          </div>
        </div>
        <div class="card">
          <h3 class="card__h">Buts par ligue</h3>
          <div class="chart-box chart-box--md">
            <Bar v-if="goalsByComp.length" :data="compGoalsData" :options="barO('x')" />
          </div>
        </div>
        <div class="card">
          <h3 class="card__h">Top 10 clubs <span class="tag">Effectif</span></h3>
          <div class="chart-box chart-box--md">
            <Bar v-if="topClubs.length" :data="clubsData" :options="barO('y')" />
          </div>
        </div>
      </div>

      <div class="card">
        <h3 class="card__h">Top 5 nations <span class="tag">Joueurs</span></h3>
        <div class="nations-grid">
          <div
            v-for="n in topNations"
            :key="n.nation"
            class="nation-cell"
            :style="{ '--intensity': (n.count / (topNations[0]?.count || 1)) }"
          >
            <span class="nation-cell__code">{{ n.nation }}</span>
            <span class="nation-cell__count">{{ n.count.toLocaleString() }}</span>
            <span class="nation-cell__label">joueurs</span>
          </div>
        </div>
      </div>

    </div>

    <!-- ═══════════════════════════════════════════════
         TAB: COMPARATEUR
    ═══════════════════════════════════════════════ -->
    <div v-if="activeTab === 'comparateur'" class="content">

      <div class="cmp-search-row">
        <div v-for="n in ([1, 2] as (1|2)[])" :key="n" class="cmp-search-box" :class="n === 1 ? 'cmp-search-box--1' : 'cmp-search-box--2'">
          <div class="cmp-search-header">
            <div class="cmp-search-avatar" :class="n === 1 ? 'cmp-search-avatar--1' : 'cmp-search-avatar--2'">
              {{ n === 1 ? (cmpPlayer1?.player.split(' ').map((w:string) => w[0]).slice(0,2).join('') || n) : (cmpPlayer2?.player.split(' ').map((w:string) => w[0]).slice(0,2).join('') || n) }}
            </div>
            <div>
              <div class="cmp-search-name">{{ n === 1 ? (cmpPlayer1?.player || 'Joueur 1') : (cmpPlayer2?.player || 'Joueur 2') }}</div>
              <div class="cmp-search-meta">{{ n === 1 ? (cmpPlayer1 ? `${cmpPlayer1.squad} · ${cmpPlayer1.pos}` : 'Sélectionnez un joueur') : (cmpPlayer2 ? `${cmpPlayer2.squad} · ${cmpPlayer2.pos}` : 'Sélectionnez un joueur') }}</div>
            </div>
          </div>
          <div class="acwrap">
            <input
              :value="n === 1 ? cmpSearch1 : cmpSearch2"
              @input="(e: any) => { if(n===1) cmpSearch1=e.target.value; else cmpSearch2=e.target.value; onCmpSearch(n) }"
              class="cmp-input"
              :placeholder="`Rechercher joueur ${n}…`"
              @focus="n===1 ? cmpShow1=cmpResults1.length>0 : cmpShow2=cmpResults2.length>0"
              @blur="blurCmpSearch(n)"
            />
            <div v-if="(n===1?cmpShow1:cmpShow2)&&(n===1?cmpResults1:cmpResults2).length" class="acdrop">
              <button
                v-for="p in (n===1?cmpResults1:cmpResults2)"
                :key="p.id"
                class="acdrop__item"
                @mousedown.prevent="selectCmp(n, p)"
              >
                <span class="acdrop__name">{{ p.player }}</span>
                <span class="acdrop__meta">{{ p.squad }} · {{ p.pos }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <template v-if="cmpPlayer1 && cmpPlayer2">
        <div class="cmp-winner" v-if="cmpWinner">
          <span class="cmp-badge cmp-badge--1">{{ cmpPlayer1.player }} · {{ cmpWinner.w1 }} stats</span>
          <span class="cmp-vs">VS</span>
          <span class="cmp-badge cmp-badge--2">{{ cmpPlayer2.player }} · {{ cmpWinner.w2 }} stats</span>
        </div>

        <div class="grid-2">
          <div class="card">
            <h3 class="card__h">Radar comparatif</h3>
            <div class="chart-box chart-box--radar">
              <Radar v-if="radarData" :data="radarData" :options="radarOpts" />
            </div>
          </div>
          <div class="card">
            <h3 class="card__h">Statistiques détaillées</h3>
            <div class="cmp-bars">
              <div v-for="s in cmpStats" :key="s.key" class="cbar">
                <div class="cbar__row">
                  <span class="cbar__v"
                    :class="{ 'cbar__v--win1': (s.key==='crdy' ? (cmpPlayer1![s.key] as number)<(cmpPlayer2![s.key] as number) : (cmpPlayer1![s.key] as number)>(cmpPlayer2![s.key] as number)) }"
                  >{{ cmpPlayer1![s.key] }}</span>
                  <span class="cbar__label">{{ s.label }}</span>
                  <span class="cbar__v"
                    :class="{ 'cbar__v--win2': (s.key==='crdy' ? (cmpPlayer2![s.key] as number)<(cmpPlayer1![s.key] as number) : (cmpPlayer2![s.key] as number)>(cmpPlayer1![s.key] as number)) }"
                  >{{ cmpPlayer2![s.key] }}</span>
                </div>
                <div class="cbar__track">
                  <div class="cbar__fill cbar__fill--1" :style="{ width: `${Math.max(5, Math.round((cmpPlayer1![s.key] as number) / Math.max(cmpPlayer1![s.key] as number, cmpPlayer2![s.key] as number, 1) * 100))}%` }"></div>
                  <div class="cbar__fill cbar__fill--2" :style="{ width: `${Math.max(5, Math.round((cmpPlayer2![s.key] as number) / Math.max(cmpPlayer1![s.key] as number, cmpPlayer2![s.key] as number, 1) * 100))}%` }"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <div v-else class="empty-state">
        <div class="empty-state__icon">🔍</div>
        <p class="empty-state__text">Sélectionnez deux joueurs pour les comparer</p>
        <p class="empty-state__sub">Utilisez les champs de recherche ci-dessus</p>
      </div>

    </div>

    <!-- ═══════════════════════════════════════════════
         TAB: CLASSEMENTS
    ═══════════════════════════════════════════════ -->
    <div v-if="activeTab === 'classements'" class="content">

      <div class="rk-controls">
        <div class="rk-tabs-bar">
          <button
            v-for="t in rkTabs"
            :key="t.id"
            :class="['rk-tab', { 'rk-tab--active': rkTab === t.id }]"
            @click="rkTab = t.id"
          >{{ t.label }}</button>
        </div>
        <div class="rk-filters">
          <div class="filter-group">
            <label>Ligue</label>
            <select v-model="rkComp" class="filter-select" @change="loadRankings">
              <option value="">Toutes les ligues</option>
              <option v-for="c in comps" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
          <div class="filter-group">
            <label>Âge min</label>
            <input v-model.number="rkAgeMin" class="filter-input-num" type="number" placeholder="—" @change="loadRankings" />
          </div>
          <div class="filter-group">
            <label>Âge max</label>
            <input v-model.number="rkAgeMax" class="filter-input-num" type="number" placeholder="—" @change="loadRankings" />
          </div>
        </div>
      </div>

      <div v-if="rkLoading" class="state"><div class="loader"></div></div>
      <div v-else class="rk-list">
        <div
          v-for="(p, i) in rkPlayers"
          :key="p.id"
          class="rk-item"
          :class="{ 'rk-item--gold': i===0, 'rk-item--silver': i===1, 'rk-item--bronze': i===2 }"
          :style="{ '--d': i }"
          @click="openModal(p)"
        >
          <span class="rk-item__rank">
            <template v-if="i===0">🥇</template>
            <template v-else-if="i===1">🥈</template>
            <template v-else-if="i===2">🥉</template>
            <template v-else>{{ i + 1 }}</template>
          </span>
          <div class="rk-item__avatar">{{ p.player.split(' ').map((w:string) => w[0]).slice(0,2).join('').toUpperCase() }}</div>
          <div class="rk-item__info">
            <span class="rk-item__name">{{ p.player }}</span>
            <span class="rk-item__meta">{{ p.squad }} · {{ p.comp }}</span>
          </div>
          <div class="rk-item__bar-wrap">
            <div class="rk-item__bar" :style="{ width: `${Math.round((p[rkTabs.find(t=>t.id===rkTab)!.key] as number) / Math.max(rkPlayers[0]?.[rkTabs.find(t=>t.id===rkTab)!.key] as number, 1) * 100)}%` }"></div>
          </div>
          <span class="rk-item__val">{{ p[rkTabs.find(t=>t.id===rkTab)!.key] }} <span class="rk-item__unit">{{ rkTabs.find(t=>t.id===rkTab)!.unit }}</span></span>
        </div>
      </div>

    </div>

    <!-- ═══════════════════════════════════════════════
         TAB: ANALYSE
    ═══════════════════════════════════════════════ -->
    <div v-if="activeTab === 'analyse'" class="content">

      <section class="filters">
        <div class="filter-group">
          <label>Ligue</label>
          <select v-model="anComp" class="filter-select">
            <option value="">Toutes les ligues</option>
            <option v-for="c in comps" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Poste</label>
          <select v-model="anPos" class="filter-select">
            <option value="">Tous les postes</option>
            <option v-for="p in positions" :key="p" :value="p">{{ p }}</option>
          </select>
        </div>
        <button class="filter-reset" @click="anComp=''; anPos=''">✕ Réinitialiser</button>
      </section>

      <div v-if="anLoading" class="state"><div class="loader"></div></div>
      <div v-else>
        <div class="grid-2">
          <div class="card">
            <h3 class="card__h">xG vs Buts réels <span class="tag">Attaquants</span></h3>
            <div class="chart-box chart-box--tall">
              <Scatter v-if="anScatterXG.length" :data="xgScatter" :options="scatterO('xG', 'Buts')" />
            </div>
          </div>
          <div class="card">
            <h3 class="card__h">Tacles vs Interceptions <span class="tag">Défenseurs</span></h3>
            <div class="chart-box chart-box--tall">
              <Scatter v-if="anScatterDef.length" :data="defScatter" :options="scatterO('Tacles', 'Interceptions')" />
            </div>
          </div>
        </div>
        <div class="card">
          <h3 class="card__h">Top 15 passeurs décisifs</h3>
          <div class="chart-box chart-box--lg">
            <Bar v-if="anTopAst.length" :data="astBarData" :options="barO('y')" />
          </div>
        </div>
      </div>

    </div>

    <!-- ═══════════════════════════════════════════════
         TAB: TABLEAU
    ═══════════════════════════════════════════════ -->
    <div v-if="activeTab === 'tableau'" class="content">

      <section class="filters">
        <div class="filter-group filter-group--grow">
          <label>Recherche</label>
          <input v-model="tblSearch" class="filter-text" placeholder="Joueur, club…" @input="onTblSearch" />
        </div>
        <div class="filter-group">
          <label>Ligue</label>
          <select v-model="tblComp" class="filter-select" @change="onTblFilter">
            <option value="">Toutes</option>
            <option v-for="c in comps" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Poste</label>
          <select v-model="tblPos" class="filter-select" @change="onTblFilter">
            <option value="">Tous</option>
            <option v-for="p in positions" :key="p" :value="p">{{ p }}</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Âge min</label>
          <input v-model.number="tblAgeMin" class="filter-num" type="number" @change="onTblFilter" />
        </div>
        <div class="filter-group">
          <label>Âge max</label>
          <input v-model.number="tblAgeMax" class="filter-num" type="number" @change="onTblFilter" />
        </div>
        <button class="filter-export" @click="exportCSV">📥 CSV</button>
      </section>

      <div v-if="tblLoading" class="state"><div class="loader"></div></div>
      <div v-else>
        <div class="table-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th
                  v-for="c in tblCols"
                  :key="c.key"
                  :class="{ 'tbl__th--on': tblSort === c.key }"
                  @click="tblSortBy(c.key)"
                >
                  {{ c.label }}
                  <span v-if="tblSort === c.key" class="sort-arrow">{{ tblOrder === 'asc' ? '▲' : '▼' }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in tblPlayers" :key="p.id" class="tbl__row" @click="openModal(p)">
                <td class="tbl__name">{{ p.player }}</td>
                <td><span class="pos-badge">{{ p.pos }}</span></td>
                <td>{{ p.squad }}</td>
                <td>{{ p.comp }}</td>
                <td>{{ p.age }}</td>
                <td>{{ p.mp }}</td>
                <td class="tbl__hl">{{ p.gls }}</td>
                <td>{{ p.ast }}</td>
                <td>{{ p.g_a }}</td>
                <td>{{ p.xg }}</td>
                <td>{{ p.tkl }}</td>
                <td>{{ p.interceptions }}</td>
                <td>{{ p.crdy }}</td>
              </tr>
              <tr v-if="!tblPlayers.length">
                <td :colspan="tblCols.length" class="tbl__empty">Aucun résultat</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="pagination" v-if="tblMeta.pages > 1">
          <button class="pg-btn" :disabled="tblMeta.page <= 1" @click="tblGoPage(tblMeta.page - 1)">‹</button>
          <template v-for="pn in tblPages" :key="pn">
            <span v-if="pn === '...'" class="pg-dots">…</span>
            <button v-else class="pg-btn" :class="{ 'pg-btn--on': pn === tblMeta.page }" @click="tblGoPage(pn as number)">{{ pn }}</button>
          </template>
          <button class="pg-btn" :disabled="tblMeta.page >= tblMeta.pages" @click="tblGoPage(tblMeta.page + 1)">›</button>
          <span class="pg-info">{{ tblMeta.total.toLocaleString() }} joueurs</span>
        </div>
      </div>

    </div>

  </template>

  <!-- ════════════ MODAL ════════════ -->
  <Teleport to="body">
    <div v-if="showModal && modalPlayer" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <button class="modal__close" @click="closeModal">✕</button>
        <div class="modal__head">
          <div class="modal__avatar">
            {{ modalPlayer.player.split(' ').map((w:string) => w[0]).slice(0,2).join('').toUpperCase() }}
          </div>
          <div>
            <h2 class="modal__name">{{ modalPlayer.player }}</h2>
            <p class="modal__sub">{{ modalPlayer.squad }} · {{ modalPlayer.pos }} · {{ modalPlayer.comp }}</p>
          </div>
        </div>
        <div class="modal__body">
          <div v-for="sec in modalSections" :key="sec.title" class="modal__sec">
            <h4 class="modal__sec-title">{{ sec.title }}</h4>
            <div class="modal__grid">
              <div v-for="s in sec.stats" :key="s.key" class="modal__stat">
                <span class="modal__stat-ico">{{ s.icon }}</span>
                <span class="modal__stat-lbl">{{ s.label }}</span>
                <span class="modal__stat-val">{{ (modalPlayer as any)[s.key] ?? '—' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- TOAST -->
  <Transition name="toast">
    <div v-if="toastMsg" class="toast">{{ toastMsg }}</div>
  </Transition>

</div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');

*,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }

.dash {
  --bg:       #0a0e17;
  --surface:  #111827;
  --surface2: #1a2332;
  --border:   #1e293b;
  --border2:  #334155;
  --text:     #e2e8f0;
  --text2:    #94a3b8;
  --text3:    #64748b;
  --accent:   #00d4aa;
  --coral:    #ff6b6b;
  --yellow:   #ffe66d;
  --blue:     #4ecdc4;
  --purple:   #a29bfe;
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  font-family: 'Space Grotesk', system-ui, sans-serif;
  padding: 28px 32px 60px;
  overflow-x: hidden;
}

/* ══════════ LOADING ══════════ */
.state {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  min-height: 40vh; gap: 16px; color: var(--text2);
}
.loader {
  width: 40px; height: 40px;
  border: 3px solid var(--border); border-top-color: var(--accent);
  border-radius: 50%; animation: spin .8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.err { color: var(--coral); font-weight: 600; }

/* ══════════ HEADER ══════════ */
.header { margin-bottom: 28px; }
.title {
  font-size: 28px; font-weight: 700; letter-spacing: -0.5px;
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
}
.title__icon { font-size: 24px; }
.title__badge {
  font-size: 11px; font-weight: 500;
  font-family: 'JetBrains Mono', monospace;
  background: rgba(0, 212, 170, 0.1);
  color: var(--accent); padding: 4px 12px;
  border-radius: 20px; border: 1px solid rgba(0, 212, 170, 0.2);
}
.subtitle { font-size: 13px; color: var(--text2); margin-top: 6px; }

/* ══════════ TABS ══════════ */
.tabs {
  display: flex; gap: 4px; margin-bottom: 28px;
  overflow-x: auto; padding-bottom: 4px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0;
}
.tab {
  background: transparent; border: none;
  border-bottom: 2px solid transparent;
  color: var(--text2); padding: 12px 20px;
  font-size: 13px; font-family: 'Space Grotesk', sans-serif;
  font-weight: 500; cursor: pointer; white-space: nowrap;
  transition: all 0.2s; margin-bottom: -1px;
}
.tab:hover { color: var(--text); background: rgba(255,255,255,0.03); }
.tab--active {
  color: var(--accent);
  border-bottom-color: var(--accent);
  background: transparent;
}

/* ══════════ CONTENT ══════════ */
.content { animation: fadeUp .3s ease-out both; }
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ══════════ KPI GRID ══════════ */
.kpi-grid {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 14px; margin-bottom: 24px;
}
.kpi {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 12px; padding: 20px 18px;
  display: flex; flex-direction: column; gap: 6px;
  position: relative; overflow: hidden;
  animation: fadeUp .4s ease both;
  animation-delay: var(--delay, 0s);
  transition: border-color .25s, box-shadow .25s;
}
.kpi::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0;
  height: 2px; background: var(--accent); opacity: 0.7;
}
.kpi:hover { border-color: var(--accent); box-shadow: 0 0 24px rgba(0,212,170,.06); }
.kpi__icon { font-size: 18px; color: var(--accent); opacity: .8; }
.kpi__val {
  font-size: 24px; font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
  letter-spacing: -0.5px; color: #fff; line-height: 1.1;
}
.kpi__val--sm { font-size: 15px; font-family: 'Space Grotesk', sans-serif; letter-spacing: 0; }
.kpi__lbl { font-size: 11px; color: var(--text2); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 500; }

/* ══════════ GRIDS ══════════ */
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
.grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 16px; }

/* ══════════ CARDS ══════════ */
.card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 12px; padding: 20px; margin-bottom: 16px;
  transition: border-color .25s, box-shadow .25s;
}
.card:hover { border-color: var(--border2); box-shadow: 0 4px 24px rgba(0,0,0,.12); }
.card__h {
  font-size: 13px; font-weight: 600; color: var(--text);
  margin-bottom: 16px; display: flex; align-items: center; gap: 8px;
}
.tag {
  font-size: 10px; font-weight: 500;
  font-family: 'JetBrains Mono', monospace;
  background: rgba(0,212,170,.1); color: var(--accent);
  padding: 2px 8px; border-radius: 12px;
}

/* ══════════ CHART BOXES ══════════ */
.chart-box        { position: relative; width: 100%; height: 280px; }
.chart-box--md    { height: 300px; }
.chart-box--tall  { height: 360px; }
.chart-box--lg    { height: 420px; }
.chart-box--radar { height: 340px; }

/* ══════════ NATIONS GRID ══════════ */
.nations-grid { display: flex; gap: 12px; flex-wrap: wrap; }
.nation-cell {
  flex: 1; min-width: 140px; padding: 20px 16px;
  border-radius: 10px; text-align: center;
  background: rgba(0, 212, 170, calc(var(--intensity) * 0.2 + 0.04));
  border: 1px solid rgba(0, 212, 170, calc(var(--intensity) * 0.25 + 0.05));
  transition: transform .2s;
}
.nation-cell:hover { transform: scale(1.04); }
.nation-cell__code {
  display: block; font-size: 13px; font-weight: 600;
  font-family: 'JetBrains Mono', monospace;
  color: var(--text); margin-bottom: 6px;
}
.nation-cell__count {
  display: block; font-size: 28px; font-weight: 700;
  color: var(--accent); font-family: 'JetBrains Mono', monospace;
  line-height: 1;
}
.nation-cell__label { display: block; font-size: 11px; color: var(--text2); margin-top: 4px; }

/* ══════════ FILTERS ══════════ */
.filters {
  display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end;
  margin-bottom: 20px; padding: 16px 20px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 12px;
}
.filter-group {
  display: flex; flex-direction: column; gap: 5px;
}
.filter-group--grow { flex: 1; }
.filter-group label {
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 1px; color: var(--text2);
  font-family: 'JetBrains Mono', monospace;
}
.filter-select, .filter-text, .filter-num, .filter-input-num {
  background: var(--surface2); border: 1px solid var(--border);
  border-radius: 8px; color: var(--text); padding: 8px 12px;
  font-size: 13px; font-family: 'Space Grotesk', sans-serif;
  outline: none; transition: border-color .2s;
}
.filter-select { cursor: pointer; min-width: 150px; }
.filter-select:hover, .filter-text:focus, .filter-num:focus { border-color: var(--accent); }
.filter-num, .filter-input-num { width: 90px; }
.filter-reset {
  background: rgba(255,107,107,.1); border: 1px solid rgba(255,107,107,.2);
  border-radius: 8px; color: var(--coral); padding: 8px 16px;
  font-size: 12px; font-family: 'JetBrains Mono', monospace;
  cursor: pointer; align-self: flex-end; transition: background .2s;
}
.filter-reset:hover { background: rgba(255,107,107,.2); }
.filter-export {
  background: rgba(0,212,170,.1); border: 1px solid rgba(0,212,170,.2);
  border-radius: 8px; color: var(--accent); padding: 8px 16px;
  font-size: 12px; font-family: 'JetBrains Mono', monospace;
  cursor: pointer; align-self: flex-end; transition: background .2s;
}
.filter-export:hover { background: rgba(0,212,170,.2); }

/* ══════════ COMPARATOR ══════════ */
.cmp-search-row {
  display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;
}
.cmp-search-box {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 12px; padding: 20px;
}
.cmp-search-box--1 { border-top: 3px solid var(--accent); }
.cmp-search-box--2 { border-top: 3px solid var(--coral); }
.cmp-search-header {
  display: flex; align-items: center; gap: 12px; margin-bottom: 14px;
}
.cmp-search-avatar {
  width: 44px; height: 44px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 15px; color: #fff; flex-shrink: 0;
}
.cmp-search-avatar--1 { background: linear-gradient(135deg, var(--accent), var(--blue)); }
.cmp-search-avatar--2 { background: linear-gradient(135deg, var(--coral), var(--purple)); }
.cmp-search-name { font-weight: 600; font-size: 15px; color: #fff; }
.cmp-search-meta { font-size: 12px; color: var(--text2); margin-top: 2px; font-family: 'JetBrains Mono', monospace; }

.acwrap { position: relative; }
.cmp-input {
  width: 100%; padding: 10px 14px;
  background: var(--surface2); border: 1px solid var(--border);
  border-radius: 8px; color: var(--text);
  font-family: 'Space Grotesk', sans-serif; font-size: 13px;
  outline: none; transition: border-color .2s;
}
.cmp-input:focus { border-color: var(--accent); }
.cmp-input::placeholder { color: var(--text3); }
.acdrop {
  position: absolute; top: 100%; left: 0; right: 0; margin-top: 4px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 8px; overflow: hidden; z-index: 40;
  box-shadow: 0 12px 32px rgba(0,0,0,.5);
}
.acdrop__item {
  display: flex; justify-content: space-between; align-items: center;
  width: 100%; padding: 10px 14px; border: none;
  background: transparent; color: var(--text);
  font-family: 'Space Grotesk', sans-serif; font-size: 13px;
  cursor: pointer; text-align: left; transition: background .15s;
}
.acdrop__item:hover { background: rgba(0,212,170,.08); }
.acdrop__name { font-weight: 600; }
.acdrop__meta { font-size: 11px; color: var(--text2); font-family: 'JetBrains Mono', monospace; }

.cmp-winner {
  display: flex; align-items: center; justify-content: center;
  gap: 16px; margin-bottom: 20px; flex-wrap: wrap;
}
.cmp-badge {
  padding: 8px 20px; border-radius: 100px;
  font-size: 13px; font-weight: 700; font-family: 'JetBrains Mono', monospace;
}
.cmp-badge--1 { background: rgba(0,212,170,.12); border: 1px solid rgba(0,212,170,.25); color: var(--accent); }
.cmp-badge--2 { background: rgba(255,107,107,.12); border: 1px solid rgba(255,107,107,.25); color: var(--coral); }
.cmp-vs { font-size: 11px; font-weight: 700; color: var(--text3); letter-spacing: 2px; }

.cmp-bars { display: flex; flex-direction: column; gap: 10px; max-height: 400px; overflow-y: auto; padding-right: 6px; }
.cbar__row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.cbar__label { font-size: 11px; color: var(--text2); font-weight: 600; text-transform: uppercase; letter-spacing: .04em; font-family: 'JetBrains Mono', monospace; }
.cbar__v { font-size: 13px; font-weight: 700; color: var(--text2); min-width: 40px; text-align: center; font-family: 'JetBrains Mono', monospace; }
.cbar__v--win1 { color: var(--accent); }
.cbar__v--win2 { color: var(--coral); }
.cbar__track { display: flex; gap: 3px; height: 5px; border-radius: 3px; overflow: hidden; background: rgba(255,255,255,.03); }
.cbar__fill { height: 100%; border-radius: 3px; transition: width .5s ease-out; }
.cbar__fill--1 { background: var(--accent); }
.cbar__fill--2 { background: var(--coral); }

/* ══════════ EMPTY STATE ══════════ */
.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-height: 300px; gap: 12px;
}
.empty-state__icon { font-size: 48px; }
.empty-state__text { font-size: 16px; font-weight: 600; color: var(--text); }
.empty-state__sub { font-size: 13px; color: var(--text2); }

/* ══════════ RANKINGS ══════════ */
.rk-controls { display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; }
.rk-tabs-bar { display: flex; gap: 6px; flex-wrap: wrap; }
.rk-tab {
  padding: 9px 18px; border: 1px solid var(--border);
  border-radius: 100px; background: transparent;
  color: var(--text2); font-family: 'Space Grotesk', sans-serif;
  font-size: 13px; font-weight: 500; cursor: pointer;
  transition: all .2s; white-space: nowrap;
}
.rk-tab:hover { color: var(--text); background: var(--surface2); }
.rk-tab--active { background: rgba(0,212,170,.1); border-color: rgba(0,212,170,.3); color: var(--accent); }
.rk-filters { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; }

.rk-list { display: flex; flex-direction: column; gap: 6px; }
.rk-item {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 18px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 10px; cursor: pointer;
  animation: fadeUp .35s ease-out both;
  animation-delay: calc(var(--d, 0) * .04s);
  transition: all .2s;
}
.rk-item:hover { border-color: var(--border2); background: var(--surface2); }
.rk-item--gold   { border-color: rgba(255,230,109,.25); background: rgba(255,230,109,.04); }
.rk-item--silver { border-color: rgba(148,163,184,.25); background: rgba(148,163,184,.04); }
.rk-item--bronze { border-color: rgba(255,107,107,.2);  background: rgba(255,107,107,.04); }
.rk-item__rank {
  font-size: 18px; width: 38px; text-align: center;
  font-weight: 700; color: var(--text2); flex-shrink: 0;
}
.rk-item--gold .rk-item__rank,
.rk-item--silver .rk-item__rank,
.rk-item--bronze .rk-item__rank { font-size: 22px; }
.rk-item__avatar {
  width: 38px; height: 38px; border-radius: 10px;
  background: rgba(0,212,170,.15);
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 12px; color: var(--accent);
  flex-shrink: 0; font-family: 'JetBrains Mono', monospace;
}
.rk-item__info { flex: 1; min-width: 0; }
.rk-item__name { display: block; font-weight: 600; font-size: 14px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rk-item__meta { font-size: 11px; color: var(--text2); font-family: 'JetBrains Mono', monospace; }
.rk-item__bar-wrap { width: 140px; height: 4px; background: rgba(255,255,255,.04); border-radius: 2px; overflow: hidden; flex-shrink: 0; }
.rk-item__bar { height: 100%; background: var(--accent); border-radius: 2px; transition: width .6s ease-out; }
.rk-item__val {
  font-size: 15px; font-weight: 700; color: var(--accent);
  min-width: 80px; text-align: right; white-space: nowrap;
  font-family: 'JetBrains Mono', monospace;
}
.rk-item__unit { font-size: 11px; font-weight: 400; color: var(--text2); }

/* ══════════ TABLE ══════════ */
.table-wrap {
  overflow-x: auto; border: 1px solid var(--border);
  border-radius: 12px; margin-bottom: 14px;
  scrollbar-width: thin; scrollbar-color: var(--border) transparent;
}
.tbl { width: 100%; border-collapse: collapse; font-size: 13px; white-space: nowrap; }
.tbl th {
  position: sticky; top: 0; background: var(--surface2);
  padding: 11px 14px; text-align: left;
  font-size: 10px; font-weight: 600; text-transform: uppercase;
  letter-spacing: .08em; color: var(--text2);
  font-family: 'JetBrains Mono', monospace;
  border-bottom: 1px solid var(--border);
  cursor: pointer; user-select: none; transition: color .2s;
}
.tbl th:hover { color: var(--text); }
.tbl__th--on { color: var(--accent) !important; }
.sort-arrow { font-size: 9px; margin-left: 4px; color: var(--accent); }
.tbl__row { transition: background .15s; cursor: pointer; }
.tbl__row:hover { background: rgba(0,212,170,.03); }
.tbl td {
  padding: 10px 14px; border-bottom: 1px solid rgba(30,41,59,.6);
  font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--text);
}
.tbl__name {
  font-weight: 600; color: #fff; font-family: 'Space Grotesk', sans-serif;
  font-size: 13px; position: sticky; left: 0;
  background: var(--surface); z-index: 2;
}
.tbl__row:hover .tbl__name { background: rgba(0,212,170,.03); }
.tbl__hl { color: var(--accent); font-weight: 700; }
.tbl__empty { padding: 36px; text-align: center; color: var(--text2); }
.pos-badge {
  display: inline-block; padding: 2px 8px;
  border-radius: 4px; font-size: 11px; font-weight: 600;
  background: rgba(0,212,170,.1); color: var(--accent);
  font-family: 'JetBrains Mono', monospace;
}

/* ══════════ PAGINATION ══════════ */
.pagination {
  display: flex; align-items: center; gap: 4px;
  justify-content: center; flex-wrap: wrap;
}
.pg-btn {
  min-width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 8px; color: var(--text2);
  font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 500;
  cursor: pointer; transition: all .2s;
}
.pg-btn:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.pg-btn--on { background: var(--accent); border-color: var(--accent); color: #0a0e17; font-weight: 700; }
.pg-btn:disabled { opacity: .3; cursor: not-allowed; }
.pg-dots { color: var(--text2); padding: 0 4px; }
.pg-info { margin-left: 10px; font-size: 12px; color: var(--text2); font-family: 'JetBrains Mono', monospace; }

/* ══════════ MODAL ══════════ */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.7); backdrop-filter: blur(8px);
  z-index: 200; display: flex; align-items: center; justify-content: center;
  padding: 20px; animation: fadeIn .2s ease-out;
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.modal {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 16px; width: 100%; max-width: 660px; max-height: 88vh;
  overflow-y: auto; animation: modalUp .25s ease-out;
  scrollbar-width: thin; scrollbar-color: var(--border) transparent;
}
@keyframes modalUp {
  from { opacity: 0; transform: translateY(20px) scale(.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.modal__close {
  position: sticky; top: 0; float: right; margin: 16px 16px 0 0;
  background: var(--surface2); border: 1px solid var(--border);
  border-radius: 50%; width: 34px; height: 34px;
  display: flex; align-items: center; justify-content: center;
  color: var(--text2); cursor: pointer; font-size: 14px;
  z-index: 2; transition: all .2s;
}
.modal__close:hover { background: var(--border); color: #fff; }
.modal__head { display: flex; align-items: center; gap: 16px; padding: 24px 28px 20px; }
.modal__avatar {
  width: 56px; height: 56px; border-radius: 14px;
  background: linear-gradient(135deg, var(--accent), var(--blue));
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 18px; color: #fff; flex-shrink: 0;
}
.modal__name { font-size: 20px; font-weight: 700; color: #fff; }
.modal__sub { font-size: 13px; color: var(--text2); margin-top: 3px; font-family: 'JetBrains Mono', monospace; }
.modal__body { padding: 0 28px 28px; }
.modal__sec { margin-bottom: 20px; }
.modal__sec-title {
  font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em;
  color: var(--text2); font-family: 'JetBrains Mono', monospace;
  margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid var(--border);
}
.modal__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 8px; }
.modal__stat {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px; background: var(--surface2);
  border-radius: 8px; border: 1px solid var(--border);
  transition: border-color .2s;
}
.modal__stat:hover { border-color: var(--border2); }
.modal__stat-ico { font-size: 14px; flex-shrink: 0; }
.modal__stat-lbl { font-size: 11px; color: var(--text2); flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.modal__stat-val { font-size: 13px; font-weight: 700; color: #fff; flex-shrink: 0; font-family: 'JetBrains Mono', monospace; }

/* ══════════ TOAST ══════════ */
.toast {
  position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
  background: var(--surface); border: 1px solid var(--accent);
  border-radius: 8px; padding: 10px 22px;
  font-size: 13px; color: var(--text); z-index: 300;
  box-shadow: 0 8px 24px rgba(0,0,0,.4), 0 0 16px rgba(0,212,170,.1);
}
.toast-enter-active, .toast-leave-active { transition: all .3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(12px); }

/* ══════════ RESPONSIVE ══════════ */
@media (max-width: 1100px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
  .grid-3 { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 760px) {
  .dash { padding: 16px; }
  .kpi-grid { grid-template-columns: 1fr 1fr; }
  .grid-2, .grid-3 { grid-template-columns: 1fr; }
  .cmp-search-row { grid-template-columns: 1fr; }
  .rk-controls { flex-direction: column; align-items: stretch; }
  .rk-item__bar-wrap { display: none; }
  .tabs { gap: 0; }
  .tab { padding: 10px 14px; font-size: 12px; }
}
@media (max-width: 480px) {
  .kpi-grid { grid-template-columns: 1fr; }
  .title { font-size: 20px; }
  .filters { flex-direction: column; }
  .filter-select { min-width: 100%; }
}
</style>
