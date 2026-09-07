"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Table from "@cloudscape-design/components/table";
import Header from "@cloudscape-design/components/header";
import TextFilter from "@cloudscape-design/components/text-filter";
import Pagination from "@cloudscape-design/components/pagination";
import CollectionPreferences from "@cloudscape-design/components/collection-preferences";
import Button from "@cloudscape-design/components/button";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Badge from "@cloudscape-design/components/badge";
import Box from "@cloudscape-design/components/box";
import { useHostedZones, HostedZone } from "@/lib/hooks/use-hosted-zones";
import { CreateEditZoneModal } from "./CreateEditZoneModal";
import { DeleteZoneModal } from "./DeleteZoneModal";
import { BulkDeleteZonesModal } from "./BulkDeleteZonesModal";

export function HostedZonesTable() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlSearch = searchParams.get("search") || "";

  const [searchInputValue, setSearchInputValue] = useState(urlSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(urlSearch);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedItems, setSelectedItems] = useState<HostedZone[]>([]);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [zoneToEdit, setZoneToEdit] = useState<HostedZone | null>(null);
  const [zoneToDelete, setZoneToDelete] = useState<HostedZone | null>(null);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchInputValue.trim();
      setDebouncedSearch(trimmed);

      const currentInUrl = searchParams.get("search") || "";
      if (trimmed !== currentInUrl) {
        const nextParams = new URLSearchParams(searchParams.toString());
        if (trimmed) {
          nextParams.set("search", trimmed);
        } else {
          nextParams.delete("search");
        }
        const qs = nextParams.toString();
        router.replace(qs ? `/hosted-zones?${qs}` : "/hosted-zones");
        setPage(1);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInputValue, searchParams, router]);

  // If user navigates history and URL search changes externally
  useEffect(() => {
    if (urlSearch !== searchInputValue) {
      setSearchInputValue(urlSearch);
      setDebouncedSearch(urlSearch);
    }
  }, [urlSearch]);

  const { data, loading, refetch } = useHostedZones({
    search: debouncedSearch,
    page,
    pageSize,
  });

  const totalPages = Math.ceil((data?.total ?? 0) / pageSize) || 1;

  const handleSuccess = async () => {
    await refetch();
    setSelectedItems([]);
  };

  return (
    <>
      <Table
        selectionType="multi"
        selectedItems={selectedItems}
        onSelectionChange={({ detail }) =>
          setSelectedItems(detail.selectedItems as HostedZone[])
        }
        ariaLabels={{
          selectionGroupLabel: "Hosted zones selection",
          allItemsSelectionLabel: ({ selectedItems: items }) =>
            `${items.length} ${
              items.length === 1 ? "zone" : "zones"
            } selected`,
          itemSelectionLabel: ({ selectedItems: items }, item) => {
            const isSelected = items.some((i) => i.id === (item as HostedZone).id);
            return `${(item as HostedZone).name} is ${
              isSelected ? "" : "not "
            }selected`;
          },
        }}
        columnDefinitions={[
          {
            id: "name",
            header: "Domain name",
            cell: (item: HostedZone) => (
              <Link
                href={`/hosted-zones/${item.id}`}
                style={{
                  color: "#0972d3",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                {item.name}
              </Link>
            ),
          },
          {
            id: "type",
            header: "Type",
            cell: () => <Badge color="green">Public</Badge>,
          },
          {
            id: "record_count",
            header: "Records",
            cell: (item: HostedZone) => item.record_count,
          },
          {
            id: "comment",
            header: "Comment",
            cell: (item: HostedZone) => item.comment || "-",
          },
          {
            id: "created_at",
            header: "Created",
            cell: (item: HostedZone) =>
              new Date(item.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              }),
          },
        ]}
        items={data?.items ?? []}
        loading={loading}
        loadingText="Loading hosted zones"
        trackBy="id"
        header={
          <Header
            variant="h2"
            counter={data ? `(${data.total})` : undefined}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  disabled={selectedItems.length !== 1}
                  onClick={() => {
                    if (selectedItems.length === 1) {
                      setZoneToEdit(selectedItems[0]);
                    }
                  }}
                >
                  Edit
                </Button>
                <Button
                  disabled={selectedItems.length !== 1}
                  onClick={() => {
                    if (selectedItems.length === 1) {
                      setZoneToDelete(selectedItems[0]);
                    }
                  }}
                >
                  Delete
                </Button>
                {selectedItems.length >= 2 && (
                  <Button
                    onClick={() => setBulkDeleteModalOpen(true)}
                  >
                    {`Delete selected (${selectedItems.length})`}
                  </Button>
                )}
                <Button
                  variant="primary"
                  onClick={() => setCreateModalOpen(true)}
                >
                  Create hosted zone
                </Button>
              </SpaceBetween>
            }
          >
            Hosted zones
          </Header>
        }
        filter={
          <TextFilter
            filteringText={searchInputValue}
            filteringPlaceholder="Find hosted zone"
            countText={`${data?.total ?? 0} matches`}
            onChange={({ detail }) => setSearchInputValue(detail.filteringText)}
          />
        }
        pagination={
          <Pagination
            currentPageIndex={page}
            pagesCount={totalPages}
            onChange={({ detail }) => setPage(detail.currentPageIndex)}
          />
        }
        preferences={
          <CollectionPreferences
            title="Preferences"
            confirmLabel="Confirm"
            cancelLabel="Cancel"
            preferences={{
              pageSize,
            }}
            pageSizePreference={{
              title: "Page size",
              options: [
                { value: 10, label: "10 resources" },
                { value: 25, label: "25 resources" },
                { value: 50, label: "50 resources" },
              ],
            }}
            onConfirm={({ detail }) => {
              if (detail.pageSize) {
                setPageSize(detail.pageSize);
                setPage(1);
              }
            }}
          />
        }
        empty={
          <Box textAlign="center" color="inherit" padding={{ vertical: "l" }}>
            <SpaceBetween size="m">
              <Box variant="strong" color="inherit">
                No hosted zones
              </Box>
              <Box variant="p" color="text-body-secondary">
                No hosted zones match the search criteria.
              </Box>
              <Button onClick={() => setCreateModalOpen(true)}>
                Create hosted zone
              </Button>
            </SpaceBetween>
          </Box>
        }
      />

      <CreateEditZoneModal
        visible={createModalOpen || Boolean(zoneToEdit)}
        zoneToEdit={zoneToEdit}
        onDismiss={() => {
          setCreateModalOpen(false);
          setZoneToEdit(null);
        }}
        onSuccess={handleSuccess}
      />

      <DeleteZoneModal
        visible={Boolean(zoneToDelete)}
        zone={zoneToDelete}
        onDismiss={() => setZoneToDelete(null)}
        onSuccess={handleSuccess}
      />

      <BulkDeleteZonesModal
        visible={bulkDeleteModalOpen}
        zones={selectedItems}
        onDismiss={() => setBulkDeleteModalOpen(false)}
        onSuccess={() => {
          setSelectedItems([]);
          handleSuccess();
        }}
      />
    </>
  );
}

export default HostedZonesTable;
