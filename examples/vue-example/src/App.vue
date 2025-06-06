<script setup lang="ts">
import MainLayout from './components/MainLayout.vue';
import { StagewiseToolbar, type ToolbarConfig } from '@stagewise/toolbar-vue';
import { VuePlugin } from '@stagewise-plugins/vue';

const toolbarConfig: ToolbarConfig = {
  plugins: [VuePlugin],
};
</script>

<template>
  <StagewiseToolbar :config="toolbarConfig" />
  <MainLayout />
</template>

<style>
/* Global styles can go here if needed */
</style>
