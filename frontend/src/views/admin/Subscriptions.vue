<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../../api/client';
import { useTelegramWebApp } from '../../composables/useTelegramWebApp';

const { hapticFeedback } = useTelegramWebApp();

const subscriptions = ref([]);
const loading = ref(true);
const error = ref(null);
const saving = ref(null); // masterId being saved

const TIERS = [
  { value: 'starter', label: 'Starter', desc: 'До 30 окошек/мес, без портфолио' },
  { value: 'pro', label: 'Pro', desc: 'Безлимит, портфолио, рассылка' },
  { value: 'business', label: 'Business', desc: 'Всё из Pro + приоритет' },
];

const STATUS_LABELS = {
  active: { label: 'Активна', cls: 'text-green-600' },
  expired: { label: 'Истекла', cls: 'text-red-500' },
  suspended: { label: 'Заблокирована', cls: 'text-orange-500' },
};

async function load() {
  loading.value = true;
  error.value = null;
  try {
    subscriptions.value = await api.get('/subscriptions');
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function upsert(sub) {
  hapticFeedback?.('light');
  saving.value = sub.masterId;
  error.value = null;
  try {
    await api.post(`/subscriptions/${sub.masterId}`, {
      tier: sub.tier,
      months: sub._months ?? 1,
    });
    await load();
    hapticFeedback?.('success');
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = null;
  }
}

async function toggleStatus(sub) {
  hapticFeedback?.('light');
  saving.value = sub.masterId;
  error.value = null;
  const newStatus = sub.status === 'suspended' ? 'active' : 'suspended';
  try {
    await api.post(`/subscriptions/${sub.masterId}/status`, { status: newStatus });
    await load();
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = null;
  }
}

function formatDate(d) {
  if (!d) return '∞';
  return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

onMounted(load);
</script>

<template>
  <div class="min-h-screen p-4 pb-24 bg-[var(--tg-theme-bg-color)] text-[var(--tg-theme-text-color)]">
    <h1 class="text-2xl font-bold mb-6">Подписки мастеров</h1>

    <p v-if="error" class="text-red-500 mb-4 text-sm">{{ error }}</p>
    <div v-if="loading" class="text-[var(--tg-theme-hint-color,#999)]">Загрузка…</div>

    <div v-else class="space-y-4">
      <div
        v-for="sub in subscriptions"
        :key="sub.masterId"
        class="rounded-xl p-4 bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)]"
      >
        <div class="flex items-center justify-between mb-3">
          <div>
            <div class="font-semibold">{{ sub.masterName }}</div>
            <div class="text-xs mt-0.5" :class="STATUS_LABELS[sub.status]?.cls ?? ''">
              {{ STATUS_LABELS[sub.status]?.label ?? sub.status }}
              <span v-if="sub.validUntil" class="text-[var(--tg-theme-hint-color,#999)]"> · до {{ formatDate(sub.validUntil) }}</span>
            </div>
          </div>
          <span
            class="text-xs px-2 py-0.5 rounded-full font-semibold"
            :class="sub.tier === 'business' ? 'bg-yellow-100 text-yellow-800' : sub.tier === 'pro' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'"
          >
            {{ sub.tier.toUpperCase() }}
          </span>
        </div>

        <!-- Tier selector -->
        <div class="flex gap-2 mb-3 flex-wrap">
          <button
            v-for="t in TIERS"
            :key="t.value"
            type="button"
            class="px-3 py-1 rounded-lg text-sm font-medium transition-colors"
            :class="sub.tier === t.value
              ? 'bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#fff)]'
              : 'bg-[var(--tg-theme-bg-color,#e8e8e8)] text-[var(--tg-theme-text-color)]'"
            @click="sub.tier = t.value"
          >
            {{ t.label }}
          </button>
        </div>

        <!-- Extend months -->
        <div class="flex items-center gap-3 mb-3">
          <span class="text-sm text-[var(--tg-theme-hint-color,#999)]">Продлить на:</span>
          <select
            v-model.number="sub._months"
            class="px-2 py-1 rounded-lg text-sm bg-[var(--tg-theme-bg-color)] border border-[var(--tg-theme-hint-color,#999)]"
          >
            <option :value="1">1 месяц</option>
            <option :value="3">3 месяца</option>
            <option :value="6">6 месяцев</option>
            <option :value="12">12 месяцев</option>
          </select>
        </div>

        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 py-2 px-3 rounded-lg text-sm font-medium bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#fff)] disabled:opacity-60"
            :disabled="saving === sub.masterId"
            @click="upsert(sub)"
          >
            {{ saving === sub.masterId ? 'Сохраняю…' : 'Сохранить' }}
          </button>
          <button
            type="button"
            class="py-2 px-3 rounded-lg text-sm font-medium bg-[var(--tg-theme-bg-color,#e8e8e8)] text-[var(--tg-theme-text-color)] disabled:opacity-60"
            :disabled="saving === sub.masterId"
            @click="toggleStatus(sub)"
          >
            {{ sub.status === 'suspended' ? 'Разблокировать' : 'Заблокировать' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
