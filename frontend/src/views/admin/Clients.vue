<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../../api/client';
import { useAuth } from '../../composables/useAuth';
import { useTelegramWebApp } from '../../composables/useTelegramWebApp';

const route = useRoute();
const router = useRouter();
const { user } = useAuth();
const { hapticFeedback } = useTelegramWebApp();

const isAdmin = computed(() => !!user.value?.isAdmin);
const currentUserId = computed(() => user.value?.id ?? '');
const masterId = computed(() => route.query.masterId ?? '');

const allUsers = ref([]);
const masters = ref([]);
const clients = ref([]);
const loading = ref(true);
const error = ref(null);
const updatingUserId = ref(null); // id пользователя, у которого меняем роли

const selectedMasterName = ref('');

async function loadAllUsers() {
  loading.value = true;
  error.value = null;
  try {
    allUsers.value = await api.get('/auth/users');
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function loadClients(mid) {
  loading.value = true;
  error.value = null;
  try {
    const url = mid ? `/crm/clients?masterId=${encodeURIComponent(mid)}` : '/crm/clients';
    clients.value = await api.get(url);
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function load() {
  if (isAdmin.value && !masterId.value) {
    await loadAllUsers();
    return;
  }
  if (isAdmin.value && masterId.value) {
    const list = await api.get('/crm/masters').catch(() => []);
    const m = list.find((x) => x.id === masterId.value);
    selectedMasterName.value = m ? [m.firstName, m.lastName].filter(Boolean).join(' ').trim() || m.id : '';
    await loadClients(masterId.value);
    return;
  }
  await loadClients();
}

function goBack() {
  hapticFeedback?.('light');
  if (isAdmin.value && masterId.value) {
    router.push('/admin/clients');
    return;
  }
  router.push('/');
}

function userDisplayName(u) {
  return [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.username || u.id;
}

function onUserClick(u) {
  hapticFeedback?.('light');
  if (u.isMaster) {
    router.push({ path: '/admin/clients', query: { masterId: u.id } });
  }
}

async function toggleRole(u, role, value) {
  if (role !== 'isAdmin' && role !== 'isMaster') return;
  if (role === 'isAdmin' && value === false && u.id === currentUserId.value) {
    if (!confirm('Снять права админа с себя? После этого вы не сможете управлять ролями других пользователей.')) return;
  }
  hapticFeedback?.('light');
  updatingUserId.value = u.id;
  error.value = null;
  try {
    await api.patch(`/auth/users/${u.id}`, { [role]: value });
    const idx = allUsers.value.findIndex((x) => x.id === u.id);
    if (idx !== -1) allUsers.value[idx] = { ...allUsers.value[idx], [role]: value };
  } catch (e) {
    error.value = e.message ?? 'Ошибка сохранения';
  } finally {
    updatingUserId.value = null;
  }
}

function goToClient(id) {
  hapticFeedback?.('light');
  const q = isAdmin.value && masterId.value ? { masterId: masterId.value } : {};
  router.push({ path: `/admin/clients/${id}`, query: q });
}

function formatLastVisit(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

onMounted(load);
watch([masterId, isAdmin], load);
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
      <h1 class="text-2xl font-bold">
        {{ isAdmin && masterId ? `Клиенты — ${selectedMasterName || 'Мастер'}` : 'Клиенты' }}
      </h1>
    </div>

    <p v-if="error" class="text-neutral-400 mb-4">{{ error }}</p>
    <div v-if="loading" class="text-[var(--tg-theme-hint-color,#999)]">Загрузка…</div>

    <!-- Админ: список всех пользователей с бейджами и тумблерами Мастер/Админ -->
    <template v-else-if="isAdmin && !masterId">
      <p class="text-sm text-[var(--tg-theme-hint-color,#999)] mb-3">Все пользователи. Включите/выключите роли тумблерами. Нажмите на мастера — откроются его клиенты.</p>
      <ul class="space-y-3">
        <li
          v-for="u in allUsers"
          :key="u.id"
          class="p-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] flex items-center justify-between gap-3 flex-wrap"
          :class="{ 'cursor-pointer active:opacity-90': u.isMaster }"
          @click="onUserClick(u)"
        >
          <div class="min-w-0 flex-1">
            <div class="font-medium">{{ userDisplayName(u) }}</div>
            <div v-if="u.username" class="text-sm text-[var(--tg-theme-hint-color,#999)]">@{{ u.username }}</div>
          </div>
          <div class="flex items-center gap-3 shrink-0" @click.stop>
            <label class="flex items-center gap-2 cursor-pointer" :class="{ 'opacity-60': updatingUserId === u.id }">
              <span class="text-sm text-[var(--tg-theme-hint-color,#999)]">Админ</span>
              <input
                type="checkbox"
                :checked="!!u.isAdmin"
                :disabled="updatingUserId === u.id"
                class="w-9 h-5 rounded-full appearance-none bg-[var(--tg-theme-hint-color,#999)] cursor-pointer disabled:cursor-not-allowed transition-colors checked:bg-[var(--tg-theme-button-color,#1a1a1a)] focus:outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]"
                style="min-width: 2.25rem; min-height: 1.25rem;"
                @change="toggleRole(u, 'isAdmin', !!$event.target.checked)"
              />
            </label>
            <label class="flex items-center gap-2 cursor-pointer" :class="{ 'opacity-60': updatingUserId === u.id }">
              <span class="text-sm text-[var(--tg-theme-hint-color,#999)]">Мастер</span>
              <input
                type="checkbox"
                :checked="!!u.isMaster"
                :disabled="updatingUserId === u.id"
                class="w-9 h-5 rounded-full appearance-none bg-[var(--tg-theme-hint-color,#999)] cursor-pointer disabled:cursor-not-allowed transition-colors checked:bg-[var(--tg-theme-button-color,#1a1a1a)] focus:outline-none focus:ring-2 focus:ring-[var(--tg-theme-button-color)]"
                style="min-width: 2.25rem; min-height: 1.25rem;"
                @change="toggleRole(u, 'isMaster', !!$event.target.checked)"
              />
            </label>
          </div>
        </li>
      </ul>
    </template>

    <!-- Список клиентов (мастер или админ с выбранным мастером) -->
    <ul v-else class="space-y-3">
      <li
        v-for="c in clients"
        :key="c.id"
        class="p-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] active:opacity-90"
        @click="goToClient(c.id)"
      >
        <div class="font-medium">{{ c.name }}</div>
        <div v-if="c.masterNickname" class="text-xs text-[var(--tg-theme-hint-color,#999)] italic">Свой ник: {{ c.masterNickname }}</div>
        <div v-if="c.phone" class="text-sm text-[var(--tg-theme-hint-color,#999)]">{{ c.phone }}</div>
        <div v-if="c.username" class="text-sm text-[var(--tg-theme-hint-color,#999)]">@{{ c.username }}</div>
        <div class="text-sm mt-2 text-[var(--tg-theme-hint-color,#999)]">
          {{ c.visitCount ?? 0 }} записей
          <span v-if="c.lastVisitAt"> · последняя {{ formatLastVisit(c.lastVisitAt) }}</span>
        </div>
      </li>
    </ul>
  </div>
</template>
