import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuth } from './useAuth';
import { api } from '../api/client';

/**
 * For admin: loads list of masters and syncs selected master with route query (masterId).
 * Returns { isAdmin, masters, selectedMasterId, selectedMasterName, setMasterId, masterIdParam }.
 * Use masterIdParam in API calls when isAdmin and selectedMasterId is set.
 */
export function useAdminMasters() {
  const route = useRoute();
  const { user } = useAuth();

  const isAdmin = computed(() => !!user.value?.isAdmin);
  const masters = ref([]);
  const mastersLoading = ref(false);

  const selectedMasterId = computed(() => route.query.masterId ?? '');

  const selectedMasterName = computed(() => {
    const id = selectedMasterId.value;
    if (!id) return '';
    const m = masters.value.find((x) => x.id === id);
    return m ? [m.firstName, m.lastName].filter(Boolean).join(' ').trim() || id : id;
  });

  /** Query param object for API: { masterId } when admin and selected, else {} */
  const masterIdParam = computed(() => {
    if (!isAdmin.value || !selectedMasterId.value) return {};
    return { masterId: selectedMasterId.value };
  });

  async function loadMasters() {
    if (!isAdmin.value) return;
    mastersLoading.value = true;
    try {
      masters.value = await api.get('/crm/masters');
    } catch {
      masters.value = [];
    } finally {
      mastersLoading.value = false;
    }
  }

  function setMasterId(id) {
    const path = route.path;
    const query = { ...route.query };
    if (id) query.masterId = id;
    else delete query.masterId;
    return { path, query };
  }

  watch(isAdmin, (v) => {
    if (v) loadMasters();
  }, { immediate: true });

  return {
    isAdmin,
    masters,
    mastersLoading,
    selectedMasterId,
    selectedMasterName,
    setMasterId,
    masterIdParam,
    loadMasters,
  };
}
