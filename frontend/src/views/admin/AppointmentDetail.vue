<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { api } from '../../api/client';
import { useTelegramWebApp } from '../../composables/useTelegramWebApp';

const router = useRouter();
const route = useRoute();
const { hapticFeedback } = useTelegramWebApp();

const appointment = ref(null);
const loading = ref(true);
const error = ref(null);
const imageError = ref(false);
const updatingId = ref(null);
const editingDiscount = ref(false);
const discountForm = ref({ withDiscount: false, discountLabel: '', discountPercent: '' });
const savingDiscount = ref(false);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    appointment.value = await api.get(`/crm/appointments/${route.params.id}`);
    imageError.value = false;
    if (appointment.value) {
      discountForm.value = {
        withDiscount: !!appointment.value.withDiscount,
        discountLabel: appointment.value.discountLabel ?? '',
        discountPercent: appointment.value.discountPercent != null ? String(appointment.value.discountPercent) : '',
      };
    }
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

function onImageError() {
  imageError.value = true;
}

function openImage() {
  if (appointment.value?.referenceImageUrl) {
    window.open(appointment.value.referenceImageUrl, '_blank');
  }
}

async function setStatus(status) {
  if (!appointment.value) return;
  updatingId.value = appointment.value.id;
  error.value = null;
  try {
    await api.put(`/crm/appointments/${appointment.value.id}`, { status });
    hapticFeedback?.('light');
    await load();
  } catch (e) {
    error.value = e.message;
  } finally {
    updatingId.value = null;
  }
}

function startEditDiscount() {
  editingDiscount.value = true;
  discountForm.value = {
    withDiscount: !!appointment.value?.withDiscount,
    discountLabel: appointment.value?.discountLabel ?? '',
    discountPercent: appointment.value?.discountPercent != null ? String(appointment.value.discountPercent) : '',
  };
}

function cancelEditDiscount() {
  editingDiscount.value = false;
}

async function saveDiscount() {
  if (!appointment.value) return;
  savingDiscount.value = true;
  error.value = null;
  try {
    const payload = {
      withDiscount: discountForm.value.withDiscount,
      discountLabel: discountForm.value.withDiscount ? (discountForm.value.discountLabel || undefined) : undefined,
      discountPercent: discountForm.value.withDiscount && discountForm.value.discountPercent !== ''
        ? Number(discountForm.value.discountPercent)
        : undefined,
    };
    await api.put(`/crm/appointments/${appointment.value.id}`, payload);
    hapticFeedback?.('light');
    await load();
    editingDiscount.value = false;
  } catch (e) {
    error.value = e.message;
  } finally {
    savingDiscount.value = false;
  }
}

function goBack() {
  hapticFeedback?.('light');
  const query = route.query.showAll ? { showAll: '1' } : undefined;
  router.push({ path: '/admin/appointments', query });
}

const hasReferenceImage = computed(() => appointment.value?.referenceImageUrl);

onMounted(load);
</script>

