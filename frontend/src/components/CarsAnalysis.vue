<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
  Chart as ChartJS, BarElement, PointElement, CategoryScale,
  LinearScale, Tooltip, Legend, ArcElement, LineElement, Filler,
  RadialLinearScale
} from 'chart.js'
import { Bar, Scatter, Doughnut, Line, PolarArea } from 'vue-chartjs'

ChartJS.register(
  BarElement, PointElement, CategoryScale, LinearScale,
  Tooltip, Legend, ArcElement, LineElement, Filler,
  RadialLinearScale
)

interface Car {
  car_id: string
  date: string
  customer_name: string
  gender: string
  annual_income: number
  dealer_name: string
  company: string
  model: string
  engine: string
  transmission: string
  color: string
  price: number
  dealer_no: string
  body_style: string
  phone: number
  dealer_region: string
}

const API = 'http://localhost:3000'

async function useFetch<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

/* ══════ STATE ══════ */
const cars = ref<Car[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const activeTab = ref<'overview' | 'brands' | 'customers' | 'dealers' | 'trends'>('overview')

/* ══════ FILTERS ══════ */
const filterCompany = ref<string>('all')
const filterRegion = ref<string>('all')
const filterBodyStyle = ref<string>('all')
const filterGender = ref<string>('all')

const companies = computed(() => {
  const s = new Set(cars.value.map(c => c.company))
  return ['all', ...Array.from(s).sort()]
})
const regions = computed(() => {
  const s = new Set(cars.value.map(c => c.dealer_region))
  return ['all', ...Array.from(s).sort()]
})
const bodyStyles = computed(() => {
  const s = new Set(cars.value.map(c => c.body_style))
  return ['all', ...Array.from(s).sort()]
})

const filtered = computed(() => {
  return cars.value.filter(c => {
    if (filterCompany.value !== 'all' && c.company !== filterCompany.value) return false
    if (filterRegion.value !== 'all' && c.dealer_region !== filterRegion.value) return false
    if (filterBodyStyle.value !== 'all' && c.body_style !== filterBodyStyle.value) return false
    if (filterGender.value !== 'all' && c.gender !== filterGender.value) return false
    return true
  })
})

/* ══════ LOAD ══════ */
onMounted(async () => {
  try {
    cars.value = await useFetch<Car[]>(`${API}/cars?limit=9999`)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Erreur'
  } finally {
    loading.value = false
  }
})

/* ══════════════════════════════════════════════════════
   KPIs
   ══════════════════════════════════════════════════════ */
const totalCars = computed(() => filtered.value.length)

const totalRevenue = computed(() =>
  filtered.value.reduce((s, c) => s + c.price, 0)
)

const avgPrice = computed(() => {
  if (!filtered.value.length) return 0
  return Math.round(totalRevenue.value / filtered.value.length)
})

const medianPrice = computed(() => {
  if (!filtered.value.length) return 0
  const sorted = [...filtered.value].map(c => c.price).sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
})

const avgIncome = computed(() => {
  if (!filtered.value.length) return 0
  return Math.round(filtered.value.reduce((s, c) => s + c.annual_income, 0) / filtered.value.length)
})

const topRegion = computed(() => {
  const map: Record<string, number> = {}
  filtered.value.forEach(c => { map[c.dealer_region] = (map[c.dealer_region] || 0) + 1 })
  return Object.entries(map).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'
})

const mostCommonCompany = computed(() => {
  const map: Record<string, number> = {}
  filtered.value.forEach(c => { map[c.company] = (map[c.company] || 0) + 1 })
  return Object.entries(map).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'
})

const topModel = computed(() => {
  const map: Record<string, number> = {}
  filtered.value.forEach(c => {
    const key = `${c.company} ${c.model}`
    map[key] = (map[key] || 0) + 1
  })
  return Object.entries(map).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'
})

const uniqueDealers = computed(() => {
  return new Set(filtered.value.map(c => c.dealer_name)).size
})

const uniqueModels = computed(() => {
  return new Set(filtered.value.map(c => `${c.company} ${c.model}`)).size
})

const priceRange = computed(() => {
  if (!filtered.value.length) return { min: 0, max: 0 }
  const prices = filtered.value.map(c => c.price)
  return { min: Math.min(...prices), max: Math.max(...prices) }
})

/* ══════════════════════════════════════════════════════
   PALETTES & THEME
   ══════════════════════════════════════════════════════ */
const PAL = [
  '#00d4aa', '#ff6b6b', '#4ecdc4', '#ffe66d', '#a29bfe',
  '#fd79a8', '#0984e3', '#6c5ce7', '#ffeaa7', '#55efc4',
  '#e17055', '#74b9ff', '#b2bec3', '#dfe6e9', '#fab1a0',
  '#81ecec', '#fdcb6e', '#e056fd', '#30336b', '#badc58'
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

/* ══════════════════════════════════════════════════════
   CHART: Prix moyen par marque (Top 12)
   ══════════════════════════════════════════════════════ */
const priceByCompany = computed(() => {
  const map: Record<string, number[]> = {}
  filtered.value.forEach(c => {
    if (!map[c.company]) map[c.company] = []
    map[c.company].push(c.price)
  })
  const sorted = Object.entries(map)
    .map(([company, prices]) => ({
      company,
      avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
      count: prices.length,
    }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 12)
  return {
    labels: sorted.map(x => x.company),
    datasets: [{
      label: 'Prix moyen ($)',
      data: sorted.map(x => x.avg),
      backgroundColor: sorted.map((_, i) => PAL[i % PAL.length]),
      borderRadius: 6,
      borderSkipped: false,
      barThickness: 22,
    }]
  }
})

const barOpts: any = {
  indexAxis: 'y', responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      ...tooltipStyle,
      callbacks: { label: (c: any) => ` ${c.raw.toLocaleString()} $` }
    }
  },
  scales: {
    x: { grid: { color: gc }, ticks: { color: tc, font: cf, callback: (v: any) => `${(v/1000).toFixed(0)}k$` } },
    y: { grid: { color: 'transparent' }, ticks: { color: tc, font: cf } },
  },
}

/* ══════════════════════════════════════════════════════
   CHART: Ventes par marque (Top 12)
   ══════════════════════════════════════════════════════ */
const salesByCompany = computed(() => {
  const map: Record<string, number> = {}
  filtered.value.forEach(c => { map[c.company] = (map[c.company] || 0) + 1 })
  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 12)
  return {
    labels: sorted.map(x => x[0]),
    datasets: [{
      label: 'Ventes',
      data: sorted.map(x => x[1]),
      backgroundColor: sorted.map((_, i) => PAL[i % PAL.length]),
      borderRadius: 6,
      borderSkipped: false,
      barThickness: 22,
    }]
  }
})

