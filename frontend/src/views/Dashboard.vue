<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';
import { useTelegramWebApp } from '../composables/useTelegramWebApp';

const router = useRouter();
const { user, logout, refreshUser, isAuthenticated } = useAuth();
const { hapticFeedback } = useTelegramWebApp();

const userReady = ref(false);
const studioAddress = 'Spaudos Rumai Vilnius';

function getGoogleMapsUrl(address) {
  if (!address?.trim()) return '';
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(address.trim());
}

onMounted(async () => {
  if (isAuthenticated.value) {
    await refreshUser();
  }
  userReady.value = true;
});

const isMasterOrAdmin = computed(() => !!user.value?.isMaster || !!user.value?.isAdmin);
const isAdmin = computed(() => !!user.value?.isAdmin);

const iconV = 'v=3';
const adminNavItems = [
  { path: '/admin/clients', label: 'Клиенты', icon: `/icons/clients.png?${iconV}` },
  { path: '/admin/stats', label: 'Статистика', icon: `/icons/stats.png?${iconV}` },
  { path: '/admin/services', label: 'Услуги', icon: `/icons/services.png?${iconV}` },
  { path: '/admin/appointments', label: 'Записи', icon: `/icons/appointments.png?${iconV}` },
  { path: '/admin/availability', label: 'Окошки', icon: `/icons/availability.png?${iconV}` },
  { path: '/admin/custom-time-requests', label: 'Запросы своего времени', icon: '🕐' },
  { path: '/giveaways', label: 'Розыгрыши', icon: `/icons/giveaways.png?${iconV}` },
  { path: '/admin/backups', label: 'Бекапы', icon: '💾' },
  { path: '/admin/broadcast', label: 'Рассылка', icon: '📢', adminOnly: true },
  { path: '/admin/suggestions', label: 'Предложения', icon: '📩', adminOnly: true },
  { path: '/admin/settings', label: 'Настройки профиля', icon: '⚙️' },
];

const userNavItems = [
  { path: '/appointments', label: 'Мои записи', icon: `/icons/appointments.png?${iconV}` },
  { path: '/appointments/book', label: 'Записаться', icon: '➕' },
  { path: '/profile', label: 'Мой профиль', icon: '👤' },
  { path: '/promo', label: 'Скидки', icon: `/icons/promo.png?${iconV}` },
  { path: '/giveaways', label: 'Розыгрыши', icon: `/icons/giveaways.png?${iconV}` },
];

function onNavClick() {
  hapticFeedback?.('light');
}

function handleLogout() {
  hapticFeedback?.('light');
  logout();
  router.replace({ name: 'Login' });
}
</script>

<template>
  <div class="min-h-screen p-4 pb-24 bg-[var(--tg-theme-bg-color)] text-[var(--tg-theme-text-color)]">
    <template v-if="!userReady">
      <div class="text-[var(--tg-theme-hint-color,#999)] py-8">Загрузка…</div>
    </template>
    <template v-else>
      <h1 class="text-2xl font-bold mb-2 flex items-center gap-2">
        Привет, {{ user?.firstName || 'друг' }}!
        <!-- Показывается всем (админам, мастерам, клиентам) при STAGE=local -->
        <span
          v-if="user?.stage === 'local'"
          class="text-xs font-normal px-2 py-0.5 rounded bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#fff)]"
        >
          in test
        </span>
        <span
          v-if="isAdmin"
          class="text-xs font-normal px-2 py-0.5 rounded bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#fff)]"
        >
          Админ
        </span>
      </h1>
      <p class="text-[var(--tg-theme-hint-color,#999)] mb-6">
        {{ isMasterOrAdmin ? (isAdmin ? 'Просмотр и управление данными мастеров' : 'Управление студией маникюра') : 'Записывайтесь и смотрите свои визиты' }}
      </p>

      <div
        v-if="!isMasterOrAdmin"
        class="mb-4 p-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] border border-[var(--tg-theme-section-separator-color)]"
      >
        <div class="text-sm font-medium text-[var(--tg-theme-hint-color,#999)] mb-1">Адрес студии</div>
        <a
          :href="getGoogleMapsUrl(studioAddress)"
          target="_blank"
          rel="noopener noreferrer"
          class="text-[var(--tg-theme-link-color,#2481cc)] underline break-words"
          @click="hapticFeedback?.('light')"
        >
          {{ studioAddress }}
        </a>
      </div>

      <div class="grid gap-3">
        <template v-if="isMasterOrAdmin">
        <RouterLink
          v-for="item in adminNavItems.filter((i) => !i.adminOnly || isAdmin)"
          :key="item.path"
          :to="item.path"
          class="flex items-center gap-4 p-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-left no-underline text-[var(--tg-theme-text-color)] cursor-pointer active:opacity-90"
          @click="onNavClick"
        >
          <span class="nav-icon-wrap text-2xl">
            <img
              v-if="item.icon.startsWith('/')"
              :src="item.icon"
              :alt="item.label"
              :class="['nav-icon', { 'nav-icon-rounded': item.path === '/admin/stats' || item.path === '/admin/services' }]"
            />
            <span v-else>{{ item.icon }}</span>
          </span>
          <span class="font-medium">{{ item.label }}</span>
        </RouterLink>
      </template>
      <template v-else>
        <RouterLink
          v-for="item in userNavItems"
          :key="item.path"
          :to="item.path"
          class="flex items-center gap-4 p-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-left no-underline text-[var(--tg-theme-text-color)] cursor-pointer active:opacity-90"
          @click="onNavClick"
        >
          <span class="nav-icon-wrap text-2xl">
            <img
              v-if="item.icon.startsWith('/')"
              :src="item.icon"
              :alt="item.label"
              :class="['nav-icon', 'nav-icon-client', { 'nav-icon-rounded': item.path === '/promo' }]"
            />
            <span v-else>{{ item.icon }}</span>
          </span>
          <span class="font-medium">{{ item.label }}</span>
        </RouterLink>
      </template>
      </div>

      <div class="mt-8 pt-6 border-t border-[var(--tg-theme-section-separator-color)] flex items-center justify-between gap-2">
        <button
          type="button"
          class="py-2 text-sm text-[var(--tg-theme-hint-color,#999)]"
          @click="handleLogout"
        >
          Выйти
        </button>
        <RouterLink
          to="/suggestions/new?category=bug"
          class="py-2 text-sm text-[var(--tg-theme-hint-color,#999)] no-underline"
          @click="hapticFeedback?.('light')"
        >
          Нашли ошибку?
        </RouterLink>
      </div>
    </template>
  </div>
</template>
