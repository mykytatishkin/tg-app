<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../../api/client';
import { useTelegramWebApp } from '../../composables/useTelegramWebApp';
import { useAdminMasters } from '../../composables/useAdminMasters';

const router = useRouter();
const { hapticFeedback } = useTelegramWebApp();
const { isAdmin, masters, mastersLoading, selectedMasterId, selectedMasterName, loadMasters } = useAdminMasters();

const stats = ref(null);
const loading = ref(true);
const error = ref(null);
const showExpenseForm = ref(false);
const expenseForm = ref({ yearMonth: '', amount: '' });
const savingExpense = ref(false);
const showMonthPicker = ref(false);
const filterYearMonth = ref(null);
const pickerYear = ref(new Date().getFullYear());
const pickerMonth = ref(String(new Date().getMonth() + 1).padStart(2, '0'));

const monthOptions = computed(() => {
  const opts = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }),
    });
  }
  return opts;
});

async function load() {
  if (isAdmin.value && masters.value.length && !selectedMasterId.value) return;
  loading.value = true;
  error.value = null;
  try {
    const params = new URLSearchParams();
    if (filterYearMonth.value) {
      const [y, m] = filterYearMonth.value.split('-');
      params.set('year', y);
      params.set('month', m);
    }
    if (isAdmin.value && selectedMasterId.value) params.set('masterId', selectedMasterId.value);
    const qs = params.toString();
    stats.value = await api.get('/crm/stats' + (qs ? '?' + qs : ''));
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

function openMonthPicker(yearMonth = null) {
  hapticFeedback?.('light');
  const ym = yearMonth ?? filterYearMonth.value;
  if (ym) {
    const [y, m] = ym.split('-');
    pickerYear.value = parseInt(y, 10);
    pickerMonth.value = m;
  } else {
    const now = new Date();
    pickerYear.value = now.getFullYear();
    pickerMonth.value = String(now.getMonth() + 1).padStart(2, '0');
  }
  showMonthPicker.value = true;
}

function applyMonthFilter() {
  hapticFeedback?.('light');
  filterYearMonth.value = `${pickerYear.value}-${pickerMonth.value}`;
  showMonthPicker.value = false;
  load();
}

function clearMonthFilter() {
  hapticFeedback?.('light');
  filterYearMonth.value = null;
  showMonthPicker.value = false;
  load();
}

const yearOptions = computed(() => {
  const y = new Date().getFullYear();
  return Array.from({ length: 6 }, (_, i) => y - i);
});

const monthLabels = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

function openExpenseForm(yearMonth = '') {
  hapticFeedback?.('light');
  const def = monthOptions.value[0]?.value ?? '';
  expenseForm.value = { yearMonth: yearMonth || def, amount: '' };
  showExpenseForm.value = true;
}

async function saveExpense() {
  const { yearMonth, amount } = expenseForm.value;
  if (!yearMonth) {
    error.value = 'Выберите месяц.';
    return;
  }
  const amt = Number(amount);
  if (Number.isNaN(amt) || amt < 0) {
    error.value = 'Введите сумму ≥ 0.';
    return;
  }
  savingExpense.value = true;
  error.value = null;
  try {
    await api.put(`/crm/expenses/${yearMonth}`, { amount: amt });
    hapticFeedback?.('light');
    showExpenseForm.value = false;
    await load();
  } catch (e) {
    error.value = e.message;
  } finally {
    savingExpense.value = false;
  }
}

function formatMonth(ym) {
  const [y, m] = ym.split('-');
  const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1);
  return d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
}

/** Pie chart for new users: madeOrder vs (registered - madeOrder). Returns conic-gradient CSS value. */
function newUsersPieGradient(registered, madeOrder) {
  if (!registered) return 'conic-gradient(#9ca3af 0turn 1turn)';
  const pct = madeOrder / registered;
  return `conic-gradient(#22c55e 0turn ${pct}turn, #9ca3af ${pct}turn 1turn)`;
}

/** Max count in byService for bar chart scale. */
const serviceChartMax = computed(() => {
  const list = stats.value?.byService ?? [];
  if (!list.length) return 1;
  return Math.max(...list.map((s) => s.count), 1);
});

const showAppointmentsModal = ref(false);
const appointmentsList = ref([]);
const loadingAppointments = ref(false);

/** Appointments grouped by date (desc), each key is YYYY-MM-DD, value is array of appointments. */
const appointmentsByDate = computed(() => {
  const list = appointmentsList.value ?? [];
  const map = new Map();
  for (const a of list) {
    const d = typeof a.date === 'string' ? a.date.slice(0, 10) : (a.date && a.date.toISOString?.())?.slice(0, 10) ?? '';
    if (!map.has(d)) map.set(d, []);
    map.get(d).push(a);
  }
  for (const arr of map.values()) {
    arr.sort((x, y) => (x.startTime || '').localeCompare(y.startTime || ''));
  }
  return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
});

function formatDateHeader(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function appointmentDisplayPrice(a) {
  if (a.finalPrice != null && a.finalPrice !== '') return Number(a.finalPrice);
  const price = a.service?.price;
  if (price != null && price !== '') return Number(price);
  return null;
}

function appointmentStatusLabel(a) {
  if (a.status === 'cancelled') return 'Отменено';
  if (a.status === 'done') return 'Завершено';
  return 'Запланировано';
}

function appointmentNote(a) {
  if (a.status === 'cancelled' && a.cancellationReason) return a.cancellationReason;
  if (a.feedback?.comment) return a.feedback.comment;
  return null;
}

async function openAppointmentsModal() {
  hapticFeedback?.('light');
  showAppointmentsModal.value = true;
  loadingAppointments.value = true;
  appointmentsList.value = [];
  try {
    const params = new URLSearchParams();
    if (filterYearMonth.value) {
      const [y, m] = filterYearMonth.value.split('-');
      const lastDay = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
      params.set('from', `${y}-${m}-01`);
      params.set('to', `${y}-${m}-${String(lastDay).padStart(2, '0')}`);
    } else {
      const end = new Date();
      const start = new Date(end.getFullYear() - 2, end.getMonth(), 1);
      params.set('from', start.toISOString().slice(0, 10));
      params.set('to', end.toISOString().slice(0, 10));
    }
    if (isAdmin.value && selectedMasterId.value) params.set('masterId', selectedMasterId.value);
    const url = '/crm/appointments?' + params.toString();
    appointmentsList.value = await api.get(url);
  } catch (e) {
    appointmentsList.value = [];
  } finally {
    loadingAppointments.value = false;
  }
}

function closeAppointmentsModal() {
  hapticFeedback?.('light');
  showAppointmentsModal.value = false;
}

function onPanelClick(panel) {
  if (panel === 'appointments') openAppointmentsModal();
  else hapticFeedback?.('light');
}

function formatMoney(v) {
  return typeof v === 'number' ? v.toFixed(2) : '0.00';
}

function goBack() {
  hapticFeedback?.('light');
  if (isAdmin.value && selectedMasterId.value) {
    router.push('/admin/stats');
    return;
  }
  router.push('/');
}

function masterDisplayName(m) {
  return [m.firstName, m.lastName].filter(Boolean).join(' ').trim() || m.id;
}

function selectMaster(m) {
  hapticFeedback?.('light');
  router.push({ path: '/admin/stats', query: { masterId: m.id } });
}

onMounted(async () => {
  if (isAdmin.value) await loadMasters();
  await load();
});
watch([selectedMasterId, filterYearMonth], load);
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
        {{ isAdmin && selectedMasterId ? `Статистика — ${selectedMasterName || 'Мастер'}` : 'Статистика' }}
      </h1>
    </div>

    <p v-if="error" class="text-neutral-400 mb-4">{{ error }}</p>
    <p v-else-if="isAdmin && !mastersLoading && masters.length === 0" class="text-[var(--tg-theme-hint-color,#999)]">Нет мастеров.</p>
    <div v-else-if="mastersLoading && isAdmin && !selectedMasterId" class="text-[var(--tg-theme-hint-color,#999)]">Загрузка…</div>

    <!-- Админ: список мастеров (без выбранного) -->
    <template v-else-if="isAdmin && !selectedMasterId">
      <p class="text-sm text-[var(--tg-theme-hint-color,#999)] mb-3">Выберите мастера, чтобы увидеть его статистику</p>
      <ul class="space-y-3">
        <li
          v-for="m in masters"
          :key="m.id"
          class="p-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] active:opacity-90 cursor-pointer"
          @click="selectMaster(m)"
        >
          <div class="font-medium">{{ masterDisplayName(m) }}</div>
        </li>
      </ul>
    </template>

    <div v-else-if="loading && !stats" class="text-[var(--tg-theme-hint-color,#999)]">Загрузка…</div>

    <template v-else-if="stats">
      <div class="grid gap-4 mb-6 grid-cols-2">
        <button
          type="button"
          class="rounded-xl p-4 bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] text-left cursor-pointer hover:opacity-95 active:opacity-90 transition-opacity border border-transparent hover:border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
          @click="onPanelClick('appointments')"
        >
          <div class="text-sm text-[var(--tg-theme-hint-color,#999)]">Всего записей</div>
          <div class="text-2xl font-semibold">{{ stats.totalAppointments }}</div>
        </button>
        <button
          type="button"
          class="rounded-xl p-4 bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] text-left cursor-pointer hover:opacity-95 active:opacity-90 transition-opacity border border-transparent hover:border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
          @click="onPanelClick('clients')"
        >
          <div class="text-sm text-[var(--tg-theme-hint-color,#999)]">Клиентов</div>
          <div class="text-2xl font-semibold">{{ stats.totalClients }}</div>
        </button>
        <button
          type="button"
          class="rounded-xl p-4 bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] text-left cursor-pointer hover:opacity-95 active:opacity-90 transition-opacity border border-transparent hover:border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
          @click="onPanelClick('feedback')"
        >
          <div class="text-sm text-[var(--tg-theme-hint-color,#999)]">Отзывов</div>
          <div class="text-2xl font-semibold">{{ stats.feedbackCount ?? 0 }}</div>
        </button>
        <button
          type="button"
          class="rounded-xl p-4 bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] text-left cursor-pointer hover:opacity-95 active:opacity-90 transition-opacity border border-transparent hover:border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
          @click="onPanelClick('rating')"
        >
          <div class="text-sm text-[var(--tg-theme-hint-color,#999)]">Средний рейтинг</div>
          <div class="text-2xl font-semibold">
            {{ stats.averageRating != null ? stats.averageRating + ' ★' : '—' }}
          </div>
        </button>
      </div>

      <h2 class="text-lg font-semibold mb-3">Заработок по месяцам</h2>

      <div class="mb-4 flex gap-2">
        <button
          type="button"
          class="flex-1 p-4 rounded-xl text-left bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)] hover:opacity-90 active:opacity-80 transition-opacity"
          @click="openMonthPicker"
        >
          <div class="text-sm text-[var(--tg-theme-hint-color,#999)] mb-1">
            {{ filterYearMonth ? formatMonth(filterYearMonth) : 'Все месяцы — нажмите, чтобы выбрать период' }}
          </div>
          <div v-if="filterYearMonth && stats.byMonth?.length" class="text-sm">
            <span class="text-[var(--tg-theme-hint-color,#999)]">доход {{ formatMoney(stats.byMonth[0]?.revenue) }} €</span>
            <span class="mx-2">·</span>
            <span class="text-[var(--tg-theme-hint-color,#999)]">прибыль {{ formatMoney(stats.byMonth[0]?.profit) }} €</span>
            <span class="mx-2">·</span>
            <span class="text-[var(--tg-theme-hint-color,#999)]">{{ stats.byMonth[0]?.appointmentCount ?? 0 }} записей</span>
          </div>
        </button>
        <button
          v-if="filterYearMonth"
          type="button"
          class="shrink-0 px-4 py-2 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)] text-sm font-medium hover:opacity-90 active:opacity-80"
          title="Сбросить фильтр"
          @click="clearMonthFilter"
        >
          Сбросить
        </button>
      </div>

      <div v-if="showMonthPicker" class="mb-6 p-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)] space-y-3">
        <div>
          <label class="block text-sm font-medium text-[var(--tg-theme-hint-color,#999)] mb-1">Год</label>
          <select
            v-model.number="pickerYear"
            class="w-full p-3 rounded-lg bg-[var(--tg-theme-bg-color,#fff)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
          >
            <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-[var(--tg-theme-hint-color,#999)] mb-1">Месяц</label>
          <select
            v-model="pickerMonth"
            class="w-full p-3 rounded-lg bg-[var(--tg-theme-bg-color,#fff)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
          >
            <option
              v-for="(label, i) in monthLabels"
              :key="i"
              :value="String(i + 1).padStart(2, '0')"
            >
              {{ label }}
            </option>
          </select>
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 py-2 rounded-lg bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#fff)]"
            @click="applyMonthFilter"
          >
            Показать
          </button>
          <button
            type="button"
            class="py-2 px-4 rounded-lg bg-[var(--tg-theme-secondary-bg-color,#e4e4e7)]"
            @click="filterYearMonth ? clearMonthFilter() : (showMonthPicker = false)"
          >
            {{ filterYearMonth ? 'Сбросить' : 'Отмена' }}
          </button>
        </div>
      </div>

      <div class="mb-4">
        <button
          type="button"
          class="w-full py-2 px-4 rounded-xl font-medium border border-[var(--tg-theme-section-separator-color,#e5e5e5)] bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] text-[var(--tg-theme-text-color,#000)]"
          @click="openExpenseForm()"
        >
          Затраты на аренду и прочее
        </button>
      </div>

      <div v-if="showExpenseForm" class="mb-6 p-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)] space-y-3">
        <label class="block text-sm font-medium text-[var(--tg-theme-hint-color,#999)]">Месяц</label>
        <select
          v-model="expenseForm.yearMonth"
          class="w-full p-3 rounded-lg bg-[var(--tg-theme-bg-color,#fff)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
        >
          <option
            v-for="opt in monthOptions"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </option>
        </select>
        <label class="block text-sm font-medium text-[var(--tg-theme-hint-color,#999)]">Сумма (€)</label>
        <input
          v-model="expenseForm.amount"
          type="number"
          min="0"
          step="0.01"
          placeholder="0"
          class="w-full p-3 rounded-lg bg-[var(--tg-theme-bg-color,#fff)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
        >
        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 py-2 rounded-lg bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#fff)] disabled:opacity-60"
            :disabled="savingExpense"
            @click="saveExpense"
          >
            {{ savingExpense ? 'Сохранение…' : 'Сохранить' }}
          </button>
          <button
            type="button"
            class="py-2 px-4 rounded-lg bg-[var(--tg-theme-secondary-bg-color,#e4e4e7)]"
            @click="showExpenseForm = false"
          >
            Отмена
          </button>
        </div>
      </div>

      <div v-if="stats.totals" class="grid grid-cols-2 gap-4 mb-6">
        <div class="rounded-xl p-4 bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)]">
          <div class="text-sm text-[var(--tg-theme-hint-color,#999)]">Доход</div>
          <div class="text-xl font-semibold">{{ formatMoney(stats.totals.revenue) }} €</div>
        </div>
        <div class="rounded-xl p-4 bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)]">
          <div class="text-sm text-[var(--tg-theme-hint-color,#999)]">Себестоимость</div>
          <div class="text-xl font-semibold">{{ formatMoney(stats.totals.cost) }} €</div>
        </div>
        <div class="rounded-xl p-4 bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)]">
          <div class="text-sm text-[var(--tg-theme-hint-color,#999)]">Аренда и прочее</div>
          <div class="text-xl font-semibold">{{ formatMoney(stats.totals.monthlyExpenses) }} €</div>
        </div>
        <div class="rounded-xl p-4 bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)]">
          <div class="text-sm text-[var(--tg-theme-hint-color,#999)]">Прибыль</div>
          <div class="text-xl font-semibold">{{ formatMoney(stats.totals.profit) }} €</div>
        </div>
      </div>

      <p v-if="!stats.byMonth?.length" class="text-sm text-[var(--tg-theme-hint-color,#999)] mb-6">
        {{ filterYearMonth ? 'Нет данных за выбранный месяц.' : 'Нет завершённых записей по месяцам.' }}
      </p>
      <ul v-else class="space-y-2 mb-8">
        <li
          v-for="m in stats.byMonth"
          :key="m.yearMonth"
          class="p-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] cursor-pointer hover:opacity-90 active:opacity-80 transition-opacity"
          @click="openMonthPicker(m.yearMonth)"
        >
          <div class="font-medium mb-1">{{ formatMonth(m.yearMonth) }}</div>
          <div class="text-sm text-[var(--tg-theme-hint-color,#999)] flex flex-wrap gap-x-4 gap-y-1">
            <span>доход {{ formatMoney(m.revenue) }} €</span>
            <span>себест. {{ formatMoney(m.cost) }} €</span>
            <span>аренда {{ formatMoney(m.monthlyExpense) }} €</span>
            <span>{{ m.appointmentCount }} записей</span>
          </div>
          <div class="text-sm font-medium mt-1">прибыль {{ formatMoney(m.profit) }} €</div>
        </li>
      </ul>

      <h2 class="text-lg font-semibold mb-3">Новые пользователи / новые клиенты</h2>
      <p class="text-sm text-[var(--tg-theme-hint-color,#999)] mb-3">
        По месяцам: сколько новых людей появилось у мастера и сколько из них сделали первый заказ.
      </p>
      <p v-if="!stats.newUsersByMonth?.length" class="text-sm text-[var(--tg-theme-hint-color,#999)] mb-6">Нет данных.</p>
      <ul v-else class="space-y-4 mb-8">
        <li
          v-for="row in stats.newUsersByMonth"
          :key="row.yearMonth"
          class="p-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] flex flex-col sm:flex-row items-start sm:items-center gap-4"
        >
          <div class="min-w-0 flex-1">
            <div class="font-medium mb-1">{{ formatMonth(row.yearMonth) }}</div>
            <div class="text-sm text-[var(--tg-theme-hint-color,#999)]">
              Зарегистрировалось: <strong class="text-[var(--tg-theme-text-color,#000)]">{{ row.registered }}</strong>
              <span class="mx-2">·</span>
              Сделали заказ: <strong class="text-[var(--tg-theme-text-color,#000)]">{{ row.madeOrder }}</strong>
            </div>
          </div>
          <div
            class="shrink-0 w-24 h-24 rounded-full border-4 border-[var(--tg-theme-bg-color,#fff)]"
            :style="{ background: newUsersPieGradient(row.registered, row.madeOrder) }"
          />
          <div class="flex flex-col gap-1 text-xs text-[var(--tg-theme-hint-color,#999)] shrink-0">
            <span class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full bg-[#22c55e]" />
              Сделали заказ ({{ row.madeOrder }})
            </span>
            <span class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full bg-[#9ca3af]" />
              Без заказа ({{ row.registered - row.madeOrder }})
            </span>
          </div>
        </li>
      </ul>

      <h2 class="text-lg font-semibold mb-3">Записи по сервисам</h2>
      <p v-if="!stats.byService?.length" class="text-sm text-[var(--tg-theme-hint-color,#999)]">Нет данных.</p>
      <div v-else class="space-y-4">
        <div
          v-for="s in stats.byService"
          :key="s.serviceId"
          class="flex flex-col gap-1"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-medium min-w-0 truncate">{{ s.serviceName }}</span>
            <span class="text-sm text-[var(--tg-theme-hint-color,#999)] shrink-0">{{ s.count }} записей</span>
          </div>
          <div class="h-7 rounded-lg overflow-hidden bg-[var(--tg-theme-section-separator-color,#e5e5e5)]/30">
            <div
              class="h-full rounded-lg bg-[var(--tg-theme-button-color,#3b82f6)] transition-[width] duration-300"
              :style="{ width: `${(s.count / serviceChartMax) * 100}%` }"
            />
          </div>
        </div>
      </div>

      <!-- Модальное окно: список записей по датам -->
      <Teleport to="body">
        <div
          v-if="showAppointmentsModal"
          class="fixed inset-0 z-[100] flex flex-col bg-black/50"
          @click.self="closeAppointmentsModal"
        >
          <div class="flex-1 min-h-0 flex flex-col m-4 rounded-2xl bg-[var(--tg-theme-bg-color,#fff)] shadow-xl max-h-[85vh]">
            <div class="flex items-center justify-between shrink-0 p-4 border-b border-[var(--tg-theme-section-separator-color,#e5e5e5)]">
              <h3 class="text-lg font-semibold text-[var(--tg-theme-text-color,#000)]">Записи</h3>
              <button
                type="button"
                class="p-2 rounded-lg hover:bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)]"
                aria-label="Закрыть"
                @click="closeAppointmentsModal"
              >
                ✕
              </button>
            </div>
            <div class="flex-1 min-h-0 overflow-y-auto p-4">
              <div v-if="loadingAppointments" class="text-[var(--tg-theme-hint-color,#999)] py-8 text-center">Загрузка…</div>
              <template v-else-if="!appointmentsByDate.length">
                <p class="text-[var(--tg-theme-hint-color,#999)] py-4 text-center">Нет записей за выбранный период.</p>
              </template>
              <template v-else>
                <div v-for="[dateStr, items] in appointmentsByDate" :key="dateStr" class="mb-6">
                  <div class="text-center py-2 mb-3 text-sm font-medium text-[var(--tg-theme-hint-color,#6b7280)] border-b border-t border-[var(--tg-theme-section-separator-color,#e5e5e5)]">
                    ____ {{ formatDateHeader(dateStr) }} ____
                  </div>
                  <div class="space-y-3">
                    <div
                      v-for="a in items"
                      :key="a.id"
                      class="rounded-xl p-4 bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
                    >
                      <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <span class="font-medium text-[var(--tg-theme-text-color,#000)]">
                          {{ (a.startTime || '').slice(0, 5) }}
                        </span>
                        <span
                          class="text-xs font-medium px-2 py-0.5 rounded"
                          :class="a.status === 'cancelled' ? 'bg-red-100 text-red-800' : a.status === 'done' ? 'bg-green-100 text-green-800' : 'bg-[var(--tg-theme-hint-color,#999)]/20 text-[var(--tg-theme-hint-color,#6b7280)]'"
                        >
                          {{ appointmentStatusLabel(a) }}
                        </span>
                      </div>
                      <div class="text-sm text-[var(--tg-theme-hint-color,#6b7280)] space-y-1">
                        <p v-if="a.service?.name">
                          <span class="text-[var(--tg-theme-hint-color,#999)]">Услуга:</span> {{ a.service.name }}
                        </p>
                        <p v-else-if="a.serviceId" class="text-[var(--tg-theme-hint-color,#999)]">Услуга: —</p>
                        <p v-else class="text-[var(--tg-theme-hint-color,#999)]">Для моделей</p>
                        <p>
                          <span class="text-[var(--tg-theme-hint-color,#999)]">Сумма:</span>
                          <span class="font-medium text-[var(--tg-theme-text-color,#000)]">
                            {{ appointmentDisplayPrice(a) != null ? formatMoney(appointmentDisplayPrice(a)) + ' €' : '—' }}
                          </span>
                        </p>
                        <p v-if="a.feedback?.rating">
                          <span class="text-[var(--tg-theme-hint-color,#999)]">Оценка:</span> {{ a.feedback.rating }} ★
                        </p>
                        <p v-if="appointmentNote(a)" class="mt-2 pt-2 border-t border-[var(--tg-theme-section-separator-color,#e5e5e5)]">
                          <span class="text-[var(--tg-theme-hint-color,#999)]">Примечание:</span> {{ appointmentNote(a) }}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </Teleport>
    </template>
  </div>
</template>
