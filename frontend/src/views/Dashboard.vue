<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';
import { useTelegramWebApp } from '../composables/useTelegramWebApp';

const router = useRouter();
const { user, logout } = useAuth();
const { hapticFeedback } = useTelegramWebApp();

const isMasterOrAdmin = computed(() => !!user.value?.isMaster || !!user.value?.isAdmin);

const adminNavItems = [
  { path: '/admin/clients', label: 'Клиенты', icon: '👥' },
  { path: '/admin/stats', label: 'Статистика', icon: '📊' },
  { path: '/admin/services', label: 'Услуги', icon: '💅' },
  { path: '/admin/appointments', label: 'Записи', icon: '📅' },
  { path: '/admin/availability', label: 'Доступность', icon: '🕐' },
  { path: '/giveaways', label: 'Розыгрыши', icon: '🎁' },
];

const userNavItems = [
  { path: '/appointments', label: 'My appointments', icon: '📅' },
  { path: '/appointments/book', label: 'Book appointment', icon: '➕' },
  { path: '/giveaways', label: 'Giveaways', icon: '🎁' },
];

function goTo(path) {
  hapticFeedback?.('light');
  router.push(path);
}

function handleLogout() {
  hapticFeedback?.('light');
  logout();
  router.replace({ name: 'Login' });
}
</script>

<template>
  <div class="min-h-screen p-4 pb-24 bg-[var(--tg-theme-bg-color,#fff)] text-[var(--tg-theme-text-color,#000)]">
    <h1 class="text-2xl font-bold mb-2">
      Hello, {{ user?.firstName || 'there' }}!
    </h1>
    <p class="text-[var(--tg-theme-hint-color,#999)] mb-6">
      {{ isMasterOrAdmin ? 'Manage your nail studio' : 'Book and view your appointments' }}
    </p>

    <div class="grid gap-3">
      <template v-if="isMasterOrAdmin">
        <button
          v-for="item in adminNavItems"
          :key="item.path"
          class="flex items-center gap-4 p-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f0f0f0)] text-left"
          @click="goTo(item.path)"
        >
          <span class="text-2xl">{{ item.icon }}</span>
          <span class="font-medium">{{ item.label }}</span>
        </button>
      </template>
      <template v-else>
        <button
          v-for="item in userNavItems"
          :key="item.path"
          class="flex items-center gap-4 p-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f0f0f0)] text-left"
          @click="goTo(item.path)"
        >
          <span class="text-2xl">{{ item.icon }}</span>
          <span class="font-medium">{{ item.label }}</span>
        </button>
      </template>
    </div>

    <div class="mt-8 pt-6 border-t border-[var(--tg-theme-section-separator-color,#e5e5e5)]">
      <button
        type="button"
        class="w-full py-2 text-sm text-[var(--tg-theme-hint-color,#999)]"
        @click="handleLogout"
      >
        Выйти
      </button>
    </div>
  </div>
</template>
