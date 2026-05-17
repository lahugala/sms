<template>
  <div class="animate-in">
    <div class="page-header">
      <div>
        <h1 class="page-title">Inbox</h1>
        <p class="page-subtitle">Received SMS messages from your Android device</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-ghost btn-sm" @click="refreshMessages" :disabled="isRefreshing" id="refresh-inbox-btn">
          <span v-if="isRefreshing" class="spinner spinner-sm"></span>
          <span v-else>🔄</span>
          {{ isRefreshing ? 'Refreshing...' : 'Refresh' }}
        </button>
        <div class="auto-refresh-badge" :class="{ active: autoRefresh }">
          <span class="pulse-dot" v-if="autoRefresh"></span>
          <span>{{ autoRefresh ? 'Live' : 'Paused' }}</span>
          <button class="toggle-live" @click="autoRefresh = !autoRefresh" :title="autoRefresh ? 'Pause auto-refresh' : 'Enable auto-refresh'">
            {{ autoRefresh ? '⏸' : '▶' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Cloud mode warning -->
    <div v-if="store.config.mode === 'cloud'" class="cloud-warning card">
      <span class="warn-icon">☁️</span>
      <div>
        <h3>Local Mode Required</h3>
        <p>The Inbox API (<code>GET /inbox</code>) is only available in <strong>Local Mode</strong>. Switch to Local in Settings to use this feature.</p>
      </div>
      <router-link to="/settings" class="btn btn-primary btn-sm">Go to Settings</router-link>
    </div>

    <!-- Not configured -->
    <div v-else-if="!store.isConfigured" class="cloud-warning card">
      <span class="warn-icon">🔌</span>
      <div>
        <h3>Gateway Not Configured</h3>
        <p>Please configure your SMS Gateway credentials in Settings first.</p>
      </div>
      <router-link to="/settings" class="btn btn-primary btn-sm">Go to Settings</router-link>
    </div>

    <template v-else>
      <!-- Filters -->
      <div class="filter-bar card">
        <div class="filter-row">
          <!-- Search -->
          <div class="search-wrap">
            <span class="search-icon">🔍</span>
            <input
              id="inbox-search"
              v-model="searchQuery"
              type="text"
              class="form-control search-input"
              placeholder="Search by sender or message..."
              @input="resetPage"
            />
          </div>

          <!-- Type filter -->
          <select v-model="filterType" class="form-control filter-select" @change="loadInbox" id="inbox-type-filter">
            <option value="SMS">📱 SMS</option>
            <option value="MMS">📷 MMS</option>
            <option value="DATA_SMS">📦 Data SMS</option>
          </select>

          <!-- SIM filter -->
          <select v-model="filterSim" class="form-control filter-select" @change="resetPage" id="inbox-sim-filter">
            <option value="">All SIMs</option>
            <option value="1">SIM 1</option>
            <option value="2">SIM 2</option>
          </select>

          <div class="message-count">
            <span>{{ filteredMessages.length }} of {{ totalCount }} messages</span>
          </div>
        </div>
      </div>

      <!-- Loading state -->
      <div v-if="isLoading" class="loading-state card">
        <span class="spinner spinner-lg"></span>
        <span>Loading inbox...</span>
      </div>

      <!-- Error state -->
      <div v-else-if="loadError" class="error-state card">
        <span style="font-size: 32px;">⚠️</span>
        <div>
          <h3>Failed to load inbox</h3>
          <p>{{ loadError }}</p>
          <p class="error-hint">Make sure the SMS Gateway app has <strong>Read SMS permission</strong> enabled and the Receive Messages feature is turned on in the app settings.</p>
        </div>
        <button class="btn btn-ghost" @click="loadInbox">Try Again</button>
      </div>

      <!-- Feature-not-enabled error (404) -->
      <div v-else-if="featureNotEnabled" class="setup-guide card">
        <div class="setup-guide-header">
          <span style="font-size:36px">🔧</span>
          <div>
            <h3>Inbox Feature Not Enabled</h3>
            <p>The <code>GET /inbox</code> endpoint returned 404. You need to enable the feature inside the Android app.</p>
          </div>
        </div>
        <ol class="setup-checklist">
          <li>
            <span class="check-num">1</span>
            <div><strong>Open SMS Gateway app</strong> on your Android phone</div>
          </li>
          <li>
            <span class="check-num">2</span>
            <div><strong>Tap the menu / Settings</strong> → look for <em>"Receive Messages"</em> or <em>"Inbox"</em></div>
          </li>
          <li>
            <span class="check-num">3</span>
            <div><strong>Enable "Read SMS"</strong> and grant the <em>READ_SMS</em> Android permission when prompted</div>
          </li>
          <li>
            <span class="check-num">4</span>
            <div><strong>Tap 🔄 Retry</strong> below after enabling</div>
          </li>
        </ol>
        <button class="btn btn-primary" @click="loadInbox()">🔄 Retry</button>
      </div>

      <!-- Empty state -->
      <div v-else-if="filteredMessages.length === 0 && !isLoading && !loadError" class="empty-outer">

        <!-- Filter active: simple message -->
        <div v-if="searchQuery || filterSim" class="empty-state card">
          <span style="font-size:40px">🔍</span>
          <h3>No messages match your filter</h3>
          <p>Try clearing the search or SIM filter.</p>
        </div>

        <!-- No filter: show full setup guide -->
        <template v-else>
          <div class="empty-state card">
            <span style="font-size:48px">📭</span>
            <h3>Inbox is empty</h3>
            <p>The app is connected but no received messages are stored yet.</p>
            <p class="empty-hint">The SMS Gateway app only stores messages received <strong>after</strong> the Inbox feature is enabled. Use the "Pull History" tool below to import past messages.</p>
            <div class="empty-actions">
              <button class="btn btn-ghost" @click="refreshMessages" :disabled="isRefreshing">
                <span v-if="isRefreshing" class="spinner spinner-sm"></span>
                <span v-else>🔄</span>
                {{ isRefreshing ? 'Refreshing...' : 'Refresh' }}
              </button>
            </div>
          </div>

          <!-- Historical Pull Panel -->
          <div class="pull-panel card">
            <div class="pull-panel-header">
              <span style="font-size:24px">📥</span>
              <div>
                <h3 class="pull-title">Pull Historical Messages</h3>
                <p class="pull-desc">Force the Android app to re-read SMS messages from a specific date range and populate the inbox.</p>
              </div>
            </div>
            <div class="pull-fields">
              <div class="form-group">
                <label class="form-label" for="pull-since">From date</label>
                <input id="pull-since" v-model="pullSince" type="datetime-local" class="form-control" :max="pullUntil || undefined" />
              </div>
              <div class="form-group">
                <label class="form-label" for="pull-until">To date</label>
                <input id="pull-until" v-model="pullUntil" type="datetime-local" class="form-control" :min="pullSince || undefined" :max="nowLocal" />
              </div>
            </div>
            <div class="pull-presets">
              <button class="preset-btn" @click="setPreset(1)">Last 24h</button>
              <button class="preset-btn" @click="setPreset(7)">Last 7 days</button>
              <button class="preset-btn" @click="setPreset(30)">Last 30 days</button>
            </div>
            <button
              class="btn btn-primary"
              @click="pullHistorical"
              :disabled="isPulling || !pullSince || !pullUntil"
              id="pull-historical-btn"
            >
              <span v-if="isPulling" class="spinner"></span>
              <span v-else>📥</span>
              {{ isPulling ? 'Pulling...' : 'Pull Messages from Device' }}
            </button>
            <p v-if="pullResult" class="pull-result" :class="pullResult.ok ? 'pull-ok' : 'pull-err'">
              {{ pullResult.ok ? '✅ ' + pullResult.msg : '❌ ' + pullResult.msg }}
            </p>
            <p class="pull-note">ℹ️ Requires SMS Gateway app v1.x+ with Inbox enabled. The device re-reads its SMS database and populates <code>GET /inbox</code>.</p>
          </div>
        </template>
      </div>

      <!-- Message list -->
      <div v-else class="inbox-list">
        <div
          v-for="msg in paginatedMessages"
          :key="msg.id"
          class="inbox-card card"
          :class="{ expanded: expandedId === msg.id }"
          @click="toggleExpand(msg.id)"
        >
          <!-- Card header -->
          <div class="inbox-header">
            <div class="sender-avatar">{{ senderInitial(msg.sender) }}</div>
            <div class="inbox-meta">
              <div class="inbox-meta-row">
                <span class="sender-number">{{ msg.sender }}</span>
                <span class="inbox-time">{{ formatTime(msg.createdAt) }}</span>
              </div>
              <div class="inbox-meta-row">
                <span class="inbox-preview" :class="{ hidden: expandedId === msg.id }">
                  {{ msg.contentPreview }}
                </span>
                <div class="inbox-tags">
                  <span v-if="msg.simNumber" class="sim-tag">SIM {{ msg.simNumber }}</span>
                  <span class="type-tag">{{ msg.type }}</span>
                </div>
              </div>
            </div>
            <span class="expand-arrow">{{ expandedId === msg.id ? '▲' : '▼' }}</span>
          </div>

          <!-- Expanded body -->
          <transition name="fade">
            <div v-if="expandedId === msg.id" class="inbox-body">
              <div class="message-bubble">
                {{ msg.contentPreview }}
              </div>
              <div class="inbox-detail-row">
                <span class="detail-label">From</span>
                <code class="detail-value">{{ msg.sender }}</code>
                <button class="reply-btn" @click.stop="replyTo(msg.sender)" title="Reply to this number">
                  ↩ Reply
                </button>
              </div>
              <div class="inbox-detail-row">
                <span class="detail-label">To</span>
                <code class="detail-value">{{ msg.recipient }}</code>
              </div>
              <div class="inbox-detail-row">
                <span class="detail-label">Received</span>
                <span class="detail-value">{{ formatFullTime(msg.createdAt) }}</span>
              </div>
              <div class="inbox-detail-row">
                <span class="detail-label">Message ID</span>
                <code class="detail-value small">{{ msg.id }}</code>
              </div>
            </div>
          </transition>
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="pagination">
          <button class="page-btn" :disabled="currentPage === 1" @click="currentPage--">◀ Prev</button>
          <span class="page-info">Page {{ currentPage }} of {{ totalPages }}</span>
          <button class="page-btn" :disabled="currentPage === totalPages" @click="currentPage++">Next ▶</button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { store } from '../store/index.js'
import { getInbox, refreshInbox } from '../services/smsApi.js'
import { useToast } from '../composables/useToast.js'

const router = useRouter()
const { success, error: toastError } = useToast()

// State
const messages        = ref([])
const totalCount      = ref(0)
const isLoading       = ref(false)
const isRefreshing    = ref(false)
const loadError       = ref(null)
const featureNotEnabled = ref(false)  // true when API returns 404
const expandedId      = ref(null)
const autoRefresh     = ref(true)
const searchQuery     = ref('')
const filterType      = ref('SMS')
const filterSim       = ref('')
const currentPage     = ref(1)
const PAGE_SIZE       = 20

// Historical pull state
const pullSince  = ref('')
const pullUntil  = ref('')
const isPulling  = ref(false)
const pullResult = ref(null)

// 'now' formatted for datetime-local max attr
const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
  .toISOString().slice(0, 16)

function setPreset(days) {
  const now  = new Date()
  const from = new Date(now - days * 86400_000)
  const fmt  = d => new Date(d - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  pullSince.value = fmt(from)
  pullUntil.value = fmt(now)
}

// Polling interval
let pollTimer = null

// Computed
const filteredMessages = computed(() => {
  let result = messages.value
  const q = searchQuery.value.toLowerCase()
  if (q) {
    result = result.filter(m =>
      m.sender?.toLowerCase().includes(q) ||
      m.contentPreview?.toLowerCase().includes(q) ||
      m.recipient?.toLowerCase().includes(q)
    )
  }
  if (filterSim.value) {
    result = result.filter(m => String(m.simNumber) === filterSim.value)
  }
  return result
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredMessages.value.length / PAGE_SIZE)))

const paginatedMessages = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filteredMessages.value.slice(start, start + PAGE_SIZE)
})

