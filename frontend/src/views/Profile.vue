<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { api } from '../api/client';
import { useTelegramWebApp } from '../composables/useTelegramWebApp';
import { setLocale, getLocale, LOCALE_LABELS, SUPPORTED } from '../i18n/index.js';

const router = useRouter();
const { t } = useI18n();
const { hapticFeedback } = useTelegramWebApp();

const currentLocale = ref(getLocale());
const localeOptions = SUPPORTED.map((l) => ({ value: l, label: LOCALE_LABELS[l] }));

function onLocaleChange(lang) {
  setLocale(lang);
  currentLocale.value = lang;
  hapticFeedback?.('light');
}

const profile = ref(null);
const instagram = ref('');
const loading = ref(true);
const saving = ref(false);
const error = ref(null);
const message = ref(null);
const myStats = ref(null);
const favoriteDays = ref([]);
const favoriteTimeBuckets = ref([]);
const savingPrefs = ref(false);

const DAY_LABELS = computed(() => {
  const days = t('profile.days');
  return [
    { value: 1, label: days[1] },
    { value: 2, label: days[2] },
    { value: 3, label: days[3] },
    { value: 4, label: days[4] },
    { value: 5, label: days[5] },
    { value: 6, label: days[6] },
    { value: 0, label: days[0] },
  ];
});
const TIME_LABELS = computed(() => {
  const tb = t('profile.timeBuckets');
  return [
    { value: 'morning', label: tb.morning },
    { value: 'afternoon', label: tb.afternoon },
    { value: 'evening', label: tb.evening },
  ];
});

