"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../api";

export interface HostedZone {
  id: number;
  name: string;
  comment: string | null;
  created_at: string;
  record_count: number;
}

export interface PaginatedHostedZones {
  items: HostedZone[];
  total: number;
  page: number;
  page_size: number;
}

export interface UseHostedZonesParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface UseHostedZonesReturn {
  data: PaginatedHostedZones | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useHostedZones({
  search = "",
  page = 1,
  pageSize = 10,
}: UseHostedZonesParams = {}): UseHostedZonesReturn {
  const [data, setData] = useState<PaginatedHostedZones | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchZones = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (search.trim()) {
        queryParams.set("search", search.trim());
      }
      queryParams.set("page", String(page));
      queryParams.set("page_size", String(pageSize));

      const path = `/api/hosted-zones?${queryParams.toString()}`;
      const res = await apiFetch<PaginatedHostedZones>(path);
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load hosted zones");
    } finally {
      setLoading(false);
    }
  }, [search, page, pageSize]);

  useEffect(() => {
    void fetchZones();
  }, [fetchZones]);

  return {
    data,
    loading,
    error,
    refetch: fetchZones,
  };
}
