<template>
  <div id="appManagePage">
    <!-- Search Form -->
    <a-form layout="inline" :model="searchParams" @finish="doSearch">
      <a-form-item label="应用名称">
        <a-input v-model:value="searchParams.appName" placeholder="输入应用名称" allow-clear />
      </a-form-item>
      <a-form-item label="用户 ID">
        <a-input
          v-model:value="searchParams.userId"
          placeholder="输入用户 ID"
          style="width: 150px"
          allow-clear
        />
      </a-form-item>
      <a-form-item label="代码类型">
        <a-input v-model:value="searchParams.codeGenType" placeholder="输入类型" allow-clear />
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
        <template v-if="column.dataIndex === 'cover'">
          <a-image v-if="record.cover" :src="record.cover" :width="80" />
          <span v-else style="color: #ccc">无封面</span>
        </template>
        <template v-else-if="column.dataIndex === 'deployKey'">
          <a
            v-if="record.deployedTime && record.deployKey"
            :href="`${DEPLOY_HOST}/${record.deployKey}/`"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ `${DEPLOY_HOST}/${record.deployKey}/` }}
          </a>
          <span v-else style="color: #ccc">未部署</span>
        </template>
        <template v-else-if="column.dataIndex === 'priority'">
          <a-tag v-if="record.priority >= 99" color="gold">精选</a-tag>
          <span v-else>{{ record.priority ?? 0 }}</span>
        </template>
        <template v-else-if="column.dataIndex === 'createTime'">
          {{ dayjs(record.createTime).format('YYYY-MM-DD HH:mm:ss') }}
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button type="link" @click="goEdit(record.id)">编辑</a-button>
            <a-popconfirm title="确认删除？" @confirm="doDelete(record.id)">
              <a-button type="link" danger>删除</a-button>
            </a-popconfirm>
            <a-button
              v-if="(record.priority ?? 0) < 99"
              type="link"
              @click="doFeatured(record)"
            >
              精选
            </a-button>
            <a-button
              v-else
              type="link"
              @click="doUnfeatured(record)"
            >
              取消精选
            </a-button>
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
import { adminListAppVoByPage, adminDeleteApp, adminUpdateApp } from '@/api/appController'
import dayjs from 'dayjs'

const DEPLOY_HOST = `${window.location.origin}/dist`

const router = useRouter()

const columns = ref([
  { title: 'ID', dataIndex: 'id', width: 120, resizable: true },
  { title: '应用名称', dataIndex: 'appName', width: 200, ellipsis: true, resizable: true },
  { title: '封面', dataIndex: 'cover', width: 100, resizable: true },
  { title: '代码类型', dataIndex: 'codeGenType', width: 100, resizable: true },
  { title: '访问链接', dataIndex: 'deployKey', width: 120, resizable: true },
  { title: '优先级', dataIndex: 'priority', width: 90, resizable: true },
  { title: '用户 ID', dataIndex: 'userId', width: 120, resizable: true },
  { title: '创建时间', dataIndex: 'createTime', width: 180, resizable: true },
  { title: '操作', key: 'action', width: 220 },
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

const data = ref<API.AppVO[]>([])
const total = ref(0)
const loading = ref(false)

const searchParams = reactive<API.AppQueryRequest>({
  pageNum: 1,
  pageSize: 10,
})

const fetchData = async () => {
  loading.value = true
  try {
    const res = await adminListAppVoByPage({ ...searchParams })
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

const goEdit = (id?: string) => {
  if (id) {
    window.open(`/app/edit/${id}`, '_blank')
  }
}

const doDelete = async (id?: string) => {
  if (id == null) return
  try {
    const res = await adminDeleteApp({ id })
    if (res.data.code === 0) {
      message.success('删除成功')
      fetchData()
    } else {
      message.error('删除失败：' + res.data.message)
    }
  } catch {
    message.error('删除失败')
  }
}

const doFeatured = async (record: API.AppVO) => {
  try {
    const res = await adminUpdateApp({
      id: record.id,
      appName: record.appName,
      cover: record.cover,
      priority: 99,
    })
    if (res.data.code === 0) {
      message.success('已设为精选')
      fetchData()
    } else {
      message.error('操作失败：' + res.data.message)
    }
  } catch {
    message.error('操作失败')
  }
}

const doUnfeatured = async (record: API.AppVO) => {
  try {
    const res = await adminUpdateApp({
      id: record.id,
      appName: record.appName,
      cover: record.cover,
      priority: 0,
    })
    if (res.data.code === 0) {
      message.success('已取消精选')
      fetchData()
    } else {
      message.error('操作失败：' + res.data.message)
    }
  } catch {
    message.error('操作失败')
  }
}

onMounted(() => {
  fetchData()
})
</script>

<style scoped>
#appManagePage {
  max-width: 1200px;
}
</style>
