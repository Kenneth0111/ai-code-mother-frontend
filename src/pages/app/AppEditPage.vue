<template>
  <div id="appEditPage">
    <!-- 顶部返回 + 标题 -->
    <div class="page-header">
      <a-button type="text" class="back-btn" @click="goBack">
        <template #icon><arrow-left-outlined /></template>
        返回
      </a-button>
      <h2 class="page-title">编辑应用信息</h2>
    </div>

    <a-spin :spinning="pageLoading">
      <!-- ========== 基本信息 ========== -->
      <div class="info-card">
        <div class="card-title">基本信息</div>

        <a-form
          ref="formRef"
          layout="vertical"
          :model="formState"
          :rules="formRules"
          @finish="handleSubmit"
        >
          <!-- 应用名称 -->
          <a-form-item
            label="应用名称"
            name="appName"
            class="required-label"
          >
            <a-input
              v-model:value="formState.appName"
              placeholder="请输入应用名称"
              :maxlength="50"
              show-count
              allow-clear
            />
          </a-form-item>

          <!-- 应用封面 -->
          <a-form-item label="应用封面" name="cover">
            <a-input
              v-model:value="formState.cover"
              placeholder="请输入封面图片链接"
              allow-clear
            />
            <div class="cover-preview-box">
              <img
                v-if="formState.cover"
                :src="formState.cover"
                alt="封面预览"
                class="cover-preview-img"
                @error="handleImgError"
              />
              <div v-else class="cover-placeholder">封面预览</div>
            </div>
            <div class="form-help-text">支持图片链接，建议尺寸：400x300</div>
          </a-form-item>

          <!-- 优先级（置灰） -->
          <a-form-item label="优先级">
            <a-input
              :value="formState.priority"
              disabled
              class="disabled-input"
              style="width: 160px"
            />
            <div class="form-help-text">设置为 99 表示精选应用</div>
          </a-form-item>

          <!-- 初始提示词（置灰） -->
          <a-form-item label="初始提示词">
            <a-textarea
              :value="formState.initPrompt"
              disabled
              class="disabled-input"
              :auto-size="{ minRows: 4, maxRows: 8 }"
              :maxlength="1000"
              show-count
            />
            <div class="form-help-text">初始提示词不可修改</div>
          </a-form-item>

          <!-- 生成类型（置灰） -->
          <a-form-item label="生成类型">
            <a-input
              :value="formState.codeGenType"
              disabled
              class="disabled-input"
            />
            <div class="form-help-text">生成类型不可修改</div>
          </a-form-item>

          <!-- 部署密钥（置灰） -->
          <a-form-item label="部署密钥">
            <a-input
              :value="formState.deployKey"
              disabled
              class="disabled-input"
            />
            <div class="form-help-text">部署密钥不可修改</div>
          </a-form-item>

          <!-- 操作按钮 -->
          <div class="action-row">
            <a-button
              type="primary"
              html-type="submit"
              :loading="submitting"
            >
              保存修改
            </a-button>
            <a-button @click="handleReset">重置</a-button>
            <a-button type="link" @click="goToChat">进入对话</a-button>
          </div>
        </a-form>
      </div>

      <!-- ========== 应用信息 ========== -->
      <div class="info-card">
        <div class="card-title">应用信息</div>

        <div class="meta-table">
          <!-- Row 1: 应用ID | 创建者 -->
          <div class="meta-row">
            <div class="meta-label">应用ID</div>
            <div class="meta-value">{{ appInfo?.id || '-' }}</div>
            <div class="meta-label">创建者</div>
            <div class="meta-value creator-cell">
              <template v-if="appInfo?.user">
                <a-avatar :size="24" :src="appInfo.user.userAvatar">
                  {{ (appInfo.user.userName || '匿')[0] }}
                </a-avatar>
                <span class="creator-name">
                  {{ appInfo.user.userName || '匿名用户' }}
                </span>
              </template>
              <span v-else>-</span>
            </div>
          </div>

          <!-- Row 2: 创建时间 | 更新时间 -->
          <div class="meta-row">
            <div class="meta-label">创建时间</div>
            <div class="meta-value">{{ formatTime(appInfo?.createTime) }}</div>
            <div class="meta-label">更新时间</div>
            <div class="meta-value">{{ formatTime(appInfo?.updateTime) }}</div>
          </div>

          <!-- Row 3: 部署时间 | 访问链接 -->
          <div class="meta-row">
            <div class="meta-label">部署时间</div>
            <div class="meta-value">
              {{ appInfo?.deployedTime ? formatTime(appInfo.deployedTime) : '尚未部署' }}
            </div>
            <div class="meta-label">访问链接</div>
            <div class="meta-value">
              <a
                v-if="deployUrl"
                :href="deployUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="link-cell"
              >
                查看预览
              </a>
              <span v-else>尚未部署</span>
            </div>
          </div>
        </div>
      </div>
    </a-spin>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { ArrowLeftOutlined } from '@ant-design/icons-vue'
