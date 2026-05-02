<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../../api/client';
import { useTelegramWebApp } from '../../composables/useTelegramWebApp';

const router = useRouter();
const { hapticFeedback } = useTelegramWebApp();

const photos = ref([]);
const loading = ref(true);
const uploading = ref(false);
const error = ref(null);
const fileInput = ref(null);
const tagInput = ref('');

async function load() {
  loading.value = true;
  error.value = null;
  try {
    photos.value = await api.get('/crm/portfolio');
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function onFileChange(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  hapticFeedback?.('light');
  uploading.value = true;
  error.value = null;
  try {
    const formData = new FormData();
    formData.append('file', file);
    if (tagInput.value.trim()) formData.append('tag', tagInput.value.trim());

    const token = localStorage.getItem('tg_auth');
    const apiBase = import.meta.env.VITE_API_URL || '/api';
    const base = apiBase.startsWith('http') ? apiBase : `${window.location.origin}${apiBase}`;
    const res = await fetch(`${base}/crm/portfolio/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'ngrok-skip-browser-warning': '1',
      },
      body: formData,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Upload failed');
    }
    hapticFeedback?.('success');
    tagInput.value = '';
    e.target.value = '';
    await load();
  } catch (e) {
    error.value = e.message;
  } finally {
    uploading.value = false;
  }
}

async function deletePhoto(id) {
  hapticFeedback?.('light');
  if (!confirm('Удалить фото?')) return;
  try {
    await api.delete(`/crm/portfolio/${id}`);
    photos.value = photos.value.filter((p) => p.id !== id);
    hapticFeedback?.('success');
  } catch (e) {
    error.value = e.message;
  }
}

onMounted(load);
</script>

<template>
  <div class="min-h-screen p-4 pb-24 bg-[var(--tg-theme-bg-color)] text-[var(--tg-theme-text-color)]">
    <div class="flex items-center gap-3 mb-6">
      <button
        class="p-2 rounded-lg bg-[var(--tg-theme-secondary-bg-color)]"
        @click="router.back()"
      >
        ← Назад
      </button>
      <h1 class="text-xl font-bold">Портфолио</h1>
    </div>

    <div class="mb-4 p-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] space-y-3">
      <div>
        <label class="block text-sm text-[var(--tg-theme-hint-color,#999)] mb-1">Тег / услуга (необязательно)</label>
        <input
          v-model="tagInput"
          type="text"
          placeholder="Например: Маникюр"
          maxlength="60"
          class="w-full rounded-lg px-3 py-2 text-sm bg-[var(--tg-theme-bg-color)] text-[var(--tg-theme-text-color)] border border-[var(--tg-theme-section-separator-color)] outline-none"
        />
      </div>
      <button
        type="button"
        class="w-full py-2.5 rounded-xl font-medium bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#fff)] disabled:opacity-60"
        :disabled="uploading"
        @click="fileInput.click()"
      >
        {{ uploading ? 'Загрузка…' : '+ Добавить фото' }}
      </button>
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        class="hidden"
        @change="onFileChange"
      />
    </div>

    <p v-if="error" class="text-neutral-400 text-sm mb-4">{{ error }}</p>

    <div v-if="loading" class="text-[var(--tg-theme-hint-color,#999)]">Загрузка…</div>

    <div v-else-if="photos.length === 0" class="text-[var(--tg-theme-hint-color,#999)] text-sm">
      Портфолио пока пустое. Добавьте первое фото!
    </div>

    <div v-else class="grid grid-cols-2 gap-3">
      <div
        v-for="photo in photos"
        :key="photo.id"
        class="relative rounded-xl overflow-hidden bg-[var(--tg-theme-secondary-bg-color)]"
      >
        <img
          :src="photo.url"
          :alt="photo.tag || 'Портфолио'"
          class="w-full aspect-square object-cover"
        />
        <div v-if="photo.tag" class="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/50 text-white text-xs truncate">
          {{ photo.tag }}
        </div>
        <button
          type="button"
          class="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/60 text-white text-sm flex items-center justify-center"
          @click="deletePhoto(photo.id)"
        >
          ×
        </button>
      </div>
    </div>
  </div>
</template>
