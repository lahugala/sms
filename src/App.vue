<template>
  <div class="app-layout">
    <!-- Sidebar -->
    <Sidebar />

    <!-- Main Content -->
    <div class="main-content">
      <!-- Top Bar -->
      <TopBar />

      <!-- Page Content -->
      <div class="page-wrapper">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </div>

    <!-- Toast Notifications -->
    <ToastContainer />
  </div>
</template>

<script setup>
import Sidebar from './components/Sidebar.vue'
import TopBar from './components/TopBar.vue'
import ToastContainer from './components/ToastContainer.vue'
</script>
