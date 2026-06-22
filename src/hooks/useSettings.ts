import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  fetchSettings,
  updateSettings,
  updateCatalogueSettings,
  fetchCatalogueTemplate,
  upsertCatalogueTemplate,
  uploadCatalogueTemplateFile,
} from '@/services/settings'
import type {
  SettingsFormData,
  CatalogueSettingsFormData,
  CatalogueLayoutConfig,
} from '@/types/database'
import { useAuth } from '@/contexts/AuthContext'
import { useEnterprise } from '@/contexts/EnterpriseContext'
import { isConflictError } from '@/lib/errors'

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  const { data: settings } = useSettings()

  return useMutation({
    mutationFn: (form: SettingsFormData) =>
      updateSettings(form, settings?.version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      toast.success('Settings saved')
    },
    onError: (error: Error) => {
      if (isConflictError(error)) {
        toast.error(error.message)
        queryClient.invalidateQueries({ queryKey: ['settings'] })
        return
      }
      toast.error(error.message)
    },
  })
}

export function useUpdateCatalogueSettings() {
  const queryClient = useQueryClient()
  const { data: settings } = useSettings()

  return useMutation({
    mutationFn: (form: CatalogueSettingsFormData) =>
      updateCatalogueSettings(form, settings?.version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      toast.success('Catalogue settings saved')
    },
    onError: (error: Error) => {
      if (isConflictError(error)) {
        toast.error(error.message)
        queryClient.invalidateQueries({ queryKey: ['settings'] })
        return
      }
      toast.error(error.message)
    },
  })
}

export function useCatalogueTemplate() {
  return useQuery({
    queryKey: ['catalogue-template'],
    queryFn: fetchCatalogueTemplate,
  })
}

export function useUploadCatalogueTemplate() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { enterpriseId } = useEnterprise()

  return useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error('Not authenticated')
      if (!enterpriseId) throw new Error('No enterprise membership found')
      const { fileUrl, fileType } = await uploadCatalogueTemplateFile(
        enterpriseId,
        file
      )
      return upsertCatalogueTemplate(enterpriseId, user.id, {
        file_url: fileUrl,
        file_type: fileType,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalogue-template'] })
      toast.success('Template uploaded')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useUpdateCatalogueLayout() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { enterpriseId } = useEnterprise()

  return useMutation({
    mutationFn: (layout_config: CatalogueLayoutConfig) => {
      if (!user) throw new Error('Not authenticated')
      if (!enterpriseId) throw new Error('No enterprise membership found')
      return upsertCatalogueTemplate(enterpriseId, user.id, { layout_config })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalogue-template'] })
      toast.success('Layout saved')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}
