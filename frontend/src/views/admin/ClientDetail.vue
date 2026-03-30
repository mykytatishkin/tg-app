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
const editForm = ref({ name: '', phone: '', username: '', instagram: '', notes: '', masterNickname: '', notifyAboutNewSlots: false });
const saving = ref(false);
const reminderSending = ref(null);
const reminderMessage = ref(null);
const simulateSending = ref(null);
const simulateMessage = ref(null);
const showSimulate = ref(false);

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
        instagram: client.value.instagram ?? '',
        notes: client.value.notes ?? '',
        masterNickname: client.value.masterNickname ?? '',
        notifyAboutNewSlots: !!client.value.notifyAboutNewSlots,
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
    instagram: client.value?.instagram ?? '',
    notes: client.value?.notes ?? '',
    masterNickname: client.value?.masterNickname ?? '',
    notifyAboutNewSlots: !!client.value?.notifyAboutNewSlots,
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
      instagram: editForm.value.instagram?.trim() || undefined,
      notes: editForm.value.notes || undefined,
      masterNickname: editForm.value.masterNickname || undefined,
      notifyAboutNewSlots: editForm.value.notifyAboutNewSlots,
    };
    const res = await api.put(`/crm/clients/${id.value}`, payload);
    if (res?.id && res.id !== id.value && !String(res.id).startsWith('u-')) {
      router.replace(`/admin/clients/${res.id}`);
      return;
    }
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
  const masterId = route.query.masterId;
  if (masterId) {
    router.push({ path: '/admin/clients', query: { masterId } });
  } else {
    router.push('/admin/clients');
  }
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function instagramLink(value) {
  if (!value?.trim()) return null;
  const v = value.trim().replace(/^@/, '');
  if (/^https?:\/\//i.test(v)) return v;
  return `https://instagram.com/${v.replace(/^instagram\.com\/?/i, '')}`;
}

async function sendReminder(type) {
  if (!client.value?.id) return;
  reminderSending.value = type;
  reminderMessage.value = null;
  error.value = null;
  try {
    const res = await api.post(`/crm/clients/${client.value.id}/send-reminder`, { type });
    reminderMessage.value = res?.message ?? (res?.sent ? 'Напоминание отправлено.' : 'Не удалось отправить.');
  } catch (e) {
    reminderMessage.value = e.message ?? 'Ошибка отправки.';
  } finally {
    reminderSending.value = null;
  }
}

const simulateTypes = [
  { key: 'appointment-reminder', label: 'Напоминание за 24ч', icon: '🕙', target: 'client' },
  { key: 'pre-session', label: 'Скоро запись (клиенту)', icon: '⏰', target: 'client' },
  { key: 'booking-confirmation', label: 'Подтверждение записи', icon: '✅', target: 'client' },
  { key: 'feedback-request', label: 'Запрос отзыва', icon: '⭐', target: 'client' },
  { key: 'discount-notification', label: 'Новые скидки', icon: '✨', target: 'client' },
  { key: 'post-session', label: 'Приём завершён? (мастеру)', icon: '📋', target: 'master' },
  { key: 'master-new-booking', label: 'Новая запись (мастеру)', icon: '📅', target: 'master' },
  { key: 'master-pre-session', label: 'Скоро сеанс (мастеру)', icon: '⏰', target: 'master' },
];

async function simulateMsg(type) {
  if (!client.value?.id) return;
  simulateSending.value = type;
  simulateMessage.value = null;
  try {
    const res = await api.post(`/crm/clients/${client.value.id}/simulate-message`, { type });
    simulateMessage.value = res?.message ?? (res?.sent ? 'Отправлено.' : 'Не удалось отправить.');
  } catch (e) {
    simulateMessage.value = e.message ?? 'Ошибка отправки.';
  } finally {
    simulateSending.value = null;
  }
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
            <div v-if="client.instagram" class="text-sm">
              <a :href="instagramLink(client.instagram)" target="_blank" rel="noopener noreferrer" class="text-[var(--tg-theme-link-color,#3366cc)] underline">{{ client.instagram.replace(/^@/, '') }}</a>
              <span class="text-[var(--tg-theme-hint-color,#999)] ml-1">Instagram</span>
            </div>
            <div v-if="client.notes" class="text-sm mt-2 whitespace-pre-wrap">{{ client.notes }}</div>
            <div v-if="(client.noShowCount ?? 0) > 0" class="mt-2">
              <span
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                :class="client.noShowCount > 2 ? 'bg-red-500/15 text-red-600' : 'bg-yellow-500/15 text-yellow-600'"
              >
                {{ client.noShowCount > 2 ? 'Ненадёжный' : 'Пропуски' }}: {{ client.noShowCount }}
              </span>
            </div>
            <div v-if="client.notifyAboutNewSlots" class="mt-2">
              <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/15 text-emerald-600">Постоянный клиент — оповещения о новых слотах</span>
            </div>
            <div v-if="client.lastNewSlotsNotificationSentAt" class="mt-2 text-xs text-[var(--tg-theme-hint-color,#999)]">
              Оповещение о новых слотах отправлено: {{ formatDateTime(client.lastNewSlotsNotificationSentAt) }}
            </div>
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
        <div v-if="client.telegramId && !editing && !String(client.id).startsWith('u-')" class="mt-4 pt-3 border-t border-[var(--tg-theme-section-separator-color,#e5e5e5)] flex flex-wrap gap-2">
          <button
            type="button"
            class="px-3 py-2 rounded-lg text-sm bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#e8e8e8)] disabled:opacity-50"
            :disabled="reminderSending !== null"
            @click="sendReminder('simple')"
          >
            {{ reminderSending === 'simple' ? 'Отправка…' : 'Отправить напоминалку про запись' }}
          </button>
          <button
            type="button"
            class="px-3 py-2 rounded-lg text-sm bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)] disabled:opacity-50"
            :disabled="reminderSending !== null"
            @click="sendReminder('smart')"
          >
            {{ reminderSending === 'smart' ? 'Отправка…' : 'Отправить подходящее расписание' }}
          </button>
        </div>
        <p v-else-if="client.telegramId && !editing && String(client.id).startsWith('u-')" class="mt-4 pt-3 border-t border-[var(--tg-theme-section-separator-color,#e5e5e5)] text-sm text-[var(--tg-theme-hint-color,#999)]">
          Зарегистрирован, записей ещё не было. Сохраните карточку или дождитесь первой записи — тогда можно будет отправить напоминание.
        </p>
        <p v-if="reminderMessage" class="mt-2 text-sm text-[var(--tg-theme-hint-color,#999)]">{{ reminderMessage }}</p>

        <div v-if="client.telegramId && !editing" class="mt-4 pt-3 border-t border-[var(--tg-theme-section-separator-color,#e5e5e5)]">
          <button
            type="button"
            class="text-sm text-[var(--tg-theme-link-color,#3366cc)] underline"
            @click="showSimulate = !showSimulate"
          >
            {{ showSimulate ? 'Скрыть тестовые сообщения' : 'Тестовые сообщения' }}
          </button>
          <div v-if="showSimulate" class="mt-3 grid grid-cols-1 gap-2">
            <p class="text-xs text-[var(--tg-theme-hint-color,#999)] mb-1">Отправка сообщений немедленно (для тестирования):</p>
            <button
              v-for="st in simulateTypes"
              :key="st.key"
              type="button"
              class="px-3 py-2 rounded-lg text-sm text-left disabled:opacity-50"
              :class="st.target === 'master'
                ? 'bg-amber-500/10 border border-amber-500/30 text-[var(--tg-theme-text-color,#000)]'
                : 'bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]'"
              :disabled="simulateSending !== null"
              @click="simulateMsg(st.key)"
            >
              {{ simulateSending === st.key ? 'Отправка…' : `${st.icon} ${st.label}` }}
            </button>
          </div>
          <p v-if="simulateMessage" class="mt-2 text-sm text-[var(--tg-theme-hint-color,#999)]">{{ simulateMessage }}</p>
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
          <label for="edit-instagram" class="block text-sm font-medium mb-1">Instagram</label>
          <input id="edit-instagram" v-model="editForm.instagram" type="text" placeholder="@username или ссылка" class="w-full px-3 py-2 rounded-lg border border-[var(--tg-theme-hint-color,#999)] bg-[var(--tg-theme-bg-color,#e8e8e8)]" />
        </div>
        <div>
          <label for="edit-masterNickname" class="block text-sm font-medium mb-1">Свой ник (видит только мастер)</label>
          <input id="edit-masterNickname" v-model="editForm.masterNickname" type="text" placeholder="Например: Маша из инсты" class="w-full px-3 py-2 rounded-lg border border-[var(--tg-theme-hint-color,#999)] bg-[var(--tg-theme-bg-color,#e8e8e8)]" />
        </div>
        <div>
          <label for="edit-notes" class="block text-sm font-medium mb-1">Заметки</label>
          <textarea id="edit-notes" v-model="editForm.notes" rows="3" class="w-full px-3 py-2 rounded-lg border border-[var(--tg-theme-hint-color,#999)] bg-[var(--tg-theme-bg-color,#e8e8e8)]"></textarea>
        </div>
        <div class="flex items-center gap-2">
          <input id="edit-notifyAboutNewSlots" v-model="editForm.notifyAboutNewSlots" type="checkbox" class="rounded border-[var(--tg-theme-hint-color,#999)]" />
          <label for="edit-notifyAboutNewSlots" class="text-sm font-medium">Получает оповещения о новых слотах (постоянный клиент)</label>
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

      <!-- Unreliable badge -->
      <div v-if="(client.noShowCount ?? 0) > 2" class="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30">
        <span class="text-red-600 font-medium text-sm">⚠️ Ненадёжный клиент — пропусков: {{ client.noShowCount }}</span>
      </div>
      <div v-else-if="(client.noShowCount ?? 0) > 0" class="mb-4 px-4 py-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)]">
        <span class="text-sm text-[var(--tg-theme-hint-color,#999)]">Пропусков без отмены: {{ client.noShowCount }}</span>
      </div>

      <div v-if="client.stats" class="mb-6">
        <h2 class="text-lg font-semibold mb-3">Статистика посещений</h2>
        <div class="rounded-xl p-4 bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] mb-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-sm text-[var(--tg-theme-hint-color,#999)]">Всего визитов</div>
              <div class="text-2xl font-semibold">{{ client.stats.totalVisits }}</div>
            </div>
            <div v-if="(client.stats.ltv ?? 0) > 0" class="text-right">
              <div class="text-sm text-[var(--tg-theme-hint-color,#999)]">Потрачено в сумме</div>
              <div class="text-2xl font-semibold text-[var(--tg-theme-text-color,#000)]">{{ client.stats.ltv.toFixed(2) }} €</div>
            </div>
          </div>
          <div v-if="client.stats.lastVisitAt" class="text-xs text-[var(--tg-theme-hint-color,#999)] mt-1">
            Последний визит: {{ formatDate(client.stats.lastVisitAt) }}
          </div>
          <template v-if="(client.stats.favoriteWeekdays?.length || client.stats.favoriteTimeRanges?.length) && client.stats.totalVisits > 0">
            <div class="mt-3 pt-3 border-t border-[var(--tg-theme-section-separator-color,#e5e5e5)] space-y-2">
              <div v-if="client.stats.favoriteWeekdays?.length" class="text-sm">
                <span class="text-[var(--tg-theme-hint-color,#999)]">Любимые дни:</span>
                <span class="ml-1">{{ client.stats.favoriteWeekdays.map(w => w.label).join(', ') }}</span>
              </div>
              <div v-if="client.stats.favoriteTimeRanges?.length" class="text-sm">
                <span class="text-[var(--tg-theme-hint-color,#999)]">Любимое время:</span>
                <span class="ml-1">{{ client.stats.favoriteTimeRanges.map(t => t.label).join(', ') }}</span>
              </div>
            </div>
          </template>
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
        <div v-if="client.stats.ltvByService?.length" class="rounded-xl p-4 bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] mt-3">
          <div class="text-sm font-medium mb-2">Сколько потратил — по услугам</div>
          <ul class="space-y-2">
            <li
              v-for="s in client.stats.ltvByService"
              :key="s.serviceName"
              class="flex justify-between text-sm"
            >
              <span>{{ s.serviceName }}</span>
              <span class="font-medium">{{ s.total.toFixed(2) }} €</span>
            </li>
          </ul>
        </div>
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
