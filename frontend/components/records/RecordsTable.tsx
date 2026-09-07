"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Table from "@cloudscape-design/components/table";
import Header from "@cloudscape-design/components/header";
import TextFilter from "@cloudscape-design/components/text-filter";
import Select from "@cloudscape-design/components/select";
import Pagination from "@cloudscape-design/components/pagination";
import CollectionPreferences from "@cloudscape-design/components/collection-preferences";
import Button from "@cloudscape-design/components/button";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Badge from "@cloudscape-design/components/badge";
import Box from "@cloudscape-design/components/box";
import Popover from "@cloudscape-design/components/popover";
import { useRecords, RecordItem } from "@/lib/hooks/use-records";
import { CreateEditRecordModal } from "./CreateEditRecordModal";
import { DeleteRecordModal } from "./DeleteRecordModal";
import { BulkDeleteRecordsModal } from "./BulkDeleteRecordsModal";

export interface RecordsTableProps {
  zoneId: number;
  zoneName: string;
}

const TYPE_OPTIONS = [
  { value: "ALL", label: "All types" },
  { value: "A", label: "A" },
  { value: "AAAA", label: "AAAA" },
  { value: "CNAME", label: "CNAME" },
  { value: "MX", label: "MX" },
  { value: "NS", label: "NS" },
  { value: "PTR", label: "PTR" },
  { value: "SRV", label: "SRV" },
  { value: "TXT", label: "TXT" },
  { value: "CAA", label: "CAA" },
];

function getBadgeColor(type: string) {
  switch (type) {
    case "A":
    case "AAAA":
      return "blue";
    case "CNAME":
      return "green";
    case "MX":
      return "grey";
    case "NS":
      return "red";
    case "TXT":
      return "severity-low";
    default:
      return "blue";
  }
}