<template>
  <div class="min-h-screen p-4 pb-24 bg-[var(--tg-theme-bg-color,#fff)] text-[var(--tg-theme-text-color,#000)]">
    <div class="flex items-center gap-3 mb-6">
      <button
        class="p-2 rounded-lg bg-[var(--tg-theme-secondary-bg-color,#f0f0f0)]"
        @click="goBack"
      >
        ← Назад
      </button>
      <h1 class="text-2xl font-bold">Детали записи</h1>
    </div>

    <p v-if="error" class="text-red-500 mb-4">{{ error }}</p>
    <div v-if="loading" class="text-[var(--tg-theme-hint-color,#999)]">Загрузка…</div>

    <template v-else-if="appointment">
      <div class="space-y-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] p-4 mb-6">
        <div>
          <span class="text-sm text-[var(--tg-theme-hint-color,#999)]">Дата и время</span>
          <div class="font-medium">{{ appointment.date }} {{ appointment.startTime }}</div>
        </div>
        <div>
          <span class="text-sm text-[var(--tg-theme-hint-color,#999)]">Клиент</span>
          <div class="font-medium">{{ appointment.client?.name }}</div>
        </div>
        <div>
          <span class="text-sm text-[var(--tg-theme-hint-color,#999)]">Услуга</span>
          <div class="font-medium">{{ appointment.service?.name }}</div>
        </div>
        <div>
          <span class="text-sm text-[var(--tg-theme-hint-color,#999)]">Статус</span>
          <div
            class="inline-block px-2 py-0.5 rounded text-sm"
            :class="appointment.status === 'cancelled' ? 'bg-red-600 text-white' : appointment.status === 'done' ? 'bg-green-600 text-white' : 'bg-[var(--tg-theme-section-bg-color,#e5e5e5)]'"
          >
            {{ appointment.status === 'scheduled' ? 'Запланировано' : appointment.status === 'done' ? 'Завершено' : 'Отменено' }}
          </div>
        </div>

        <div v-if="appointment.withDiscount || editingDiscount" class="space-y-2">
          <span class="text-sm text-[var(--tg-theme-hint-color,#999)]">Со скидкой</span>
          <div v-if="!editingDiscount" class="mt-1 p-3 rounded-lg bg-[var(--tg-theme-bg-color,#fff)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]">
            <span v-if="appointment.discountLabel">{{ appointment.discountLabel }}</span>
            <span v-if="appointment.discountPercent != null"> — {{ appointment.discountPercent }}%</span>
            <span v-else-if="!appointment.discountLabel" class="text-[var(--tg-theme-hint-color,#999)]">Скидка указана</span>
          </div>
          <button
            v-if="!editingDiscount"
            type="button"
            class="text-sm px-2 py-1 rounded bg-[var(--tg-theme-button-color,#2481cc)] text-white"
            @click="startEditDiscount"
          >
            Изменить скидку
          </button>
          <form v-else class="space-y-2 p-3 rounded-lg bg-[var(--tg-theme-bg-color,#fff)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]" @submit.prevent="saveDiscount">
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="discountForm.withDiscount" type="checkbox" class="rounded">
              <span class="text-sm">Со скидкой</span>
            </label>
            <template v-if="discountForm.withDiscount">
              <div>
                <label for="discount-label" class="block text-sm mb-1">Название скидки</label>
                <input
                  id="discount-label"
                  v-model="discountForm.discountLabel"
                  type="text"
                  placeholder="Например: День рождения"
                  class="w-full px-3 py-2 rounded-lg border border-[var(--tg-theme-hint-color,#999)] bg-[var(--tg-theme-bg-color,#fff)]"
                >
              </div>
              <div>
                <label for="discount-percent" class="block text-sm mb-1">Процент (%)</label>
                <input
                  id="discount-percent"
                  v-model="discountForm.discountPercent"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  placeholder="10"
                  class="w-full px-3 py-2 rounded-lg border border-[var(--tg-theme-hint-color,#999)] bg-[var(--tg-theme-bg-color,#fff)]"
                >
              </div>
            </template>
            <div class="flex gap-2 pt-2">
              <button type="submit" class="px-3 py-1.5 rounded-lg bg-[var(--tg-theme-button-color,#2481cc)] text-white text-sm" :disabled="savingDiscount">
                {{ savingDiscount ? 'Сохранение…' : 'Сохранить' }}
              </button>
              <button type="button" class="px-3 py-1.5 rounded-lg bg-[var(--tg-theme-secondary-bg-color,#e4e4e7)] text-sm" @click="cancelEditDiscount">
                Отмена
              </button>
            </div>
          </form>
        </div>
        <div v-else class="space-y-2">
          <button
            type="button"
            class="text-sm px-2 py-1 rounded bg-[var(--tg-theme-section-bg-color,#e5e5e5)]"
            @click="startEditDiscount"
          >
            + Со скидкой
          </button>
        </div>

        <div v-if="appointment.note">
          <span class="text-sm text-[var(--tg-theme-hint-color,#999)]">Пожелания клиента</span>
          <div class="mt-1 p-3 rounded-lg bg-[var(--tg-theme-bg-color,#fff)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]">
            {{ appointment.note }}
          </div>
        </div>

        <div v-if="hasReferenceImage">
          <span class="text-sm text-[var(--tg-theme-hint-color,#999)]">Референс-фото</span>
          <div class="mt-1">
            <img
              v-if="!imageError"
              :src="appointment.referenceImageUrl"
              alt="Референс"
              class="max-w-full max-h-64 rounded-lg border border-[var(--tg-theme-section-separator-color,#e5e5e5)] object-contain"
              @error="onImageError"
            >
            <a
              :href="appointment.referenceImageUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-block mt-2 text-sm text-[var(--tg-theme-link-color,#2481cc)] underline"
            >
              {{ imageError ? 'Открыть изображение' : 'Открыть в новой вкладке' }}
            </a>
          </div>
        </div>
      </div>

      <div v-if="appointment.status === 'scheduled'" class="flex gap-2">
        <button
          type="button"
          class="flex-1 py-2 rounded-lg bg-green-600 text-white disabled:opacity-50"
          :disabled="updatingId === appointment.id"
          @click="setStatus('done')"
        >
          Завершено
        </button>
        <button
          type="button"
          class="flex-1 py-2 rounded-lg bg-red-600 text-white disabled:opacity-50"
          :disabled="updatingId === appointment.id"
          @click="setStatus('cancelled')"
        >
          Отменить
        </button>
      </div>
    </template>
  </div>
</template>
