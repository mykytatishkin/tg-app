<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../../api/client';
import { useTelegramWebApp } from '../../composables/useTelegramWebApp';

const router = useRouter();
const { hapticFeedback } = useTelegramWebApp();

const bio = ref('');
const loading = ref(true);
const saving = ref(false);
const error = ref(null);
const message = ref(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const profile = await api.get('/crm/masters/profile');
    bio.value = profile.bio ?? '';
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
    await api.patch('/crm/masters/profile', { bio: bio.value });
    hapticFeedback?.('medium');
    message.value = 'Сохранено.';
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
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
        ← Назад
      </button>
      <h1 class="text-xl font-bold">Настройки профиля</h1>
    </div>

    <div v-if="loading" class="text-[var(--tg-theme-hint-color,#999)]">Загрузка…</div>

    <template v-else>
      <div class="rounded-xl p-4 bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] mb-4">
        <label class="block text-sm font-medium mb-2">
          Bio
          <span class="text-[var(--tg-theme-hint-color,#999)] font-normal">— до 500 символов</span>
        </label>
        <textarea
          v-model="bio"
          maxlength="500"
          rows="6"
          placeholder="Расскажите о своём опыте, специализации и стиле работы…"
          class="w-full px-3 py-2 rounded-lg border border-[var(--tg-theme-hint-color,#999)]/30 bg-[var(--tg-theme-bg-color,#e8e8e8)] resize-y text-sm outline-none"
        />
        <p class="text-xs text-[var(--tg-theme-hint-color,#999)] mt-1 text-right">
          {{ bio.length }} / 500
        </p>
      </div>

      <p v-if="message" class="text-green-500 text-sm mb-3">{{ message }}</p>
      <p v-if="error" class="text-red-400 text-sm mb-3">{{ error }}</p>

      <button
        type="button"
        class="w-full py-3 px-4 rounded-xl font-medium bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#fff)] disabled:opacity-50"
        :disabled="saving"
        @click="save"
      >
        {{ saving ? 'Сохранение…' : 'Сохранить' }}
      </button>
    </template>
  </div>
</template>
