<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import {
  Chart as ChartJS, ArcElement, BarElement, PointElement, LineElement,
  CategoryScale, LinearScale, RadialLinearScale, Tooltip, Legend, Filler,
} from 'chart.js'
import { Bar, Doughnut, Scatter, Radar } from 'vue-chartjs'
import CarsAnalysis from './components/CarsAnalysis.vue'

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

/* ══════════════════════ COMPOSABLE ══════════════════════ */
const API = 'http://localhost:3000'

async function useFetch<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

/* ══════════════════════ GLOBAL STATE ══════════════════════ */
const page = ref<string>('dashboard')
const sidebarOpen = ref<boolean>(false)
const globalSearch = ref<string>('')
const globalSearchResults = ref<Player[]>([])
const globalSearchShow = ref<boolean>(false)
const loading = ref<boolean>(true)
const fatalError = ref<string | null>(null)
const toastMsg = ref<string | null>(null)

function toast(msg: string) { toastMsg.value = msg; setTimeout(() => toastMsg.value = null, 3500) }

const pages = [
  { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
  { id: 'compare', label: 'Comparateur', icon: 'users' },
  { id: 'rankings', label: 'Classements', icon: 'trophy' },
  { id: 'analysis', label: 'Analyse', icon: 'chart' },
  { id: 'table', label: 'Tableau', icon: 'list' },
  { id: 'cars', label: 'Voitures', icon: 'car' },
] as const

const tabLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  compare: 'Comparateur',
  rankings: 'Classements',
  analysis: 'Analyse',
  table: 'Tableau',
  cars: '🚗 Voitures',
}

function nav(p: string) { page.value = p; sidebarOpen.value = false }

let gsTimeout: ReturnType<typeof setTimeout>
function onGlobalSearch() {
  clearTimeout(gsTimeout)
  if (!globalSearch.value.trim()) { globalSearchResults.value = []; globalSearchShow.value = false; return }
  gsTimeout = setTimeout(async () => {
    try {
      globalSearchResults.value = await useFetch<Player[]>(`${API}/players?search=${encodeURIComponent(globalSearch.value)}&limit=8`)
      globalSearchShow.value = true
    } catch { globalSearchResults.value = [] }
  }, 250)
}
function selectGlobalPlayer(p: Player) {
  globalSearch.value = ''; globalSearchShow.value = false
  modalPlayer.value = p; showModal.value = true
}
function blurGlobalSearch() { window.setTimeout(() => { globalSearchShow.value = false }, 200) }
function blurCmpSearch(n: 1 | 2) { window.setTimeout(() => { if (n === 1) cmpShow1.value = false; else cmpShow2.value = false }, 200) }

/* ══════════════════════ DASHBOARD ══════════════════════ */
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

const radarLabels = ['Buts', 'Passes D.', 'xG', 'Tackles', 'Intercept.', 'Prog. Passes']
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
  { label: 'xAG', key: 'xag' }, { label: 'Tackles', key: 'tkl' },
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
  { id: 'scorers', label: 'Buteurs', sort: 'gls', key: 'gls' as keyof Player, unit: 'buts' },
  { id: 'assisters', label: 'Passeurs', sort: 'ast', key: 'ast' as keyof Player, unit: 'PD' },
  { id: 'defenders', label: 'Défenseurs', sort: 'tkl', key: 'tkl' as keyof Player, unit: 'tkl' },
  { id: 'gk', label: 'Gardiens', sort: 'saves', key: 'saves' as keyof Player, unit: 'arrêts' },
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
  catch (e: unknown) { toast('Erreur chargement classement') }
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
    { key: 'min', label: 'Minutes', icon: '⏱' }, { key: 'nineties', label: '90 min equiv.', icon: '🔢' },
  ]},
  { title: 'Attaque', stats: [
    { key: 'gls', label: 'Buts', icon: '🥅' }, { key: 'ast', label: 'Passes D.', icon: '🅰️' },
    { key: 'g_a', label: 'B+PD', icon: '📊' }, { key: 'xg', label: 'xG', icon: '📈' },
    { key: 'xag', label: 'xAG', icon: '📉' }, { key: 'npxg', label: 'npxG', icon: '🎯' },
    { key: 'g_pk', label: 'Buts hors PK', icon: '⚡' },
  ]},
  { title: 'Défense', stats: [
    { key: 'tkl', label: 'Tackles', icon: '🦶' }, { key: 'tklw', label: 'Tkl gagnés', icon: '✅' },
    { key: 'blocks', label: 'Blocks', icon: '🧱' }, { key: 'interceptions', label: 'Interceptions', icon: '🖐' },
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

/* ══════════════════════ FILTERS ══════════════════════ */
const comps = ref<string[]>([]); const positions = ref<string[]>([])

/* ══════════════════════ CHART OPTIONS — NEW THEME ══════════════════════ */
const cf = { family: "'JetBrains Mono', 'Fira Code', monospace", size: 10 }
const gc = 'rgba(255,255,255,0.03)'
const tc = '#64748b'

const ttip = {
  backgroundColor: '#0f172a',
  titleFont: { ...cf, size: 11 },
  bodyFont: cf,
  borderColor: '#1e293b',
  borderWidth: 1,
  padding: 12,
  cornerRadius: 8,
  displayColors: true,
}

function barO(axis: 'x' | 'y' = 'x'): any {
  return {
    indexAxis: axis, responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: ttip },
    scales: {
      x: { grid: { color: axis === 'y' ? gc : 'transparent' }, ticks: { color: tc, font: cf, maxRotation: 45 } },
      y: { grid: { color: axis === 'x' ? gc : 'transparent' }, ticks: { color: tc, font: cf } },
    },
  }
}
function scatterO(xl: string, yl: string): any {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { ...ttip, callbacks: { label: (c: any) => `${c.raw.label} — ${xl}: ${c.raw.x}, ${yl}: ${c.raw.y}` } } },
    scales: {
      x: { title: { display: true, text: xl, color: tc, font: cf }, grid: { color: gc }, ticks: { color: tc, font: cf } },
      y: { title: { display: true, text: yl, color: tc, font: cf }, grid: { color: gc }, ticks: { color: tc, font: cf } },
    },
  }
}
const dOpts: any = {
  responsive: true, maintainAspectRatio: false, cutout: '62%',
  plugins: {
    legend: { position: 'bottom', labels: { color: '#94a3b8', font: cf, padding: 16, usePointStyle: true, pointStyleWidth: 10 } },
    tooltip: ttip,
  },
}
const radarOpts: any = {
  responsive: true, maintainAspectRatio: false,
  scales: { r: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.06)' }, angleLines: { color: 'rgba(255,255,255,0.06)' }, pointLabels: { color: '#94a3b8', font: cf }, ticks: { display: false } } },
  plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: cf, padding: 14 } }, tooltip: ttip },
}

