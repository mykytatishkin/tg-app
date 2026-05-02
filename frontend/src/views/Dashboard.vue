<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuth } from '../composables/useAuth';
import { useTelegramWebApp } from '../composables/useTelegramWebApp';
import { useCity } from '../composables/useCity';
import { api } from '../api/client';

const router = useRouter();
const { t } = useI18n();
const { user, logout, refreshUser, isAuthenticated } = useAuth();
const { hapticFeedback } = useTelegramWebApp();
const { selectedCity, cityChangedInSession, setCity } = useCity();

const userReady = ref(false);
const cities = ref([]);
const showCityPicker = ref(false);
const studioAddress = 'Spaudos Rumai Vilnius';

function getGoogleMapsUrl(address) {
  if (!address?.trim()) return '';
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(address.trim());
}

async function loadCities() {
  try {
    cities.value = await api.get('/appointments/cities');
  } catch {
    cities.value = [];
  }
}

function onCityChange(city) {
  hapticFeedback?.('light');
  setCity(city);
  showCityPicker.value = false;
}

onMounted(async () => {
  if (isAuthenticated.value) {
    await Promise.all([refreshUser(), loadCities()]);
  }
  userReady.value = true;
  // Show city picker only if: cities available, none selected yet, and not changed in session
  if (cities.value.length > 1 && !selectedCity.value && !cityChangedInSession.value) {
    showCityPicker.value = true;
  }
});

const isMasterOrAdmin = computed(() => !!user.value?.isMaster || !!user.value?.isAdmin);
const isAdmin = computed(() => !!user.value?.isAdmin);

const iconV = 'v=3';
const adminNavItems = computed(() => [
  { path: '/admin/clients', label: t('dashboard.nav.clients'), icon: `/icons/clients.png?${iconV}` },
  { path: '/admin/stats', label: t('dashboard.nav.stats'), icon: `/icons/stats.png?${iconV}` },
  { path: '/admin/services', label: t('dashboard.nav.services'), icon: `/icons/services.png?${iconV}` },
  { path: '/admin/appointments', label: t('dashboard.nav.appointments'), icon: `/icons/appointments.png?${iconV}` },
  { path: '/admin/availability', label: t('dashboard.nav.availability'), icon: `/icons/availability.png?${iconV}` },
  { path: '/admin/custom-time-requests', label: t('dashboard.nav.customTimeRequests'), icon: '🕐' },
  { path: '/admin/portfolio', label: t('dashboard.nav.portfolio'), icon: '🖼️' },
  { path: '/giveaways', label: t('dashboard.nav.giveaways'), icon: `/icons/giveaways.png?${iconV}` },
  { path: '/admin/backups', label: t('dashboard.nav.backups'), icon: '💾' },
  { path: '/admin/broadcast', label: t('dashboard.nav.broadcast'), icon: '📢', adminOnly: true },
  { path: '/admin/suggestions', label: t('dashboard.nav.suggestions'), icon: '📩', adminOnly: true },
  { path: '/admin/settings', label: t('dashboard.nav.settings'), icon: '⚙️' },
  { path: '/admin/subscriptions', label: t('dashboard.nav.subscriptions'), icon: '💳', adminOnly: true },
]);

const userNavItems = computed(() => [
  { path: '/appointments', label: t('dashboard.nav.myAppointments'), icon: `/icons/appointments.png?${iconV}` },
  { path: '/appointments/book', label: t('dashboard.nav.book'), icon: '➕' },
  { path: '/profile', label: t('dashboard.nav.profile'), icon: '👤' },
  { path: '/promo', label: t('dashboard.nav.promo'), icon: `/icons/promo.png?${iconV}` },
  { path: '/giveaways', label: t('dashboard.nav.giveaways'), icon: `/icons/giveaways.png?${iconV}` },
]);

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
      <div class="text-[var(--tg-theme-hint-color,#999)] py-8">{{ t('common.loading') }}</div>
    </template>
    <template v-else>
      <h1 class="text-2xl font-bold mb-2 flex items-center gap-2">
        {{ t('dashboard.greeting', { name: user?.firstName || '👋' }) }}
        <span
          v-if="user?.stage === 'local'"
          class="text-xs font-normal px-2 py-0.5 rounded bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#fff)]"
        >
          {{ t('dashboard.testBadge') }}
        </span>
        <span
          v-if="isAdmin"
          class="text-xs font-normal px-2 py-0.5 rounded bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#fff)]"
        >
          {{ t('dashboard.adminBadge') }}
        </span>
      </h1>
      <p class="text-[var(--tg-theme-hint-color,#999)] mb-6">
        {{ isMasterOrAdmin ? (isAdmin ? t('dashboard.subtitleAdmin') : t('dashboard.subtitleMaster')) : t('dashboard.subtitleClient') }}
      </p>

      <!-- City picker modal (first-run or explicit change) -->
      <div
        v-if="showCityPicker && cities.length > 1"
        class="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/50"
      >
        <div class="w-full max-w-sm rounded-2xl p-5 bg-[var(--tg-theme-bg-color,#fff)] shadow-xl">
          <h3 class="text-lg font-semibold mb-3">Выберите город</h3>
          <div class="space-y-2">
            <button
              v-for="city in cities"
              :key="city"
              type="button"
              class="w-full text-left px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] font-medium"
              @click="onCityChange(city)"
            >
              {{ city }}
            </button>
          </div>
        </div>
      </div>

      <!-- City selector row (when cities available) -->
      <div
        v-if="!isMasterOrAdmin && cities.length > 1"
        class="mb-4 flex items-center justify-between p-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] border border-[var(--tg-theme-section-separator-color)]"
      >
        <span class="text-sm text-[var(--tg-theme-hint-color,#999)]">Город</span>
        <button
          type="button"
          class="text-sm font-medium text-[var(--tg-theme-link-color,#2481cc)]"
          @click="showCityPicker = true; hapticFeedback?.('light')"
        >
          {{ selectedCity || 'Выбрать' }} ▾
        </button>
      </div>

      <div
        v-if="!isMasterOrAdmin"
        class="mb-4 p-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] border border-[var(--tg-theme-section-separator-color)]"
      >
        <div class="text-sm font-medium text-[var(--tg-theme-hint-color,#999)] mb-1">{{ t('dashboard.studioAddress') }}</div>
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
          {{ t('common.logout') }}
        </button>
        <RouterLink
          to="/suggestions/new?category=bug"
          class="py-2 text-sm text-[var(--tg-theme-hint-color,#999)] no-underline"
          @click="hapticFeedback?.('light')"
        >
          {{ t('common.foundBug') }}
        </RouterLink>
      </div>
    </template>
  </div>
</template>