// Methods
async function loadInbox(silent = false) {
  if (!store.apiClient || store.config.mode !== 'local') return
  if (!silent) { isLoading.value = true; featureNotEnabled.value = false }
  loadError.value = null

  try {
    const result = await getInbox(store.apiClient, {
      type: filterType.value,
      limit: 200,
      offset: 0,
    })
    messages.value  = result.messages
    totalCount.value = result.total || result.messages.length
  } catch (err) {
    const status = err.response?.status
    if (status === 404) {
      featureNotEnabled.value = true   // show setup guide
    } else if (!silent) {
      loadError.value = err.response?.data?.message || err.message || 'Failed to load inbox'
    }
  } finally {
    isLoading.value = false
  }
}

async function pullHistorical() {
  if (!store.apiClient || isPulling.value) return
  isPulling.value = true
  pullResult.value = null
  try {
    // Convert local datetime-local values to UTC ISO strings
    const since = new Date(pullSince.value).toISOString()
    const until = new Date(pullUntil.value).toISOString()
    await refreshInbox(store.apiClient, { since, until })
    // Give the device a couple seconds to process, then reload
    await new Promise(r => setTimeout(r, 2000))
    await loadInbox(true)
    pullResult.value = { ok: true, msg: 'Request sent! Messages should appear above within a few seconds.' }
    success('📥 Historical pull requested successfully!')
  } catch (err) {
    const msg = err.response?.data?.message || err.message || 'Failed to pull historical messages'
    pullResult.value = { ok: false, msg }
    toastError(`❌ ${msg}`)
  } finally {
    isPulling.value = false
  }
}