const CC = ['#00d4aa','#ff6b6b','#4ecdc4','#ffe66d','#a29bfe','#fd79a8','#0984e3','#6c5ce7','#ffeaa7','#55efc4','#e17055','#74b9ff','#fab1a0','#81ecec','#fdcb6e']

const posData = computed(() => { const l = Object.keys(playersByPos.value); return { labels: l, datasets: [{ data: Object.values(playersByPos.value), backgroundColor: l.map((_, i) => CC[i % CC.length]), borderWidth: 0 }] } })
const compGoalsData = computed(() => ({ labels: goalsByComp.value.map(c => c.comp), datasets: [{ data: goalsByComp.value.map(c => c.gls), backgroundColor: goalsByComp.value.map((_, i) => CC[i % CC.length]), borderRadius: 6, borderSkipped: false }] }))
const clubsData = computed(() => ({ labels: topClubs.value.map(c => c.squad), datasets: [{ data: topClubs.value.map(c => c.count), backgroundColor: '#00d4aa', borderRadius: 6, borderSkipped: false }] }))

const xgScatter = computed(() => ({ datasets: [{ data: anScatterXG.value.map(p => ({ x: p.xg, y: p.gls, label: p.player })), backgroundColor: '#00d4aa88', pointRadius: 4.5, pointHoverRadius: 7, pointBorderColor: '#00d4aa', pointBorderWidth: 1 }] }))
const defScatter = computed(() => ({ datasets: [{ data: anScatterDef.value.map(p => ({ x: p.tkl, y: p.interceptions, label: p.player })), backgroundColor: '#ff6b6b88', pointRadius: 4.5, pointHoverRadius: 7, pointBorderColor: '#ff6b6b', pointBorderWidth: 1 }] }))
const astBarData = computed(() => ({ labels: anTopAst.value.map(p => p.player), datasets: [{ data: anTopAst.value.map(p => p.ast), backgroundColor: '#ffe66d', borderRadius: 5, borderSkipped: false }] }))

/* ══════════════════════ INIT ══════════════════════ */
onMounted(async () => {
  try {
    const [, filters] = await Promise.all([loadDashboard(), useFetch<{ comps: string[]; positions: string[] }>(`${API}/stats/filters`)])
    comps.value = filters.comps; positions.value = filters.positions
  } catch (e: unknown) { fatalError.value = e instanceof Error ? e.message : 'Erreur' }
  finally { loading.value = false }
})

const loaded = reactive<Record<string, boolean>>({ dashboard: true })
watch(page, async (p) => {
  if (loaded[p]) return
  try {
    if (p === 'rankings') await loadRankings()
    else if (p === 'analysis') await loadAnalysis()
    else if (p === 'table') await loadTable()
    loaded[p] = true
  } catch (e: unknown) { toast(e instanceof Error ? e.message : 'Erreur') }
})
</script>

