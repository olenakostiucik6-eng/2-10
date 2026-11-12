<script setup>
defineProps({
  count: {
    type: Number,
    required: true,
  },
  label: {
    type: String,
    default: 'Усього завдань',
  },
});
</script>

<template>
  <div class="tf3-stat">
    <span class="tf3-stat-label">{{ label }}</span>
    <strong>{{ count }}</strong>
  </div>
</template>