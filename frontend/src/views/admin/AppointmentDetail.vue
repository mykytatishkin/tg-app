<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { api } from '../../api/client';
import { useTelegramWebApp } from '../../composables/useTelegramWebApp';

const MASTER_CANCEL_REASONS = [
  'Болезнь',
  'Семейные обстоятельства',
  'Технические причины',
  'Другая причина',
];

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
const editingFinalPrice = ref(false);
const finalPriceInput = ref('');
const savingFinalPrice = ref(false);
const showCancelModal = ref(false);
const cancelReason = ref('');
const cancelOtherText = ref('');

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

async function setStatus(status, cancellationReason) {
  if (!appointment.value) return;
  updatingId.value = appointment.value.id;
  error.value = null;
  try {
    const payload = { status };
    if (status === 'cancelled') {
      payload.cancellationReason = cancellationReason || 'Не указана';
    }
    await api.put(`/crm/appointments/${appointment.value.id}`, payload);
    hapticFeedback?.('light');
    await load();
  } catch (e) {
    error.value = e.message;
  } finally {
    updatingId.value = null;
  }
}

function openCancelModal() {
  hapticFeedback?.('light');
  cancelReason.value = '';
  cancelOtherText.value = '';
  showCancelModal.value = true;
}

function closeCancelModal() {
  showCancelModal.value = false;
  cancelReason.value = '';
  cancelOtherText.value = '';
}

function masterReasonToSend() {
  if (cancelReason.value === 'Другая причина' && cancelOtherText.value.trim()) {
    return cancelOtherText.value.trim();
  }
  return cancelReason.value || 'Не указана';
}

const canConfirmMasterCancel = computed(() => {
  if (!cancelReason.value) return false;
  if (cancelReason.value === 'Другая причина') return !!cancelOtherText.value.trim();
  return true;
});

