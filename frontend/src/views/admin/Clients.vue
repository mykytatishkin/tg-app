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
/** Фильтр списка пользователей: 'all' | 'admin' | 'master' */
const roleFilter = ref('all');
const userSearch = ref('');
const userSort = ref('name'); // 'name' | 'adminsFirst' | 'mastersFirst'

const selectedMasterName = ref('');
const clientSearch = ref('');
const clientSort = ref('lastVisit'); // 'lastVisit' | 'firstVisit' | 'name'
/** Фильтр списка: 'all' | 'clients' (с заказами) | 'users' (без заказов) */
const clientTypeFilter = ref('all');
let searchDebounce = null;

function isClient(c) {
  return (c.visitCount ?? 0) > 0 || !!c.firstVisitAt;
}

const totalUsersCount = computed(() => clients.value.length);
const clientsCount = computed(() => clients.value.filter(isClient).length);
const noOrderCount = computed(() => clients.value.filter((c) => !isClient(c)).length);

const filteredClients = computed(() => {
  const list = clients.value;
  if (clientTypeFilter.value === 'clients') return list.filter(isClient);
  if (clientTypeFilter.value === 'users') return list.filter((c) => !isClient(c)); // Без заказов
  return list;
});

const filteredUsers = computed(() => {
  let list = allUsers.value;
  if (roleFilter.value === 'admin') list = list.filter((u) => u.isAdmin);
  else if (roleFilter.value === 'master') list = list.filter((u) => u.isMaster);
  const q = userSearch.value.trim().toLowerCase();
  if (q) {
    list = list.filter((u) => {
      const name = userDisplayName(u).toLowerCase();
      const username = (u.username ?? '').toLowerCase();
      return name.includes(q) || (q.startsWith('@') ? username.includes(q.slice(1)) : username.includes(q));
    });
  }
  const sortBy = userSort.value;
  return [...list].sort((a, b) => {
    if (sortBy === 'adminsFirst') {
      if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1;
      if (a.isMaster !== b.isMaster) return a.isMaster ? -1 : 1;
    } else if (sortBy === 'mastersFirst') {
      if (a.isMaster !== b.isMaster) return a.isMaster ? -1 : 1;
      if (a.isAdmin !== b.isAdmin) return a.isAdmin ? -1 : 1;
    }
    return userDisplayName(a).localeCompare(userDisplayName(b), 'ru');
  });
});

const registeredCount = computed(() => allUsers.value.length);
const mastersCount = computed(() => allUsers.value.filter((u) => u.isMaster).length);
const adminsCount = computed(() => allUsers.value.filter((u) => u.isAdmin).length);

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
    const params = new URLSearchParams();
    if (mid) params.set('masterId', mid);
    if (clientSearch.value.trim()) params.set('search', clientSearch.value.trim());
    if (clientSort.value) params.set('sort', clientSort.value);
    const url = params.toString() ? `/crm/clients?${params.toString()}` : '/crm/clients';
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