<template>
<div class="shell" :class="{ 'shell--sidebar-open': sidebarOpen }">

  <!-- ═══ SIDEBAR ═══ -->
  <aside class="sidebar">
    <div class="sidebar__logo" @click="nav('dashboard')">
      <span class="sidebar__ball">⚽</span>
      <span class="sidebar__brand">FootStats<span class="sidebar__pro">Pro</span></span>
    </div>
    <nav class="sidebar__nav">
      <button v-for="p in pages" :key="p.id" class="snav" :class="{ 'snav--on': page === p.id }" @click="nav(p.id)">
        <svg v-if="p.icon==='grid'" class="snav__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
        <svg v-if="p.icon==='users'" class="snav__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
        <svg v-if="p.icon==='trophy'" class="snav__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 010-5H6"/><path d="M18 9h1.5a2.5 2.5 0 000-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22"/><path d="M18 2H6v7a6 6 0 1012 0V2z"/></svg>
        <svg v-if="p.icon==='chart'" class="snav__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
        <svg v-if="p.icon==='list'" class="snav__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
        <svg v-if="p.icon==='car'" class="snav__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 17H3a2 2 0 01-2-2v-4a2 2 0 012-2h1l2-4h10l2 4h1a2 2 0 012 2v4a2 2 0 01-2 2h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/></svg>
        <span class="snav__txt">{{ p.label }}</span>
      </button>
    </nav>
    <div class="sidebar__foot">
      <span class="sidebar__ver">v2.0 — Big 5 Leagues</span>
    </div>
  </aside>

  <div class="overlay" v-if="sidebarOpen" @click="sidebarOpen = false"></div>

  <!-- ═══ MAIN ═══ -->
  <div class="main-area">
    <header class="topbar">
      <button class="burger" @click="sidebarOpen = !sidebarOpen">
        <span/><span/><span/>
      </button>
      <h2 class="topbar__title">{{ tabLabels[page] || 'Dashboard' }}</h2>
      <div class="gsearch">
        <svg class="gsearch__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input v-model="globalSearch" class="gsearch__input" placeholder="Rechercher un joueur…" @input="onGlobalSearch" @focus="globalSearchShow = globalSearchResults.length > 0" @blur="blurGlobalSearch" />
        <div v-if="globalSearchShow && globalSearchResults.length" class="gsearch__drop">
          <button v-for="p in globalSearchResults" :key="p.id" class="gsearch__item" @mousedown.prevent="selectGlobalPlayer(p)">
            <span class="gsearch__name">{{ p.player }}</span>
            <span class="gsearch__meta">{{ p.squad }} · {{ p.pos }}</span>
          </button>
        </div>
      </div>
    </header>

    <div class="content">
      <div v-if="loading" class="state-center"><div class="spinner"></div><p>Chargement…</p></div>
      <div v-else-if="fatalError" class="state-center"><span class="state-ico">⚠️</span><p>{{ fatalError }}</p></div>

      <template v-else>

        <!-- ═══ DASHBOARD ═══ -->
        <div v-if="page==='dashboard'" class="pg">
          <div class="kpi-row">
            <div class="kpi" v-for="(k, i) in [
              { icon: '👥', val: overview.totalPlayers.toLocaleString(), lbl: 'Joueurs', accent: '#00d4aa' },
              { icon: '⚽', val: overview.totalGoals.toLocaleString(), lbl: 'Buts totaux', accent: '#ff6b6b' },
              { icon: '🏆', val: overview.topScorer?.player || '—', lbl: `Meilleur buteur · ${overview.topScorer?.gls ?? 0} buts`, sm: true, accent: '#4ecdc4' },
              { icon: '🏟️', val: overview.bestLeague?.comp || '—', lbl: `Meilleure ligue · ${overview.bestLeague?.totalGls ?? 0} buts`, sm: true, accent: '#ffe66d' },
            ]" :key="i" :style="{ '--d': i, '--accent': k.accent }">
              <span class="kpi__ico">{{ k.icon }}</span>
              <div><span class="kpi__val" :class="{ 'kpi__val--sm': k.sm }">{{ k.val }}</span><span class="kpi__lbl">{{ k.lbl }}</span></div>
            </div>
          </div>
          <div class="grid3">
            <div class="card"><h3 class="card__h">Répartition par Poste</h3><div class="cw cw--donut"><Doughnut v-if="Object.keys(playersByPos).length" :data="posData" :options="dOpts" /></div></div>
            <div class="card"><h3 class="card__h">Buts par Ligue</h3><div class="cw"><Bar v-if="goalsByComp.length" :data="compGoalsData" :options="barO('x')" /></div></div>
            <div class="card"><h3 class="card__h">Top 10 Clubs</h3><div class="cw"><Bar v-if="topClubs.length" :data="clubsData" :options="barO('y')" /></div></div>
          </div>
          <div class="card" style="margin-top:14px">
            <h3 class="card__h">Top 5 Nations</h3>
            <div class="heatmap">
              <div v-for="n in topNations" :key="n.nation" class="hm-cell" :style="{ '--intensity': (n.count / (topNations[0]?.count || 1)) }">
                <span class="hm-cell__flag">{{ n.nation }}</span>
                <span class="hm-cell__count">{{ n.count }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ═══ COMPARATOR ═══ -->
        <div v-if="page==='compare'" class="pg">
          <div class="cmp-search-row">
            <div class="cmp-search" v-for="n in ([1, 2] as (1|2)[])" :key="n">
              <label class="cmp-search__lbl">Joueur {{ n }}</label>
              <div class="acwrap">
                <input :value="n===1 ? cmpSearch1 : cmpSearch2" @input="(e: any) => { if(n===1) cmpSearch1=e.target.value; else cmpSearch2=e.target.value; onCmpSearch(n) }" class="fi" :placeholder="`Rechercher joueur ${n}…`" @focus="n===1 ? cmpShow1=cmpResults1.length>0 : cmpShow2=cmpResults2.length>0" @blur="blurCmpSearch(n)" />
                <div v-if="(n===1?cmpShow1:cmpShow2)&&(n===1?cmpResults1:cmpResults2).length" class="acdrop">
                  <button v-for="p in (n===1?cmpResults1:cmpResults2)" :key="p.id" class="acdrop__item" @mousedown.prevent="selectCmp(n, p)">{{ p.player }} <small>{{ p.squad }}</small></button>
                </div>
              </div>
            </div>
          </div>
          <template v-if="cmpPlayer1 && cmpPlayer2">
            <div class="cmp-winner" v-if="cmpWinner">
              <span class="cmp-winner__badge cmp-winner__badge--1">{{ cmpPlayer1.player }}: {{ cmpWinner.w1 }} stats</span>
              <span class="cmp-winner__vs">VS</span>
              <span class="cmp-winner__badge cmp-winner__badge--2">{{ cmpPlayer2.player }}: {{ cmpWinner.w2 }} stats</span>
            </div>
            <div class="grid2">
              <div class="card"><h3 class="card__h">Radar comparatif</h3><div class="cw cw--radar"><Radar v-if="radarData" :data="radarData" :options="radarOpts" /></div></div>
              <div class="card"><h3 class="card__h">Statistiques détaillées</h3>
                <div class="cmp-bars">
                  <div v-for="s in cmpStats" :key="s.key" class="cbar">
                    <div class="cbar__row">
                      <span class="cbar__v" :class="{ 'cbar__v--win': (s.key==='crdy' ? (cmpPlayer1![s.key] as number)<(cmpPlayer2![s.key] as number) : (cmpPlayer1![s.key] as number)>(cmpPlayer2![s.key] as number)) }">{{ cmpPlayer1![s.key] }}</span>
                      <span class="cbar__label">{{ s.label }}</span>
                      <span class="cbar__v" :class="{ 'cbar__v--win': (s.key==='crdy' ? (cmpPlayer2![s.key] as number)<(cmpPlayer1![s.key] as number) : (cmpPlayer2![s.key] as number)>(cmpPlayer1![s.key] as number)) }">{{ cmpPlayer2![s.key] }}</span>
                    </div>
                    <div class="cbar__track">
                      <div class="cbar__fill cbar__fill--1" :style="{ width: `${Math.max(5, Math.round((cmpPlayer1![s.key] as number) / Math.max(cmpPlayer1![s.key] as number, cmpPlayer2![s.key] as number, 1) * 100))}%` }"></div>
                      <div class="cbar__fill cbar__fill--2" :style="{ width: `${Math.max(5, Math.round((cmpPlayer2![s.key] as number) / Math.max(cmpPlayer1![s.key] as number, cmpPlayer2![s.key] as number, 1) * 100))}%` }"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="cmp-cards">
              <div v-for="(pl, idx) in [cmpPlayer1, cmpPlayer2]" :key="idx" class="cmp-card" :class="idx===0?'cmp-card--1':'cmp-card--2'">
                <div class="cmp-card__head">
                  <div class="cmp-card__avatar">{{ pl!.player.split(' ').map((w:string)=>w[0]).slice(0,2).join('') }}</div>
                  <div><div class="cmp-card__name">{{ pl!.player }}</div><div class="cmp-card__sub">{{ pl!.squad }} · {{ pl!.pos }} · {{ pl!.comp }}</div></div>
                </div>
              </div>
            </div>
          </template>
          <div v-else class="state-center state-center--mini"><span class="state-ico">🔍</span><p>Sélectionnez deux joueurs pour les comparer</p></div>
        </div>

        <!-- ═══ RANKINGS ═══ -->
        <div v-if="page==='rankings'" class="pg">
          <div class="rk-tabs">
            <button v-for="t in rkTabs" :key="t.id" class="rtab" :class="{ 'rtab--on': rkTab===t.id }" @click="rkTab=t.id">{{ t.label }}</button>
          </div>
          <div class="fbar">
            <select v-model="rkComp" class="fi" @change="loadRankings"><option value="">Toutes les ligues</option><option v-for="c in comps" :key="c" :value="c">{{ c }}</option></select>
            <input v-model.number="rkAgeMin" class="fi fi--age" type="number" placeholder="Âge min" @change="loadRankings" />
            <input v-model.number="rkAgeMax" class="fi fi--age" type="number" placeholder="Âge max" @change="loadRankings" />
          </div>
          <div v-if="rkLoading" class="state-center state-center--mini"><div class="spinner"></div></div>
          <div v-else class="rk-list">
            <div v-for="(p, i) in rkPlayers" :key="p.id" class="rk-item" :class="{ 'rk-item--gold': i===0, 'rk-item--silver': i===1, 'rk-item--bronze': i===2 }" :style="{ '--d': i }" @click="openModal(p)">
              <span class="rk-item__rank">
                <template v-if="i===0">🥇</template><template v-else-if="i===1">🥈</template><template v-else-if="i===2">🥉</template><template v-else>{{ i + 1 }}</template>
              </span>
              <div class="rk-item__info">
                <span class="rk-item__name">{{ p.player }}</span>
                <span class="rk-item__meta">{{ p.squad }} · {{ p.comp }}</span>
              </div>
              <div class="rk-item__bar-wrap">
                <div class="rk-item__bar" :style="{ width: `${Math.round((p[rkTabs.find(t=>t.id===rkTab)!.key] as number) / Math.max(rkPlayers[0]?.[rkTabs.find(t=>t.id===rkTab)!.key] as number, 1) * 100)}%` }"></div>
              </div>
              <span class="rk-item__val">{{ p[rkTabs.find(t=>t.id===rkTab)!.key] }} {{ rkTabs.find(t=>t.id===rkTab)!.unit }}</span>
            </div>
          </div>
        </div>

        <!-- ═══ ANALYSIS ═══ -->
        <div v-if="page==='analysis'" class="pg">
          <div class="fbar">
            <select v-model="anComp" class="fi"><option value="">Toutes les ligues</option><option v-for="c in comps" :key="c" :value="c">{{ c }}</option></select>
            <select v-model="anPos" class="fi"><option value="">Tous les postes</option><option v-for="p in positions" :key="p" :value="p">{{ p }}</option></select>
          </div>
          <div v-if="anLoading" class="state-center state-center--mini"><div class="spinner"></div></div>
          <div v-else class="grid2">
            <div class="card"><h3 class="card__h">xG vs Buts réels</h3><div class="cw"><Scatter v-if="anScatterXG.length" :data="xgScatter" :options="scatterO('xG','Buts')" /></div></div>
            <div class="card"><h3 class="card__h">Tackles vs Interceptions</h3><div class="cw"><Scatter v-if="anScatterDef.length" :data="defScatter" :options="scatterO('Tackles','Interceptions')" /></div></div>
            <div class="card card--span2"><h3 class="card__h">Top 15 Passeurs décisifs</h3><div class="cw cw--tall"><Bar v-if="anTopAst.length" :data="astBarData" :options="barO('y')" /></div></div>
          </div>
        </div>

        <!-- ═══ TABLE ═══ -->
        <div v-if="page==='table'" class="pg">
          <div class="fbar">
            <input v-model="tblSearch" class="fi fi--grow" placeholder="🔍 Rechercher…" @input="onTblSearch" />
            <select v-model="tblComp" class="fi" @change="onTblFilter"><option value="">Toutes ligues</option><option v-for="c in comps" :key="c" :value="c">{{ c }}</option></select>
            <select v-model="tblPos" class="fi" @change="onTblFilter"><option value="">Tous postes</option><option v-for="p in positions" :key="p" :value="p">{{ p }}</option></select>
            <input v-model.number="tblAgeMin" class="fi fi--age" type="number" placeholder="Âge min" @change="onTblFilter" />
            <input v-model.number="tblAgeMax" class="fi fi--age" type="number" placeholder="Âge max" @change="onTblFilter" />
            <button class="btn btn--accent btn--sm" @click="exportCSV">📥 CSV</button>
          </div>
          <div class="tscroll">
            <table class="dt">
              <thead><tr>
                <th v-for="c in tblCols" :key="c.key" class="dt__th" :class="{ 'dt__th--on': tblSort===c.key }" @click="tblSortBy(c.key)">{{ c.label }}<span v-if="tblSort===c.key" class="sa">{{ tblOrder==='asc'?'▲':'▼' }}</span></th>
              </tr></thead>
              <tbody>
                <tr v-for="p in tblPlayers" :key="p.id" class="dt__row" @click="openModal(p)">
                  <td class="dt__td dt__td--name">{{ p.player }}</td>
                  <td class="dt__td"><span class="pbadge">{{ p.pos }}</span></td>
                  <td class="dt__td">{{ p.squad }}</td>
                  <td class="dt__td">{{ p.comp }}</td>
                  <td class="dt__td">{{ p.age }}</td>
                  <td class="dt__td">{{ p.mp }}</td>
                  <td class="dt__td dt__td--hl">{{ p.gls }}</td>
                  <td class="dt__td">{{ p.ast }}</td>
                  <td class="dt__td">{{ p.g_a }}</td>
                  <td class="dt__td">{{ p.xg }}</td>
                  <td class="dt__td">{{ p.tkl }}</td>
                  <td class="dt__td">{{ p.interceptions }}</td>
                  <td class="dt__td">{{ p.crdy }}</td>
                </tr>
                <tr v-if="!tblPlayers.length"><td :colspan="tblCols.length" class="dt__empty">Aucun résultat</td></tr>
              </tbody>
            </table>
          </div>
          <div class="pag" v-if="tblMeta.pages>1">
            <button class="pb" :disabled="tblMeta.page<=1" @click="tblGoPage(tblMeta.page-1)">‹</button>
            <template v-for="pn in tblPages" :key="pn">
              <span v-if="pn==='...'" class="pd">…</span>
              <button v-else class="pb" :class="{ 'pb--on': pn===tblMeta.page }" @click="tblGoPage(pn as number)">{{ pn }}</button>
            </template>
            <button class="pb" :disabled="tblMeta.page>=tblMeta.pages" @click="tblGoPage(tblMeta.page+1)">›</button>
            <span class="pi">{{ tblMeta.total.toLocaleString() }} joueurs</span>
          </div>
        </div>

        <!-- ✅ Page Voitures -->
        <CarsAnalysis v-if="page==='cars'" />

      </template>
    </div>
  </div>

  <!-- ═══ MODAL ═══ -->
  <Teleport to="body">
    <div v-if="showModal && modalPlayer" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <button class="modal__close" @click="closeModal">✕</button>
        <div class="modal__head">
          <div class="modal__avatar">{{ modalPlayer.player.split(' ').map((w:string)=>w[0]).slice(0,2).join('').toUpperCase() }}</div>
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

  <Transition name="toast">
    <div v-if="toastMsg" class="toast">{{ toastMsg }}</div>
  </Transition>
</div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');

/* ═══════════════════════════════════════════════════════
   NEW THEME — #00d4aa / #ff6b6b dark
   ═══════════════════════════════════════════════════════ */
:root {
  --bg: #0a0e17;
  --sf: #111827;
  --sf2: #1a2332;
  --bd: #1e293b;
  --bdl: #334155;
  --tx: #e2e8f0;
  --txd: #94a3b8;
  --txdd: #64748b;
  --g: #00d4aa;
  --gg: rgba(0,212,170,.25);
  --coral: #ff6b6b;
  --blue: #4ecdc4;
  --yellow: #ffe66d;
  --purple: #a29bfe;
  --r: 12px;
  --rs: 8px;
  --f: 'Space Grotesk', system-ui, sans-serif;
  --mono: 'JetBrains Mono', 'Fira Code', monospace;
  --t: .2s cubic-bezier(.4,0,.2,1);
  --sidebar-w: 230px;
}

*,*::before,*::after { margin: 0; padding: 0; box-sizing: border-box }

.shell {
  display: flex;
  min-height: 100vh;
  background: var(--bg);
  color: var(--tx);
  font-family: var(--f);
}

/* ═══ SIDEBAR ═══ */
.sidebar {
  position: fixed; top: 0; left: 0; bottom: 0;
  width: var(--sidebar-w);
  background: var(--sf);
  border-right: 1px solid var(--bd);
  display: flex; flex-direction: column;
  z-index: 30;
  transition: transform var(--t);
}
.sidebar__logo {
  padding: 22px 20px;
  display: flex; align-items: center; gap: 10px;
  cursor: pointer;
  border-bottom: 1px solid var(--bd);
}
.sidebar__ball { font-size: 1.6rem; filter: drop-shadow(0 0 8px rgba(0,212,170,.4)) }
.sidebar__brand { font-size: 1.15rem; font-weight: 700; letter-spacing: -.02em; color: #fff }
.sidebar__pro { color: var(--g); margin-left: 2px }
.sidebar__nav { flex: 1; padding: 14px 12px; display: flex; flex-direction: column; gap: 2px }
.sidebar__foot { padding: 14px 20px; border-top: 1px solid var(--bd) }
.sidebar__ver { font-size: .68rem; color: var(--txdd); font-family: var(--mono) }

.snav {
  display: flex; align-items: center; gap: 10px;
  padding: 11px 14px; border: none;
  background: transparent;
  border-radius: var(--rs);
  color: var(--txd);
  font-family: inherit; font-size: .84rem; font-weight: 500;
  cursor: pointer; transition: all var(--t);
  text-align: left; width: 100%;
}
.snav:hover { background: rgba(0,212,170,.06); color: var(--tx) }
.snav--on { background: rgba(0,212,170,.1); color: var(--g); box-shadow: inset 3px 0 0 var(--g) }
.snav__ico { width: 18px; height: 18px; flex-shrink: 0 }
.snav__txt { white-space: nowrap }

.overlay { display: none }
@media(max-width:860px) {
  .sidebar { transform: translateX(-100%) }
  .shell--sidebar-open .sidebar { transform: translateX(0) }
  .overlay { display: block; position: fixed; inset: 0; background: rgba(0,0,0,.6); z-index: 25; backdrop-filter: blur(4px) }
  .main-area { margin-left: 0!important }
}

/* ═══ MAIN AREA ═══ */
.main-area { margin-left: var(--sidebar-w); flex: 1; display: flex; flex-direction: column; min-width: 0 }

.topbar {
  position: sticky; top: 0; z-index: 15;
  display: flex; align-items: center; gap: 14px;
  padding: 14px 28px;
  background: rgba(10,14,23,.88);
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--bd);
}
.topbar__title { font-size: 1.08rem; font-weight: 600; white-space: nowrap; color: #fff; letter-spacing: -.01em }

.burger { display: none; background: none; border: none; cursor: pointer; width: 28px; height: 20px; flex-direction: column; justify-content: space-between }
.burger span { display: block; width: 100%; height: 2px; background: var(--tx); border-radius: 2px }
@media(max-width:860px) { .burger { display: flex } }

/* ═══ GLOBAL SEARCH ═══ */
.gsearch { position: relative; margin-left: auto; width: 290px }
.gsearch__ico { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; color: var(--txdd) }
.gsearch__input {
  width: 100%; padding: 9px 14px 9px 34px;
  background: var(--sf2); border: 1px solid var(--bd); border-radius: var(--rs);
  color: var(--tx); font-family: inherit; font-size: .83rem;
  outline: none; transition: border-color var(--t);
}
.gsearch__input:focus { border-color: var(--g); box-shadow: 0 0 0 3px rgba(0,212,170,.08) }
.gsearch__input::placeholder { color: var(--txdd) }
.gsearch__drop {
  position: absolute; top: 100%; left: 0; right: 0; margin-top: 6px;
  background: var(--sf); border: 1px solid var(--bd); border-radius: var(--rs);
  overflow: hidden; z-index: 50;
  box-shadow: 0 12px 32px rgba(0,0,0,.5);
}
.gsearch__item {
  display: flex; justify-content: space-between; align-items: center;
  width: 100%; padding: 11px 16px; border: none;
  background: transparent; color: var(--tx);
  font-family: inherit; font-size: .83rem;
  cursor: pointer; text-align: left; transition: background var(--t);
}
.gsearch__item:hover { background: rgba(0,212,170,.08) }
.gsearch__name { font-weight: 600 }
.gsearch__meta { font-size: .74rem; color: var(--txd); font-family: var(--mono) }
@media(max-width:600px) { .gsearch { width: 180px } }

.content { padding: 24px 28px 60px; flex: 1 }

.pg { animation: fadeUp .3s ease-out }
@keyframes fadeUp { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }

/* ═══ STATES ═══ */
.state-center { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; min-height: 50vh; color: var(--txd) }
.state-center--mini { min-height: 30vh }
.state-ico { font-size: 2.5rem }
.spinner { width: 36px; height: 36px; border: 3px solid var(--bd); border-top-color: var(--g); border-radius: 50%; animation: spin .7s linear infinite }
@keyframes spin { to { transform: rotate(360deg) } }

/* ═══ KPI ROW ═══ */
.kpi-row { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; margin-bottom: 20px }
@media(max-width:960px) { .kpi-row { grid-template-columns: repeat(2,1fr) } }
@media(max-width:520px) { .kpi-row { grid-template-columns: 1fr } }

.kpi {
  background: var(--sf);
  border: 1px solid var(--bd);
  border-radius: var(--r);
  padding: 18px 20px;
  display: flex; align-items: center; gap: 14px;
  position: relative; overflow: hidden;
  animation: fadeUp .4s ease-out both;
  animation-delay: calc(var(--d,0)*.06s);
  transition: border-color .3s, box-shadow .3s;
}
.kpi::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: var(--accent, var(--g));
  opacity: .7;
}
.kpi:hover {
  border-color: var(--g);
  box-shadow: 0 0 24px rgba(0,212,170,.06);
}
.kpi__ico {
  font-size: 1.5rem; width: 48px; height: 48px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,212,170,.08);
  border-radius: 12px; flex-shrink: 0;
}
.kpi__val {
  display: block; font-size: 1.55rem; font-weight: 700;
  letter-spacing: -.03em; color: #fff; line-height: 1.15;
  font-family: var(--mono);
}
.kpi__val--sm { font-size: .95rem; font-family: var(--f) }
.kpi__lbl {
  display: block; font-size: .72rem; color: var(--txd);
  margin-top: 3px; white-space: nowrap; overflow: hidden;
  text-overflow: ellipsis;
}

