<script setup lang="ts">
import { ref } from 'vue'
import PlayerAnalysis from './components/PlayerAnalysis.vue'
import CarsAnalysis from './components/CarsAnalysis.vue'

const page = ref<'football' | 'cars'>('football')
const sidebarOpen = ref(false)

function nav(p: 'football' | 'cars') {
  page.value = p
  sidebarOpen.value = false
}
</script>

<template>
<div class="shell" :class="{ 'shell--open': sidebarOpen }">

  <!-- ════════════════════════ SIDEBAR ════════════════════════ -->
  <aside class="sidebar">

    <div class="sidebar__logo">
      <div class="sidebar__logo-mark">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      </div>
      <div class="sidebar__brand">
        <span class="sidebar__brand-name">Analytics</span>
        <span class="sidebar__brand-pro">Pro</span>
      </div>
    </div>

    <nav class="sidebar__nav">

      <!-- ── SECTION FOOTBALL ── -->
      <div class="sidebar__section">
        <span class="sidebar__section-label">Football</span>
        <button
          class="snav"
          :class="{ 'snav--on': page === 'football' }"
          @click="nav('football')"
        >
          <div class="snav__icon-wrap" :class="{ 'snav__icon-wrap--on': page === 'football' }">
            <svg class="snav__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 2c0 0-3 4-3 10s3 10 3 10"/>
              <path d="M12 2c0 0 3 4 3 10s-3 10-3 10"/>
              <path d="M2 12h20"/>
            </svg>
          </div>
          <div class="snav__text">
            <span class="snav__label">Analyse Football</span>
            <span class="snav__sub">Big 5 Ligues · Joueurs</span>
          </div>
          <div v-if="page === 'football'" class="snav__dot"></div>
        </button>
      </div>

      <!-- ── DIVIDER ── -->
      <div class="sidebar__divider">
        <span class="sidebar__divider-text">Autre analyse</span>
      </div>

      <!-- ── SECTION AUTOMOBILE ── -->
      <div class="sidebar__section">
        <span class="sidebar__section-label">Automobile</span>
        <button
          class="snav snav--car-mode"
          :class="{ 'snav--on-car': page === 'cars' }"
          @click="nav('cars')"
        >
          <div class="snav__icon-wrap snav__icon-wrap--car" :class="{ 'snav__icon-wrap--on-car': page === 'cars' }">
            <svg class="snav__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 17H3a2 2 0 01-2-2v-4a2 2 0 012-2h1l2-4h10l2 4h1a2 2 0 012 2v4a2 2 0 01-2 2h-2"/>
              <circle cx="7.5" cy="17.5" r="2.5"/>
              <circle cx="16.5" cy="17.5" r="2.5"/>
            </svg>
          </div>
          <div class="snav__text">
            <span class="snav__label">Analyse Automobile</span>
            <span class="snav__sub">Ventes · Concessionnaires</span>
          </div>
          <div v-if="page === 'cars'" class="snav__dot snav__dot--coral"></div>
        </button>
      </div>

    </nav>

    <div class="sidebar__footer">
      <div class="sidebar__footer-badge">
        <span class="sidebar__footer-dot"></span>
        <span>v3.0 · Plateforme Analytique</span>
      </div>
    </div>

  </aside>

  <!-- Overlay mobile -->
  <div class="overlay" v-if="sidebarOpen" @click="sidebarOpen = false"></div>

  <!-- ════════════════════════ MAIN AREA ════════════════════════ -->
  <div class="main">

    <!-- Topbar -->
    <header class="topbar">
      <button class="burger" @click="sidebarOpen = !sidebarOpen" aria-label="Menu">
        <span/><span/><span/>
      </button>
      <div class="topbar__breadcrumb">
        <span class="topbar__section">
          {{ page === 'football' ? '⚽ Analyse Football' : '🚗 Analyse Automobile' }}
        </span>
        <span class="topbar__sep">/</span>
        <span class="topbar__page">
          {{ page === 'football' ? 'Big 5 Ligues' : 'Tableau des ventes' }}
        </span>
      </div>
      <div class="topbar__switcher">
        <button
          class="sw-btn"
          :class="{ 'sw-btn--on': page === 'football' }"
          @click="nav('football')"
          title="Analyse Football"
        >⚽</button>
        <button
          class="sw-btn"
          :class="{ 'sw-btn--on-car': page === 'cars' }"
          @click="nav('cars')"
          title="Analyse Automobile"
        >🚗</button>
      </div>
    </header>

    <!-- Page content -->
    <div class="main__content">
      <Transition name="page" mode="out-in">
        <PlayerAnalysis v-if="page === 'football'" key="football" />
        <CarsAnalysis   v-else                      key="cars" />
      </Transition>
    </div>

  </div>