function onClientSearchInput() {
  if (searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    loadClients(masterId.value || undefined);
    searchDebounce = null;
  }, 400);
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

    <!-- Админ: список всех пользователей с фильтром, бейджами и тумблерами -->
    <template v-else-if="isAdmin && !masterId">
      <div class="flex flex-wrap items-center gap-3 mb-3 text-sm text-[var(--tg-theme-hint-color,#6b7280)]">
        <span>Зарегистрировано: <strong class="text-[var(--tg-theme-text-color,#000)]">{{ registeredCount }}</strong></span>
        <span>·</span>
        <span>Мастеров: <strong class="text-[var(--tg-theme-text-color,#000)]">{{ mastersCount }}</strong></span>
        <span>·</span>
        <span>Админов: <strong class="text-[var(--tg-theme-text-color,#000)]">{{ adminsCount }}</strong></span>
      </div>
      <p class="text-sm text-[var(--tg-theme-hint-color,#999)] mb-3">Нажмите на мастера — откроются его клиенты. Роли включайте/выключайте тумблерами ниже.</p>
      <div class="mb-4 space-y-3">
        <input
          v-model="userSearch"
          type="search"
          placeholder="Поиск по имени или нику…"
          class="w-full p-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)] text-[var(--tg-theme-text-color,#000)] placeholder-[var(--tg-theme-hint-color,#999)]"
        >
        <div class="flex items-center gap-3">
          <label for="user-sort" class="text-sm font-medium text-[var(--tg-theme-hint-color,#6b7280)] shrink-0">Сортировка</label>
          <select
            id="user-sort"
            v-model="userSort"
            class="flex-1 min-w-0 p-3 pr-10 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)] text-[var(--tg-theme-text-color,#000)] text-sm cursor-pointer"
          >
            <option value="name">По алфавиту</option>
            <option value="adminsFirst">Сначала админы</option>
            <option value="mastersFirst">Сначала мастера</option>
          </select>
        </div>
      </div>
      <div class="flex gap-2 mb-4 flex-wrap">
        <button
          type="button"
          class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          :class="roleFilter === 'all' ? 'bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#fff)]' : 'bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] text-[var(--tg-theme-text-color,#000)]'"
          @click="roleFilter = 'all'"
        >
          Все
        </button>
        <button
          type="button"
          class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          :class="roleFilter === 'admin' ? 'bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#fff)]' : 'bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] text-[var(--tg-theme-text-color,#000)]'"
          @click="roleFilter = 'admin'"
        >
          Только админы
        </button>
        <button
          type="button"
          class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          :class="roleFilter === 'master' ? 'bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#fff)]' : 'bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] text-[var(--tg-theme-text-color,#000)]'"
          @click="roleFilter = 'master'"
        >
          Только мастера
        </button>
      </div>
      <ul class="space-y-3">
        <li
          v-for="u in filteredUsers"
          :key="u.id"
          class="p-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)]"
          :class="{ 'cursor-pointer active:opacity-90': u.isMaster }"
          @click="onUserClick(u)"
        >
          <div class="min-w-0 flex-1">
            <div class="font-medium">{{ userDisplayName(u) }}</div>
            <div v-if="u.username" class="text-sm text-[var(--tg-theme-hint-color,#999)]">@{{ u.username }}</div>
            <div class="flex gap-2 mt-2">
              <span v-if="u.isAdmin" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--tg-theme-hint-color,#999)] text-white">Админ ✓</span>
              <span v-if="u.isMaster" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#fff)]">Мастер ✓</span>
              <span v-if="!u.isAdmin && !u.isMaster" class="text-xs text-[var(--tg-theme-hint-color,#999)]">Обычный пользователь</span>
            </div>
          </div>
          <div class="flex items-center gap-4 mt-4 pt-3 border-t border-[var(--tg-theme-section-separator-color,#e5e5e5)]" @click.stop>
            <label class="flex items-center gap-2 cursor-pointer select-none" :class="{ 'opacity-60': updatingUserId === u.id }">
              <span class="text-sm" :class="u.isAdmin ? 'text-[var(--tg-theme-button-color,#1a1a1a)] font-medium' : 'text-[var(--tg-theme-hint-color,#999)]'">Админ {{ u.isAdmin ? '— вкл' : '— выкл' }}</span>
              <input
                type="checkbox"
                :checked="!!u.isAdmin"
                :disabled="updatingUserId === u.id"
                class="role-switch"
                @change="toggleRole(u, 'isAdmin', !!$event.target.checked)"
              />
            </label>
            <label class="flex items-center gap-2 cursor-pointer select-none" :class="{ 'opacity-60': updatingUserId === u.id }">
              <span class="text-sm" :class="u.isMaster ? 'text-[var(--tg-theme-button-color,#1a1a1a)] font-medium' : 'text-[var(--tg-theme-hint-color,#999)]'">Мастер {{ u.isMaster ? '— вкл' : '— выкл' }}</span>
              <input
                type="checkbox"
                :checked="!!u.isMaster"
                :disabled="updatingUserId === u.id"
                class="role-switch"
                @change="toggleRole(u, 'isMaster', !!$event.target.checked)"
              />
            </label>
          </div>
        </li>
      </ul>
    </template>

    <!-- Список клиентов (мастер или админ с выбранным мастером) -->
    <div v-else>
      <div class="flex flex-wrap items-center gap-3 mb-3 text-sm text-[var(--tg-theme-hint-color,#6b7280)]">
        <span>Пользователей: <strong class="text-[var(--tg-theme-text-color,#000)]">{{ totalUsersCount }}</strong></span>
        <span>·</span>
        <span>Клиентов: <strong class="text-[var(--tg-theme-text-color,#000)]">{{ clientsCount }}</strong></span>
        <span>·</span>
        <span>Без заказов: <strong class="text-[var(--tg-theme-text-color,#000)]">{{ noOrderCount }}</strong></span>
      </div>
      <div class="flex gap-2 mb-3 flex-wrap">
        <button
          type="button"
          class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          :class="clientTypeFilter === 'all' ? 'bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#fff)]' : 'bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] text-[var(--tg-theme-text-color,#000)]'"
          @click="clientTypeFilter = 'all'"
        >
          Все
        </button>
        <button
          type="button"
          class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          :class="clientTypeFilter === 'clients' ? 'bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#fff)]' : 'bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] text-[var(--tg-theme-text-color,#000)]'"
          @click="clientTypeFilter = 'clients'"
        >
          Клиенты
        </button>
        <button
          type="button"
          class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          :class="clientTypeFilter === 'users' ? 'bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#fff)]' : 'bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] text-[var(--tg-theme-text-color,#000)]'"
          @click="clientTypeFilter = 'users'"
        >
          Без заказов
        </button>
      </div>
      <div class="mb-4 space-y-3">
        <input
          v-model="clientSearch"
          type="search"
          placeholder="Поиск по имени, нику, инстаграму, телефону…"
          class="w-full p-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)] text-[var(--tg-theme-text-color,#000)] placeholder-[var(--tg-theme-hint-color,#999)]"
          @input="onClientSearchInput"
        >
        <div class="flex items-center gap-3">
          <label for="client-sort" class="text-sm font-medium text-[var(--tg-theme-hint-color,#6b7280)] shrink-0">Сортировка</label>
          <select
            id="client-sort"
            v-model="clientSort"
            class="client-sort-select flex-1 min-w-0 p-3 pr-10 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)] text-[var(--tg-theme-text-color,#000)] text-sm cursor-pointer"
            @change="loadClients(masterId || undefined)"
          >
            <option value="lastVisit">По последней записи</option>
            <option value="firstVisit">По первой записи</option>
            <option value="name">По алфавиту</option>
          </select>
        </div>
      </div>
      <ul class="space-y-3">
      <li
        v-for="c in filteredClients"
        :key="c.id"
        class="p-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] active:opacity-90"
        @click="goToClient(c.id)"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <div class="font-medium">{{ c.name }}</div>
            <div v-if="c.masterNickname" class="text-xs text-[var(--tg-theme-hint-color,#999)] italic">Свой ник: {{ c.masterNickname }}</div>
            <div v-if="c.phone" class="text-sm text-[var(--tg-theme-hint-color,#999)]">{{ c.phone }}</div>
            <div v-if="c.username" class="text-sm text-[var(--tg-theme-hint-color,#999)]">@{{ c.username }}</div>
          </div>
          <div class="shrink-0 flex flex-col items-end gap-1">
            <span
              class="inline-flex px-2 py-0.5 rounded text-xs font-medium"
              :class="isClient(c) ? 'bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#fff)]' : 'bg-[var(--tg-theme-hint-color,#999)]/20 text-[var(--tg-theme-hint-color,#6b7280)]'"
            >
              {{ isClient(c) ? 'Клиент' : 'Без заказов' }}
            </span>
            <span
              v-if="(c.noShowCount ?? 0) > 2"
              class="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-red-500/15 text-red-600"
            >
              Ненадёжный ({{ c.noShowCount }})
            </span>
          </div>
        </div>
        <div class="text-sm mt-2 text-[var(--tg-theme-hint-color,#999)]">
          {{ c.visitCount ?? 0 }} записей
          <span v-if="c.lastVisitAt"> · последняя {{ formatLastVisit(c.lastVisitAt) }}</span>
          <span v-if="(c.noShowCount ?? 0) > 0" class="text-red-500"> · пропусков: {{ c.noShowCount }}</span>
        </div>
        <div v-if="(c.ltv ?? 0) > 0" class="text-sm mt-1 font-medium text-[var(--tg-theme-button-color,#1a1a1a)]">
          LTV: {{ c.ltv.toFixed(2) }} €
        </div>
      </li>
    </ul>
    </div>
  </div>
</template>

<style scoped>
.role-switch {
  width: 2.5rem;
  height: 1.35rem;
  border-radius: 9999px;
  appearance: none;
  -webkit-appearance: none;
  background: var(--tg-theme-hint-color, #999);
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;
  position: relative;
}
.role-switch:checked {
  background: var(--tg-theme-button-color, #1a1a1a);
}
.role-switch::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: calc(1.35rem - 4px);
  height: calc(1.35rem - 4px);
  border-radius: 50%;
  background: white;
  transition: transform 0.2s;
  box-shadow: 0 1px 2px rgba(0,0,0,0.2);
}
.role-switch:checked::before {
  transform: translateX(calc(2.5rem - 1.35rem));
}
.role-switch:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}
</style>
