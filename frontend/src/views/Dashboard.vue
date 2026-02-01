<script setup>
import { useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';
import { useTelegramWebApp } from '../composables/useTelegramWebApp';

const router = useRouter();
const { user } = useAuth();
const { hapticFeedback } = useTelegramWebApp();

const navItems = [
  { path: '/clients', label: 'Clients', icon: '👥' },
  { path: '/appointments', label: 'Appointments', icon: '📅' },
  { path: '/services', label: 'Services', icon: '💅' },
  { path: '/giveaways', label: 'Giveaways', icon: '🎁' },
];

function goTo(path) {
  hapticFeedback?.('light');
  router.push(path);
}
</script>

<template>
  <div class="min-h-screen p-4 pb-24 bg-[var(--tg-theme-bg-color,#fff)] text-[var(--tg-theme-text-color,#000)]">
    <h1 class="text-2xl font-bold mb-2">
      Hello, {{ user?.firstName || 'Master' }}!
    </h1>
    <p class="text-[var(--tg-theme-hint-color,#999)] mb-6">
      Manage your nail studio
    </p>

    <div class="grid gap-3">
      <button
        v-for="item in navItems"
        :key="item.path"
        class="flex items-center gap-4 p-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f0f0f0)] text-left"
        @click="goTo(item.path)"
      >
        <span class="text-2xl">{{ item.icon }}</span>
        <span class="font-medium">{{ item.label }}</span>
      </button>
    </div>
  </div>
</template>