async function confirmMasterCancel() {
  if (!appointment.value) return;
  const reason = masterReasonToSend();
  closeCancelModal();
  await setStatus('cancelled', reason);
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

const isByReference = computed(() => !!(appointment.value?.note || appointment.value?.referenceImageUrl));

function startEditFinalPrice() {
  editingFinalPrice.value = true;
  finalPriceInput.value = appointment.value?.finalPrice != null ? String(appointment.value.finalPrice) : '';
}

function cancelEditFinalPrice() {
  editingFinalPrice.value = false;
}

async function saveFinalPrice() {
  if (!appointment.value) return;
  savingFinalPrice.value = true;
  error.value = null;
  try {
    const val = String(finalPriceInput.value ?? '').trim();
    const finalPrice = val === '' ? undefined : Number(val);
    if (finalPrice !== undefined && (Number.isNaN(finalPrice) || finalPrice < 0)) {
      error.value = 'Введите число ≥ 0.';
      return;
    }
    await api.put(`/crm/appointments/${appointment.value.id}`, { finalPrice: finalPrice ?? null });
    hapticFeedback?.('light');
    await load();
    editingFinalPrice.value = false;
  } catch (e) {
    error.value = e.message;
  } finally {
    savingFinalPrice.value = false;
  }
}

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

    <p v-if="error" class="text-neutral-400 mb-4">{{ error }}</p>
    <div v-if="loading" class="text-[var(--tg-theme-hint-color,#999)]">Загрузка…</div>

    <template v-else-if="appointment">
      <div
        class="space-y-4 rounded-xl p-4 mb-6"
        :class="!appointment.serviceId ? 'bg-neutral-700/50 border border-neutral-600' : 'bg-[var(--tg-theme-secondary-bg-color)]'"
      >
        <div>
          <span class="text-sm text-[var(--tg-theme-hint-color,#999)]">Дата и время</span>
          <div class="font-medium">{{ appointment.date }} {{ appointment.startTime ? appointment.startTime.slice(0, 5) : '' }}</div>
        </div>
        <div>
          <span class="text-sm text-[var(--tg-theme-hint-color,#999)]">Клиент</span>
          <div class="font-medium">{{ appointment.client?.name }}</div>
        </div>
        <div>
          <span class="text-sm text-[var(--tg-theme-hint-color,#999)]">Услуга</span>
          <div class="font-medium">
            <template v-if="appointment.serviceId">
              {{ appointment.service?.name }}
              <span v-if="appointment.service?.price != null"> · {{ appointment.service.price }}+ €</span>
            </template>
            <span v-else class="text-neutral-400 font-medium">Для моделей</span>
          </div>
        </div>
        <div>
          <span class="text-sm text-[var(--tg-theme-hint-color,#999)]">Статус</span>
          <div
            class="inline-block px-2 py-0.5 rounded text-sm"
            :class="appointment.status === 'cancelled' ? 'bg-neutral-800 text-neutral-300' : appointment.status === 'done' ? 'bg-neutral-500 text-white' : 'bg-[var(--tg-theme-section-bg-color)]'"
          >
            {{ appointment.status === 'scheduled' ? 'Запланировано' : appointment.status === 'done' ? 'Завершено' : 'Отменено' }}
          </div>
          <div v-if="appointment.status === 'cancelled' && appointment.cancellationReason" class="mt-2 text-sm text-[var(--tg-theme-hint-color,#999)]">
            Причина: {{ appointment.cancellationReason }}
            <span v-if="appointment.cancelledBy" class="ml-1">({{ appointment.cancelledBy === 'client' ? 'клиент' : 'мастер' }})</span>
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
            class="text-sm px-2 py-1 rounded bg-[var(--tg-theme-button-color,#1a1a1a)] text-white"
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
              <button type="submit" class="px-3 py-1.5 rounded-lg bg-[var(--tg-theme-button-color,#1a1a1a)] text-white text-sm" :disabled="savingDiscount">
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

        <div class="space-y-2">
          <span class="text-sm text-[var(--tg-theme-hint-color,#999)]">Финальная сумма</span>
          <div v-if="!editingFinalPrice" class="mt-1 flex items-center gap-2">
            <span v-if="appointment.finalPrice != null" class="font-medium">{{ appointment.finalPrice }} €</span>
            <span v-else class="text-[var(--tg-theme-hint-color,#999)]">Не указана</span>
            <button
              type="button"
              class="text-sm px-2 py-1 rounded bg-[var(--tg-theme-button-color,#1a1a1a)] text-white"
              @click="startEditFinalPrice"
            >
              {{ appointment.finalPrice != null ? 'Изменить' : 'Указать' }}
            </button>
          </div>
          <form v-else class="flex flex-wrap items-center gap-2" @submit.prevent="saveFinalPrice">
            <input
              id="final-price"
              v-model="finalPriceInput"
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
              class="w-28 px-3 py-2 rounded-lg border border-[var(--tg-theme-hint-color,#999)] bg-[var(--tg-theme-bg-color,#fff)]"
            >
            <span class="text-sm">€</span>
            <button type="submit" class="px-3 py-1.5 rounded-lg bg-[var(--tg-theme-button-color,#1a1a1a)] text-white text-sm" :disabled="savingFinalPrice">
              {{ savingFinalPrice ? 'Сохранение…' : 'Сохранить' }}
            </button>
            <button type="button" class="px-3 py-1.5 rounded-lg bg-[var(--tg-theme-secondary-bg-color,#e4e4e7)] text-sm" @click="cancelEditFinalPrice">
              Отмена
            </button>
          </form>
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
              class="inline-block mt-2 text-sm text-[var(--tg-theme-link-color,#c0c0c0)] underline"
            >
              {{ imageError ? 'Открыть изображение' : 'Открыть в новой вкладке' }}
            </a>
          </div>
        </div>

        <div v-if="appointment.status === 'done' && appointment.feedback" class="space-y-2 pt-2 border-t border-[var(--tg-theme-section-separator-color,#e5e5e5)]">
          <span class="text-sm text-[var(--tg-theme-hint-color,#999)]">Отзыв клиента</span>
          <div class="mt-1 p-3 rounded-lg bg-[var(--tg-theme-bg-color,#fff)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]">
            <div class="flex items-center gap-1 mb-2">
              <span class="text-yellow-500" aria-hidden="true">{{ '★'.repeat(appointment.feedback.rating) }}{{ '☆'.repeat(5 - appointment.feedback.rating) }}</span>
              <span class="text-sm text-[var(--tg-theme-hint-color,#999)]">{{ appointment.feedback.rating }} из 5</span>
            </div>
            <p v-if="appointment.feedback.comment" class="text-sm mb-2">{{ appointment.feedback.comment }}</p>
            <ul v-if="appointment.feedback.whatWasGood?.length" class="text-sm text-[var(--tg-theme-hint-color,#999)] list-disc list-inside">
              <li v-for="(item, i) in appointment.feedback.whatWasGood" :key="i">{{ item }}</li>
            </ul>
          </div>
        </div>
      </div>

      <div v-if="appointment.status === 'scheduled'" class="flex gap-2">
        <button
          type="button"
          class="flex-1 py-2 rounded-lg bg-neutral-500 text-white disabled:opacity-50"
          :disabled="updatingId === appointment.id"
          @click="setStatus('done')"
        >
          Завершено
        </button>
        <button
          type="button"
          class="flex-1 py-2 rounded-lg bg-neutral-800 text-neutral-300 disabled:opacity-50"
          :disabled="updatingId === appointment.id"
          @click="openCancelModal"
        >
          Отменить
        </button>
      </div>

      <div
        v-if="showCancelModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        @click.self="closeCancelModal"
      >
        <div class="w-full max-w-sm rounded-xl p-4 bg-[var(--tg-theme-bg-color,#fff)] shadow-lg">
          <h3 class="text-lg font-semibold mb-3">Укажите причину отмены</h3>
          <p class="text-sm text-[var(--tg-theme-hint-color,#999)] mb-3">Причина будет отправлена клиенту.</p>
          <div class="space-y-2 mb-4">
            <label
              v-for="r in MASTER_CANCEL_REASONS"
              :key="r"
              class="flex items-center gap-2 cursor-pointer"
            >
              <input v-model="cancelReason" type="radio" :value="r" class="rounded-full">
              <span class="text-sm">{{ r }}</span>
            </label>
            <div v-if="cancelReason === 'Другая причина'" class="ml-6 mt-2">
              <input
                v-model="cancelOtherText"
                type="text"
                placeholder="Напишите причину"
                class="w-full px-3 py-2 rounded-lg border border-[var(--tg-theme-hint-color,#999)] bg-[var(--tg-theme-bg-color,#fff)] text-sm"
              >
            </div>
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              class="flex-1 py-2 rounded-lg bg-neutral-800 text-white disabled:opacity-50"
              :disabled="updatingId !== null || !canConfirmMasterCancel"
              @click="confirmMasterCancel"
            >
              {{ updatingId !== null ? 'Отмена…' : 'Отменить запись' }}
            </button>
            <button
              type="button"
              class="py-2 px-4 rounded-lg bg-[var(--tg-theme-secondary-bg-color,#e4e4e7)] text-sm"
              @click="closeCancelModal"
            >
              Назад
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
