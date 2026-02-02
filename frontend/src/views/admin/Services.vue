<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../../api/client';
import { useTelegramWebApp } from '../../composables/useTelegramWebApp';

const router = useRouter();
const { hapticFeedback } = useTelegramWebApp();

const services = ref([]);
const loading = ref(true);
const error = ref(null);
const showForm = ref(false);
const editingService = ref(null);
const form = ref({ name: '', durationMinutes: 60, price: '', cost: '', forModels: false });
const submitting = ref(false);
const deletingId = ref(null);
const togglingForModelsId = ref(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    services.value = await api.get('/crm/services');
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

function openAddForm() {
  hapticFeedback?.('light');
  editingService.value = null;
  form.value = { name: '', durationMinutes: 60, price: '', cost: '', forModels: false };
  showForm.value = true;
  error.value = null;
}

function openEditForm(s) {
  hapticFeedback?.('light');
  editingService.value = s;
  form.value = {
    name: s.name,
    durationMinutes: s.durationMinutes ?? 60,
    price: s.price != null ? String(s.price) : '',
    cost: s.cost != null ? String(s.cost) : '',
    forModels: !!s.forModels,
  };
  showForm.value = true;
  error.value = null;
}

async function saveService() {
  if (!form.value.name?.trim()) {
    error.value = 'Введите название услуги.';
    return;
  }
  const duration = Number(form.value.durationMinutes);
  const price = form.value.price === '' ? undefined : Number(form.value.price);
  const cost = form.value.cost === '' ? undefined : Number(form.value.cost);
  if (duration < 1 || (price !== undefined && price < 0) || (cost !== undefined && cost < 0)) {
    error.value = 'Длительность минимум 1 мин; цена и себестоимость не меньше 0.';
    return;
  }
  submitting.value = true;
  error.value = null;
  try {
    const payload = {
      name: form.value.name.trim(),
      durationMinutes: duration,
      price: price,
      cost: cost,
      forModels: !!form.value.forModels,
    };
    if (editingService.value) {
      await api.put(`/crm/services/${editingService.value.id}`, payload);
    } else {
      await api.post('/crm/services', payload);
    }
    hapticFeedback?.('light');
    showForm.value = false;
    editingService.value = null;
    await load();
  } catch (e) {
    error.value = e.message;
  } finally {
    submitting.value = false;
  }
}

async function removeService(id) {
  deletingId.value = id;
  error.value = null;
  try {
    await api.delete(`/crm/services/${id}`);
    hapticFeedback?.('light');
    await load();
  } catch (e) {
    error.value = e.message;
  } finally {
    deletingId.value = null;
  }
}

async function toggleForModels(s) {
  togglingForModelsId.value = s.id;
  error.value = null;
  try {
    await api.put(`/crm/services/${s.id}`, { forModels: !s.forModels });
    hapticFeedback?.('light');
    await load();
  } catch (e) {
    error.value = e.message;
  } finally {
    togglingForModelsId.value = null;
  }
}

function goBack() {
  hapticFeedback?.('light');
  router.push('/');
}

onMounted(load);
</script>

<template>
  <div class="min-h-screen p-4 pb-24 bg-[var(--tg-theme-bg-color)] text-[var(--tg-theme-text-color)]">
    <div class="flex items-center gap-3 mb-6">
      <button
        class="p-2 rounded-lg bg-[var(--tg-theme-secondary-bg-color)] border border-[var(--tg-theme-section-separator-color)]"
        @click="goBack"
      >
        ← Назад
      </button>
      <h1 class="text-2xl font-bold">Услуги</h1>
    </div>

    <p v-if="error" class="text-neutral-400 mb-4">{{ error }}</p>

    <div v-if="!showForm" class="mb-6">
      <button
        type="button"
        class="w-full py-3 px-4 rounded-xl font-medium bg-[var(--tg-theme-button-color)] text-[var(--tg-theme-button-text-color)] border border-[var(--tg-theme-section-separator-color)]"
        @click="openAddForm"
      >
        Добавить услугу
      </button>
    </div>

    <div v-else class="mb-6 p-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] border border-[var(--tg-theme-section-separator-color)] space-y-3">
      <div>
        <label class="block text-sm font-medium mb-1 text-[var(--tg-theme-hint-color,#999)]">Название</label>
        <input
          v-model="form.name"
          type="text"
          class="w-full p-3 rounded-lg bg-[var(--tg-theme-bg-color,#e8e8e8)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
          placeholder="Напр. Маникюр"
        >
      </div>
      <div>
        <label class="block text-sm font-medium mb-1 text-[var(--tg-theme-hint-color,#999)]">Длительность (мин)</label>
        <input
          v-model.number="form.durationMinutes"
          type="number"
          min="1"
          class="w-full p-3 rounded-lg bg-[var(--tg-theme-bg-color,#e8e8e8)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
        >
      </div>
      <div>
        <label class="block text-sm font-medium mb-1 text-[var(--tg-theme-hint-color,#999)]">Цена от (€+, необяз.)</label>
        <input
          v-model="form.price"
          type="number"
          min="0"
          step="0.01"
          class="w-full p-3 rounded-lg bg-[var(--tg-theme-bg-color,#e8e8e8)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
          placeholder="0"
        >
        <p class="text-xs text-[var(--tg-theme-hint-color,#999)] mt-1">Минимум, отображается как «цена+ €».</p>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1 text-[var(--tg-theme-hint-color,#999)]">Себестоимость (€, необяз.)</label>
        <input
          v-model="form.cost"
          type="number"
          min="0"
          step="0.01"
          class="w-full p-3 rounded-lg bg-[var(--tg-theme-bg-color,#e8e8e8)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
          placeholder="0"
        >
        <p class="text-xs text-[var(--tg-theme-hint-color,#999)] mt-1">Для учёта в статистике заработка.</p>
      </div>
      <label class="flex items-center gap-2 cursor-pointer">
        <input v-model="form.forModels" type="checkbox" class="rounded">
        <span class="text-sm">Для моделей</span>
      </label>
      <div class="flex gap-2">
        <button
          type="button"
          class="flex-1 py-2 rounded-lg bg-[var(--tg-theme-button-color)] text-[var(--tg-theme-button-text-color)] border border-[var(--tg-theme-section-separator-color)] disabled:opacity-60"
          :disabled="submitting"
          @click="saveService"
        >
          {{ submitting ? 'Сохранение…' : (editingService ? 'Сохранить' : 'Добавить') }}
        </button>
        <button
          type="button"
          class="py-2 px-4 rounded-lg bg-[var(--tg-theme-secondary-bg-color)] text-[var(--tg-theme-text-color)] border border-[var(--tg-theme-section-separator-color)]"
          @click="showForm = false"
        >
          Отмена
        </button>
      </div>
    </div>

    <div v-if="loading" class="text-[var(--tg-theme-hint-color,#999)]">Загрузка…</div>

    <ul v-else class="space-y-3">
      <li
        v-for="s in services"
        :key="s.id"
        class="p-4 rounded-xl flex flex-col gap-3"
        :class="s.forModels ? 'bg-neutral-700/50 border border-neutral-600' : 'bg-[var(--tg-theme-secondary-bg-color)] border border-[var(--tg-theme-section-separator-color)]'"
      >
        <div>
          <div class="font-medium">{{ s.name }}</div>
          <div class="text-sm text-[var(--tg-theme-hint-color,#999)]">
            {{ s.durationMinutes }} min
            <span v-if="s.price != null"> · {{ s.price }}+ €</span>
            <span v-if="s.cost != null" class="text-[var(--tg-theme-hint-color,#999)]"> · себест. {{ s.cost }} €</span>
            <span v-if="s.forModels" class="ml-1 text-neutral-400 font-medium">· Для моделей</span>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2 justify-end">
          <button
            type="button"
            class="text-sm px-3 py-1.5 rounded border border-[var(--tg-theme-section-separator-color)] bg-[var(--tg-theme-section-bg-color)] text-[var(--tg-theme-text-color)] whitespace-nowrap shrink-0"
            @click="openEditForm(s)"
          >
            Редактировать
          </button>
          <button
            type="button"
            class="text-sm px-3 py-1.5 rounded border disabled:opacity-50 text-[var(--tg-theme-button-text-color)] whitespace-nowrap shrink-0"
            :class="s.forModels ? 'bg-[var(--tg-theme-button-color)] border-[var(--tg-theme-section-separator-color)]' : 'bg-[var(--tg-theme-section-bg-color)] border-[var(--tg-theme-section-separator-color)]'"
            :disabled="togglingForModelsId === s.id"
            @click="toggleForModels(s)"
          >
            {{ togglingForModelsId === s.id ? '…' : (s.forModels ? 'Для моделей [вкл.]' : 'Для моделей') }}
          </button>
          <button
            type="button"
            class="text-sm px-3 py-1.5 rounded border border-[var(--tg-theme-section-separator-color)] bg-[var(--tg-theme-section-bg-color)] text-[var(--tg-theme-text-color)] disabled:opacity-50 whitespace-nowrap shrink-0"
            :disabled="deletingId === s.id"
            @click="removeService(s.id)"
          >
            Удалить
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>
