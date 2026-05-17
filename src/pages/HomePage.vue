<template>
  <div id="homePage">
    <!-- Hero Section -->
    <div class="hero-section">
      <div class="hero-content">
        <h1 class="hero-title">
          一句话
          <img class="hero-logo" src="@/assets/logo.png" alt="Logo" />
          呈所想
        </h1>
        <p class="hero-subtitle">与 AI 对话轻松创建应用和网站</p>

        <!-- Input Area -->
        <div class="input-card">
          <a-textarea
            v-model:value="promptText"
            :auto-size="{ minRows: 2, maxRows: 4 }"
            placeholder="使用 NoCode 创建一个高效的小工具，帮我计算......"
            class="prompt-input"
            :bordered="false"
            @pressEnter.prevent="handleCreate"
          />
          <div class="input-actions">
            <div class="left-actions">
              <a-button size="small">
                <template #icon><upload-outlined /></template>
                上传
              </a-button>
              <a-button size="small">✨ 优化</a-button>
            </div>
            <a-button
              type="primary"
              shape="circle"
              size="large"
              :loading="creating"
              @click="handleCreate"
            >
              <template #icon><arrow-up-outlined /></template>
            </a-button>
          </div>
        </div>

        <!-- Quick Tags -->
        <div class="quick-tags">
          <a-tag
            v-for="tag in quickTags"
            :key="tag"
            class="tag-item"
            @click="promptText = tag"
          >
            {{ tag }}
          </a-tag>
        </div>
      </div>
    </div>

    <!-- My Apps Section -->
    <div class="section" v-if="loginUserStore.loginUser.id">
      <div class="section-header">
        <h2 class="section-title">我的作品</h2>
        <a-input-search
          v-model:value="myAppsSearch"
          placeholder="搜索我的应用"
          style="width: 240px"
          allow-clear
          @search="doSearchMyApps"
        />
      </div>
      <a-spin :spinning="myAppsLoading">
        <div v-if="myApps.length > 0" class="app-grid">
          <div
            class="app-card"
            v-for="app in myApps"
            :key="app.id"
            @click="goToChat(app.id)"
          >
            <div class="app-cover">
              <img v-if="app.cover" :src="app.cover" alt="cover" />
              <div v-else class="cover-placeholder">
                <appstore-outlined style="font-size: 40px; color: #bbb" />
              </div>
            </div>
            <div class="app-info">
              <div class="app-name">{{ app.appName || '未命名应用' }}</div>
              <div class="app-time">创建于 {{ formatRelativeTime(app.createTime) }}</div>
            </div>
          </div>
        </div>
        <a-empty v-else description="还没有创建应用，快去试试吧" />
      </a-spin>
      <div v-if="myAppsTotal > 20" class="pagination-wrapper">
        <a-pagination
          v-model:current="myAppsPage"
          :total="myAppsTotal"
          :pageSize="20"
          @change="fetchMyApps"
          show-less-items
        />
      </div>
    </div>

    <!-- Featured Apps Section -->
    <div class="section">
      <div class="section-header">
        <h2 class="section-title">精选案例</h2>
        <a-input-search
          v-model:value="featuredAppsSearch"
          placeholder="搜索精选应用"
          style="width: 240px"
          allow-clear
          @search="doSearchFeaturedApps"
        />
      </div>
      <a-spin :spinning="featuredAppsLoading">
        <div v-if="featuredApps.length > 0" class="app-grid">
          <div
            class="app-card featured"
            v-for="app in featuredApps"
            :key="app.id"
            @click="goToChat(app.id)"
          >
            <div class="app-cover">
              <img v-if="app.cover" :src="app.cover" alt="cover" />
              <div v-else class="cover-placeholder">
                <appstore-outlined style="font-size: 40px; color: #bbb" />
              </div>
            </div>
            <div class="app-footer">
              <a-avatar :src="app.user?.userAvatar" :size="28">
                {{ (app.user?.userName || '匿')[0] }}
              </a-avatar>
              <div class="app-meta">
                <span class="app-name">{{ app.appName || '未命名应用' }}</span>
                <a-tag v-if="app.codeGenType" color="blue" :bordered="false" size="small">
                  {{ app.codeGenType }}
                </a-tag>
              </div>
              <span class="author-name">{{ app.user?.userName || '匿名用户' }}</span>
            </div>
          </div>
        </div>
        <a-empty v-else description="暂无精选应用" />
      </a-spin>
      <div v-if="featuredAppsTotal > 20" class="pagination-wrapper">
        <a-pagination
          v-model:current="featuredAppsPage"
          :total="featuredAppsTotal"
          :pageSize="20"
          @change="fetchFeaturedApps"
          show-less-items
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  UploadOutlined,
  ArrowUpOutlined,
  AppstoreOutlined,
} from '@ant-design/icons-vue'
import { useLoginUserStore } from '@/stores/loginUser'
import { addApp, listMyAppVoByPage, listGoodAppVoByPage } from '@/api/appController'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

