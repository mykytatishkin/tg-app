<script setup>
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { api } from '../api/client';
import { useTelegramWebApp } from '../composables/useTelegramWebApp';

const router = useRouter();
const route = useRoute();
const { hapticFeedback, webApp } = useTelegramWebApp();

const appointmentId = ref(route.query.id || '');
const loading = ref(false);
const paymentLoading = ref(false);
const paymentDone = ref(false);
const error = ref(null);
const confettiRunning = ref(true);

function runConfetti() {
  const colors = ['#fff', '#e8e8e8', '#c0c0c0', '#888', '#4a4a4a', '#1a1a1a'];
  const container = document.getElementById('confetti-container');
  if (!container) return;
  for (let i = 0; i < 60; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.setProperty('--x', Math.random() * 100 - 50 + 'vw');
    el.style.setProperty('--delay', Math.random() * 0.5 + 's');
    el.style.setProperty('--duration', Math.random() * 0.5 + 1.5 + 's');
    el.style.setProperty('--rotation', Math.random() * 720 - 360 + 'deg');
    el.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    container.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }
  setTimeout(() => { confettiRunning.value = false; }, 3000);
}

async function enableReminder() {
  if (!appointmentId.value) return;
  hapticFeedback?.('light');
  loading.value = true;
  error.value = null;
  try {
    await api.post(`/appointments/${appointmentId.value}/reminder`, { enable: true });
    hapticFeedback?.('success');
    goToAppointments();
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

function skipReminder() {
  hapticFeedback?.('light');
  goToAppointments();
}

function goToAppointments() {
  router.replace('/appointments');
}

async function payNow() {
  if (!appointmentId.value) return;
  hapticFeedback?.('light');
  paymentLoading.value = true;
  error.value = null;
  try {
    const data = await api.post(`/appointments/${appointmentId.value}/payment`, {});
    if (!data.invoiceUrl) {
      // No payment provider configured — skip gracefully
      hapticFeedback?.('success');
      paymentDone.value = true;
      return;
    }
    if (webApp?.openInvoice) {
      webApp.openInvoice(data.invoiceUrl, (status) => {
        if (status === 'paid') {
          hapticFeedback?.('success');
          paymentDone.value = true;
        } else if (status === 'failed') {
          error.value = 'Платёж не прошёл. Попробуйте ещё раз.';
          hapticFeedback?.('error');
        }
      });
    } else {
      // Fallback: open in browser tab
      window.open(data.invoiceUrl, '_blank');
    }
  } catch (e) {
    error.value = e.message;
  } finally {
    paymentLoading.value = false;
  }
}

onMounted(() => {
  runConfetti();
  if (!appointmentId.value) {
    goToAppointments();
  }
  webApp?.expand?.();
});
</script>

<template>
  <div class="min-h-screen p-4 pb-24 bg-[var(--tg-theme-bg-color,#fff)] text-[var(--tg-theme-text-color,#000)] flex flex-col items-center justify-center relative overflow-hidden">
    <div id="confetti-container" class="fixed inset-0 pointer-events-none z-0" aria-hidden="true" />

    <div class="relative z-10 text-center max-w-sm w-full">
      <template v-if="paymentDone">
        <div class="text-4xl mb-4">💳</div>
        <h1 class="text-2xl font-bold mb-4">Оплата прошла!</h1>
        <p class="text-[var(--tg-theme-hint-color,#999)] mb-8">
          Ваш визит подтверждён и оплачен.
        </p>
        <div class="flex flex-col gap-3">
          <button
            type="button"
            class="w-full py-3 px-4 rounded-xl font-medium bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#e8e8e8)]"
            @click="goToAppointments"
          >
            Мои записи
          </button>
        </div>
      </template>

      <template v-else>
        <h1 class="text-2xl font-bold mb-4">
          Вы успешно забронировали визит
        </h1>
        <p class="text-[var(--tg-theme-hint-color,#999)] mb-6">
          Включить напоминалку?
        </p>
        <p class="text-sm text-[var(--tg-theme-hint-color,#999)] mb-6">
          За день до записи (за 24 ч или меньше) мы пришлём напоминание вам и мастеру в чат с ботом.
        </p>

        <p v-if="error" class="text-red-500 text-sm mb-4">{{ error }}</p>

        <div class="flex flex-col gap-3">
          <button
            type="button"
            class="w-full py-3 px-4 rounded-xl font-medium bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#e8e8e8)] disabled:opacity-60"
            :disabled="loading || paymentLoading"
            @click="enableReminder"
          >
            {{ loading ? 'Включаю…' : 'Да, включить напоминание' }}
          </button>

          <button
            type="button"
            class="w-full py-3 px-4 rounded-xl font-medium bg-[var(--tg-theme-secondary-bg-color,#e5e5e5)] text-[var(--tg-theme-text-color,#000)] disabled:opacity-60"
            :disabled="loading || paymentLoading"
            @click="payNow"
          >
            {{ paymentLoading ? 'Открываю оплату…' : '💳 Оплатить визит' }}
          </button>

          <button
            type="button"
            class="w-full py-3 px-4 rounded-xl font-medium text-[var(--tg-theme-hint-color,#999)]"
            :disabled="loading || paymentLoading"
            @click="skipReminder"
          >
            Пропустить
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.confetti-piece {
  position: absolute;
  left: 50%;
  top: -10px;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  animation: confetti-fall var(--duration, 2s) var(--delay, 0s) ease-out forwards;
  opacity: 0.95;
}

@keyframes confetti-fall {
  0% {
    transform: translate(0, 0) rotate(0deg);
    opacity: 0.95;
  }
  100% {
    transform: translate(var(--x, 0), 100vh) rotate(var(--rotation, 0deg));
    opacity: 0;
  }
}
</style>
