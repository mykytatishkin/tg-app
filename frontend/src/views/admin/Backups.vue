<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../../composables/useAuth';
import { useTelegramWebApp } from '../../composables/useTelegramWebApp';
import { api } from '../../api/client';

const router = useRouter();
const { getApiUrl, token } = useAuth();
const { hapticFeedback } = useTelegramWebApp();

const backupLoading = ref(false);
const backupResult = ref(null);
const backupError = ref(null);
const restoreLoading = ref(false);
const restoreResult = ref(null);
const restoreError = ref(null);
const selectedFile = ref(null);
const fileInput = ref(null);
const backupShowConfigHint = ref(false);

function goBack() {
  hapticFeedback?.('light');
  router.push('/');
}

async function runEmergencyBackup() {
  backupLoading.value = true;
  backupResult.value = null;
  backupError.value = null;
  backupShowConfigHint.value = false;
  try {
    const data = await api.post('/backup/run', {});
    backupResult.value = `Бекап создан: ${data.filename} (${(data.size / 1024).toFixed(1)} КБ)`;
  } catch (e) {
    backupError.value = e.message || 'Ошибка создания бекапа';
    backupShowConfigHint.value = (e.message || '').toLowerCase().includes('not configured');
  } finally {
    backupLoading.value = false;
  }
}

function onFileChange(e) {
  const file = e.target?.files?.[0];
  selectedFile.value = file || null;
  restoreResult.value = null;
  restoreError.value = null;
}

async function runRestore() {
  if (!selectedFile.value) {
    restoreError.value = 'Выберите файл .sql';
    return;
  }
  const confirmed = window.confirm(
    'Текущая база данных будет полностью заменена данными из файла. Продолжить?',
  );
  if (!confirmed) return;

  restoreLoading.value = true;
  restoreResult.value = null;
  restoreError.value = null;
  try {
    const formData = new FormData();
    formData.append('file', selectedFile.value);
    const res = await fetch(getApiUrl('/backup/restore'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.value}`,
      },
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Ошибка: ${res.status}`);
    }
    restoreResult.value = data.message || 'База восстановлена';
    selectedFile.value = null;
    if (fileInput.value) fileInput.value.value = '';
  } catch (e) {
    restoreError.value = e.message || 'Ошибка восстановления';
  } finally {
    restoreLoading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen p-4 pb-24 bg-[var(--tg-theme-bg-color)] text-[var(--tg-theme-text-color)]">
    <div class="flex items-center gap-2 mb-6">
      <button
        type="button"
        class="p-1 rounded-lg text-[var(--tg-theme-hint-color,#999)]"
        aria-label="Назад"
        @click="goBack"
      >
        ←
      </button>
      <h1 class="text-xl font-bold">Бекапы</h1>
    </div>

    <section class="mb-8">
      <h2 class="text-lg font-medium mb-3">Экстренный бекап</h2>
      <p class="text-sm text-[var(--tg-theme-hint-color,#999)] mb-3">
        Создать бекап базы данных сейчас и сохранить в настроенное место (локальная папка или OneDrive).
      </p>
      <button
        type="button"
        class="w-full py-3 px-4 rounded-xl font-medium bg-[var(--tg-theme-button-color)] text-[var(--tg-theme-button-text-color)] disabled:opacity-50"
        :disabled="backupLoading"
        @click="runEmergencyBackup"
      >
        {{ backupLoading ? 'Создаём…' : 'Экстренный бекап' }}
      </button>
      <p v-if="backupResult" class="mt-2 text-sm text-green-600 dark:text-green-400">
        {{ backupResult }}
      </p>
      <p v-if="backupError" class="mt-2 text-sm text-red-600 dark:text-red-400">
        {{ backupError }}
      </p>
      <div
        v-if="backupShowConfigHint"
        class="mt-3 p-3 rounded-lg bg-[var(--tg-theme-secondary-bg-color)] text-sm text-[var(--tg-theme-hint-color,#999)] whitespace-pre-wrap"
      >
        Добавьте в backend/.env:
        BACKUP_DESTINATION=local
        BACKUP_LOCAL_PATH=./backups
        (или путь к папке OneDrive). Перезапустите бэкенд.
      </div>
    </section>

    <section>
      <h2 class="text-lg font-medium mb-3">Восстановить из файла</h2>
      <p class="text-sm text-[var(--tg-theme-hint-color,#999)] mb-3">
        Загрузите файл .sql с бекапом. Текущая база будет заменена.
      </p>
      <input
        ref="fileInput"
        type="file"
        accept=".sql"
        class="block w-full text-sm text-[var(--tg-theme-text-color)] file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:bg-[var(--tg-theme-button-color)] file:text-[var(--tg-theme-button-text-color)]"
        @change="onFileChange"
      />
      <button
        type="button"
        class="mt-3 w-full py-3 px-4 rounded-xl font-medium bg-[var(--tg-theme-secondary-bg-color)] border border-[var(--tg-theme-button-color)] text-[var(--tg-theme-text-color)] disabled:opacity-50"
        :disabled="restoreLoading || !selectedFile"
        @click="runRestore"
      >
        {{ restoreLoading ? 'Восстанавливаем…' : 'Восстановить' }}
      </button>
      <p v-if="restoreResult" class="mt-2 text-sm text-green-600 dark:text-green-400">
        {{ restoreResult }}
      </p>
      <p v-if="restoreError" class="mt-2 text-sm text-red-600 dark:text-red-400">
        {{ restoreError }}
      </p>
    </section>
  </div>
</template>