async function refreshMessages() {
  if (!store.apiClient || isRefreshing.value) return
  isRefreshing.value = true
  try {
    await refreshInbox(store.apiClient)
    await loadInbox(true)
    success('📥 Inbox refreshed!')
  } catch (err) {
    // /inbox/refresh might not be available on all versions — fall back to just reload
    await loadInbox(true)
    success('📥 Inbox reloaded!')
  } finally {
    isRefreshing.value = false
  }
}

function toggleExpand(id) {
  expandedId.value = expandedId.value === id ? null : id
}

function senderInitial(sender) {
  if (!sender) return '?'
  const cleaned = sender.replace(/^\+/, '')
  return cleaned.length > 0 ? cleaned.slice(-2) : '?'
}

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now - d
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function formatFullTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'medium' })
}

function resetPage() {
  currentPage.value = 1
}

function replyTo(phoneNumber) {
  router.push({ path: '/send', query: { to: phoneNumber } })
}

// Watch filterType to reload from API
watch(filterType, () => {
  resetPage()
  loadInbox()
})

// Auto-refresh polling (every 30s)
watch(autoRefresh, (val) => {
  clearInterval(pollTimer)
  if (val) {
    pollTimer = setInterval(() => loadInbox(true), 30_000)
  }
})

onMounted(() => {
  if (store.isConfigured && store.config.mode === 'local') {
    loadInbox()
    pollTimer = setInterval(() => loadInbox(true), 30_000)
  }
})

