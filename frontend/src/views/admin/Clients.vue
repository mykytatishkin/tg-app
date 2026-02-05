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

const selectedMasterName = ref('');

const filteredUsers = computed(() => {
  if (roleFilter.value === 'all') return allUsers.value;
  if (roleFilter.value === 'admin') return allUsers.value.filter((u) => u.isAdmin);
  if (roleFilter.value === 'master') return allUsers.value.filter((u) => u.isMaster);
  return allUsers.value;
});

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

    <!-- Админ: список всех пользователей с фильтром, бейджами и тумблерами -->
    <template v-else-if="isAdmin && !masterId">
      <p class="text-sm text-[var(--tg-theme-hint-color,#999)] mb-3">Нажмите на мастера — откроются его клиенты. Роли включайте/выключайте тумблерами ниже.</p>
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