const barVertOpts: any = {
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { ...tooltipStyle, callbacks: { label: (c: any) => ` ${c.raw} ventes` } }
  },
  scales: {
    x: { grid: { color: 'transparent' }, ticks: { color: tc, font: cf, maxRotation: 45 } },
    y: { grid: { color: gc }, ticks: { color: tc, font: cf } },
  },
}

/* ══════════════════════════════════════════════════════
   CHART: Transmission
   ══════════════════════════════════════════════════════ */
const transmissionData = computed(() => {
  const map: Record<string, number> = {}
  filtered.value.forEach(c => { map[c.transmission] = (map[c.transmission] || 0) + 1 })
  const labels = Object.keys(map)
  return {
    labels,
    datasets: [{
      data: Object.values(map),
      backgroundColor: labels.map((_, i) => PAL[i % PAL.length]),
      borderWidth: 0,
      hoverOffset: 8,
    }]
  }
})

const dOpts: any = {
  responsive: true, maintainAspectRatio: false, cutout: '62%',
  plugins: {
    legend: { position: 'bottom', labels: { color: '#94a3b8', font: cf, padding: 16, usePointStyle: true, pointStyleWidth: 10 } },
    tooltip: { ...tooltipStyle }
  },
}

/* ══════════════════════════════════════════════════════
   CHART: Body Style
   ══════════════════════════════════════════════════════ */
const bodyStyleData = computed(() => {
  const map: Record<string, number> = {}
  filtered.value.forEach(c => { map[c.body_style] = (map[c.body_style] || 0) + 1 })
  const labels = Object.keys(map).sort()
  return {
    labels,
    datasets: [{
      data: labels.map(l => map[l]),
      backgroundColor: labels.map((_, i) => PAL[(i + 5) % PAL.length]),
      borderWidth: 0,
      hoverOffset: 8,
    }]
  }
})

/* ══════════════════════════════════════════════════════
   CHART: Engine type
   ══════════════════════════════════════════════════════ */
const engineData = computed(() => {
  const map: Record<string, number> = {}
  filtered.value.forEach(c => { map[c.engine] = (map[c.engine] || 0) + 1 })
  const labels = Object.keys(map).sort()
  return {
    labels,
    datasets: [{
      data: labels.map(l => map[l]),
      backgroundColor: labels.map((_, i) => PAL[(i + 3) % PAL.length]),
      borderWidth: 0,
      hoverOffset: 8,
    }]
  }
})

/* ══════════════════════════════════════════════════════
   CHART: Gender split
   ══════════════════════════════════════════════════════ */
const genderData = computed(() => {
  const map: Record<string, number> = {}
  filtered.value.forEach(c => { map[c.gender] = (map[c.gender] || 0) + 1 })
  return {
    labels: Object.keys(map),
    datasets: [{
      data: Object.values(map),
      backgroundColor: ['#00d4aa', '#ff6b6b', '#a29bfe', '#ffe66d'],
      borderWidth: 0,
      hoverOffset: 8,
    }]
  }
})

