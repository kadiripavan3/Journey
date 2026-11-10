import { type CategoryResponse, type TemplateResponse, useGetCatalog } from '@/api/generated/journey';

/** The fixed lists the app offers (categories, interests, templates), with look-ups by id. They rarely change, so they are kept for the session. */
export function useCatalog() {
  const catalog = useGetCatalog({ query: { staleTime: Infinity } });
  const categories: CategoryResponse[] = catalog.data?.categories ?? [];
  const templates: TemplateResponse[] = catalog.data?.templates ?? [];
  return {
    query: catalog,
    categories,
    templates,
    interests: catalog.data?.interests ?? [],
    category: (id: string | null | undefined) => categories.find((c) => c.id === id),
    template: (id: string | null | undefined) => templates.find((t) => t.id === id),
  };
}