onUnmounted(() => {
  clearInterval(pollTimer)
})
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-lg);
  margin-bottom: var(--space-xl);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-shrink: 0;
}

.auto-refresh-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px 5px 8px;
  border-radius: var(--radius-full);
  border: 1px solid var(--clr-border);
  font-size: 12px;
  color: var(--clr-text-muted);
  background: rgba(255,255,255,0.03);
}

.auto-refresh-badge.active {
  border-color: rgba(0, 229, 160, 0.3);
  color: var(--clr-accent-success);
  background: rgba(0, 229, 160, 0.05);
}

.pulse-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--clr-accent-success);
  animation: pulse-glow 1.5s ease-in-out infinite;
}

.toggle-live {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 13px;
  padding: 0 2px;
  color: inherit;
}

/* Cloud warning */
.cloud-warning {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  padding: var(--space-lg) var(--space-xl);
  background: rgba(255, 179, 71, 0.05);
  border-color: rgba(255, 179, 71, 0.25);
  margin-bottom: var(--space-lg);
}

.warn-icon {
  font-size: 32px;
  flex-shrink: 0;
}

.cloud-warning h3 {
  color: var(--clr-accent-warning);
  margin-bottom: 4px;
  font-size: 15px;
  font-weight: 700;
}

.cloud-warning p {
  font-size: 13px;
  color: var(--clr-text-secondary);
}

