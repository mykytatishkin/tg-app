<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from './composables/useAuth';
import { useTelegramWebApp } from './composables/useTelegramWebApp';
import { setAuthComposable } from './api/client';

const router = useRouter();
const auth = useAuth();
const { ready } = useTelegramWebApp();

setAuthComposable(auth);

onMounted(() => {
  ready();
});

router.beforeEach(async (to) => {
  if (to.meta.requiresAuth && !auth.isAuthenticated.value) {
    const ok = await auth.ensureAuth();
    if (!ok) return { name: 'Login' };
  }
  return true;
});
</script>

<template>
  <div id="app" class="min-h-screen">
    <RouterView />
  </div>
</template>