import type { FormInstance, Rule } from 'ant-design-vue/es/form'
import { useLoginUserStore } from '@/stores/loginUser'
import { getAppVoById, updateApp, adminUpdateApp } from '@/api/appController'
import dayjs from 'dayjs'

const BASE_URL = `${window.location.origin}/dist`

const route = useRoute()
const router = useRouter()
const loginUserStore = useLoginUserStore()

const appId = route.params.id as string
const pageLoading = ref(true)
const submitting = ref(false)
const formRef = ref<FormInstance>()

const appInfo = ref<API.AppVO>()

const isAdmin = computed(() => loginUserStore.loginUser.userRole === 'admin')

interface FormState {
  appName: string
  cover: string
  priority: number
  initPrompt: string
  codeGenType: string
  deployKey: string
}

const formState = reactive<FormState>({
  appName: '',
  cover: '',
  priority: 0,
  initPrompt: '',
  codeGenType: '',
  deployKey: '',
})

// 用于"重置"按钮：保存初始加载的值
const originalFormState = ref<FormState>({
  appName: '',
  cover: '',
  priority: 0,
  initPrompt: '',
  codeGenType: '',
  deployKey: '',
})

const formRules: Record<string, Rule[]> = {
  appName: [
    { required: true, message: '请输入应用名称', trigger: 'blur' },
    { max: 50, message: '应用名称最多 50 个字符', trigger: 'blur' },
    {
      validator: (_rule, value) => {
        if (typeof value === 'string' && value.trim().length === 0) {
          return Promise.reject('应用名称不能为空')
        }
        return Promise.resolve()
      },
      trigger: 'blur',
    },
  ],
}

// 部署的访问链接：根据 deployKey 构造，未部署时为空
const deployUrl = computed(() => {
  if (!appInfo.value?.deployedTime || !appInfo.value?.deployKey) return ''
  return `${BASE_URL}/${appInfo.value.deployKey}/`
})

const formatTime = (time?: string): string => {
  if (!time) return '-'
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

const handleImgError = (e: Event) => {
  const target = e.target as HTMLImageElement
  target.style.display = 'none'
}

const goBack = () => {
  // 管理员通常从「应用管理」页通过 window.open(..., '_blank') 打开编辑页，
  // 新标签页没有 SPA 浏览历史，router.back() 不会生效。
  // 这里根据是否存在 SPA 历史 + 用户角色，选择合适的返回目标。
  const hasSpaHistory = window.history.state?.back != null
  if (hasSpaHistory) {
    router.back()
  } else if (isAdmin.value) {
    router.push('/admin/appManage')
  } else {
    router.push('/')
  }
}

const goToChat = () => {
  router.push(`/app/chat/${appId}`)
}

const fillFormFromApp = (app: API.AppVO) => {
  const next: FormState = {
    appName: app.appName || '',
    cover: app.cover || '',
    priority: app.priority ?? 0,
    initPrompt: app.initPrompt || '',
    codeGenType: app.codeGenType || '',
    deployKey: app.deployKey || '',
  }
  Object.assign(formState, next)
  originalFormState.value = { ...next }
}

const handleReset = () => {
  Object.assign(formState, originalFormState.value)
  formRef.value?.clearValidate()
}

const handleSubmit = async () => {
  const trimmedName = formState.appName.trim()
  if (!trimmedName) {
    message.warning('应用名称不能为空')
    return
  }
  submitting.value = true
  try {
    let res
    const cover = formState.cover.trim()
    // 管理员：可同时更新名称、封面和优先级
    if (isAdmin.value) {
      res = await adminUpdateApp({
        id: appId,
        appName: trimmedName,
        cover,
      })
    } else {
      res = await updateApp({
        id: appId,
        appName: trimmedName,
        cover,
      })
    }

    if (res.data.code === 0) {
      message.success('保存成功')
      // 刷新最新数据，更新 originalFormState 以便后续"重置"
      await fetchApp()
    } else {
      message.error('保存失败：' + (res.data.message || '未知错误'))
    }
  } catch {
    message.error('保存失败')
  } finally {
    submitting.value = false
  }
}

const fetchApp = async () => {
  try {
    const res = await getAppVoById({ id: appId })
    if (res.data.code === 0 && res.data.data) {
      appInfo.value = res.data.data
      fillFormFromApp(res.data.data)
    } else {
      message.error('获取应用信息失败')
      router.back()
    }
  } catch {
    message.error('获取应用信息失败')
    router.back()
  } finally {
    pageLoading.value = false
  }
}

onMounted(() => {
  fetchApp()
})
</script>

<style scoped>
#appEditPage {
  max-width: 960px;
  margin: 0 auto;
  padding: 8px 4px 32px;
}

