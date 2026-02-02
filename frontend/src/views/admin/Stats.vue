<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../../api/client';
import { useTelegramWebApp } from '../../composables/useTelegramWebApp';

const router = useRouter();
const { hapticFeedback } = useTelegramWebApp();

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
  loading.value = true;
  error.value = null;
  try {
    const params = new URLSearchParams();
    if (filterYearMonth.value) {
      const [y, m] = filterYearMonth.value.split('-');
      params.set('year', y);
      params.set('month', m);
    }
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

function formatMoney(v) {
  return typeof v === 'number' ? v.toFixed(2) : '0.00';
}

function goBack() {
  hapticFeedback?.('light');
  router.push('/');
}

onMounted(load);
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
      <h1 class="text-2xl font-bold">Статистика</h1>
    </div>

    <p v-if="error" class="text-neutral-400 mb-4">{{ error }}</p>
    <div v-if="loading" class="text-[var(--tg-theme-hint-color,#999)]">Загрузка…</div>

    <template v-else-if="stats">
      <div class="grid gap-4 mb-6 grid-cols-2">
        <div class="rounded-xl p-4 bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)]">
          <div class="text-sm text-[var(--tg-theme-hint-color,#999)]">Всего записей</div>
          <div class="text-2xl font-semibold">{{ stats.totalAppointments }}</div>
        </div>
        <div class="rounded-xl p-4 bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)]">
          <div class="text-sm text-[var(--tg-theme-hint-color,#999)]">Клиентов</div>
          <div class="text-2xl font-semibold">{{ stats.totalClients }}</div>
        </div>
        <div class="rounded-xl p-4 bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)]">
          <div class="text-sm text-[var(--tg-theme-hint-color,#999)]">Отзывов</div>
          <div class="text-2xl font-semibold">{{ stats.feedbackCount ?? 0 }}</div>
        </div>
        <div class="rounded-xl p-4 bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)]">
          <div class="text-sm text-[var(--tg-theme-hint-color,#999)]">Средний рейтинг</div>
          <div class="text-2xl font-semibold">
            {{ stats.averageRating != null ? stats.averageRating + ' ★' : '—' }}
          </div>
        </div>
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

      <h2 class="text-lg font-semibold mb-3">Записи по сервисам</h2>
      <p v-if="!stats.byService?.length" class="text-sm text-[var(--tg-theme-hint-color,#999)]">Нет данных.</p>
      <ul v-else class="space-y-2">
        <li
          v-for="s in stats.byService"
          :key="s.serviceId"
          class="flex justify-between items-center p-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)]"
        >
          <span class="font-medium">{{ s.serviceName }}</span>
          <span class="text-[var(--tg-theme-hint-color,#999)]">{{ s.count }} записей</span>
        </li>
      </ul>
    </template>
  </div>
</template>
