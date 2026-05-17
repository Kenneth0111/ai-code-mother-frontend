<template>
  <a-layout class="basic-layout" v-if="!route.meta.hideLayout">
    <!-- 顶部导航栏 -->
    <GlobalHeader />

    <!-- 主要内容区域 -->
    <a-layout-content class="main-content">
      <router-view />
    </a-layout-content>

    <!-- 底部版权信息 -->
    <GlobalFooter />
  </a-layout>
  <router-view v-else />
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import GlobalHeader from '@/components/GlobalHeader.vue'
import GlobalFooter from '@/components/GlobalFooter.vue'

const route = useRoute()
</script>

<style scoped>
.basic-layout {
  background: var(--color-bg-warm, #FFF9EE);
  min-height: 100vh;
}

.main-content {
  padding: 24px;
  background: var(--color-card-bg, #FFFCF5);
  margin: 16px auto 56px;
  border-radius: 16px;
}
</style>
