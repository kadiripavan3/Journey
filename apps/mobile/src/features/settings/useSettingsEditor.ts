import { useQueryClient } from '@tanstack/react-query';

import { useCache } from '@/api/cache';
import { getGetSettingsQueryKey, type SettingsResponse, useGetSettings, useSaveSettings } from '@/api/generated/journey';

/** Changing one switch shows the new state at once and saves it. If saving fails, the switch goes back. */
export function useSettingsEditor() {
  const queryClient = useQueryClient();
  const cache = useCache();
  const settings = useGetSettings();
  const save = useSaveSettings({
    mutation: {
      onMutate: ({ data }) => {
        const before = queryClient.getQueryData<SettingsResponse>(getGetSettingsQueryKey());
        queryClient.setQueryData(getGetSettingsQueryKey(), data);
        return { before };
      },
      onSuccess: (saved) => cache.settingsSaved(saved),
      onError: (_error, _sent, context) => {
        if (context?.before) queryClient.setQueryData(getGetSettingsQueryKey(), context.before);
      },
    },
  });
  const change = (patch: Partial<SettingsResponse>) => {
    if (settings.data) save.mutate({ data: { ...settings.data, ...patch } });
  };
  return { settings, save, change };
}
