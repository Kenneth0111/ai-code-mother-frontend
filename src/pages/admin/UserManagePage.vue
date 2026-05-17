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
          <a-button danger @click="doDelete(record.id)">删除</a-button>
        </template>
      </template>
    </a-table>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { deleteUser, listUserVoByPage } from '@/api/userController.ts'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'

const columns = ref([
  { title: 'id', dataIndex: 'id', width: 180, resizable: true },
  { title: '账号', dataIndex: 'userAccount', width: 150, resizable: true },
  { title: '用户名', dataIndex: 'userName', width: 120, resizable: true },
  { title: '头像', dataIndex: 'userAvatar', width: 100, resizable: true },
  { title: '简介', dataIndex: 'userProfile', width: 200, resizable: true },
  { title: '用户角色', dataIndex: 'userRole', width: 120, resizable: true },
  { title: '创建时间', dataIndex: 'createTime', width: 180, resizable: true },
  { title: '操作', key: 'action', width: 100 },
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
    total.value = res.data.data.totalRow ?? 0
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
</style>