</div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');

*,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ═════ SHELL ═════ */
.shell {
  --bg:        #0a0e17;
  --sf:        #111827;
  --sf2:       #1a2332;
  --bd:        #1e293b;
  --bd2:       #334155;
  --tx:        #e2e8f0;
  --txd:       #94a3b8;
  --txdd:      #64748b;
  --green:     #00d4aa;
  --green-a:   rgba(0,212,170,.12);
  --coral:     #ff6b6b;
  --coral-a:   rgba(255,107,107,.12);
  --sidebar-w: 252px;
  --topbar-h:  58px;
  --r:         10px;
  --t:         .2s cubic-bezier(.4,0,.2,1);
  display: flex; min-height: 100vh;
  background: var(--bg); color: var(--tx);
  font-family: 'Space Grotesk', system-ui, sans-serif;
}

/* ═════ SIDEBAR ═════ */
.sidebar {
  position: fixed; top: 0; left: 0; bottom: 0;
  width: var(--sidebar-w);
  background: var(--sf); border-right: 1px solid var(--bd);
  display: flex; flex-direction: column;
  z-index: 30; transition: transform var(--t);
}

.sidebar__logo {
  display: flex; align-items: center; gap: 12px;
  padding: 22px 20px 20px; border-bottom: 1px solid var(--bd);
}
.sidebar__logo-mark {
  width: 36px; height: 36px; border-radius: 10px;
  background: linear-gradient(135deg, #00d4aa, #0090aa);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; box-shadow: 0 4px 16px rgba(0,212,170,.25);
}
.sidebar__logo-mark svg { width: 18px; height: 18px; stroke: #fff; }
.sidebar__brand { display: flex; align-items: baseline; gap: 3px; }
.sidebar__brand-name { font-size: 16px; font-weight: 700; color: #fff; letter-spacing: -.02em; }
.sidebar__brand-pro {
  font-size: 10px; font-weight: 700; font-family: 'JetBrains Mono', monospace;
  color: var(--green); background: var(--green-a);
  padding: 1px 6px; border-radius: 4px; margin-left: 1px;
}

.sidebar__nav {
  flex: 1; padding: 18px 12px;
  display: flex; flex-direction: column; gap: 2px;
  overflow-y: auto;
}

.sidebar__section { display: flex; flex-direction: column; gap: 3px; }
.sidebar__section-label {
  font-size: 9px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .12em; color: var(--txdd);
  font-family: 'JetBrains Mono', monospace;
  padding: 0 10px; margin-bottom: 2px;
}

.sidebar__divider {
  display: flex; align-items: center; gap: 8px;
  margin: 16px 4px;
}
.sidebar__divider::before,
.sidebar__divider::after { content: ''; flex: 1; height: 1px; background: var(--bd); }
.sidebar__divider-text {
  font-size: 9px; font-weight: 600; text-transform: uppercase;
  letter-spacing: .08em; color: var(--txdd);
  font-family: 'JetBrains Mono', monospace; white-space: nowrap;
}

/* Nav buttons */
.snav {
  display: flex; align-items: center; gap: 11px;
  padding: 9px 10px; border: none; border-radius: var(--r);
  background: transparent; color: var(--txd);
  font-family: 'Space Grotesk', sans-serif; font-size: 13px; font-weight: 500;
  cursor: pointer; transition: all var(--t);
  text-align: left; width: 100%; position: relative;
}
.snav:hover { background: rgba(255,255,255,.04); color: var(--tx); }
.snav--on { background: var(--green-a); }
.snav--on-car { background: var(--coral-a); }

.snav__icon-wrap {
  width: 34px; height: 34px; border-radius: 8px;
  background: rgba(255,255,255,.05);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; transition: background var(--t);
}
.snav__icon-wrap--on     { background: rgba(0,212,170,.2); }
.snav__icon-wrap--on-car { background: rgba(255,107,107,.2); }

.snav__ico { width: 16px; height: 16px; stroke: var(--txd); transition: stroke var(--t); }
.snav:hover .snav__ico     { stroke: var(--tx); }
.snav--on .snav__ico       { stroke: var(--green); }
.snav--on-car .snav__ico   { stroke: var(--coral); }

.snav__text { flex: 1; min-width: 0; }
.snav__label { display: block; font-size: 13px; font-weight: 600; color: var(--txd); line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: color var(--t); }
.snav__sub   { display: block; font-size: 10px; color: var(--txdd); font-family: 'JetBrains Mono', monospace; margin-top: 1px; }
.snav--on .snav__label     { color: #fff; }
.snav--on-car .snav__label { color: #fff; }

.snav__dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--green); flex-shrink: 0;
  box-shadow: 0 0 8px rgba(0,212,170,.6);
}
.snav__dot--coral {
  background: var(--coral);
  box-shadow: 0 0 8px rgba(255,107,107,.6);
}

.sidebar__footer {
  padding: 14px 18px; border-top: 1px solid var(--bd);
}
.sidebar__footer-badge {
  display: flex; align-items: center; gap: 7px;
  font-size: 10px; color: var(--txdd);
  font-family: 'JetBrains Mono', monospace;
}
.sidebar__footer-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--green); box-shadow: 0 0 6px rgba(0,212,170,.5);
  flex-shrink: 0;
}

/* Mobile */
.overlay { display: none; }
@media (max-width: 860px) {
  .sidebar { transform: translateX(-100%); }
  .shell--open .sidebar { transform: translateX(0); }
  .overlay {
    display: block; position: fixed; inset: 0;
    background: rgba(0,0,0,.65); z-index: 25;
    backdrop-filter: blur(4px);
  }
}

/* ═════ MAIN AREA ═════ */
.main {
  margin-left: var(--sidebar-w); flex: 1;
  display: flex; flex-direction: column; min-width: 0;
}
@media (max-width: 860px) { .main { margin-left: 0; } }

/* Topbar */
.topbar {
  position: sticky; top: 0; z-index: 15;
  display: flex; align-items: center; gap: 14px;
  height: var(--topbar-h); padding: 0 24px;
  background: rgba(10,14,23,.90);
  backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
  border-bottom: 1px solid var(--bd);
}

.burger {
  display: none; background: none; border: none; cursor: pointer;
  flex-direction: column; justify-content: space-between;
  width: 22px; height: 16px; flex-shrink: 0;
}
.burger span { display: block; width: 100%; height: 2px; background: var(--txd); border-radius: 2px; }
@media (max-width: 860px) { .burger { display: flex; } }

.topbar__breadcrumb {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px;
}
.topbar__section { font-weight: 600; color: #fff; }
.topbar__sep { color: var(--bd2); font-size: 16px; }
.topbar__page { color: var(--txd); }

.topbar__switcher {
  margin-left: auto; display: flex; gap: 4px;
  background: var(--sf2); border: 1px solid var(--bd);
  border-radius: 9px; padding: 3px;
}
.sw-btn {
  width: 36px; height: 30px; border: none;
  border-radius: 6px; background: transparent;
  font-size: 16px; cursor: pointer; line-height: 1;
  transition: background var(--t);
}
.sw-btn:hover { background: rgba(255,255,255,.06); }
.sw-btn--on     { background: rgba(0,212,170,.15); box-shadow: 0 0 12px rgba(0,212,170,.15); }
.sw-btn--on-car { background: rgba(255,107,107,.15); box-shadow: 0 0 12px rgba(255,107,107,.15); }

/* Content */
.main__content { flex: 1; }

/* Page transition */
.page-enter-active,
.page-leave-active { transition: opacity .18s ease, transform .18s ease; }
.page-enter-from { opacity: 0; transform: translateX(12px); }
.page-leave-to   { opacity: 0; transform: translateX(-12px); }
</style>
