<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../../api/client';
import { useTelegramWebApp } from '../../composables/useTelegramWebApp';

const route = useRoute();
const router = useRouter();
const { hapticFeedback } = useTelegramWebApp();

const client = ref(null);
const loading = ref(true);
const error = ref(null);
const editing = ref(false);
const editForm = ref({ name: '', phone: '', username: '', notes: '', masterNickname: '' });
const saving = ref(false);

const id = computed(() => route.params.id);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    client.value = await api.get(`/crm/clients/${id.value}`);
    if (client.value) {
      editForm.value = {
        name: client.value.name ?? '',
        phone: client.value.phone ?? '',
        username: client.value.username ?? '',
        notes: client.value.notes ?? '',
        masterNickname: client.value.masterNickname ?? '',
      };
    }
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

function startEdit() {
  editing.value = true;
  editForm.value = {
    name: client.value?.name ?? '',
    phone: client.value?.phone ?? '',
    username: client.value?.username ?? '',
    notes: client.value?.notes ?? '',
    masterNickname: client.value?.masterNickname ?? '',
  };
}

function cancelEdit() {
  editing.value = false;
}

async function save() {
  saving.value = true;
  error.value = null;
  try {
    const payload = {
      name: editForm.value.name || undefined,
      phone: editForm.value.phone || undefined,
      username: editForm.value.username || undefined,
      notes: editForm.value.notes || undefined,
      masterNickname: editForm.value.masterNickname || undefined,
    };
    await api.put(`/crm/clients/${id.value}`, payload);
    await load();
    editing.value = false;
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}

function goBack() {
  hapticFeedback?.('light');
  router.push('/admin/clients');
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
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
      <h1 class="text-2xl font-bold truncate flex-1">Клиент</h1>
    </div>

    <p v-if="error" class="text-neutral-400 mb-4">{{ error }}</p>
    <div v-if="loading" class="text-[var(--tg-theme-hint-color,#999)]">Загрузка…</div>

    <template v-else-if="client">
      <div class="rounded-xl p-4 bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] mb-6">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <div class="font-medium text-lg">{{ client.name }}</div>
            <div v-if="client.masterNickname" class="text-xs text-[var(--tg-theme-hint-color,#999)] italic mt-1">Свой ник (только для мастера): {{ client.masterNickname }}</div>
            <div v-if="client.phone" class="text-sm text-[var(--tg-theme-hint-color,#999)]">{{ client.phone }}</div>
            <div v-if="client.username" class="text-sm text-[var(--tg-theme-hint-color,#999)]">@{{ client.username }}</div>
            <div v-if="client.notes" class="text-sm mt-2 whitespace-pre-wrap">{{ client.notes }}</div>
          </div>
          <button
            v-if="!editing"
            type="button"
            class="shrink-0 px-3 py-1.5 rounded-lg text-sm bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#e8e8e8)]"
            @click="startEdit"
          >
            Редактировать
          </button>
        </div>
      </div>

      <form v-if="editing" class="rounded-xl p-4 bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] mb-6 space-y-3" @submit.prevent="save">
        <div>
          <label for="edit-name" class="block text-sm font-medium mb-1">Имя</label>
          <input id="edit-name" v-model="editForm.name" type="text" class="w-full px-3 py-2 rounded-lg border border-[var(--tg-theme-hint-color,#999)] bg-[var(--tg-theme-bg-color,#e8e8e8)]" required />
        </div>
        <div>
          <label for="edit-phone" class="block text-sm font-medium mb-1">Телефон</label>
          <input id="edit-phone" v-model="editForm.phone" type="text" class="w-full px-3 py-2 rounded-lg border border-[var(--tg-theme-hint-color,#999)] bg-[var(--tg-theme-bg-color,#e8e8e8)]" />
        </div>
        <div>
          <label for="edit-username" class="block text-sm font-medium mb-1">Username (Telegram)</label>
          <input id="edit-username" v-model="editForm.username" type="text" placeholder="@username" class="w-full px-3 py-2 rounded-lg border border-[var(--tg-theme-hint-color,#999)] bg-[var(--tg-theme-bg-color,#e8e8e8)]" />
        </div>
        <div>
          <label for="edit-masterNickname" class="block text-sm font-medium mb-1">Свой ник (видит только мастер)</label>
          <input id="edit-masterNickname" v-model="editForm.masterNickname" type="text" placeholder="Например: Маша из инсты" class="w-full px-3 py-2 rounded-lg border border-[var(--tg-theme-hint-color,#999)] bg-[var(--tg-theme-bg-color,#e8e8e8)]" />
        </div>
        <div>
          <label for="edit-notes" class="block text-sm font-medium mb-1">Заметки</label>
          <textarea id="edit-notes" v-model="editForm.notes" rows="3" class="w-full px-3 py-2 rounded-lg border border-[var(--tg-theme-hint-color,#999)] bg-[var(--tg-theme-bg-color,#e8e8e8)]"></textarea>
        </div>
        <div class="flex gap-2">
          <button type="submit" class="px-4 py-2 rounded-lg bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#e8e8e8)]" :disabled="saving">
            {{ saving ? 'Сохранение…' : 'Сохранить' }}
          </button>
          <button type="button" class="px-4 py-2 rounded-lg bg-[var(--tg-theme-secondary-bg-color,#e4e4e7)]" @click="cancelEdit">
            Отмена
          </button>
        </div>
      </form>

      <div v-if="client.stats" class="mb-6">
        <h2 class="text-lg font-semibold mb-3">Статистика посещений</h2>
        <div class="rounded-xl p-4 bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] mb-3">
          <div class="text-sm text-[var(--tg-theme-hint-color,#999)]">Всего визитов</div>
          <div class="text-2xl font-semibold">{{ client.stats.totalVisits }}</div>
          <div v-if="client.stats.lastVisitAt" class="text-xs text-[var(--tg-theme-hint-color,#999)] mt-1">
            Последний визит: {{ formatDate(client.stats.lastVisitAt) }}
          </div>
        </div>
        <div v-if="client.stats.byService?.length" class="rounded-xl p-4 bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)]">
          <div class="text-sm font-medium mb-2">По сервисам</div>
          <ul class="space-y-2">
            <li
              v-for="s in client.stats.byService"
              :key="s.serviceId"
              class="flex justify-between text-sm"
            >
              <span>{{ s.serviceName }}</span>
              <span class="text-[var(--tg-theme-hint-color,#999)]">{{ s.count }} записей</span>
            </li>
          </ul>
        </div>
        <p v-else class="text-sm text-[var(--tg-theme-hint-color,#999)]">Нет записей по сервисам.</p>
      </div>

      <div v-if="client.recentAppointments?.length" class="mb-6">
        <h2 class="text-lg font-semibold mb-3">Последние записи</h2>
        <ul class="space-y-2">
          <li
            v-for="a in client.recentAppointments"
            :key="a.id"
            class="flex justify-between items-center p-3 rounded-lg bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] text-sm"
          >
            <span>{{ formatDate(a.date) }} {{ a.startTime?.slice(0, 5) }}</span>
            <span class="text-[var(--tg-theme-hint-color,#999)]">{{ a.serviceName ?? '—' }} · {{ a.status === 'scheduled' ? 'запланировано' : a.status === 'done' ? 'завершено' : 'отменено' }}</span>
          </li>
        </ul>
      </div>
      
    </template>
  </div>
</template>