/* ══════════════════════════════════════════════════════
   CHART: Color popularity
   ══════════════════════════════════════════════════════ */
const colorPopularity = computed(() => {
  const map: Record<string, number> = {}
  filtered.value.forEach(c => { map[c.color] = (map[c.color] || 0) + 1 })
  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10)
  const colorMap: Record<string, string> = {
    'Black': '#1a1a2e', 'White': '#e2e8f0', 'Red': '#ef4444', 'Blue': '#3b82f6',
    'Silver': '#94a3b8', 'Grey': '#64748b', 'Gray': '#64748b', 'Green': '#22c55e',
    'Yellow': '#eab308', 'Orange': '#f97316', 'Brown': '#92400e', 'Gold': '#d4a017',
    'Beige': '#d4c5a9', 'Pale White': '#f1f5f9',
  }
  return {
    labels: sorted.map(x => x[0]),
    datasets: [{
      label: 'Nombre de ventes',
      data: sorted.map(x => x[1]),
      backgroundColor: sorted.map(x => colorMap[x[0]] || PAL[0]),
      borderRadius: 6,
      borderSkipped: false,
      barThickness: 20,
    }]
  }
})

/* ══════════════════════════════════════════════════════
   CHART: Prix vs Revenu
   ══════════════════════════════════════════════════════ */
const priceVsIncome = computed(() => ({
  datasets: [{
    label: 'Véhicules',
    data: filtered.value.slice(0, 2000).map(c => ({
      x: c.annual_income,
      y: c.price,
      label: `${c.company} ${c.model}`
    })),
    backgroundColor: '#00d4aa55',
    pointRadius: 3,
    pointHoverRadius: 7,
    pointBorderColor: '#00d4aa',
    pointBorderWidth: 1,
  }]
}))

const scatterOpts: any = {
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      ...tooltipStyle,
      callbacks: {
        label: (c: any) => `${c.raw.label} — Revenu: ${c.raw.x.toLocaleString()} $ · Prix: ${c.raw.y.toLocaleString()} $`
      }
    }
  },
  scales: {
    x: { title: { display: true, text: 'Revenu annuel ($)', color: tc, font: cf }, grid: { color: gc }, ticks: { color: tc, font: cf, callback: (v: any) => `${(v/1000).toFixed(0)}k` } },
    y: { title: { display: true, text: 'Prix ($)', color: tc, font: cf }, grid: { color: gc }, ticks: { color: tc, font: cf, callback: (v: any) => `${(v/1000).toFixed(0)}k` } },
  },
}

/* ══════════════════════════════════════════════════════
   CHART: Ventes par mois (timeline)
   ══════════════════════════════════════════════════════ */
const salesTimeline = computed(() => {
  const map: Record<string, number> = {}
  filtered.value.forEach(c => {
    if (!c.date) return
    const d = c.date.substring(0, 7) // YYYY-MM
    map[d] = (map[d] || 0) + 1
  })
  const sorted = Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]))
  return {
    labels: sorted.map(x => x[0]),
    datasets: [{
      label: 'Ventes',
      data: sorted.map(x => x[1]),
      borderColor: '#00d4aa',
      backgroundColor: 'rgba(0,212,170,0.08)',
      fill: true,
      tension: 0.4,
      pointRadius: 2,
      pointHoverRadius: 6,
      pointBackgroundColor: '#00d4aa',
      borderWidth: 2,
    }]
  }
})

const lineOpts: any = {
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { ...tooltipStyle, callbacks: { label: (c: any) => ` ${c.raw} ventes` } }
  },
  scales: {
    x: { grid: { color: gc }, ticks: { color: tc, font: cf, maxRotation: 45, maxTicksLimit: 20 } },
    y: { grid: { color: gc }, ticks: { color: tc, font: cf } },
  },
}

/* ══════════════════════════════════════════════════════
   CHART: Revenu par mois (timeline)
   ══════════════════════════════════════════════════════ */
const revenueTimeline = computed(() => {
  const map: Record<string, number> = {}
  filtered.value.forEach(c => {
    if (!c.date) return
    const d = c.date.substring(0, 7)
    map[d] = (map[d] || 0) + c.price
  })
  const sorted = Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]))
  return {
    labels: sorted.map(x => x[0]),
    datasets: [{
      label: 'Revenu ($)',
      data: sorted.map(x => x[1]),
      borderColor: '#ff6b6b',
      backgroundColor: 'rgba(255,107,107,0.08)',
      fill: true,
      tension: 0.4,
      pointRadius: 2,
      pointHoverRadius: 6,
      pointBackgroundColor: '#ff6b6b',
      borderWidth: 2,
    }]
  }
})