.cloud-warning code {
  font-family: var(--font-mono);
  background: rgba(255,179,71,0.15);
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 12px;
}

/* Filter bar */
.filter-bar {
  padding: var(--space-md) var(--space-lg);
  margin-bottom: var(--space-lg);
}

.filter-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.search-wrap {
  position: relative;
  flex: 1;
  min-width: 200px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 14px;
  pointer-events: none;
}

.search-input {
  padding-left: 36px !important;
}

.filter-select {
  width: auto;
  min-width: 120px;
}

.message-count {
  font-size: 12px;
  color: var(--clr-text-muted);
  white-space: nowrap;
  margin-left: auto;
}

/* States */
.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  padding: var(--space-xl) var(--space-xl);
  text-align: center;
  min-height: 200px;
}

.error-state h3,
.empty-state h3 {
  font-size: 16px;
  font-weight: 700;
  color: var(--clr-text-primary);
}

.error-state p,
.empty-state p {
  font-size: 13px;
  color: var(--clr-text-secondary);
  max-width: 400px;
}

.error-hint {
  font-size: 12px !important;
  color: var(--clr-text-muted) !important;
  background: rgba(255, 94, 122, 0.05);
  border: 1px solid rgba(255, 94, 122, 0.15);
  border-radius: var(--radius-sm);
  padding: var(--space-sm) var(--space-md);
  margin-top: var(--space-xs);
}