/* ========== 顶部返回区 ========== */
.page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.back-btn {
  color: var(--color-text-mid, #7A6555) !important;
  font-size: 14px;
  padding: 4px 8px !important;
}

.back-btn:hover {
  color: var(--color-primary, #FF8C42) !important;
}

.page-title {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 600;
  color: var(--color-text-dark, #4A3728);
  margin: 0;
}

/* ========== 信息卡片 ========== */
.info-card {
  background: #fff;
  border: 1px solid var(--color-border-soft, #F0E4D4);
  border-radius: 14px;
  padding: 24px 28px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(74, 55, 40, 0.04);
}

.card-title {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-dark, #4A3728);
  padding-bottom: 14px;
  margin-bottom: 18px;
  border-bottom: 1px solid var(--color-border-soft, #F0E4D4);
}

/* ========== 表单微调 ========== */
:deep(.ant-form-item) {
  margin-bottom: 20px;
}

:deep(.ant-form-item-label) {
  padding-bottom: 6px !important;
}

:deep(.ant-form-item-label > label) {
  font-size: 14px;
  color: var(--color-text-mid, #7A6555);
  height: auto;
}

/* "应用名称" 标签前的红色星号 */
.required-label :deep(.ant-form-item-label > label::before) {
  display: inline-block;
  margin-right: 4px;
  color: #ff4d4f;
  font-size: 14px;
  font-family: SimSun, sans-serif;
  line-height: 1;
  content: '*';
}

/* 隐藏 Ant Design 默认在 required 字段后追加的星号（避免双星号） */
.required-label :deep(.ant-form-item-required::before) {
  display: none !important;
}

.required-label :deep(.ant-form-item-required::after) {
  display: none !important;
}

/* 置灰输入框样式 */
.disabled-input :deep(.ant-input),
.disabled-input :deep(.ant-input-affix-wrapper),
.disabled-input :deep(textarea.ant-input) {
  background: #f7f7f7 !important;
  color: var(--color-text-light, #A89585) !important;
  cursor: not-allowed;
}

.disabled-input.ant-input,
.disabled-input.ant-input-affix-wrapper {
  background: #f7f7f7 !important;
  color: var(--color-text-light, #A89585) !important;
}

.form-help-text {
  margin-top: 6px;
  font-size: 12px;
  color: var(--color-text-light, #A89585);
}

/* ========== 封面预览 ========== */
.cover-preview-box {
  margin-top: 10px;
  width: 100%;
  min-height: 200px;
  background: #fafafa;
  border: 1px dashed var(--color-border-soft, #F0E4D4);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 10px;
}

.cover-preview-img {
  max-width: 100%;
  max-height: 240px;
  object-fit: contain;
  border-radius: 4px;
}

.cover-placeholder {
  color: var(--color-text-light, #A89585);
  font-size: 14px;
}

/* ========== 操作按钮 ========== */
.action-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 8px;
}

.action-row :deep(.ant-btn-link) {
  padding: 0 8px;
}

/* ========== 应用信息表格 ========== */
.meta-table {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border-soft, #F0E4D4);
  border-radius: 8px;
  overflow: hidden;
}

.meta-row {
  display: grid;
  grid-template-columns: 140px 1fr 140px 1fr;
  border-bottom: 1px solid var(--color-border-soft, #F0E4D4);
}

.meta-row:last-child {
  border-bottom: none;
}

.meta-label,
.meta-value {
  padding: 14px 18px;
  font-size: 14px;
  display: flex;
  align-items: center;
  min-height: 52px;
  word-break: break-all;
}

.meta-label {
  background: #fafafa;
  color: var(--color-text-mid, #7A6555);
  font-weight: 500;
  border-right: 1px solid var(--color-border-soft, #F0E4D4);
}

.meta-value {
  color: var(--color-text-dark, #4A3728);
  background: #fff;
  border-right: 1px solid var(--color-border-soft, #F0E4D4);
}

.meta-row .meta-value:last-child {
  border-right: none;
}

.creator-cell {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.creator-name {
  color: var(--color-text-dark, #4A3728);
}

.link-cell {
  color: #1677ff;
  cursor: pointer;
}

.link-cell:hover {
  color: #4096ff;
  text-decoration: underline;
}

/* ========== 响应式 ========== */
@media (max-width: 720px) {
  .info-card {
    padding: 18px;
  }

  .meta-row {
    grid-template-columns: 100px 1fr;
  }

  .meta-row .meta-label,
  .meta-row .meta-value {
    border-right: none;
  }

  /* 把每一行的 4 列变成两组上下排列 */
  .meta-row > .meta-label:nth-child(3),
  .meta-row > .meta-value:nth-child(4) {
    border-top: 1px solid var(--color-border-soft, #F0E4D4);
  }
}
</style>
