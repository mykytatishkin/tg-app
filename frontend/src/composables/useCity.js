import { ref, watch } from 'vue';

const STORAGE_KEY = 'tg_app_selected_city';

const selectedCity = ref(localStorage.getItem(STORAGE_KEY) || '');
const cityChangedInSession = ref(false);

watch(selectedCity, (val) => {
  if (val) {
    localStorage.setItem(STORAGE_KEY, val);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
});

export function useCity() {
  function setCity(city) {
    if (city !== selectedCity.value) {
      selectedCity.value = city;
      cityChangedInSession.value = true;
    }
  }

  return {
    selectedCity,
    cityChangedInSession,
    setCity,
  };
}
