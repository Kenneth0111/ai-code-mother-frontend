<template>
  <div id="userManagePage">
    <!-- 搜索表单 -->
    <a-form layout="inline" :model="searchParams" @finish="doSearch">
      <a-form-item label="账号">
        <a-input v-model:value="searchParams.userAccount" placeholder="输入账号" />
      </a-form-item>
      <a-form-item label="用户名">
        <a-input v-model:value="searchParams.userName" placeholder="输入用户名" />
      </a-form-item>
      <a-form-item>
        <a-button type="primary" html-type="submit">搜索</a-button>
      </a-form-item>
    </a-form>
    <a-divider />
    <!-- 表格 -->
    <a-table
      :columns="columns"
      :data-source="data"
      :pagination="pagination"
      :scroll="{ x: scrollX }"
      @change="doTableChange"
    >
      <template #headerCell="{ column }">
        <span>{{ column.title }}</span>
        <span
          v-if="column.resizable"
          class="column-resize-handle"
          @mousedown.stop.prevent="startResize($event, column)"
        />
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'userAvatar'">
          <a-image :src="record.userAvatar" :width="80" />
        </template>
        <template v-else-if="column.dataIndex === 'userRole'">
          <div v-if="record.userRole === 'admin'">
            <a-tag color="green">管理员</a-tag>
          </div>
          <div v-else>
            <a-tag color="blue">普通用户</a-tag>
          </div>
        </template>
        <template v-else-if="column.dataIndex === 'createTime'">
          {{ dayjs(record.createTime).format('YYYY-MM-DD HH:mm:ss') }}
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button type="primary" @click="openEditModal(record)">编辑</a-button>
            <a-button danger @click="doDelete(record.id)">删除</a-button>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- 编辑用户弹窗 -->
    <a-modal
      v-model:open="editModalVisible"
      title="编辑用户"
      :mask-closable="false"
      :footer="null"
      width="560px"
      @cancel="doBack"
    >
      <a-form
        ref="editFormRef"
        :model="editForm"
        :rules="editRules"
        layout="vertical"
        class="edit-user-form"
      >
        <a-form-item label="用户 ID" name="id">
          <a-input v-model:value="editForm.id" disabled />
        </a-form-item>

        <a-form-item label="账号" name="userAccount">
          <a-input v-model:value="editForm.userAccount" disabled />
        </a-form-item>

        <a-form-item label="用户名" name="userName">
          <a-input
            v-model:value="editForm.userName"
            placeholder="请输入用户名"
            :maxlength="10"
            show-count
            allow-clear
          />
        </a-form-item>

        <a-form-item label="用户头像" name="userAvatar">
          <a-input
            v-model:value="editForm.userAvatar"
            placeholder="请输入头像图片 URL"
            allow-clear
          />
          <div class="avatar-preview-wrapper">
            <span class="avatar-preview-label">预览：</span>
            <a-avatar
              v-if="editForm.userAvatar"
              :src="editForm.userAvatar"
              :size="72"
              shape="square"
            />
            <a-avatar v-else :size="72" shape="square">
              <template #icon><UserOutlined /></template>
            </a-avatar>
          </div>
        </a-form-item>

        <a-form-item label="用户简介" name="userProfile">
          <a-textarea
            v-model:value="editForm.userProfile"
            placeholder="请输入用户简介"
            :maxlength="20"
            show-count
            :auto-size="{ minRows: 2, maxRows: 3 }"
            allow-clear
          />
        </a-form-item>

        <a-form-item label="用户角色" name="userRole">
          <div class="role-wrapper">
            <a-tag v-if="editForm.userRole === 'admin'" color="green">管理员</a-tag>
            <a-tag v-else color="blue">普通用户</a-tag>
            <a-button
              v-if="editForm.userRole !== 'admin'"
              type="primary"
              size="small"
              @click="editForm.userRole = 'admin'"
            >
              设为管理员
            </a-button>
            <a-button
              v-else
              size="small"
              @click="editForm.userRole = 'user'"
            >
              取消管理员
            </a-button>
          </div>
        </a-form-item>

        <div class="edit-form-footer">
          <a-space>
            <a-button type="primary" :loading="saving" @click="doSave">保存修改</a-button>
            <a-button @click="doReset">重置</a-button>
            <a-button @click="doBack">返回</a-button>
          </a-space>
        </div>
      </a-form>
    </a-modal>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { deleteUser, listUserVoByPage, updateUser } from '@/api/userController.ts'