const router = useRouter()
const loginUserStore = useLoginUserStore()

const promptText = ref('')
const creating = ref(false)

const quickTags = ['波普风电商页面', '企业网站', '电商运营后台', '暗黑话题社区']

// My Apps
const myApps = ref<API.AppVO[]>([])
const myAppsPage = ref(1)
const myAppsTotal = ref(0)
const myAppsLoading = ref(false)
const myAppsSearch = ref('')

// Featured Apps
const featuredApps = ref<API.AppVO[]>([])
const featuredAppsPage = ref(1)
const featuredAppsTotal = ref(0)
const featuredAppsLoading = ref(false)
const featuredAppsSearch = ref('')

const formatRelativeTime = (time?: string) => {
  if (!time) return '未知'
  return dayjs(time).fromNow()
}

const handleCreate = async () => {
  if (!promptText.value.trim()) {
    message.warning('请输入提示词')
    return
  }
  if (!loginUserStore.loginUser.id) {
    message.warning('请先登录')
    router.push('/user/login')
    return
  }
  creating.value = true
  try {
    const res = await addApp({ initPrompt: promptText.value.trim() })
    if (res.data.code === 0 && res.data.data) {
      const appId = res.data.data
      await router.push(`/app/chat/${appId}`)
    } else {
      message.error('创建失败：' + (res.data.message || '未知错误'))
    }
  } catch (e: any) {
    message.error('创建失败')
  } finally {
    creating.value = false
  }
}

const goToChat = (appId?: string) => {
  if (appId) {
    router.push(`/app/chat/${appId}`)
  }
}

const fetchMyApps = async () => {
  if (!loginUserStore.loginUser.id) return
  myAppsLoading.value = true
  try {
    const res = await listMyAppVoByPage({
      pageNum: myAppsPage.value,
      pageSize: 20,
      appName: myAppsSearch.value || undefined,
      sortField: 'createTime',
      sortOrder: 'descend',
    })
    if (res.data.code === 0 && res.data.data) {
      myApps.value = res.data.data.records ?? []
      // 后端 totalRow 可能以字符串形式返回（Long 防精度丢失），需转 Number 以避免 a-pagination 类型告警
      myAppsTotal.value = Number(res.data.data.totalRow ?? 0)
    }
  } catch {
    // silent
  } finally {
    myAppsLoading.value = false
  }
}

const fetchFeaturedApps = async () => {
  featuredAppsLoading.value = true
  try {
    const res = await listGoodAppVoByPage({
      pageNum: featuredAppsPage.value,
      pageSize: 20,
      appName: featuredAppsSearch.value || undefined,
      sortField: 'priority',
      sortOrder: 'descend',
    })
    if (res.data.code === 0 && res.data.data) {
      featuredApps.value = res.data.data.records ?? []
      featuredAppsTotal.value = Number(res.data.data.totalRow ?? 0)
    }
  } catch {
    // silent
  } finally {
    featuredAppsLoading.value = false
  }
}

const doSearchMyApps = () => {
  myAppsPage.value = 1
  fetchMyApps()
}

const doSearchFeaturedApps = () => {
  featuredAppsPage.value = 1
  fetchFeaturedApps()
}

onMounted(() => {
  fetchMyApps()
  fetchFeaturedApps()
})
</script>

<style scoped>
#homePage {
  margin: -24px;
  background: var(--color-bg-warm);
}

/* ========== Hero Section ========== */
.hero-section {
  background: var(--color-bg-hero);
  padding: 64px 24px 44px;
  display: flex;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.hero-section::before {
  content: '';
  position: absolute;
  top: -40px;
  right: -60px;
  width: 260px;
  height: 260px;
  background: radial-gradient(circle, rgba(255, 217, 102, 0.35) 0%, transparent 70%);
  border-radius: 50%;
}

.hero-section::after {
  content: '';
  position: absolute;
  bottom: -30px;
  left: -40px;
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, rgba(126, 214, 168, 0.25) 0%, transparent 70%);
  border-radius: 50%;
}

.hero-content {
  max-width: 720px;
  width: 100%;
  text-align: center;
  position: relative;
  z-index: 1;
}

