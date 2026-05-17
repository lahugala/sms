<template>
  <teleport to="body">
    <div class="toast-container">
      <transition-group name="toast-slide" tag="div" class="toast-list">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="['toast', `toast-${toast.type}`]"
          @click="dismiss(toast.id)"
        >
          <span class="toast-icon">{{ iconMap[toast.type] }}</span>
          <span class="toast-message">{{ toast.message }}</span>
          <span class="toast-close">✕</span>
        </div>
      </transition-group>
    </div>
  </teleport>
</template>

<script setup>
import { useToast } from '../composables/useToast.js'

const { toasts, dismiss } = useToast()

const iconMap = {
  success: '✅',
  error: '❌',
  info: 'ℹ️',
  warning: '⚠️',
}
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: var(--space-xl);
  right: var(--space-xl);
  z-index: 9999;
}

.toast-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.toast {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: 14px var(--space-lg);
  border-radius: var(--radius-md);
  min-width: 280px;
  max-width: 400px;
  box-shadow: var(--shadow-lg);
  cursor: pointer;
  backdrop-filter: blur(12px);
  border: 1px solid;
}

.toast-success {
  background: rgba(0, 229, 160, 0.08);
  border-color: rgba(0, 229, 160, 0.3);
}

.toast-error {
  background: rgba(255, 94, 122, 0.08);
  border-color: rgba(255, 94, 122, 0.3);
}

.toast-info {
  background: rgba(108, 99, 255, 0.08);
  border-color: rgba(108, 99, 255, 0.3);
}

.toast-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.toast-message {
  flex: 1;
  font-size: 14px;
  color: var(--clr-text-primary);
  line-height: 1.4;
}

.toast-close {
  font-size: 12px;
  color: var(--clr-text-muted);
  flex-shrink: 0;
}

.toast-slide-enter-active {
  animation: slideInRight 0.3s ease;
}

.toast-slide-leave-active {
  animation: slideOutRight 0.25s ease forwards;
}

@keyframes slideInRight {
  from { transform: translateX(110%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes slideOutRight {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(110%); opacity: 0; }
}
</style>
