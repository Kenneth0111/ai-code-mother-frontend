<template>
  <a-layout-footer class="footer">
    <div class="footer-content">
      <p class="copyright">
        <a
          href="https://github.com/Kenneth0111"
          target="_blank"
          rel="noopener noreferrer"
          class="author-link"
        >
          编程导航项目 by 程序员张博洋
        </a>
      </p>
    </div>
  </a-layout-footer>
</template>

<script setup lang="ts">
// 无需额外的响应式数据
</script>

<style scoped>
.footer {
  background: linear-gradient(180deg, #FFF5E8, #FFECD4);
  text-align: center;
  padding: 20px;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  border-top: 2px dashed var(--color-border-soft, #F0E4D4);
}

.copyright {
  margin: 0;
  font-family: var(--font-body, 'Long Cang', cursive);
  color: var(--color-text-mid, #7A6555);
  font-size: 14px;
}

.author-link {
  color: var(--color-primary, #FF8C42);
  transition: color 0.3s;
}

.author-link:hover {
  color: var(--color-primary-hover, #FF7726);
}
</style>