export function RecordsTable({ zoneId, zoneName }: RecordsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlSearch = searchParams.get("search") || "";
  const urlType = searchParams.get("type")?.toUpperCase() || "ALL";

  const [searchInputValue, setSearchInputValue] = useState(urlSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(urlSearch);

  const matchedTypeOption =
    TYPE_OPTIONS.find((t) => t.value === urlType) || TYPE_OPTIONS[0];
  const [selectedTypeOption, setSelectedTypeOption] = useState(matchedTypeOption);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedItems, setSelectedItems] = useState<RecordItem[]>([]);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState<RecordItem | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<RecordItem | null>(null);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchInputValue.trim();
      setDebouncedSearch(trimmed);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInputValue]);

  // Sync debounced search and selected type to URL
  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams.toString());
    let changed = false;

    const currentUrlSearch = searchParams.get("search") || "";
    if (debouncedSearch !== currentUrlSearch) {
      if (debouncedSearch) {
        nextParams.set("search", debouncedSearch);
      } else {
        nextParams.delete("search");
      }
      changed = true;
    }

    const currentUrlType = (searchParams.get("type") || "ALL").toUpperCase();
    const typeVal = selectedTypeOption.value || "ALL";
    if (typeVal !== currentUrlType) {
      if (typeVal !== "ALL") {
        nextParams.set("type", typeVal);
      } else {
        nextParams.delete("type");
      }
      changed = true;
    }

    if (changed) {
      const qs = nextParams.toString();
      router.replace(qs ? `?${qs}` : window.location.pathname);
      setPage(1);
    }
  }, [debouncedSearch, selectedTypeOption, searchParams, router]);

  // Handle external URL changes
  useEffect(() => {
    if (urlSearch !== searchInputValue) {
      setSearchInputValue(urlSearch);
      setDebouncedSearch(urlSearch);
    }
    if (urlType !== selectedTypeOption.value) {
      const match = TYPE_OPTIONS.find((t) => t.value === urlType) || TYPE_OPTIONS[0];
      setSelectedTypeOption(match);
    }
  }, [urlSearch, urlType]);

  const { data, loading, refetch } = useRecords({
    zoneId,
    search: debouncedSearch,
    type: selectedTypeOption.value,
    page,
    pageSize,
  });

  const totalPages = Math.ceil((data?.total ?? 0) / pageSize) || 1;

  const handleSuccess = async () => {
    setSelectedItems([]);
    await refetch();
  };

  return (
    <>
      <Table
        selectionType="multi"
        selectedItems={selectedItems}
        onSelectionChange={({ detail }) =>
          setSelectedItems(detail.selectedItems as RecordItem[])
        }
        ariaLabels={{
          selectionGroupLabel: "DNS records selection",
          allItemsSelectionLabel: ({ selectedItems: items }) =>
            `${items.length} ${
              items.length === 1 ? "record" : "records"
            } selected`,
          itemSelectionLabel: ({ selectedItems: items }, item) => {
            const isSelected = items.some(
              (i) => i.id === (item as RecordItem).id
            );
            return `${(item as RecordItem).name} is ${
              isSelected ? "" : "not "
            }selected`;
          },
        }}
        columnDefinitions={[
          {
            id: "name",
            header: "Record name",
            cell: (item: RecordItem) => <strong>{item.name}</strong>,
          },
          {
            id: "type",
            header: "Type",
            cell: (item: RecordItem) => (
              <Badge color={getBadgeColor(item.type) as any}>{item.type}</Badge>
            ),
          },
          {
            id: "values",
            header: "Values",
            cell: (item: RecordItem) => {
              const vals = item.values || [];
              if (vals.length === 0) return "-";
              if (vals.length === 1) {
                return (
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: "0.85rem",
                      wordBreak: "break-all",
                    }}
                  >
                    {vals[0]}
                  </span>
                );
              }
              return (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: "0.85rem",
                      maxWidth: "240px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      display: "inline-block",
                    }}
                  >
                    {vals[0]}
                  </span>
                  <Popover
                    dismissButton={false}
                    position="top"
                    size="medium"
                    triggerType="custom"
                    content={
                      <div style={{ maxHeight: "150px", overflowY: "auto" }}>
                        <Box variant="h4" margin={{ bottom: "xs" }}>
                          All {vals.length} values:
                        </Box>
                        <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
                          {vals.map((v, i) => (
                            <li key={i} style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
                              {v}
                            </li>
                          ))}
                        </ul>
                      </div>
                    }
                  >
                    <Badge color="grey">{`+${vals.length - 1} more`}</Badge>
                  </Popover>
                </div>
              );
            },
          },
          {
            id: "ttl",
            header: "TTL (seconds)",
            cell: (item: RecordItem) => item.ttl,
          },
          {
            id: "actions",
            header: "Actions",
            cell: (item: RecordItem) => (
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  variant="inline-icon"
                  iconName="edit"
                  onClick={() => setRecordToEdit(item)}
                  ariaLabel={`Edit record ${item.name}`}
                />
                {item.is_default ? (
                  <span
                    title="Default records cannot be deleted"
                    style={{ display: "inline-block", cursor: "not-allowed" }}
                  >
                    <Button
                      variant="inline-icon"
                      iconName="remove"
                      disabled={true}
                      ariaLabel="Default records cannot be deleted"
                    />
                  </span>
                ) : (
                  <Button
                    variant="inline-icon"
                    iconName="remove"
                    onClick={() => setRecordToDelete(item)}
                    ariaLabel={`Delete record ${item.name}`}
                  />
                )}
              </SpaceBetween>
            ),
          },
        ]}
        items={data?.items ?? []}
        loading={loading}
        loadingText="Loading records"
        trackBy="id"
        header={
          <Header
            variant="h2"
            counter={data ? `(${data.total})` : undefined}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                {selectedItems.filter((r) => !r.is_default).length >= 2 && (
                  <Button onClick={() => setBulkDeleteModalOpen(true)}>
                    {`Delete selected (${
                      selectedItems.filter((r) => !r.is_default).length
                    })`}
                  </Button>
                )}
                <Button
                  variant="primary"
                  onClick={() => setCreateModalOpen(true)}
                >
                  Create record
                </Button>
              </SpaceBetween>
            }
          >
            Records
          </Header>
        }
        filter={
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: "1rem",
              alignItems: "center",
            }}
          >
            <TextFilter
              filteringText={searchInputValue}
              filteringPlaceholder="Find record by name"
              countText={`${data?.total ?? 0} matches`}
              onChange={({ detail }) => setSearchInputValue(detail.filteringText)}
            />
            <div style={{ minWidth: "160px" }}>
              <Select
                selectedOption={selectedTypeOption}
                onChange={({ detail }) => {
                  setSelectedTypeOption(detail.selectedOption as any);
                  setPage(1);
                }}
                options={TYPE_OPTIONS}
              />
            </div>
          </div>
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
                No records
              </Box>
              <Box variant="p" color="text-body-secondary">
                No DNS records match the search criteria.
              </Box>
              <Button onClick={() => setCreateModalOpen(true)}>
                Create record
              </Button>
            </SpaceBetween>
          </Box>
        }
      />

      <CreateEditRecordModal
        visible={createModalOpen || Boolean(recordToEdit)}
        zoneId={zoneId}
        zoneName={zoneName}
        recordToEdit={recordToEdit}
        onDismiss={() => {
          setCreateModalOpen(false);
          setRecordToEdit(null);
        }}
        onSuccess={handleSuccess}
      />

      <DeleteRecordModal
        visible={Boolean(recordToDelete)}
        zoneId={zoneId}
        record={recordToDelete}
        onDismiss={() => setRecordToDelete(null)}
        onSuccess={handleSuccess}
      />

      <BulkDeleteRecordsModal
        visible={bulkDeleteModalOpen}
        zoneId={zoneId}
        records={selectedItems}
        onDismiss={() => setBulkDeleteModalOpen(false)}
        onSuccess={() => {
          setSelectedItems([]);
          handleSuccess();
        }}
      />
    </>
  );
}

export default RecordsTable;
