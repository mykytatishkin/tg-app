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

async function load() {
  loading.value = true;
  error.value = null;
  try {
    appointment.value = await api.get(`/crm/appointments/${route.params.id}`);
    imageError.value = false;
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
        ← Back
      </button>
      <h1 class="text-2xl font-bold">Appointment details</h1>
    </div>

    <p v-if="error" class="text-red-500 mb-4">{{ error }}</p>
    <div v-if="loading" class="text-[var(--tg-theme-hint-color,#999)]">Loading…</div>

    <template v-else-if="appointment">
      <div class="space-y-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] p-4 mb-6">
        <div>
          <span class="text-sm text-[var(--tg-theme-hint-color,#999)]">Date & time</span>
          <div class="font-medium">{{ appointment.date }} {{ appointment.startTime }}</div>
        </div>
        <div>
          <span class="text-sm text-[var(--tg-theme-hint-color,#999)]">Client</span>
          <div class="font-medium">{{ appointment.client?.name }}</div>
        </div>
        <div>
          <span class="text-sm text-[var(--tg-theme-hint-color,#999)]">Service</span>
          <div class="font-medium">{{ appointment.service?.name }}</div>
        </div>
        <div>
          <span class="text-sm text-[var(--tg-theme-hint-color,#999)]">Status</span>
          <div
            class="capitalize inline-block px-2 py-0.5 rounded text-sm"
            :class="appointment.status === 'cancelled' ? 'bg-red-600 text-white' : appointment.status === 'done' ? 'bg-green-600 text-white' : 'bg-[var(--tg-theme-section-bg-color,#e5e5e5)]'"
          >
            {{ appointment.status }}
          </div>
        </div>

        <div v-if="appointment.note">
          <span class="text-sm text-[var(--tg-theme-hint-color,#999)]">Client wishes</span>
          <div class="mt-1 p-3 rounded-lg bg-[var(--tg-theme-bg-color,#fff)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]">
            {{ appointment.note }}
          </div>
        </div>

        <div v-if="hasReferenceImage">
          <span class="text-sm text-[var(--tg-theme-hint-color,#999)]">Reference image</span>
          <div class="mt-1">
            <img
              v-if="!imageError"
              :src="appointment.referenceImageUrl"
              alt="Reference"
              class="max-w-full max-h-64 rounded-lg border border-[var(--tg-theme-section-separator-color,#e5e5e5)] object-contain"
              @error="onImageError"
            >
            <a
              :href="appointment.referenceImageUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-block mt-2 text-sm text-[var(--tg-theme-link-color,#2481cc)] underline"
            >
              {{ imageError ? 'Open image' : 'Open image in new tab' }}
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
          Done
        </button>
        <button
          type="button"
          class="flex-1 py-2 rounded-lg bg-red-600 text-white disabled:opacity-50"
          :disabled="updatingId === appointment.id"
          @click="setStatus('cancelled')"
        >
          Cancel
        </button>
      </div>
    </template>
  </div>
</template>
