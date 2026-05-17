<template>
  <header class="topbar">
    <div class="topbar-left">
      <h2 class="topbar-title">{{ pageTitle }}</h2>
    </div>
    <div class="topbar-right">
      <div class="mode-pill" :class="store.config.mode === 'local' ? 'mode-local' : 'mode-cloud'">
        <span>{{ store.config.mode === 'local' ? '🏠 Local' : '☁️ Cloud' }}</span>
      </div>
      <router-link to="/send" class="btn btn-primary btn-sm" id="quick-send-btn">
        <span>✉️</span> Quick Send
      </router-link>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { store } from '../store/index.js'

const route = useRoute()
const pageTitle = computed(() => route.meta.title || 'SMS Gateway')
</script>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-xl);
  height: var(--topbar-height);
  background: rgba(10, 13, 20, 0.8);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--clr-border);
  position: sticky;
  top: 0;
  z-index: 50;
}

.topbar-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--clr-text-primary);
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.mode-pill {
  display: flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 600;
}

.mode-local {
  background: rgba(0, 229, 160, 0.1);
  border: 1px solid rgba(0, 229, 160, 0.25);
  color: var(--clr-accent-success);
}

.mode-cloud {
  background: rgba(79, 195, 247, 0.1);
  border: 1px solid rgba(79, 195, 247, 0.25);
  color: var(--clr-accent-secondary);
}
</style>