async function load() {
  loading.value = true;
  error.value = null;
  message.value = null;
  try {
    const [profileRes, statsRes] = await Promise.all([
      api.get('/appointments/profile'),
      api.get('/appointments/my-stats').catch(() => null),
    ]);
    profile.value = profileRes;
    if (profile.value) {
      instagram.value = profile.value.instagram ?? '';
      favoriteDays.value = profile.value.favoriteDays ?? [];
      favoriteTimeBuckets.value = profile.value.favoriteTimeBuckets ?? [];
    }
    myStats.value = statsRes;
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  error.value = null;
  message.value = null;
  try {
    const res = await api.patch('/appointments/profile', { instagram: instagram.value?.trim() || undefined });
    profile.value = res;
    if (res) instagram.value = res.instagram ?? '';
    message.value = 'Сохранено.';
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}

function toggleDay(day) {
  const idx = favoriteDays.value.indexOf(day);
  if (idx >= 0) favoriteDays.value.splice(idx, 1);
  else favoriteDays.value.push(day);
}
function toggleTimeBucket(bucket) {
  const idx = favoriteTimeBuckets.value.indexOf(bucket);
  if (idx >= 0) favoriteTimeBuckets.value.splice(idx, 1);
  else favoriteTimeBuckets.value.push(bucket);
}
async function savePreferences() {
  savingPrefs.value = true;
  error.value = null;
  message.value = null;
  try {
    const res = await api.patch('/appointments/profile', {
      favoriteDays: favoriteDays.value.length > 0 ? favoriteDays.value : [],
      favoriteTimeBuckets: favoriteTimeBuckets.value.length > 0 ? favoriteTimeBuckets.value : [],
    });
    profile.value = res;
    if (res) {
      favoriteDays.value = res.favoriteDays ?? [];
      favoriteTimeBuckets.value = res.favoriteTimeBuckets ?? [];
    }
    message.value = 'Предпочтения сохранены.';
  } catch (e) {
    error.value = e.message;
  } finally {
    savingPrefs.value = false;
  }
}

function goBack() {
  hapticFeedback?.('light');
  router.push('/');
}

onMounted(load);
</script>

<template>
  <div class="min-h-screen p-4 pb-24 bg-[var(--tg-theme-bg-color,#e8e8e8)] text-[var(--tg-theme-text-color,#000)]">
    <div class="flex items-center gap-3 mb-6">
      <button
        class="p-2 rounded-lg bg-[var(--tg-theme-secondary-bg-color,#f0f0f0)]"
        @click="goBack"
      >
        {{ t('common.back') }}
      </button>
      <h1 class="text-2xl font-bold">{{ t('profile.title') }}</h1>
    </div>

    <p v-if="error" class="text-red-500 mb-4">{{ error }}</p>
    <p v-if="message" class="text-[var(--tg-theme-hint-color,#999)] mb-4">{{ message }}</p>

    <div v-if="loading" class="text-[var(--tg-theme-hint-color,#999)]">{{ t('common.loading') }}</div>

    <template v-else-if="profile">
      <div class="rounded-xl p-4 bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] mb-6">
        <div class="text-sm text-[var(--tg-theme-hint-color,#999)] mb-1">Имя</div>
        <div class="font-medium">{{ profile.name }}</div>
      </div>
      <form class="rounded-xl p-4 bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] mb-6" @submit.prevent="save">
        <label for="profile-instagram" class="block text-sm font-medium mb-2">Instagram</label>
        <input
          id="profile-instagram"
          v-model="instagram"
          type="text"
          placeholder="@username или ссылка на профиль"
          class="w-full px-3 py-2 rounded-lg border border-[var(--tg-theme-hint-color,#999)] bg-[var(--tg-theme-bg-color,#e8e8e8)] mb-4"
        />
        <p class="text-xs text-[var(--tg-theme-hint-color,#999)] mb-4">
          Укажите ник или ссылку — мастер сможет видеть ваш профиль. Вход в Instagram не требуется.
        </p>
        <button
          type="submit"
          class="px-4 py-2 rounded-lg bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#e8e8e8)]"
          :disabled="saving"
        >
          {{ saving ? t('common.saving') : t('common.save') }}
        </button>
      </form>

      <!-- Language selector -->
      <div class="rounded-xl p-4 bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] mb-6">
        <div class="text-sm font-medium mb-3">{{ t('profile.language') }}</div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="opt in localeOptions"
            :key="opt.value"
            type="button"
            class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            :class="currentLocale === opt.value ? 'bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#fff)]' : 'bg-[var(--tg-theme-bg-color,#e8e8e8)] text-[var(--tg-theme-text-color,#000)]'"
            @click="onLocaleChange(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <!-- Favorite days & time preferences -->
      <div class="rounded-xl p-4 bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] mb-6">
        <div class="text-sm font-medium mb-3">{{ t('profile.favDays') }}</div>
        <div class="flex flex-wrap gap-2 mb-4">
          <button
            v-for="d in DAY_LABELS"
            :key="d.value"
            type="button"
            class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            :class="favoriteDays.includes(d.value) ? 'bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#fff)]' : 'bg-[var(--tg-theme-bg-color,#e8e8e8)] text-[var(--tg-theme-text-color,#000)]'"
            @click="toggleDay(d.value)"
          >
            {{ d.label }}
          </button>
        </div>
        <div class="text-sm font-medium mb-3">{{ t('profile.favTimes') }}</div>
        <div class="flex flex-wrap gap-2 mb-4">
          <button
            v-for="t in TIME_LABELS"
            :key="t.value"
            type="button"
            class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            :class="favoriteTimeBuckets.includes(t.value) ? 'bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#fff)]' : 'bg-[var(--tg-theme-bg-color,#e8e8e8)] text-[var(--tg-theme-text-color,#000)]'"
            @click="toggleTimeBucket(t.value)"
          >
            {{ t.label }}
          </button>
        </div>
        <p class="text-xs text-[var(--tg-theme-hint-color,#999)] mb-3">
          Выберите удобные дни и время — мы учтём это при рекомендации свободных слотов.
        </p>
        <button
          type="button"
          class="px-4 py-2 rounded-lg bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#e8e8e8)]"
          :disabled="savingPrefs"
          @click="savePreferences"
        >
          {{ savingPrefs ? t('common.saving') : t('common.save') }}
        </button>
      </div>
    </template>

    <template v-else>
      <p class="text-[var(--tg-theme-hint-color,#999)]">
        Ваш профиль появится после первой записи к мастеру. Тогда здесь можно будет указать Instagram.
      </p>
    </template>

    <!-- Client spending stats -->
    <div v-if="myStats && myStats.totalSpent > 0" class="mt-6 pt-6 border-t border-[var(--tg-theme-section-separator-color,#e0e0e0)]">
      <h2 class="text-lg font-medium mb-3">Моя статистика</h2>
      <div class="rounded-xl p-4 bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] mb-3">
        <div class="text-sm text-[var(--tg-theme-hint-color,#999)]">Всего потрачено</div>
        <div class="text-2xl font-semibold">{{ myStats.totalSpent.toFixed(2) }} €</div>
      </div>
      <div v-for="m in myStats.byMaster" :key="m.masterName" class="rounded-xl p-4 bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] mb-3">
        <div class="flex items-start justify-between gap-2 mb-2">
          <div class="font-medium">{{ m.masterName }}</div>
          <div class="text-sm font-medium text-[var(--tg-theme-button-color,#1a1a1a)]">{{ m.totalSpent.toFixed(2) }} €</div>
        </div>
        <div class="text-xs text-[var(--tg-theme-hint-color,#999)] mb-2">{{ m.appointmentCount }} завершённых записей</div>
        <ul v-if="m.byService?.length" class="space-y-1">
          <li v-for="s in m.byService" :key="s.name" class="flex justify-between text-sm">
            <span>{{ s.name }}</span>
            <span class="text-[var(--tg-theme-hint-color,#999)]">{{ s.total.toFixed(2) }} €</span>
          </li>
        </ul>
      </div>
    </div>

    <div class="mt-6 pt-6 border-t border-[var(--tg-theme-section-separator-color,#e0e0e0)]">
      <h2 class="text-lg font-medium mb-2">{{ t('profile.feedback') }}</h2>
      <p class="text-sm text-[var(--tg-theme-hint-color,#999)] mb-3">
        Есть идея по улучшению или нашли ошибку? Напишите нам.
      </p>
      <div class="flex flex-wrap gap-2">
        <RouterLink
          to="/suggestions/new"
          class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] text-[var(--tg-theme-text-color,#000)] no-underline font-medium"
        >
          Оставить предложение →
        </RouterLink>
        <RouterLink
          to="/suggestions/new?category=bug"
          class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] text-[var(--tg-theme-text-color,#000)] no-underline font-medium"
        >
          {{ t('profile.bugReport') }}
        </RouterLink>
      </div>
    </div>
  </div>
</template>
