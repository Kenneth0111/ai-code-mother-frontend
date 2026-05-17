<template>
  <div id="userEditPage">
    <div class="edit-card">
      <div class="card-header">
        <h2 class="title">用户信息</h2>
        <div class="desc">在这里修改你的个人信息</div>
      </div>

      <a-spin :spinning="loading">
        <a-form
          ref="formRef"
          :model="formState"
          :label-col="{ span: 4 }"
          :wrapper-col="{ span: 19 }"
          label-align="left"
          autocomplete="off"
          @finish="handleSubmit"
        >
          <!-- 用户ID（不可改） -->
          <a-form-item label="用户ID">
            <a-input :value="formState.id" disabled />
          </a-form-item>

          <!-- 账号（不可改） -->
          <a-form-item label="账号">
            <a-input :value="formState.userAccount" disabled />
          </a-form-item>

          <!-- 用户名 -->
          <a-form-item
            label="用户名"
            name="userName"
            :rules="[
              { required: true, message: '用户名不能为空' },
              { max: 10, message: '用户名最多10个字' },
            ]"
          >
            <a-input
              v-model:value="formState.userName"
              placeholder="请输入用户名（最多10个字）"
              :maxlength="10"
              show-count
            />
          </a-form-item>

          <!-- 用户密码 -->
          <a-form-item
            label="用户密码"
            name="userPassword"
            :rules="[
              { required: true, message: '密码不能为空' },
              { min: 8, message: '密码长度不能小于8位' },
            ]"
          >
            <a-input-password
              v-model:value="formState.userPassword"
              placeholder="请输入新密码（至少8位）"
              autocomplete="new-password"
            />
          </a-form-item>

          <!-- 用户头像 -->
          <a-form-item label="用户头像" name="userAvatar">
            <a-input
              v-model:value="formState.userAvatar"
              placeholder="请输入头像图片URL"
              allow-clear
            />
            <div class="avatar-preview">
              <a-avatar
                :src="formState.userAvatar || undefined"
                :size="72"
                shape="circle"
              >
                {{ (formState.userName || '?')[0] }}
              </a-avatar>
              <span class="avatar-tip">头像预览</span>
            </div>
          </a-form-item>

          <!-- 用户简介 -->
          <a-form-item
            label="用户简介"
            name="userProfile"
            :rules="[
              { required: true, message: '简介不能为空' },
              { max: 20, message: '简介最多20个字' },
            ]"
          >
            <a-textarea
              v-model:value="formState.userProfile"
              placeholder="一句话介绍自己（最多20个字）"
              :maxlength="20"
              show-count
              :auto-size="{ minRows: 2, maxRows: 3 }"
            />
          </a-form-item>

          <!-- 用户角色（不可改） -->
          <a-form-item label="用户角色">
            <a-input :value="userRoleLabel" disabled />
          </a-form-item>

          <!-- 创建时间（不可改） -->
          <a-form-item label="创建时间">
            <a-input :value="formatTime(formState.createTime)" disabled />
          </a-form-item>

          <!-- 修改时间（不可改） -->
          <a-form-item label="修改时间">
            <a-input :value="formatTime(formState.editTime)" disabled />
          </a-form-item>

          <!-- 操作按钮 -->
          <a-form-item :wrapper-col="{ offset: 4, span: 19 }">
            <div class="form-actions">
              <a-button type="primary" html-type="submit" :loading="submitting">
                保存修改
              </a-button>
              <a-button @click="handleReset">重置</a-button>
              <a-button @click="handleBack">返回</a-button>
            </div>
          </a-form-item>
        </a-form>
      </a-spin>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message, type FormInstance } from 'ant-design-vue'
import dayjs from 'dayjs'
import { getMyUser, updateMyUser } from '@/api/userController.ts'
import { useLoginUserStore } from '@/stores/loginUser.ts'

const router = useRouter()
const loginUserStore = useLoginUserStore()

const formRef = ref<FormInstance>()
const loading = ref(false)
const submitting = ref(false)

interface UserEditForm {
  id?: string
  userAccount?: string
  userName?: string
  userPassword?: string
  userAvatar?: string
  userProfile?: string
  userRole?: string
  createTime?: string
  editTime?: string
}

const formState = reactive<UserEditForm>({
  id: '',
  userAccount: '',
  userName: '',
  userPassword: '',
  userAvatar: '',
  userProfile: '',
  userRole: '',
  createTime: '',
  editTime: '',
})

// 原始数据，用于「重置」恢复
let originalUser: UserEditForm = {}

const userRoleLabel = computed(() => {
  if (formState.userRole === 'admin') return '管理员'
  if (formState.userRole === 'user') return '普通用户'
  return formState.userRole || ''
})

