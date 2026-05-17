<template>
  <div id="appEditPage">
    <h2 class="title">编辑应用信息</h2>
    <a-spin :spinning="pageLoading">
      <a-form
        :model="formState"
        :label-col="{ span: 4 }"
        :wrapper-col="{ span: 18 }"
        @finish="handleSubmit"
      >
        <a-form-item label="应用 ID">
          <span>{{ formState.id }}</span>
        </a-form-item>

        <a-form-item
          label="应用名称"
          name="appName"
          :rules="[{ required: true, message: '请输入应用名称' }]"
        >
          <a-input v-model:value="formState.appName" placeholder="请输入应用名称" />
        </a-form-item>

        <!-- Admin-only fields -->
        <template v-if="isAdmin">
          <a-form-item label="封面地址" name="cover">
            <a-input v-model:value="formState.cover" placeholder="请输入封面图片地址" />
          </a-form-item>

          <a-form-item label="封面预览" v-if="formState.cover">
            <a-image :src="formState.cover" :width="200" />
          </a-form-item>

          <a-form-item label="优先级" name="priority">
            <a-input-number
              v-model:value="formState.priority"
              :min="0"
              :max="999"
              placeholder="优先级数值"
            />
            <span style="margin-left: 8px; color: #999">设为 99 即为精选应用</span>
          </a-form-item>
        </template>

        <a-form-item :wrapper-col="{ offset: 4, span: 18 }">
          <a-space>
            <a-button type="primary" html-type="submit" :loading="submitting">保存</a-button>
            <a-button @click="router.back()">返回</a-button>
          </a-space>
        </a-form-item>
      </a-form>
    </a-spin>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { useLoginUserStore } from '@/stores/loginUser'
import { getAppVoById, updateApp, adminUpdateApp } from '@/api/appController'

const route = useRoute()
const router = useRouter()
const loginUserStore = useLoginUserStore()

const appId = route.params.id as string
const pageLoading = ref(true)
const submitting = ref(false)

const isAdmin = computed(() => loginUserStore.loginUser.userRole === 'admin')

const formState = reactive({
  id: appId,
  appName: '',
  cover: '',
  priority: 0,
})

const handleSubmit = async () => {
  submitting.value = true
  try {
    let res
    if (isAdmin.value) {
      res = await adminUpdateApp({
        id: formState.id,
        appName: formState.appName,
        cover: formState.cover,
        priority: formState.priority,
      })
    } else {
      res = await updateApp({
        id: formState.id,
        appName: formState.appName,
      })
    }
    if (res.data.code === 0) {
      message.success('保存成功')
      router.back()
    } else {
      message.error('保存失败：' + (res.data.message || '未知错误'))
    }
  } catch {
    message.error('保存失败')
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  try {
    const res = await getAppVoById({ id: appId })
    if (res.data.code === 0 && res.data.data) {
      const app = res.data.data
      formState.appName = app.appName || ''
      formState.cover = app.cover || ''
      formState.priority = app.priority || 0
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
})
</script>

<style scoped>
#appEditPage {
  max-width: 640px;
  margin: 0 auto;
}

.title {
  font-family: var(--font-display, 'ZCOOL KuaiLe', cursive);
  text-align: center;
  margin-bottom: 32px;
  color: var(--color-text-dark, #4A3728);
}
</style>
