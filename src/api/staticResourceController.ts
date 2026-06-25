// @ts-ignore
/* eslint-disable */
import request from '@/request'

export type SourceFileVO = {
  path: string
  name: string
  content: string
  lang: string
}

type SourceFilesResponse = {
  code: number
  data?: SourceFileVO[]
  message?: string
}

export async function listStaticSourceFiles(
  params: { deployKey: string },
  options?: { [key: string]: any }
) {
  const { deployKey } = params
  return request<SourceFilesResponse>(`/static/${deployKey}/source-files`, {
    method: 'GET',
    ...(options || {}),
  })
}

/** 此处后端没有提供注释 GET /static/${param0}/&#42;&#42; */
export async function serveStaticResource(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.serveStaticResourceParams,
  options?: { [key: string]: any }
) {
  const { deployKey: param0, ...queryParams } = params
  return request<string>(`/static/${param0}/**`, {
    method: 'GET',
    params: { ...queryParams },
    ...(options || {}),
  })
}