const revenueLineOpts: any = {
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { ...tooltipStyle, callbacks: { label: (c: any) => ` ${c.raw.toLocaleString()} $` } }
  },
  scales: {
    x: { grid: { color: gc }, ticks: { color: tc, font: cf, maxRotation: 45, maxTicksLimit: 20 } },
    y: { grid: { color: gc }, ticks: { color: tc, font: cf, callback: (v: any) => `${(v/1000000).toFixed(1)}M` } },
  },
}

/* ══════════════════════════════════════════════════════
   CHART: Prix moyen par région
   ══════════════════════════════════════════════════════ */
const priceByRegion = computed(() => {
  const map: Record<string, number[]> = {}
  filtered.value.forEach(c => {
    if (!map[c.dealer_region]) map[c.dealer_region] = []
    map[c.dealer_region].push(c.price)
  })
  const sorted = Object.entries(map)
    .map(([region, prices]) => ({
      region,
      avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
      count: prices.length,
    }))
    .sort((a, b) => b.avg - a.avg)
  return {
    labels: sorted.map(x => x.region),
    datasets: [{
      label: 'Prix moyen ($)',
      data: sorted.map(x => x.avg),
      backgroundColor: sorted.map((_, i) => PAL[(i + 2) % PAL.length]),
      borderRadius: 6,
      borderSkipped: false,
      barThickness: 22,
    }]
  }
})

/* ══════════════════════════════════════════════════════
   CHART: Ventes par région
   ══════════════════════════════════════════════════════ */
const salesByRegion = computed(() => {
  const map: Record<string, number> = {}
  filtered.value.forEach(c => { map[c.dealer_region] = (map[c.dealer_region] || 0) + 1 })
  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1])
  return {
    labels: sorted.map(x => x[0]),
    datasets: [{
      label: 'Ventes',
      data: sorted.map(x => x[1]),
      backgroundColor: sorted.map((_, i) => PAL[(i + 7) % PAL.length]),
      borderRadius: 6,
      borderSkipped: false,
      barThickness: 22,
    }]
  }
})

/* ══════════════════════════════════════════════════════
   CHART: Income distribution
   ══════════════════════════════════════════════════════ */
const incomeDistribution = computed(() => {
  const buckets: Record<string, number> = {
    '< 200k': 0, '200k-400k': 0, '400k-600k': 0,
    '600k-800k': 0, '800k-1M': 0, '> 1M': 0
  }
  filtered.value.forEach(c => {
    const inc = c.annual_income
    if (inc < 200000) buckets['< 200k']++
    else if (inc < 400000) buckets['200k-400k']++
    else if (inc < 600000) buckets['400k-600k']++
    else if (inc < 800000) buckets['600k-800k']++
    else if (inc < 1000000) buckets['800k-1M']++
    else buckets['> 1M']++
  })
  return {
    labels: Object.keys(buckets),
    datasets: [{
      label: 'Clients',
      data: Object.values(buckets),
      backgroundColor: Object.keys(buckets).map((_, i) => PAL[(i + 4) % PAL.length]),
      borderRadius: 6,
      borderSkipped: false,
    }]
  }
})

/* ══════════════════════════════════════════════════════
   CHART: Prix moyen par body style
   ══════════════════════════════════════════════════════ */
const priceByBodyStyle = computed(() => {
  const map: Record<string, number[]> = {}
  filtered.value.forEach(c => {
    if (!map[c.body_style]) map[c.body_style] = []
    map[c.body_style].push(c.price)
  })
  const sorted = Object.entries(map)
    .map(([style, prices]) => ({
      style,
      avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
    }))
    .sort((a, b) => b.avg - a.avg)
  return {
    labels: sorted.map(x => x.style),
    datasets: [{
      label: 'Prix moyen ($)',
      data: sorted.map(x => x.avg),
      backgroundColor: sorted.map((_, i) => PAL[(i + 8) % PAL.length]),
      borderRadius: 6,
      borderSkipped: false,
    }]
  }
})

/* ══════════════════════════════════════════════════════
   CHART: Gender vs Average Price
   ══════════════════════════════════════════════════════ */
const genderPriceData = computed(() => {
  const map: Record<string, number[]> = {}
  filtered.value.forEach(c => {
    if (!map[c.gender]) map[c.gender] = []
    map[c.gender].push(c.price)
  })
  const entries = Object.entries(map).map(([g, prices]) => ({
    gender: g,
    avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
  }))
  return {
    labels: entries.map(e => e.gender),
    datasets: [{
      label: 'Prix moyen ($)',
      data: entries.map(e => e.avg),
      backgroundColor: ['#00d4aa', '#ff6b6b', '#a29bfe'],
      borderRadius: 6,
      borderSkipped: false,
    }]
  }
})

/* ══════════════════════════════════════════════════════
   TABLE: Top 10 dealers
   ══════════════════════════════════════════════════════ */
