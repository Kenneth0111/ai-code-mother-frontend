<template>
  <div id="chatHistoryManagePage">
    <!-- Search Form -->
    <a-form layout="inline" :model="searchParams" @finish="doSearch">
      <a-form-item label="应用 ID">
        <a-input
          v-model:value="searchParams.appId"
          placeholder="输入应用 ID"
          style="width: 160px"
          allow-clear
        />
      </a-form-item>
      <a-form-item label="用户 ID">
        <a-input
          v-model:value="searchParams.userId"
          placeholder="输入用户 ID"
          style="width: 160px"
          allow-clear
        />
      </a-form-item>
      <a-form-item label="消息内容">
        <a-input
          v-model:value="searchParams.message"
          placeholder="输入消息关键词"
          allow-clear
        />
      </a-form-item>
      <a-form-item label="消息类型">
        <a-select
          v-model:value="searchParams.messageType"
          placeholder="全部"
          style="width: 120px"
          allow-clear
        >
          <a-select-option value="user">用户消息</a-select-option>
          <a-select-option value="ai">AI 消息</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item>
        <a-button type="primary" html-type="submit">搜索</a-button>
      </a-form-item>
    </a-form>
    <a-divider />
    <!-- Table -->
    <a-table
      :columns="columns"
      :data-source="data"
      :pagination="pagination"
      :loading="loading"
      :scroll="{ x: scrollX }"
      @change="doTableChange"
      row-key="id"
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
        <template v-if="column.dataIndex === 'messageType'">
          <a-tag v-if="record.messageType === 'ai'" color="purple">AI 消息</a-tag>
          <a-tag v-else color="blue">用户消息</a-tag>
        </template>
        <template v-else-if="column.dataIndex === 'message'">
          <a-tooltip :title="record.message" placement="topLeft">
            <span class="message-cell">{{ record.message }}</span>
          </a-tooltip>
        </template>
        <template v-else-if="column.dataIndex === 'createTime'">
          {{ dayjs(record.createTime).format('YYYY-MM-DD HH:mm:ss') }}
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button type="link" @click="goToApp(record.appId)">查看应用</a-button>
          </a-space>
        </template>
      </template>
    </a-table>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { listAllChatHistoryByPageForAdmin } from '@/api/chatHistoryController'
import dayjs from 'dayjs'

const router = useRouter()

const columns = ref<any[]>([
  { title: 'ID', dataIndex: 'id', width: 160, resizable: true },
  { title: '消息内容', dataIndex: 'message', width: 360, ellipsis: true, resizable: true },
  { title: '消息类型', dataIndex: 'messageType', width: 110, resizable: true },
  { title: '应用 ID', dataIndex: 'appId', width: 160, resizable: true },
  { title: '用户 ID', dataIndex: 'userId', width: 160, resizable: true },
  { title: '创建时间', dataIndex: 'createTime', width: 180, resizable: true },
  { title: '操作', key: 'action', width: 120 },
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

const data = ref<API.ChatHistory[]>([])
const total = ref(0)
const loading = ref(false)

const searchParams = reactive<API.ChatHistoryQueryRequest>({
  pageNum: 1,
  pageSize: 10,
})

const fetchData = async () => {
  loading.value = true
  try {
    const res = await listAllChatHistoryByPageForAdmin({ ...searchParams })
    if (res.data.code === 0 && res.data.data) {
      data.value = res.data.data.records ?? []
      total.value = Number(res.data.data.totalRow ?? 0)
    } else {
      message.error('获取数据失败：' + res.data.message)
    }
  } catch {
    message.error('获取数据失败')
  } finally {
    loading.value = false
  }
}

const pagination = computed(() => ({
  current: searchParams.pageNum ?? 1,
  pageSize: searchParams.pageSize ?? 10,
  total: total.value,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条`,
}))

const doTableChange = (page: any) => {
  searchParams.pageNum = page.current
  searchParams.pageSize = page.pageSize
  fetchData()
}

const doSearch = () => {
  searchParams.pageNum = 1
  fetchData()
}

const goToApp = (appId?: string) => {
  if (appId == null) return
  window.open(`/app/chat/${appId}`, '_blank')
}

onMounted(() => {
  fetchData()
})
</script>

<style scoped>
#chatHistoryManagePage {
  max-width: 1200px;
}

.message-cell {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}
</style>
