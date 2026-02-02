import { createRouter, createWebHistory } from 'vue-router';
import { useAuth } from '../composables/useAuth';

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
    path: '/admin/drinks',
    name: 'AdminDrinks',
    component: () => import('../views/admin/Drinks.vue'),
    meta: { requiresAuth: true, requiresMaster: true },
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('../views/Profile.vue'),
    meta: { requiresAuth: true },
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
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