/* Inbox list */
.inbox-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.inbox-card {
  padding: var(--space-md) var(--space-lg);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.inbox-card:hover {
  border-color: var(--clr-border-hover);
  transform: translateX(2px);
}

.inbox-card.expanded {
  border-color: rgba(108, 99, 255, 0.3);
  background: rgba(108, 99, 255, 0.03);
}

/* Card header */
.inbox-header {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.sender-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: var(--gradient-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-mono);
  color: #fff;
  flex-shrink: 0;
  letter-spacing: -1px;
}

.inbox-meta {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.inbox-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}

.sender-number {
  font-size: 14px;
  font-weight: 700;
  font-family: var(--font-mono);
  color: var(--clr-text-primary);
}

.inbox-time {
  font-size: 11px;
  color: var(--clr-text-muted);
  flex-shrink: 0;
}

.inbox-preview {
  font-size: 13px;
  color: var(--clr-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.inbox-preview.hidden {
  opacity: 0;
}

.inbox-tags {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.sim-tag {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: var(--radius-full);
  background: rgba(108, 99, 255, 0.15);
  color: var(--clr-accent-primary);
}

.type-tag {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: var(--radius-full);
  background: rgba(0, 229, 160, 0.1);
  color: var(--clr-accent-success);
}

.expand-arrow {
  font-size: 11px;
  color: var(--clr-text-muted);
  flex-shrink: 0;
}

/* Expanded body */
.inbox-body {
  padding-top: var(--space-md);
  margin-top: var(--space-md);
  border-top: 1px solid var(--clr-border);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.message-bubble {
  background: rgba(108, 99, 255, 0.06);
  border: 1px solid rgba(108, 99, 255, 0.15);
  border-radius: var(--radius-md);
  padding: var(--space-md) var(--space-lg);
  font-size: 14px;
  color: var(--clr-text-primary);
  line-height: 1.6;
  word-break: break-word;
  white-space: pre-wrap;
}

.inbox-detail-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 12px;
}

.detail-label {
  width: 70px;
  color: var(--clr-text-muted);
  flex-shrink: 0;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  font-size: 11px;
}

.detail-value {
  color: var(--clr-text-secondary);
  font-family: var(--font-mono);
  font-size: 12px;
}

.detail-value.small {
  font-size: 10px;
  word-break: break-all;
}

.reply-btn {
  margin-left: auto;
  background: rgba(108, 99, 255, 0.1);
  border: 1px solid rgba(108, 99, 255, 0.25);
  color: var(--clr-accent-primary);
  border-radius: var(--radius-sm);
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.reply-btn:hover {
  background: rgba(108, 99, 255, 0.2);
}

/* Pagination */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  margin-top: var(--space-md);
  padding: var(--space-md);
}

.page-btn {
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--clr-border);
  color: var(--clr-text-secondary);
  border-radius: var(--radius-sm);
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.page-btn:hover:not(:disabled) {
  background: rgba(108, 99, 255, 0.1);
  border-color: var(--clr-border-hover);
  color: var(--clr-accent-primary);
}

.page-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.page-info {
  font-size: 13px;
  color: var(--clr-text-muted);
}

/* Spinner sizes */
.spinner-sm {
  width: 14px;
  height: 14px;
}

.spinner-lg {
  width: 36px;
  height: 36px;
  border-width: 3px;
}

.btn-sm {
  padding: 6px 14px;
  font-size: 13px;
}

@media (max-width: 700px) {
  .filter-row {
    flex-direction: column;
    align-items: stretch;
  }
  .filter-select {
    width: 100%;
  }
  .message-count {
    margin-left: 0;
  }
}

/* 404 setup guide */
.setup-guide {
  padding: var(--space-xl);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}
.setup-guide-header {
  display: flex;
  align-items: flex-start;
  gap: var(--space-lg);
}
.setup-guide-header h3 {
  font-size: 16px;
  font-weight: 700;
  color: var(--clr-accent-warning);
  margin-bottom: 6px;
}
.setup-guide-header p { font-size: 13px; color: var(--clr-text-secondary); }
.setup-guide-header code {
  font-family: var(--font-mono);
  background: rgba(255,179,71,0.15);
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 12px;
}
.setup-checklist {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}
.setup-checklist li {
  display: flex;
  align-items: flex-start;
  gap: var(--space-md);
  font-size: 13px;
  color: var(--clr-text-secondary);
}
.check-num {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(255,179,71,0.15);
  color: var(--clr-accent-warning);
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* Empty outer wrapper */
.empty-outer {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}
.empty-hint {
  font-size: 12px !important;
  color: var(--clr-text-muted) !important;
  background: rgba(108,99,255,0.05);
  border: 1px solid rgba(108,99,255,0.15);
  border-radius: var(--radius-sm);
  padding: var(--space-sm) var(--space-md);
  margin-top: var(--space-xs);
  max-width: 440px !important;
  line-height: 1.6 !important;
}
.empty-actions { margin-top: var(--space-sm); }

/* Historical pull panel */
.pull-panel {
  padding: var(--space-xl);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  border-color: rgba(108,99,255,0.2);
  background: rgba(108,99,255,0.03);
}
.pull-panel-header {
  display: flex;
  align-items: flex-start;
  gap: var(--space-md);
}
.pull-title { font-size: 15px; font-weight: 700; color: var(--clr-text-primary); margin-bottom: 4px; }
.pull-desc  { font-size: 13px; color: var(--clr-text-secondary); }
.pull-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-md);
}
.pull-presets {
  display: flex;
  gap: var(--space-sm);
  flex-wrap: wrap;
}
.preset-btn {
  background: rgba(108,99,255,0.08);
  border: 1px solid rgba(108,99,255,0.2);
  color: var(--clr-accent-primary);
  border-radius: var(--radius-full);
  padding: 4px 14px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.preset-btn:hover {
  background: rgba(108,99,255,0.18);
}
.pull-result {
  font-size: 13px;
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-sm);
  font-weight: 600;
}
.pull-ok  { color: var(--clr-accent-success); background: rgba(0,229,160,0.07); border: 1px solid rgba(0,229,160,0.2); }
.pull-err { color: var(--clr-accent-danger);  background: rgba(255,94,122,0.07); border: 1px solid rgba(255,94,122,0.2); }
.pull-note {
  font-size: 11px;
  color: var(--clr-text-muted);
  line-height: 1.5;
}
.pull-note code {
  font-family: var(--font-mono);
  background: rgba(255,255,255,0.06);
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 11px;
}
@media (max-width: 600px) {
  .pull-fields { grid-template-columns: 1fr; }
}
</style>