const topDealers = computed(() => {
  const map: Record<string, { count: number; revenue: number; region: string }> = {}
  filtered.value.forEach(c => {
    if (!map[c.dealer_name]) map[c.dealer_name] = { count: 0, revenue: 0, region: c.dealer_region }
    map[c.dealer_name].count++
    map[c.dealer_name].revenue += c.price
  })
  return Object.entries(map)
    .map(([name, d]) => ({ name, ...d, avgPrice: Math.round(d.revenue / d.count) }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
})

/* ══════════════════════════════════════════════════════
   TABLE: Top 10 models
   ══════════════════════════════════════════════════════ */
const topModels = computed(() => {
  const map: Record<string, { count: number; revenue: number; company: string }> = {}
  filtered.value.forEach(c => {
    const key = `${c.company} ${c.model}`
    if (!map[key]) map[key] = { count: 0, revenue: 0, company: c.company }
    map[key].count++
    map[key].revenue += c.price
  })
  return Object.entries(map)
    .map(([name, d]) => ({ name, ...d, avgPrice: Math.round(d.revenue / d.count) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
})

/* ══════════════════════════════════════════════════════
   CHART: Engine by Company (Stacked)
   ══════════════════════════════════════════════════════ */
const engineByCompany = computed(() => {
  const companyMap: Record<string, Record<string, number>> = {}
  const engines = new Set<string>()
  filtered.value.forEach(c => {
    if (!companyMap[c.company]) companyMap[c.company] = {}
    companyMap[c.company][c.engine] = (companyMap[c.company][c.engine] || 0) + 1
    engines.add(c.engine)
  })
  const topCompanies = Object.entries(companyMap)
    .map(([c, e]) => ({ c, total: Object.values(e).reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
    .map(x => x.c)

  const engineList = Array.from(engines).sort()
  return {
    labels: topCompanies,
    datasets: engineList.map((eng, i) => ({
      label: eng,
      data: topCompanies.map(c => companyMap[c]?.[eng] || 0),
      backgroundColor: PAL[(i + 2) % PAL.length],
      borderRadius: 4,
      borderSkipped: false,
    }))
  }
})

const stackedBarOpts: any = {
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom', labels: { color: '#94a3b8', font: cf, padding: 14, usePointStyle: true } },
    tooltip: { ...tooltipStyle, mode: 'index' }
  },
  scales: {
    x: { stacked: true, grid: { color: 'transparent' }, ticks: { color: tc, font: cf, maxRotation: 45 } },
    y: { stacked: true, grid: { color: gc }, ticks: { color: tc, font: cf } },
  },
}

/* ═══ helper format ═══ */
function fmt(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'
  return n.toString()
}
</script>

<template>
<div class="dash">
  <!-- Loading / Error -->
  <div v-if="loading" class="state"><div class="loader"></div><p>Chargement des données…</p></div>
  <div v-else-if="error" class="state"><p class="err">⚠ {{ error }}</p></div>

  <template v-else>
    <!-- HEADER -->
    <header class="header">
      <div class="header__left">
        <h1 class="title">
          <span class="title__icon">◈</span>
          Analyse Automobile
          <span class="title__badge">{{ totalCars.toLocaleString() }} véhicules</span>
        </h1>
        <p class="subtitle">Analyse complète de la base de données automobile</p>
      </div>
    </header>

    <!-- FILTERS -->
    <section class="filters">
      <div class="filter-group">
        <label>Marque</label>
        <select v-model="filterCompany">
          <option v-for="c in companies" :key="c" :value="c">{{ c === 'all' ? 'Toutes' : c }}</option>
        </select>
      </div>
      <div class="filter-group">
        <label>Région</label>
        <select v-model="filterRegion">
          <option v-for="r in regions" :key="r" :value="r">{{ r === 'all' ? 'Toutes' : r }}</option>
        </select>
      </div>
      <div class="filter-group">
        <label>Carrosserie</label>
        <select v-model="filterBodyStyle">
          <option v-for="b in bodyStyles" :key="b" :value="b">{{ b === 'all' ? 'Toutes' : b }}</option>
        </select>
      </div>
      <div class="filter-group">
        <label>Genre</label>
        <select v-model="filterGender">
          <option value="all">Tous</option>
          <option value="Male">Homme</option>
          <option value="Female">Femme</option>
        </select>
      </div>
      <button class="filter-reset" @click="filterCompany='all'; filterRegion='all'; filterBodyStyle='all'; filterGender='all'">
        ✕ Réinitialiser
      </button>
    </section>

    <!-- TABS -->
    <nav class="tabs">
      <button v-for="t in [
        { id: 'overview', label: '◉ Vue d\'ensemble' },
        { id: 'brands', label: '◆ Marques & Modèles' },
        { id: 'customers', label: '◇ Clients' },
        { id: 'dealers', label: '▣ Concessionnaires' },
        { id: 'trends', label: '▤ Tendances' },
      ]" :key="t.id"
        :class="['tab', { 'tab--active': activeTab === t.id }]"
        @click="activeTab = t.id as any">
        {{ t.label }}
      </button>
    </nav>

    <!-- ═══════════════════ TAB: OVERVIEW ═══════════════════ -->
    <div v-if="activeTab === 'overview'" class="content">
      <!-- KPI Row -->
      <div class="kpi-grid">
        <div class="kpi" v-for="(k, i) in [
          { val: totalCars.toLocaleString(), lbl: 'Ventes totales', icon: '⬡', accent: '#00d4aa' },
          { val: fmt(totalRevenue) + ' $', lbl: 'Revenu total', icon: '◈', accent: '#ff6b6b' },
          { val: avgPrice.toLocaleString() + ' $', lbl: 'Prix moyen', icon: '◇', accent: '#4ecdc4' },
          { val: medianPrice.toLocaleString() + ' $', lbl: 'Prix médian', icon: '▣', accent: '#ffe66d' },
          { val: uniqueModels.toString(), lbl: 'Modèles uniques', icon: '◆', accent: '#a29bfe' },
          { val: uniqueDealers.toString(), lbl: 'Concessionnaires', icon: '▤', accent: '#fd79a8' },
          { val: mostCommonCompany, lbl: 'Marque #1', icon: '★', accent: '#0984e3' },
          { val: topRegion, lbl: 'Région #1', icon: '◎', accent: '#6c5ce7' },
        ]" :key="i" :style="{ '--accent': k.accent, '--delay': i * 0.05 + 's' }">
          <span class="kpi__icon">{{ k.icon }}</span>
          <span class="kpi__val">{{ k.val }}</span>
          <span class="kpi__lbl">{{ k.lbl }}</span>
        </div>
      </div>

      <!-- Main Charts Row -->
      <div class="grid-2">
        <div class="card">
          <h3 class="card__h">Prix moyen par marque <span class="tag">Top 12</span></h3>
          <div class="chart-box chart-box--tall"><Bar :data="priceByCompany" :options="barOpts" /></div>
        </div>
        <div class="card">
          <h3 class="card__h">Volume de ventes par marque <span class="tag">Top 12</span></h3>
          <div class="chart-box chart-box--tall"><Bar :data="salesByCompany" :options="barVertOpts" /></div>
        </div>
      </div>

      <div class="grid-3">
        <div class="card">
          <h3 class="card__h">Transmission</h3>
          <div class="chart-box chart-box--md"><Doughnut :data="transmissionData" :options="dOpts" /></div>
        </div>
        <div class="card">
          <h3 class="card__h">Carrosserie</h3>
          <div class="chart-box chart-box--md"><Doughnut :data="bodyStyleData" :options="dOpts" /></div>
        </div>
        <div class="card">
          <h3 class="card__h">Motorisation</h3>
          <div class="chart-box chart-box--md"><Doughnut :data="engineData" :options="dOpts" /></div>
        </div>
      </div>

      <!-- Scatter full width -->
      <div class="card">
        <h3 class="card__h">Prix vs Revenu annuel client</h3>
        <div class="chart-box chart-box--lg"><Scatter :data="priceVsIncome" :options="scatterOpts" /></div>
      </div>
    </div>

    <!-- ═══════════════════ TAB: BRANDS ═══════════════════ -->
    <div v-if="activeTab === 'brands'" class="content">
      <div class="grid-2">
        <div class="card">
          <h3 class="card__h">Prix moyen par marque <span class="tag">Top 12</span></h3>
          <div class="chart-box chart-box--tall"><Bar :data="priceByCompany" :options="barOpts" /></div>
        </div>
        <div class="card">
          <h3 class="card__h">Motorisation par marque <span class="tag">Top 10</span></h3>
          <div class="chart-box chart-box--tall"><Bar :data="engineByCompany" :options="stackedBarOpts" /></div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <h3 class="card__h">Prix moyen par carrosserie</h3>
          <div class="chart-box chart-box--md"><Bar :data="priceByBodyStyle" :options="barVertOpts" /></div>
        </div>
        <div class="card">
          <h3 class="card__h">Couleurs les plus populaires <span class="tag">Top 10</span></h3>
          <div class="chart-box chart-box--md"><Bar :data="colorPopularity" :options="barOpts" /></div>
        </div>
      </div>

      <!-- Top Models Table -->
      <div class="card">
        <h3 class="card__h">Top 10 modèles les plus vendus</h3>
        <div class="table-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>#</th><th>Modèle</th><th>Ventes</th><th>Revenu total</th><th>Prix moyen</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(m, i) in topModels" :key="m.name">
                <td class="rank">{{ i + 1 }}</td>
                <td class="name">{{ m.name }}</td>
                <td>{{ m.count.toLocaleString() }}</td>
                <td>{{ m.revenue.toLocaleString() }} $</td>
                <td>{{ m.avgPrice.toLocaleString() }} $</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ═══════════════════ TAB: CUSTOMERS ═══════════════════ -->
    <div v-if="activeTab === 'customers'" class="content">
      <div class="kpi-grid kpi-grid--small">
        <div class="kpi" v-for="(k, i) in [
          { val: avgIncome.toLocaleString() + ' $', lbl: 'Revenu moyen', icon: '◈', accent: '#00d4aa' },
          { val: priceRange.min.toLocaleString() + ' $', lbl: 'Prix min', icon: '▽', accent: '#4ecdc4' },
          { val: priceRange.max.toLocaleString() + ' $', lbl: 'Prix max', icon: '△', accent: '#ff6b6b' },
          { val: topModel, lbl: 'Modèle préféré', icon: '★', accent: '#ffe66d' },
        ]" :key="i" :style="{ '--accent': k.accent, '--delay': i * 0.05 + 's' }">
          <span class="kpi__icon">{{ k.icon }}</span>
          <span class="kpi__val">{{ k.val }}</span>
          <span class="kpi__lbl">{{ k.lbl }}</span>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <h3 class="card__h">Répartition par genre</h3>
          <div class="chart-box chart-box--md"><Doughnut :data="genderData" :options="dOpts" /></div>
        </div>
        <div class="card">
          <h3 class="card__h">Prix moyen par genre</h3>
          <div class="chart-box chart-box--md"><Bar :data="genderPriceData" :options="barVertOpts" /></div>
        </div>
      </div>

      <div class="card">
        <h3 class="card__h">Distribution des revenus clients</h3>
        <div class="chart-box chart-box--md"><Bar :data="incomeDistribution" :options="barVertOpts" /></div>
      </div>

      <div class="card">
        <h3 class="card__h">Prix vs Revenu annuel client</h3>
        <div class="chart-box chart-box--lg"><Scatter :data="priceVsIncome" :options="scatterOpts" /></div>
      </div>
    </div>

    <!-- ═══════════════════ TAB: DEALERS ═══════════════════ -->
    <div v-if="activeTab === 'dealers'" class="content">
      <div class="grid-2">
        <div class="card">
          <h3 class="card__h">Prix moyen par région</h3>
          <div class="chart-box chart-box--tall"><Bar :data="priceByRegion" :options="barOpts" /></div>
        </div>
        <div class="card">
          <h3 class="card__h">Volume de ventes par région</h3>
          <div class="chart-box chart-box--tall"><Bar :data="salesByRegion" :options="barOpts" /></div>
        </div>
      </div>

      <div class="card">
        <h3 class="card__h">Top 10 concessionnaires par revenu</h3>
        <div class="table-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>#</th><th>Concessionnaire</th><th>Région</th><th>Ventes</th><th>Revenu total</th><th>Prix moyen</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(d, i) in topDealers" :key="d.name">
                <td class="rank">{{ i + 1 }}</td>
                <td class="name">{{ d.name }}</td>
                <td>{{ d.region }}</td>
                <td>{{ d.count.toLocaleString() }}</td>
                <td>{{ d.revenue.toLocaleString() }} $</td>
                <td>{{ d.avgPrice.toLocaleString() }} $</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ═══════════════════ TAB: TRENDS ═══════════════════ -->
    <div v-if="activeTab === 'trends'" class="content">
      <div class="card">
        <h3 class="card__h">Évolution des ventes par mois</h3>
        <div class="chart-box chart-box--lg"><Line :data="salesTimeline" :options="lineOpts" /></div>
      </div>
      <div class="card">
        <h3 class="card__h">Évolution du revenu par mois</h3>
        <div class="chart-box chart-box--lg"><Line :data="revenueTimeline" :options="revenueLineOpts" /></div>
      </div>
      <div class="grid-3">
        <div class="card">
          <h3 class="card__h">Transmission</h3>
          <div class="chart-box chart-box--md"><Doughnut :data="transmissionData" :options="dOpts" /></div>
        </div>
        <div class="card">
          <h3 class="card__h">Motorisation</h3>
          <div class="chart-box chart-box--md"><Doughnut :data="engineData" :options="dOpts" /></div>
        </div>
        <div class="card">
          <h3 class="card__h">Genre</h3>
          <div class="chart-box chart-box--md"><Doughnut :data="genderData" :options="dOpts" /></div>
        </div>
      </div>
    </div>
  </template>
</div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');

/* ═══════════ RESET & BASE ═══════════ */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
.dash {
  --bg: #0a0e17;
  --surface: #111827;
  --surface2: #1a2332;
  --border: #1e293b;
  --text: #e2e8f0;
  --text2: #94a3b8;
  --accent: #00d4aa;
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  font-family: 'Space Grotesk', sans-serif;
  padding: 24px;
  overflow-x: hidden;
}

/* ═══════════ LOADING ═══════════ */
.state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh; gap: 16px; color: var(--text2); }
.loader { width: 40px; height: 40px; border: 3px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg) } }
.err { color: #ff6b6b; }

/* ═══════════ HEADER ═══════════ */
.header { margin-bottom: 24px; }
.title {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.5px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.title__icon {
  color: var(--accent);
  font-size: 24px;
}
.title__badge {
  font-size: 11px;
  font-weight: 500;
  font-family: 'JetBrains Mono', monospace;
  background: rgba(0, 212, 170, 0.1);
  color: var(--accent);
  padding: 4px 10px;
  border-radius: 20px;
  border: 1px solid rgba(0, 212, 170, 0.2);
}
.subtitle { font-size: 13px; color: var(--text2); margin-top: 6px; }

/* ═══════════ FILTERS ═══════════ */
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-end;
  margin-bottom: 20px;
  padding: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
}
.filter-group { display: flex; flex-direction: column; gap: 4px; }
.filter-group label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text2);
  font-family: 'JetBrains Mono', monospace;
}
.filter-group select {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  padding: 8px 12px;
  font-size: 13px;
  font-family: 'Space Grotesk', sans-serif;
  cursor: pointer;
  min-width: 150px;
  transition: border-color 0.2s;
}
.filter-group select:hover { border-color: var(--accent); }
.filter-reset {
  background: rgba(255, 107, 107, 0.1);
  border: 1px solid rgba(255, 107, 107, 0.2);
  border-radius: 8px;
  color: #ff6b6b;
  padding: 8px 16px;
  font-size: 12px;
  font-family: 'JetBrains Mono', monospace;
  cursor: pointer;
  transition: all 0.2s;
}
.filter-reset:hover { background: rgba(255, 107, 107, 0.2); }

