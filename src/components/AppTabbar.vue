
<template>
  <f7-toolbar bottom tabbar class="app-tabbar">
    <f7-link
      href="/"
      :class="{ 'app-link-active': active === 'home' }"
      aria-label="Головна"
    >
      <f7-icon f7="house_fill" />
      <span class="app-tab-label">Головна</span>
    </f7-link>

    <f7-link
      href="/tasks/"
      :class="{ 'app-link-active': active === 'tasks' }"
      aria-label="Завдання"
    >
      <f7-icon f7="square_list_fill" />
      <span class="app-tab-label">Завдання</span>
    </f7-link>

    <f7-link
      href="/settings/"
      :class="{ 'app-link-active': active === 'settings' }"
      aria-label="Налаштування"
    >
      <f7-icon f7="gear_alt_fill" />
      <span class="app-tab-label">Налаштування</span>
    </f7-link>

    <f7-link
      href="/about/"
      :class="{ 'app-link-active': active === 'about' }"
      aria-label="Про застосунок"
    >
      <f7-icon f7="info_circle_fill" />
      <span class="app-tab-label">Про застосунок</span>
    </f7-link>
  </f7-toolbar>
</template>

<script setup>
defineProps({
  active: {
    type: String,
    required: true,
  },
})
</script>