/* ═══ GRIDS ═══ */
.grid2 { display: grid; grid-template-columns: repeat(2,1fr); gap: 14px }
.grid3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px }
@media(max-width:960px) { .grid2,.grid3 { grid-template-columns: 1fr } }

/* ═══ CARDS ═══ */
.card {
  background: var(--sf);
  border: 1px solid var(--bd);
  border-radius: var(--r);
  padding: 20px;
  transition: border-color .3s, box-shadow .3s;
}
.card:hover {
  border-color: var(--bdl);
  box-shadow: 0 4px 20px rgba(0,0,0,.15);
}
.card__h {
  font-size: .78rem; font-weight: 600;
  text-transform: uppercase; letter-spacing: .05em;
  color: var(--txd); margin-bottom: 14px;
}
.card--span2 { grid-column: span 2 }
@media(max-width:960px) { .card--span2 { grid-column: span 1 } }

/* ═══ CHART WRAPPERS ═══ */
.cw { height: 270px; position: relative }
.cw--donut { height: 290px }
.cw--tall { height: 380px }
.cw--radar { height: 320px }

/* ═══ HEATMAP ═══ */
.heatmap { display: flex; gap: 10px; flex-wrap: wrap }
.hm-cell {
  flex: 1; min-width: 120px; padding: 18px;
  border-radius: var(--rs);
  background: rgba(0,212,170, calc(var(--intensity)*.25 + .04));
  border: 1px solid rgba(0,212,170, calc(var(--intensity)*.3));
  text-align: center; transition: transform var(--t);
}
.hm-cell:hover { transform: scale(1.03) }
.hm-cell__flag { display: block; font-size: .88rem; font-weight: 600; color: #fff; margin-bottom: 4px }
.hm-cell__count { font-size: 1.3rem; font-weight: 700; color: var(--g); font-family: var(--mono) }

/* ═══ COMPARATOR ═══ */
.cmp-search-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px }
@media(max-width:600px) { .cmp-search-row { grid-template-columns: 1fr } }
.cmp-search__lbl {
  display: block; font-size: .72rem; font-weight: 600;
  color: var(--txd); margin-bottom: 6px;
  text-transform: uppercase; letter-spacing: .06em;
  font-family: var(--mono);
}
.acwrap { position: relative }
.acdrop {
  position: absolute; top: 100%; left: 0; right: 0; margin-top: 4px;
  background: var(--sf); border: 1px solid var(--bd); border-radius: var(--rs);
  overflow: hidden; z-index: 40;
  box-shadow: 0 8px 24px rgba(0,0,0,.5);
}
.acdrop__item {
  display: block; width: 100%; padding: 10px 14px; border: none;
  background: transparent; color: var(--tx);
  font-family: inherit; font-size: .83rem;
  cursor: pointer; text-align: left; transition: background var(--t);
}
.acdrop__item:hover { background: rgba(0,212,170,.08) }
.acdrop__item small { color: var(--txd); margin-left: 6px; font-family: var(--mono); font-size: .72rem }

