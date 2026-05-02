import { createRouter, createWebHistory } from 'vue-router';
import { useAuth } from '../composables/useAuth';
import { useTelegramWebApp } from '../composables/useTelegramWebApp';

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('../views/Dashboard.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
  },
  {
    path: '/appointments',
    name: 'Appointments',
    component: () => import('../views/Appointments.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/appointments/book',
    name: 'BookAppointment',
    component: () => import('../views/AppointmentsBook.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/appointments/success',
    name: 'BookingSuccess',
    component: () => import('../views/BookingSuccess.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/admin/stats',
    name: 'AdminStats',
    component: () => import('../views/admin/Stats.vue'),
    meta: { requiresAuth: true, requiresMaster: true },
  },
  {
    path: '/admin/clients',
    name: 'AdminClients',
    component: () => import('../views/admin/Clients.vue'),
    meta: { requiresAuth: true, requiresMaster: true },
  },
  {
    path: '/admin/clients/:id',
    name: 'AdminClientDetail',
    component: () => import('../views/admin/ClientDetail.vue'),
    meta: { requiresAuth: true, requiresMaster: true },
  },
  {
    path: '/admin/services',
    name: 'AdminServices',
    component: () => import('../views/admin/Services.vue'),
    meta: { requiresAuth: true, requiresMaster: true },
  },
  {
    path: '/admin/appointments',
    name: 'AdminAppointments',
    component: () => import('../views/admin/Appointments.vue'),
    meta: { requiresAuth: true, requiresMaster: true },
  },
  {
    path: '/admin/appointments/:id',
    name: 'AdminAppointmentDetail',
    component: () => import('../views/admin/AppointmentDetail.vue'),
    meta: { requiresAuth: true, requiresMaster: true },
  },
  {
    path: '/admin/availability',
    name: 'AdminAvailability',
    component: () => import('../views/admin/Availability.vue'),
    meta: { requiresAuth: true, requiresMaster: true },
  },
  {
    path: '/admin/backups',
    name: 'AdminBackups',
    component: () => import('../views/admin/Backups.vue'),
    meta: { requiresAuth: true, requiresMaster: true },
  },
  {
    path: '/admin/broadcast',
    name: 'AdminBroadcast',
    component: () => import('../views/admin/Broadcast.vue'),
    meta: { requiresAuth: true, requiresMaster: true },
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('../views/Profile.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/suggestions/new',
    name: 'SuggestionsNew',
    component: () => import('../views/SuggestionsNew.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/admin/suggestions',
    name: 'AdminSuggestions',
    component: () => import('../views/admin/Suggestions.vue'),
    meta: { requiresAuth: true, requiresMaster: true },
  },
  {
    path: '/admin/custom-time-requests',
    name: 'AdminCustomTimeRequests',
    component: () => import('../views/admin/CustomTimeRequests.vue'),
    meta: { requiresAuth: true, requiresMaster: true },
  },
  {
    path: '/promo',
    name: 'Promo',
    component: () => import('../views/Promo.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/giveaways',
    name: 'Giveaways',
    component: () => import('../views/Giveaways.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/giveaways/new',
    name: 'GiveawayNew',
    component: () => import('../views/GiveawayNew.vue'),
    meta: { requiresAuth: true, requiresMaster: true },
  },
  {
    path: '/giveaways/:id',
    name: 'GiveawayDetail',
    component: () => import('../views/GiveawayDetail.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/masters/:id',
    name: 'MasterProfile',
    component: () => import('../views/MasterProfile.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/admin/settings',
    name: 'AdminMasterSettings',
    component: () => import('../views/admin/MasterSettings.vue'),
    meta: { requiresAuth: true, requiresMaster: true },
  },
  {
    path: '/admin/portfolio',
    name: 'AdminPortfolio',
    component: () => import('../views/admin/Portfolio.vue'),
    meta: { requiresAuth: true, requiresMaster: true },
  },
  {
    path: '/admin/subscriptions',
    name: 'AdminSubscriptions',
    component: () => import('../views/admin/Subscriptions.vue'),
    meta: { requiresAuth: true, requiresMaster: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth && !to.meta.requiresMaster) return true;

  const { ensureAuth, user } = useAuth();
  const { isAvailable } = useTelegramWebApp();

  // Outside Telegram and no stored token — send to login (which shows preview stub)
  const authed = await ensureAuth();
  if (!authed) {
    return { name: 'Login' };
  }

  if (to.meta.requiresMaster) {
    const u = user.value;
    if (!u?.isMaster && !u?.isAdmin) {
      return { name: 'Dashboard' };
    }
  }

  return true;
});

export default router;