/* ═══════════ TABS ═══════════ */
.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 24px;
  overflow-x: auto;
  padding-bottom: 4px;
}
.tab {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--text2);
  padding: 10px 18px;
  font-size: 13px;
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}
.tab:hover { background: var(--surface); color: var(--text); }
.tab--active {
  background: var(--surface);
  border-color: var(--border);
  color: var(--accent);
  box-shadow: 0 0 12px rgba(0, 212, 170, 0.08);
}

/* ═══════════ KPI GRID ═══════════ */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}
.kpi-grid--small { grid-template-columns: repeat(4, 1fr); }
.kpi {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  position: relative;
  overflow: hidden;
  animation: fadeUp 0.4s ease both;
  animation-delay: var(--delay, 0s);
  transition: border-color 0.3s, box-shadow 0.3s;
}
.kpi:hover {
  border-color: var(--accent, #00d4aa);
  box-shadow: 0 0 20px rgba(0, 212, 170, 0.06);
}
.kpi::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: var(--accent);
  opacity: 0.6;
}
.kpi__icon {
  font-size: 18px;
  color: var(--accent);
  opacity: 0.7;
}
.kpi__val {
  font-size: 22px;
  font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
  letter-spacing: -0.5px;
}
.kpi__lbl {
  font-size: 11px;
  color: var(--text2);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 500;
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ═══════════ CARDS ═══════════ */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
  animation: fadeUp 0.5s ease both;
}
.card__h {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.tag {
  font-size: 10px;
  font-weight: 500;
  font-family: 'JetBrains Mono', monospace;
  background: rgba(0, 212, 170, 0.1);
  color: var(--accent);
  padding: 2px 8px;
  border-radius: 12px;
}

/* ═══════════ GRIDS ═══════════ */
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
.grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 16px; }

