<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from './composables/useAuth';
import { useTelegramWebApp } from './composables/useTelegramWebApp';
import { useTelegramTheme } from './composables/useTelegramTheme';
import { setAuthComposable } from './api/client';

const router = useRouter();
const auth = useAuth();
const { ready } = useTelegramWebApp();

useTelegramTheme();
setAuthComposable(auth);

onMounted(async () => {
  ready();
  if (auth.isAuthenticated.value) {
    await auth.refreshUser();
  }
});

router.beforeEach(async (to) => {
  if (to.meta.requiresAuth && !auth.isAuthenticated.value) {
    const ok = await auth.ensureAuth();
    if (!ok) return { name: 'Login' };
  }
  if (to.meta.requiresMaster) {
    await auth.refreshUser();
    const user = auth.user.value;
    if (!user?.isMaster && !user?.isAdmin) return { path: '/' };
  }
  return true;
});
</script>

<template>
  <div id="app" class="min-h-screen">
    <RouterView />
  </div>
</template>
