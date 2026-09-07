"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../api";

export interface RecordItem {
  id: number;
  hosted_zone_id: number;
  name: string;
  type: string;
  ttl: number;
  values: string[];
  is_default: boolean;
  created_at: string;
}

export interface PaginatedRecords {
  items: RecordItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface UseRecordsParams {
  zoneId: number | string;
  search?: string;
  type?: string;
  page?: number;
  pageSize?: number;
}

export interface UseRecordsReturn {
  data: PaginatedRecords | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useRecords({
  zoneId,
  search = "",
  type = "",
  page = 1,
  pageSize = 10,
}: UseRecordsParams): UseRecordsReturn {
  const [data, setData] = useState<PaginatedRecords | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    if (!zoneId) return;

    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (search.trim()) {
        queryParams.set("search", search.trim());
      }
      if (type.trim() && type !== "ALL") {
        queryParams.set("type", type.trim().toUpperCase());
      }
      queryParams.set("page", String(page));
      queryParams.set("page_size", String(pageSize));

      const path = `/api/hosted-zones/${zoneId}/records?${queryParams.toString()}`;
      const res = await apiFetch<PaginatedRecords>(path);
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load records");
    } finally {
      setLoading(false);
    }
  }, [zoneId, search, type, page, pageSize]);

  useEffect(() => {
    void fetchRecords();
  }, [fetchRecords]);

  return {
    data,
    loading,
    error,
    refetch: fetchRecords,
  };
}
