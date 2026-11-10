import { useQueryClient } from '@tanstack/react-query';

import { getGetSettingsQueryKey, type SettingsResponse, useGetSettings, useSaveSettings } from '@/api/generated/journey';

/** Changing one switch saves straight away and shows the new state at once. */
export function useSettingsEditor() {
  const queryClient = useQueryClient();
  const settings = useGetSettings();
  const save = useSaveSettings({
    mutation: {
      onMutate: ({ data }) => queryClient.setQueryData(getGetSettingsQueryKey(), data),
      onSettled: () => queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() }),
    },
  });
  const change = (patch: Partial<SettingsResponse>) => {
    if (settings.data) save.mutate({ data: { ...settings.data, ...patch } });
  };
  return { settings, save, change };
}