/* ═══════════ CHART CONTAINERS ═══════════ */
.chart-box { position: relative; width: 100%; height: 280px; }
.chart-box--tall { height: 380px; }
.chart-box--md { height: 300px; }
.chart-box--lg { height: 400px; }

/* ═══════════ TABLES ═══════════ */
.table-wrap { overflow-x: auto; }
.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.tbl th {
  text-align: left;
  padding: 10px 14px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text2);
  font-family: 'JetBrains Mono', monospace;
  border-bottom: 1px solid var(--border);
}
.tbl td {
  padding: 10px 14px;
  border-bottom: 1px solid rgba(30, 41, 59, 0.5);
  color: var(--text);
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
}
.tbl tr:hover td { background: rgba(0, 212, 170, 0.03); }
.tbl .rank {
  color: var(--accent);
  font-weight: 700;
  width: 40px;
}
.tbl .name { font-family: 'Space Grotesk', sans-serif; font-weight: 500; }

/* ═══════════ RESPONSIVE ═══════════ */
@media (max-width: 1024px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
  .grid-2, .grid-3 { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .dash { padding: 12px; }
  .kpi-grid { grid-template-columns: 1fr; }
  .title { font-size: 20px; }
  .tabs { gap: 2px; }
  .tab { padding: 8px 12px; font-size: 12px; }
  .filters { flex-direction: column; }
  .filter-group select { min-width: 100%; }
}
</style>