.hero-title {
  font-family: var(--font-display);
  font-size: 46px;
  font-weight: 700;
  color: var(--color-text-dark);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  letter-spacing: 2px;
}

.hero-logo {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 4px 16px rgba(255, 140, 66, 0.3);
  border: 3px solid #fff;
  transition: transform 0.4s ease;
}

.hero-logo:hover {
  transform: rotate(-8deg) scale(1.1);
}

.hero-subtitle {
  font-family: var(--font-body);
  font-size: 17px;
  color: var(--color-text-mid);
  margin-bottom: 36px;
  letter-spacing: 1px;
}

/* ========== Input Card ========== */
.input-card {
  background: var(--color-card-bg);
  border-radius: 20px;
  padding: 18px 22px 14px;
  box-shadow:
    0 6px 28px rgba(255, 140, 66, 0.1),
    0 2px 8px rgba(0, 0, 0, 0.04);
  border: 2px dashed var(--color-border-soft);
  transition: border-color 0.3s, box-shadow 0.3s;
}

.input-card:focus-within {
  border-color: var(--color-primary-light);
  box-shadow:
    0 8px 32px rgba(255, 140, 66, 0.16),
    0 2px 8px rgba(0, 0, 0, 0.04);
}

.prompt-input {
  font-family: var(--font-body) !important;
  font-size: 16px;
  resize: none;
  color: var(--color-text-dark);
}

.input-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
}

.left-actions {
  display: flex;
  gap: 8px;
}

/* ========== Quick Tags ========== */
.quick-tags {
  margin-top: 24px;
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}

.tag-item {
  cursor: pointer;
  border-radius: 24px;
  padding: 6px 20px;
  font-family: var(--font-body);
  font-size: 15px;
  border: 2px dashed var(--color-border-soft);
  background: var(--color-tag-bg);
  color: var(--color-text-mid);
  transition: all 0.3s ease;
  backdrop-filter: blur(4px);
}

.tag-item:nth-child(1):hover {
  color: #E86430;
  border-color: #FFAA7A;
  background: #FFF0E5;
  transform: translateY(-2px) rotate(-1deg);
}

.tag-item:nth-child(2):hover {
  color: #2D9D6E;
  border-color: #7ED6A8;
  background: #E8F8EE;
  transform: translateY(-2px) rotate(1deg);
}

.tag-item:nth-child(3):hover {
  color: #3B8DB5;
  border-color: #7EC8E3;
  background: #E5F4FA;
  transform: translateY(-2px) rotate(-1deg);
}

.tag-item:nth-child(4):hover {
  color: #8B5FB0;
  border-color: #C4A8E0;
  background: #F3ECF9;
  transform: translateY(-2px) rotate(1deg);
}

/* ========== Section ========== */
.section {
  max-width: 1200px;
  margin: 0 auto;
  padding: 36px 24px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 28px;
}

.section-title {
  font-family: var(--font-display);
  font-size: 26px;
  font-weight: 600;
  color: var(--color-text-dark);
  margin: 0;
  position: relative;
  padding-bottom: 6px;
}

.section-title::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 60%;
  height: 3px;
  background: linear-gradient(90deg, var(--color-primary), var(--color-accent-yellow));
  border-radius: 2px;
}

/* ========== App Grid ========== */
.app-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 22px;
}

.app-card {
  background: var(--color-card-bg);
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid var(--color-border-soft);
  transition: all 0.35s ease;
}

.app-card:hover {
  box-shadow: 0 10px 30px rgba(255, 140, 66, 0.12);
  transform: translateY(-4px);
  border-color: var(--color-primary-light);
}

.app-cover {
  width: 100%;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  background: linear-gradient(135deg, #FFF5E8, #FFE8D6);
}

.app-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #FFF5E8 0%, #FFE8D6 50%, #FFECD4 100%);
}

.app-info {
  padding: 14px 18px;
}

.app-name {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 500;
  color: var(--color-text-dark);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-time {
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--color-text-light);
  margin-top: 4px;
}

.app-footer {
  padding: 12px 18px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-top: 1px dashed var(--color-border-soft);
}

.app-meta {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.app-meta .app-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.author-name {
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--color-text-light);
  white-space: nowrap;
}

.pagination-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 28px;
}

/* ========== Responsive ========== */
@media (max-width: 900px) {
  .app-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .app-grid {
    grid-template-columns: 1fr;
  }

  .hero-title {
    font-size: 30px;
  }

  .hero-logo {
    width: 44px;
    height: 44px;
  }
}
</style>