.cmp-winner { display: flex; align-items: center; justify-content: center; gap: 14px; margin-bottom: 18px; flex-wrap: wrap }
.cmp-winner__badge { padding: 8px 20px; border-radius: 100px; font-size: .84rem; font-weight: 700; font-family: var(--mono) }
.cmp-winner__badge--1 { background: rgba(0,212,170,.12); border: 1px solid rgba(0,212,170,.25); color: var(--g) }
.cmp-winner__badge--2 { background: rgba(255,107,107,.12); border: 1px solid rgba(255,107,107,.25); color: var(--coral) }
.cmp-winner__vs { font-size: .8rem; font-weight: 700; color: var(--txd) }

.cmp-bars { display: flex; flex-direction: column; gap: 10px; max-height: 420px; overflow-y: auto; padding-right: 4px }
.cbar__row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px }
.cbar__label { font-size: .72rem; color: var(--txd); font-weight: 600; text-transform: uppercase; letter-spacing: .04em; font-family: var(--mono) }
.cbar__v { font-size: .88rem; font-weight: 700; color: var(--txd); min-width: 40px; text-align: center; font-family: var(--mono) }
.cbar__v--win { color: var(--g) }
.cbar__track { display: flex; gap: 3px; height: 6px; border-radius: 3px; overflow: hidden; background: rgba(255,255,255,.03) }
.cbar__fill { height: 100%; border-radius: 3px; transition: width .5s ease-out }
.cbar__fill--1 { background: var(--g) }
.cbar__fill--2 { background: var(--coral) }