import { message, type FormInstance } from 'ant-design-vue'
import { UserOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'

const columns = ref([
  { title: 'id', dataIndex: 'id', width: 180, resizable: true },
  { title: '账号', dataIndex: 'userAccount', width: 150, resizable: true },
  { title: '用户名', dataIndex: 'userName', width: 120, resizable: true },
  { title: '头像', dataIndex: 'userAvatar', width: 100, resizable: true },
  { title: '简介', dataIndex: 'userProfile', width: 200, resizable: true },
  { title: '用户角色', dataIndex: 'userRole', width: 120, resizable: true },
  { title: '创建时间', dataIndex: 'createTime', width: 180, resizable: true },
  { title: '操作', key: 'action', width: 180 },
])

const scrollX = computed(() => {
  return columns.value.reduce((sum, col) => sum + (col.width || 100), 0)
})

const startResize = (e: MouseEvent, slotColumn: any) => {
  const key = slotColumn.dataIndex || slotColumn.key
  const col = columns.value.find((c) => c.dataIndex === key || c.key === key)
  if (!col) return

  const startX = e.clientX
  const startWidth = col.width || 100

  const onMouseMove = (ev: MouseEvent) => {
    col.width = Math.max(startWidth + (ev.clientX - startX), 60)
  }

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

// 数据
const data = ref<API.UserVO[]>([])
const total = ref(0)

// 搜索条件
const searchParams = reactive<API.UserQueryRequest>({
  pageNum: 1,
  pageSize: 10,
})

// 获取数据
const fetchData = async () => {
  const res = await listUserVoByPage({
    ...searchParams,
  })
  if (res.data.data) {
    data.value = res.data.data.records ?? []
    total.value = Number(res.data.data.totalRow ?? 0)
  } else {
    message.error('获取数据失败，' + res.data.message)
  }
}

// 分页参数
const pagination = computed(() => {
  return {
    current: searchParams.pageNum ?? 1,
    pageSize: searchParams.pageSize ?? 10,
    total: total.value,
    showSizeChanger: true,
    showTotal: (total: number) => `共 ${total} 条`,
  }
})

// 表格变化处理
const doTableChange = (page: any) => {
  searchParams.pageNum = page.current
  searchParams.pageSize = page.pageSize
  fetchData()
}

const doSearch = () => {
  searchParams.pageNum = 1
  fetchData()
}

// 删除数据
const doDelete = async (id: string | undefined) => {
  if (id == null) {
    return
  }
  const res = await deleteUser({ id })
  if (res.data.code === 0) {
    message.success('删除成功')
    fetchData()
  } else {
    message.error('删除失败')
  }
}

// =================== 编辑用户 ===================

interface EditUserForm {
  id?: string
  userAccount?: string
  userName?: string
  userAvatar?: string
  userProfile?: string
  userRole?: string
}

const editModalVisible = ref(false)
const saving = ref(false)
const editFormRef = ref<FormInstance>()

// 当前编辑表单
const editForm = reactive<EditUserForm>({
  id: '',
  userAccount: '',
  userName: '',
  userAvatar: '',
  userProfile: '',
  userRole: 'user',
})

// 编辑前原始数据，用于重置
const originalForm = ref<EditUserForm>({})

// 表单校验规则
const editRules = {
  userName: [
    { required: true, message: '用户名不能为空', trigger: 'blur' },
    { max: 10, message: '用户名最多 10 个字', trigger: 'blur' },
  ],
  userProfile: [
    { required: true, message: '用户简介不能为空', trigger: 'blur' },
    { max: 20, message: '用户简介最多 20 个字', trigger: 'blur' },
  ],
}

// 打开编辑弹窗
const openEditModal = (record: API.UserVO) => {
  const snapshot: EditUserForm = {
    id: record.id,
    userAccount: record.userAccount,
    userName: record.userName,
    userAvatar: record.userAvatar,
    userProfile: record.userProfile,
    userRole: record.userRole || 'user',
  }
  Object.assign(editForm, snapshot)
  originalForm.value = { ...snapshot }
  editModalVisible.value = true
}

// 保存修改
const doSave = async () => {
  try {
    await editFormRef.value?.validate()
  } catch {
    return
  }
  if (!editForm.id) {
    message.error('用户 ID 缺失')
    return
  }
  saving.value = true
  try {
    const res = await updateUser({
      id: editForm.id,
      userName: editForm.userName,
      userAvatar: editForm.userAvatar,
      userProfile: editForm.userProfile,
      userRole: editForm.userRole,
    })
    if (res.data.code === 0) {
      message.success('修改成功')
      editModalVisible.value = false
      fetchData()
    } else {
      message.error('修改失败，' + (res.data.message ?? ''))
    }
  } finally {
    saving.value = false
  }
}

// 重置为打开弹窗时的初始值
const doReset = () => {
  Object.assign(editForm, originalForm.value)
  editFormRef.value?.clearValidate()
}

// 返回（关闭弹窗）
const doBack = () => {
  editModalVisible.value = false
}

// 页面加载时请求一次
onMounted(() => {
  fetchData()
})
</script>

<style scoped>
#userManagePage {
  max-width: 1200px;
  width: 100%;
}

.edit-user-form {
  padding-top: 4px;
}

.avatar-preview-wrapper {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar-preview-label {
  color: var(--color-text-mid, #7A6555);
  font-size: 13px;
}

.role-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
}

.edit-form-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}
</style>
