<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from '../../composables/useAuth';
import { useTelegramWebApp } from '../../composables/useTelegramWebApp';
import { useAdminMasters } from '../../composables/useAdminMasters';
import { api } from '../../api/client';

const route = useRoute();
const router = useRouter();
const { user, refreshUser } = useAuth();
const { hapticFeedback } = useTelegramWebApp();
const { isAdmin, masters, selectedMasterId, selectedMasterName, loadMasters } = useAdminMasters();

const options = ref([]);
const newOption = ref('');
const saving = ref(false);
const error = ref(null);
const loading = ref(true);

async function loadMyDrinks() {
  await refreshUser();
  options.value = Array.isArray(user.value?.drinkOptions) ? [...user.value.drinkOptions] : [];
}

async function loadMasterDrinks(masterId) {
  loading.value = true;
  error.value = null;
  try {
    const data = await api.get(`/auth/users/${masterId}`);
    options.value = Array.isArray(data?.drinkOptions) ? [...data.drinkOptions] : [];
  } catch (e) {
    error.value = e.message;
    options.value = [];
  } finally {
    loading.value = false;
  }
}

async function load() {
  if (isAdmin.value && selectedMasterId.value) {
    await loadMasterDrinks(selectedMasterId.value);
    return;
  }
  if (!isAdmin.value) {
    loading.value = true;
    await loadMyDrinks();
    loading.value = false;
  }
}

function goBack() {
  hapticFeedback?.('light');
  if (isAdmin.value && selectedMasterId.value) {
    router.push('/admin/drinks');
    return;
  }
  router.push('/');
}

function masterDisplayName(m) {
  return [m.firstName, m.lastName].filter(Boolean).join(' ').trim() || m.id;
}

function selectMaster(m) {
  hapticFeedback?.('light');
  router.push({ path: '/admin/drinks', query: { masterId: m.id } });
}

function addOption() {
  const v = newOption.value?.trim();
  if (!v) return;
  if (options.value.includes(v)) return;
  options.value.push(v);
  newOption.value = '';
}

function removeOption(idx) {
  hapticFeedback?.('light');
  options.value.splice(idx, 1);
}

async function save() {
  hapticFeedback?.('light');
  saving.value = true;
  error.value = null;
  try {
    if (isAdmin.value && selectedMasterId.value) {
      await api.patch(`/auth/users/${selectedMasterId.value}`, { drinkOptions: options.value });
    } else {
      await api.patch('/auth/me', { drinkOptions: options.value });
      await refreshUser();
    }
    error.value = null;
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  if (isAdmin.value) await loadMasters();
  await load();
});
watch(selectedMasterId, load);
</script>

<template>
  <div class="min-h-screen p-4 pb-24 bg-[var(--tg-theme-bg-color)] text-[var(--tg-theme-text-color)]">
    <div class="flex items-center gap-3 mb-4">
      <button
        type="button"
        class="shrink-0 p-2 rounded-lg bg-[var(--tg-theme-secondary-bg-color)] border border-[var(--tg-theme-section-separator-color)]"
        @click="goBack"
      >
        ← Назад
      </button>
      <h1 class="text-xl font-bold min-w-0 truncate">
        {{ isAdmin && selectedMasterId ? `Напитки — ${selectedMasterName || 'Мастер'}` : 'Напитки для клиентов' }}
      </h1>
    </div>

    <!-- Админ: список мастеров (без выбранного) -->
    <template v-if="isAdmin && !selectedMasterId">
      <p class="text-sm text-[var(--tg-theme-hint-color,#999)] mb-3">Выберите мастера, чтобы настроить его варианты напитков</p>
      <ul class="space-y-3">
        <li
          v-for="m in masters"
          :key="m.id"
          class="p-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] active:opacity-90 cursor-pointer"
          @click="selectMaster(m)"
        >
          <div class="font-medium">{{ masterDisplayName(m) }}</div>
        </li>
      </ul>
    </template>

    <template v-else>
    <div class="mb-6 p-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] border border-[var(--tg-theme-section-separator-color)]">
      <p class="text-sm text-[var(--tg-theme-text-color)] leading-relaxed">
        За 5–10 минут до сеанса клиенту придёт напоминание «Желаете что-то выпить?» с кнопками из этого списка. Выбор клиента отправится вам в бот.
      </p>
    </div>

    <p v-if="error" class="text-neutral-400 mb-4">{{ error }}</p>
    <div v-if="loading" class="text-[var(--tg-theme-hint-color,#999)] mb-4">Загрузка…</div>

    <div class="mb-6 p-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] border border-[var(--tg-theme-section-separator-color)] space-y-3">
      <label for="drink-option-input" class="block text-sm font-medium text-[var(--tg-theme-text-color)]">Добавить вариант</label>
      <div class="flex flex-col gap-2">
        <input
          id="drink-option-input"
          v-model="newOption"
          type="text"
          placeholder="Напр. Кофе, Чай, Вода"
          class="w-full min-w-0 p-3 rounded-lg bg-[var(--tg-theme-bg-color)] border border-[var(--tg-theme-section-separator-color)]"
          @keydown.enter.prevent="addOption"
        >
        <button
          type="button"
          class="w-full py-2 px-4 rounded-lg bg-[var(--tg-theme-button-color)] text-[var(--tg-theme-button-text-color)] border border-[var(--tg-theme-section-separator-color)]"
          @click="addOption"
        >
          Добавить
        </button>
      </div>
    </div>

    <ul v-if="options.length" class="space-y-2 mb-6">
      <li
        v-for="(opt, idx) in options"
        :key="idx"
        class="p-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] border border-[var(--tg-theme-section-separator-color)] flex items-center justify-between gap-2"
      >
        <span>{{ opt }}</span>
        <button
          type="button"
          class="text-sm px-2 py-1 rounded border border-[var(--tg-theme-section-separator-color)] bg-[var(--tg-theme-section-bg-color)] text-[var(--tg-theme-text-color)]"
          @click="removeOption(idx)"
        >
          Удалить
        </button>
      </li>
    </ul>
    <p v-else class="text-[var(--tg-theme-hint-color)] mb-6">Пока нет вариантов. Добавьте выше.</p>

    <button
      v-if="!loading"
      type="button"
      class="w-full py-3 px-4 rounded-xl font-medium bg-[var(--tg-theme-button-color)] text-[var(--tg-theme-button-text-color)] border border-[var(--tg-theme-section-separator-color)] disabled:opacity-60"
      :disabled="saving"
      @click="save"
    >
      {{ saving ? 'Сохраняю…' : 'Сохранить список' }}
    </button>
    </template>
  </div>
</template>