const formatTime = (time?: string) => {
  if (!time) return ''
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

const fillForm = (data: UserEditForm) => {
  formState.id = data.id ?? ''
  formState.userAccount = data.userAccount ?? ''
  formState.userName = data.userName ?? ''
  // 后端不会返回原文密码，密码默认为空，需要用户重新输入
  formState.userPassword = ''
  formState.userAvatar = data.userAvatar ?? ''
  formState.userProfile = data.userProfile ?? ''
  formState.userRole = data.userRole ?? ''
  formState.createTime = data.createTime ?? ''
  formState.editTime = data.editTime ?? ''
}

const fetchMyUser = async () => {
  loading.value = true
  try {
    const res = await getMyUser()
    if (res.data.code === 0 && res.data.data) {
      originalUser = { ...res.data.data }
      fillForm(originalUser)
    } else {
      message.error('获取用户信息失败：' + (res.data.message || '未知错误'))
    }
  } catch (e: any) {
    // 区分 HTTP 错误与业务错误
    const status = e?.response?.status
    if (status === 404) {
      message.error('获取用户信息失败：后端接口不存在（请重启后端服务）')
    } else if (status) {
      message.error(`获取用户信息失败：HTTP ${status}`)
    } else {
      message.error('获取用户信息失败：' + (e?.message || '网络异常'))
    }
  } finally {
    loading.value = false
  }
}

const handleSubmit = async () => {
  submitting.value = true
  try {
    const res = await updateMyUser({
      id: formState.id,
      userName: formState.userName,
      userPassword: formState.userPassword,
      userAvatar: formState.userAvatar,
      userProfile: formState.userProfile,
    })
    if (res.data.code === 0 && res.data.data) {
      message.success('保存成功')
      // 同步登录用户 store（顶部菜单的头像 / 用户名等需要刷新）
      await loginUserStore.fetchLoginUser()
      // 重新拉取一次用户信息，更新 editTime
      await fetchMyUser()
    } else {
      message.error('保存失败：' + (res.data.message || '未知错误'))
    }
  } catch (e: any) {
    const status = e?.response?.status
    if (status === 404) {
      message.error('保存失败：后端接口不存在（请重启后端服务）')
    } else if (status) {
      message.error(`保存失败：HTTP ${status}`)
    } else {
      message.error('保存失败：' + (e?.message || '网络异常'))
    }
  } finally {
    submitting.value = false
  }
}

const handleReset = () => {
  fillForm(originalUser)
  formRef.value?.clearValidate()
}

const handleBack = () => {
  router.push('/')
}

onMounted(() => {
  fetchMyUser()
})
</script>

<style scoped>
#userEditPage {
  max-width: 960px;
  margin: 0 auto;
  padding: 8px 4px 32px;
  box-sizing: border-box;
}

.edit-card {
  width: 720px;
  background: var(--color-card-bg, #fffcf5);
  border-radius: 20px;
  border: 2px dashed var(--color-border-soft, #f0e4d4);
  padding: 32px 40px;
  box-shadow: 0 6px 24px rgba(255, 140, 66, 0.08);
  box-sizing: border-box;
}

/* 让表单输入框充满 wrapper，避免被截断 */
:deep(.ant-form-item .ant-input),
:deep(.ant-form-item .ant-input-affix-wrapper),
:deep(.ant-form-item .ant-input-password),
:deep(.ant-form-item textarea) {
  width: 100% !important;
}

.card-header {
  text-align: center;
  margin-bottom: 24px;
}

.title {
  font-family: var(--font-display);
  font-size: 26px;
  color: var(--color-text-dark, #4a3728);
  margin: 0 0 6px 0;
  position: relative;
  display: inline-block;
  padding-bottom: 6px;
}

.title::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 60%;
  height: 3px;
  background: linear-gradient(
    90deg,
    var(--color-primary, #ff8c42),
    var(--color-accent-yellow, #ffd966)
  );
  border-radius: 2px;
}

.desc {
  font-family: var(--font-body);
  color: var(--color-text-mid, #7a6555);
  font-size: 14px;
  margin-top: 8px;
}

.avatar-preview {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border: 1px dashed var(--color-border-soft, #f0e4d4);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.5);
}

.avatar-tip {
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--color-text-light, #a89585);
}

.form-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

:deep(.ant-input[disabled]),
:deep(.ant-input-affix-wrapper-disabled) {
  background: #faf6ee !important;
  color: var(--color-text-light, #a89585) !important;
  cursor: not-allowed;
}

@media (max-width: 600px) {
  .edit-card {
    padding: 22px 16px;
  }
}
</style>