.cmp-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 14px }
@media(max-width:600px) { .cmp-cards { grid-template-columns: 1fr } }
.cmp-card { background: var(--sf); border: 1px solid var(--bd); border-radius: var(--r); padding: 18px }
.cmp-card--1 { border-left: 3px solid var(--g) }
.cmp-card--2 { border-left: 3px solid var(--coral) }
.cmp-card__head { display: flex; align-items: center; gap: 12px }
.cmp-card__avatar {
  width: 46px; height: 46px; border-radius: 12px;
  background: var(--g);
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: .9rem; color: #fff; flex-shrink: 0;
}
.cmp-card--2 .cmp-card__avatar { background: var(--coral) }
.cmp-card__name { font-weight: 700; font-size: 1rem; color: #fff }
.cmp-card__sub { font-size: .76rem; color: var(--txd); margin-top: 2px }

/* ═══ RANKINGS ═══ */
.rk-tabs { display: flex; gap: 6px; margin-bottom: 14px; overflow-x: auto }
.rtab {
  padding: 9px 20px; border: 1px solid var(--bd); border-radius: 100px;
  background: transparent; color: var(--txd);
  font-family: inherit; font-size: .82rem; font-weight: 500;
  cursor: pointer; transition: all var(--t); white-space: nowrap;
}
.rtab:hover { color: var(--tx); background: var(--sf2) }
.rtab--on { background: rgba(0,212,170,.1); border-color: var(--g); color: var(--g) }

.rk-list { display: flex; flex-direction: column; gap: 6px }
.rk-item {
  display: flex; align-items: center; gap: 14px;
  padding: 13px 18px;
  background: var(--sf); border: 1px solid var(--bd);
  border-radius: var(--rs); cursor: pointer;
  animation: fadeUp .35s ease-out both;
  animation-delay: calc(var(--d,0)*.04s);
  transition: all var(--t);
}
.rk-item:hover { border-color: var(--bdl); background: var(--sf2) }
.rk-item--gold { border-color: rgba(255,230,109,.25); background: rgba(255,230,109,.04) }
.rk-item--silver { border-color: rgba(148,163,184,.25); background: rgba(148,163,184,.04) }
.rk-item--bronze { border-color: rgba(255,107,107,.2); background: rgba(255,107,107,.04) }
.rk-item__rank { font-size: 1.2rem; width: 36px; text-align: center; font-weight: 700; color: var(--txd); flex-shrink: 0 }
.rk-item--gold .rk-item__rank,.rk-item--silver .rk-item__rank,.rk-item--bronze .rk-item__rank { font-size: 1.4rem }
.rk-item__info { flex: 1; min-width: 0 }
.rk-item__name { display: block; font-weight: 600; font-size: .9rem; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
.rk-item__meta { font-size: .72rem; color: var(--txd); font-family: var(--mono) }
.rk-item__bar-wrap { width: 120px; height: 6px; background: rgba(255,255,255,.04); border-radius: 3px; overflow: hidden; flex-shrink: 0 }
@media(max-width:600px) { .rk-item__bar-wrap { display: none } }
.rk-item__bar { height: 100%; background: var(--g); border-radius: 3px; transition: width .6s ease-out }
.rk-item__val { font-size: .84rem; font-weight: 700; color: var(--g); min-width: 80px; text-align: right; white-space: nowrap; font-family: var(--mono) }

/* ═══ FILTER BAR ═══ */
.fbar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; align-items: center }

.fi {
  padding: 9px 14px;
  background: var(--sf2); border: 1px solid var(--bd);
  border-radius: var(--rs); color: var(--tx);
  font-family: inherit; font-size: .82rem;
  outline: none; transition: border-color var(--t), box-shadow var(--t);
}
.fi:focus { border-color: var(--g); box-shadow: 0 0 0 3px rgba(0,212,170,.08) }
.fi::placeholder { color: var(--txdd) }
.fi--grow { flex: 1; min-width: 180px }
.fi--age { width: 90px }
select.fi {
  cursor: pointer; appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%2364748b' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 12px center; padding-right: 30px;
}

.btn {
  display: inline-flex; align-items: center; gap: 5px;
  border: none; border-radius: var(--rs);
  cursor: pointer; font-family: var(--mono); font-weight: 600;
  transition: all var(--t);
}
.btn:active { transform: scale(.96) }
.btn--accent { background: var(--g); color: #0a0e17; padding: 9px 16px; font-size: .82rem }
.btn--accent:hover { box-shadow: 0 4px 16px var(--gg); background: #00e6b8 }
.btn--sm { padding: 7px 12px; font-size: .78rem }

/* ═══ DATA TABLE ═══ */
.tscroll {
  overflow-x: auto;
  border: 1px solid var(--bd); border-radius: var(--r);
  scrollbar-width: thin; scrollbar-color: var(--bd) transparent;
}
.dt { width: 100%; border-collapse: collapse; font-size: .8rem; white-space: nowrap }
.dt__th {
  position: sticky; top: 0; background: var(--sf2);
  padding: 11px 14px; text-align: left;
  font-weight: 600; font-size: .7rem;
  text-transform: uppercase; letter-spacing: .06em;
  color: var(--txd); font-family: var(--mono);
  border-bottom: 1px solid var(--bd);
  cursor: pointer; user-select: none; transition: color var(--t);
}
.dt__th:hover { color: var(--tx) }
.dt__th--on { color: var(--g) }
.sa { font-size: .6rem; margin-left: 3px; color: var(--g) }
.dt__row { transition: background var(--t); cursor: pointer }
.dt__row:hover { background: rgba(0,212,170,.03) }
.dt__td { padding: 10px 14px; border-bottom: 1px solid rgba(30,41,59,.6); font-family: var(--mono); font-size: .78rem }
.dt__td--name { font-weight: 600; color: #fff; font-family: var(--f); position: sticky; left: 0; background: var(--sf); z-index: 2 }
.dt__row:hover .dt__td--name { background: var(--sf2) }
.dt__td--hl { color: var(--g); font-weight: 700 }
.dt__empty { padding: 36px; text-align: center; color: var(--txd) }
.pbadge {
  display: inline-block; padding: 2px 8px;
  border-radius: 4px; font-size: .68rem; font-weight: 600;
  background: rgba(0,212,170,.1); color: var(--g);
  font-family: var(--mono);
}

/* ═══ PAGINATION ═══ */
.pag { display: flex; align-items: center; gap: 4px; margin-top: 14px; justify-content: center; flex-wrap: wrap }
.pb {
  min-width: 34px; height: 34px;
  display: flex; align-items: center; justify-content: center;
  background: var(--sf); border: 1px solid var(--bd);
  border-radius: var(--rs); color: var(--txd);
  font-family: var(--mono); font-size: .78rem; font-weight: 500;
  cursor: pointer; transition: all var(--t);
}
.pb:hover:not(:disabled) { border-color: var(--g); color: var(--g) }
.pb--on { background: var(--g); border-color: var(--g); color: #0a0e17; font-weight: 700 }
.pb:disabled { opacity: .3; cursor: not-allowed }
.pd { color: var(--txd); padding: 0 3px }
.pi { margin-left: 10px; font-size: .74rem; color: var(--txd); font-family: var(--mono) }

/* ═══ MODAL ═══ */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.65);
  backdrop-filter: blur(6px);
  z-index: 100;
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
  animation: fadeIn .2s ease-out;
}
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
.modal {
  background: var(--sf);
  border: 1px solid var(--bd);
  border-radius: 16px;
  width: 100%; max-width: 640px; max-height: 85vh;
  overflow-y: auto; padding: 0;
  animation: modalSlide .25s ease-out;
  scrollbar-width: thin; scrollbar-color: var(--bd) transparent;
}
@keyframes modalSlide { from { opacity: 0; transform: translateY(20px) scale(.97) } to { opacity: 1; transform: translateY(0) scale(1) } }
.modal__close {
  position: sticky; top: 0; float: right;
  margin: 16px 16px 0 0;
  background: var(--sf2); border: 1px solid var(--bd);
  border-radius: 50%; width: 34px; height: 34px;
  display: flex; align-items: center; justify-content: center;
  color: var(--txd); cursor: pointer; font-size: .9rem;
  z-index: 2; transition: all var(--t);
}
.modal__close:hover { background: var(--bd); color: #fff }
.modal__head { display: flex; align-items: center; gap: 14px; padding: 22px 26px 18px }
.modal__avatar {
  width: 54px; height: 54px; border-radius: 14px;
  background: linear-gradient(135deg, var(--g), var(--blue));
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 1.1rem; color: #fff; flex-shrink: 0;
}
.modal__name { font-size: 1.2rem; font-weight: 700; color: #fff }
.modal__sub { font-size: .8rem; color: var(--txd); margin-top: 2px; font-family: var(--mono) }
.modal__body { padding: 0 26px 26px }
.modal__sec { margin-bottom: 18px }
.modal__sec-title {
  font-size: .72rem; font-weight: 600;
  text-transform: uppercase; letter-spacing: .06em;
  color: var(--txd); font-family: var(--mono);
  margin-bottom: 10px; padding-bottom: 6px;
  border-bottom: 1px solid var(--bd);
}
.modal__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 8px }
.modal__stat {
  display: flex; align-items: center; gap: 8px;
  padding: 9px 12px; background: var(--sf2);
  border-radius: var(--rs); border: 1px solid var(--bd);
  transition: border-color var(--t);
}
.modal__stat:hover { border-color: var(--bdl) }
.modal__stat-ico { font-size: .95rem; flex-shrink: 0 }
.modal__stat-lbl { font-size: .74rem; color: var(--txd); flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
.modal__stat-val { font-size: .88rem; font-weight: 700; color: #fff; flex-shrink: 0; font-family: var(--mono) }

/* ═══ TOAST ═══ */
.toast {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  background: var(--sf); border: 1px solid var(--g);
  border-radius: var(--rs); padding: 10px 20px;
  font-size: .84rem; color: var(--tx); z-index: 200;
  box-shadow: 0 8px 24px rgba(0,0,0,.4), 0 0 12px rgba(0,212,170,.1);
}
.toast-enter-active,.toast-leave-active { transition: all .3s ease }
.toast-enter-from,.toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(16px) }
</style>