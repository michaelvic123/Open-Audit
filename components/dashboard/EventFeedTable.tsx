"use client";

import { useState } from "react";
import { CheckCircle2, HelpCircle, Clock, Eye, GitBranch } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RawDataDialog } from "./RawDataDialog";
import { ContributeDialog } from "./ContributeDialog";
import { formatRelativeTime, truncateHex } from "@/lib/translator/decode";
import type { TranslatedEvent, RawEvent } from "@/lib/translator/types";

interface EventFeedTableProps {
  events: TranslatedEvent[];
  isLoading?: boolean;
  newEventIds?: Set<string>;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

const PAGE_SIZE_OPTIONS = [25, 50];

function getVisiblePages(currentPage: number, totalPages: number): number[] {
  const start = Math.max(1, currentPage - 1);
  const end = Math.min(totalPages, start + 2);
  const normalizedStart = Math.max(1, end - 2);

  return Array.from({ length: end - normalizedStart + 1 }, function (_, index) {
    return normalizedStart + index;
  });
}

function StatusBadge({ status }: { status: TranslatedEvent["status"] }): React.JSX.Element {
  if (status === "translated") {
    return (
      <Badge variant="success" className="gap-1 whitespace-nowrap">
        <CheckCircle2 className="h-3 w-3" />
        Translated
      </Badge>
    );
  }

  if (status === "pending") {
    return (
      <Badge variant="secondary" className="gap-1 whitespace-nowrap">
        <Clock className="h-3 w-3" />
        Pending
      </Badge>
    );
  }

  return (
    <Badge variant="warning" className="gap-1 whitespace-nowrap">
      <HelpCircle className="h-3 w-3" />
      Cryptic
    </Badge>
  );
}

function SkeletonRow(): React.JSX.Element {
  return (
    <TableRow>
      {[1, 2, 3, 4, 5].map(function (i) {
        return (
          <TableCell key={i}>
            <div className="h-4 bg-muted animate-pulse rounded" />
          </TableCell>
        );
      })}
    </TableRow>
  );
}

export function EventFeedTable({
  events,
  isLoading = false,
  newEventIds = new Set(),
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: EventFeedTableProps): React.JSX.Element {
  const [rawDialogEvent, setRawDialogEvent] = useState<RawEvent | null>(null);
  const [contributeDialogEvent, setContributeDialogEvent] = useState<RawEvent | null>(null);
  const visiblePages = getVisiblePages(currentPage, totalPages);
  const rangeStart = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = totalItems === 0 ? 0 : rangeStart + events.length - 1;

  function handleViewRaw(event: RawEvent): void {
    setRawDialogEvent(event);
  }

  function handleContribute(event: RawEvent): void {
    setContributeDialogEvent(event);
  }

  return (
    <>
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-[130px]">Status</TableHead>
              <TableHead className="w-[100px]">Time</TableHead>
              <TableHead>Translated Description</TableHead>
              <TableHead className="w-[160px] hidden md:table-cell">Contract</TableHead>
              <TableHead className="w-[180px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }).map(function (_, i) {
                  return <SkeletonRow key={i} />;
                })
              : events.map(function (event) {
                  const isTranslated = event.status === "translated";

                  return (
                    <TableRow
                      key={event.raw.id}
                      className={`group transition-colors ${newEventIds.has(event.raw.id) ? "animate-slide-in bg-violet-50/60 dark:bg-violet-950/30" : ""}`}
                    >
                      {/* Status */}
                      <TableCell>
                        <StatusBadge status={event.status} />
                      </TableCell>

                      {/* Time */}
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                        {formatRelativeTime(event.raw.timestamp)}
                      </TableCell>

                      {/* Description */}
                      <TableCell>
                        {isTranslated ? (
                          <div className="space-y-0.5">
                            {event.eventType && (
                              <span className="text-xs font-medium text-violet-600 dark:text-violet-400 uppercase tracking-wide">
                                {event.eventType}
                              </span>
                            )}
                            <p className="text-sm">{event.description}</p>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <p className="text-sm text-muted-foreground italic">
                              No translation available for this event.
                            </p>
                            <p className="font-mono text-xs text-muted-foreground/70">
                              {truncateHex(event.raw.data, 10)}
                            </p>
                          </div>
                        )}
                      </TableCell>

                      {/* Contract ID */}
                      <TableCell className="hidden md:table-cell">
                        <span className="font-mono text-xs text-muted-foreground">
                          {event.raw.contractId.slice(0, 6)}...
                          {event.raw.contractId.slice(-4)}
                        </span>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            onClick={function () {
                              handleViewRaw(event.raw);
                            }}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            View Raw
                          </Button>

                          {!isTranslated && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 text-xs border-violet-200 text-violet-700 hover:bg-violet-50 hover:text-violet-800 dark:border-violet-800 dark:text-violet-400 dark:hover:bg-violet-950"
                              onClick={function () {
                                handleContribute(event.raw);
                              }}
                            >
                              <GitBranch className="h-3.5 w-3.5 mr-1" />
                              Contribute
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}

            {!isLoading && events.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  No events found. Enter a Contract ID above to search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {!isLoading && totalItems > 0 && (
          <div className="flex flex-col gap-3 border-t bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center">
              <span>
                Showing {rangeStart}-{rangeEnd} of {totalItems} events
              </span>
              <label className="flex items-center gap-2">
                <span>Rows</span>
                <select
                  value={pageSize}
                  onChange={function (e) {
                    onPageSizeChange(Number(e.target.value));
                  }}
                  className="h-8 rounded-md border bg-background px-2 text-foreground"
                  aria-label="Records per page"
                >
                  {PAGE_SIZE_OPTIONS.map(function (option) {
                    return (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    );
                  })}
                </select>
              </label>
            </div>

            <div className="flex items-center gap-1 self-end sm:self-auto">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3"
                onClick={function () {
                  onPageChange(currentPage - 1);
                }}
                disabled={currentPage === 1}
              >
                Previous
              </Button>

              {visiblePages.map(function (page) {
                return (
                  <Button
                    key={page}
                    variant={page === currentPage ? "default" : "outline"}
                    size="sm"
                    className="h-8 min-w-8 px-2"
                    onClick={function () {
                      onPageChange(page);
                    }}
                    aria-current={page === currentPage ? "page" : undefined}
                  >
                    {page}
                  </Button>
                );
              })}

              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3"
                onClick={function () {
                  onPageChange(currentPage + 1);
                }}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <RawDataDialog
        event={rawDialogEvent}
        open={rawDialogEvent !== null}
        onOpenChange={function (open) {
          if (!open) setRawDialogEvent(null);
        }}
      />

      <ContributeDialog
        event={contributeDialogEvent}
        open={contributeDialogEvent !== null}
        onOpenChange={function (open) {
          if (!open) setContributeDialogEvent(null);
        }}
      />
    </>
  );
}
