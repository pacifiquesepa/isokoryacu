import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  Eye,
  Search,
} from "lucide-react";
import type { SuperAdminRecordList } from "@/lib/data-access/super-admin-records";
import SuperAdminRecordRowActions from "@/components/super-admin/record-row-actions";
import SuperAdminCsvExportButton from "@/components/super-admin/csv-export-button";
import { SUPER_ADMIN_RECORD_PAGE_SIZES } from "@/lib/data-access/super-admin-records";

type SuperAdminRecordsTableProps = {
  data: SuperAdminRecordList;
  path: string;
  query: string;
  category?: string;
};

const dateFormat = new Intl.DateTimeFormat("en-RW", {
  dateStyle: "medium",
  timeZone: "UTC",
});

function statusClass(status: string) {
  return status.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function formatCurrency(value: number, currency = "RWF") {
  return new Intl.NumberFormat("en-RW", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function getCsvRows(data: SuperAdminRecordList) {
  if (data.kind === "users") {
    return [
      ["User ID", "Name", "Email", "Phone", "Role", "Account access", "Registered"],
      ...data.rows.map((record) => [
        record.id,
        record.name,
        record.summary,
        record.phone ?? "",
        record.status.replace("_", " "),
        record.isAnonymized
          ? "Anonymized"
          : record.isSuspended
            ? "Suspended"
            : "Active",
        dateFormat.format(record.createdAt),
      ]),
    ];
  }
  if (data.kind === "products") {
    return [
      ["Product", "Seller · category", "Price", "Stock", "Status", "Added"],
      ...data.rows.map((record) => [
        record.name,
        record.summary,
        formatCurrency(record.value ?? 0, record.currency),
        String(record.stockQuantity ?? ""),
        record.status,
        dateFormat.format(record.createdAt),
      ]),
    ];
  }
  return [
    ["Order", "Customer", "Items", "Subtotal", "Status", "Placed"],
    ...data.rows.map((record) => [
      record.name,
      record.summary,
      String(record.itemCount ?? 0),
      formatCurrency(record.value ?? 0, record.currency),
      record.status,
      dateFormat.format(record.createdAt),
    ]),
  ];
}

function getRecordHref(kind: SuperAdminRecordList["kind"], id: string, status?: string) {
  if (kind === "users" && status === "seller") {
    return `/super-admin/merchants/${encodeURIComponent(id)}`;
  }
  return `/super-admin/records/${kind}/${encodeURIComponent(id)}`;
}

function RecordColumns({ data }: { data: SuperAdminRecordList }) {
  if (data.kind === "users") {
    return (
      <>
        <th scope="col">User ID</th>
        <th scope="col">Name</th>
        <th scope="col">Email</th>
        <th scope="col">Phone</th>
        <th scope="col">Role</th>
        <th scope="col">Account access</th>
        <th scope="col">Registered</th>
        <th scope="col">Actions</th>
      </>
    );
  }
  if (data.kind === "products") {
    return (
      <>
        <th scope="col">Product</th>
        <th scope="col">Seller · category</th>
        <th scope="col">Price</th>
        <th scope="col">Stock</th>
        <th scope="col">Status</th>
        <th scope="col">Actions</th>
      </>
    );
  }
  return (
    <>
      <th scope="col">Order</th>
      <th scope="col">Customer</th>
      <th scope="col">Items</th>
      <th scope="col">Total</th>
      <th scope="col">Status</th>
      <th scope="col">Placed</th>
      <th scope="col">Actions</th>
    </>
  );
}

function RecordCells({
  data,
  index,
}: {
  data: SuperAdminRecordList;
  index: number;
}) {
  const record = data.rows[index];
  if (data.kind === "users") {
    return (
      <>
        <td><code title={record.id}>#{record.id.slice(-8).toUpperCase()}</code></td>
        <td><strong>{record.name}</strong></td>
        <td>{record.summary}</td>
        <td>{record.phone ?? "—"}</td>
        <td>
          <span className={`super-admin-status is-${statusClass(record.status)}`}>
            {record.status.replace("_", " ")}
          </span>
        </td>
        <td>
          <span
            className={`super-admin-merchant-access-status${record.isSuspended ? " is-suspended" : ""}`}
          >
            {record.isAnonymized
              ? "Anonymized"
              : record.isSuspended
                ? "Suspended"
                : "Active"}
          </span>
        </td>
        <td>{dateFormat.format(record.createdAt)}</td>
        <td>
          <div className="super-admin-table-actions">
            <ViewRecordLink kind={data.kind} id={record.id} status={record.status} />
            <SuperAdminRecordRowActions
              id={record.id}
              isAnonymized={record.isAnonymized}
              isSuspended={record.isSuspended}
              key={`${record.id}:${record.status}:${record.isSuspended ? "suspended" : "active"}`}
              kind={data.kind}
              status={record.status}
            />
          </div>
        </td>
      </>
    );
  }
  if (data.kind === "products") {
    return (
      <>
        <td>
          <div className="super-admin-record-product-cell">
            <Image
              alt=""
              className="super-admin-record-product-image"
              height={44}
              src={record.image ?? "/window.svg"}
              unoptimized
              width={44}
            />
            <strong>{record.name}</strong>
          </div>
        </td>
        <td>{record.summary}</td>
        <td>{formatCurrency(record.value ?? 0, record.currency)}</td>
        <td>{record.stockQuantity}</td>
        <td><span className={`super-admin-status is-${statusClass(record.status)}`}>{record.status}</span></td>
        <td>
          <div className="super-admin-table-actions">
            <ViewRecordLink kind={data.kind} id={record.id} />
            <SuperAdminRecordRowActions
              id={record.id}
              kind={data.kind}
              status={record.status}
            />
          </div>
        </td>
      </>
    );
  }
  return (
    <>
      <td><strong>{record.name}</strong></td>
      <td>{record.summary}</td>
      <td>{record.itemCount}</td>
      <td>{formatCurrency(record.value ?? 0, record.currency)}</td>
      <td><span className={`super-admin-status is-${statusClass(record.status)}`}>{record.status}</span></td>
      <td>{dateFormat.format(record.createdAt)}</td>
      <td>
        <div className="super-admin-table-actions">
          <ViewRecordLink kind={data.kind} id={record.id} />
          <SuperAdminRecordRowActions
            id={record.id}
            kind={data.kind}
            status={record.status}
          />
        </div>
      </td>
    </>
  );
}

function ViewRecordLink({
  kind,
  id,
  status,
}: {
  kind: SuperAdminRecordList["kind"];
  id: string;
  status?: string;
}) {
  return (
    <Link
      aria-label={`View ${kind.slice(0, -1)} details`}
      className="super-admin-view-action"
      href={getRecordHref(kind, id, status)}
    >
      <Eye aria-hidden="true" size={16} />
      View
    </Link>
  );
}

export default function SuperAdminRecordsTable({
  data,
  path,
  query,
  category,
}: SuperAdminRecordsTableProps) {
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (category) params.set("category", category);
    params.set("pageSize", String(data.pageSize));
    params.set("page", String(page));
    return `${path}?${params.toString()}`;
  };

  return (
    <div className="super-admin-records-page">
      <div className="super-admin-records-heading">
        <div>
          <div className="super-admin-breadcrumb">Workspace / {data.title}</div>
          <h1>{data.title}</h1>
          <p>Browse and view marketplace records.</p>
        </div>
        <Link className="super-admin-back-action" href="/super-admin/dashboard">
          <ArrowLeft size={16} />
          Dashboard
        </Link>
      </div>

      <section aria-label={`${data.title} summary`} className="super-admin-records-summary">
        {data.summary.map((card) => (
          <Link className="super-admin-summary-card" href={card.href} key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value.toLocaleString("en-RW")}</strong>
          </Link>
        ))}
      </section>

      <section className="super-admin-panel super-admin-records-panel">
        <div className="super-admin-records-toolbar">
          <div>
            <h2>{data.title}</h2>
            <p>{data.total.toLocaleString("en-RW")} records</p>
          </div>
          <form action={path} className="super-admin-record-search" role="search">
            <Search aria-hidden="true" size={17} />
            <input
              aria-label={`Search ${data.title.toLowerCase()}`}
              defaultValue={query}
              maxLength={100}
              name="q"
              placeholder="Search records"
              type="search"
            />
            {data.kind === "products" && (
              <select
                aria-label="Filter products by category"
                defaultValue={category ?? ""}
                name="category"
              >
                <option value="">All categories</option>
                {data.categories?.map((option) => (
                  <option key={option.slug} value={option.slug}>
                    {option.name}
                  </option>
                ))}
              </select>
            )}
            <button type="submit">Search</button>
          </form>
          <SuperAdminCsvExportButton
            fileName={`${data.title}-page-${data.page}`}
            label="Export page CSV"
            rows={getCsvRows(data)}
          />
        </div>

        {data.rows.length ? (
          <div className="super-admin-records-table-wrap">
            <table className="super-admin-records-table">
              <thead>
                <tr><RecordColumns data={data} /></tr>
              </thead>
              <tbody>
                {data.rows.map((record, index) => (
                  <tr key={record.id}><RecordCells data={data} index={index} /></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="super-admin-records-empty">
            <ArrowLeftRight aria-hidden="true" size={24} />
            <strong>No matching records</strong>
            <span>Try changing or clearing the search.</span>
          </div>
        )}

        {data.total > 0 && (
          <nav aria-label="Pagination" className="super-admin-pagination">
            <span>
              Showing {(data.page - 1) * data.pageSize + 1}–
              {Math.min(data.page * data.pageSize, data.total)} of {data.total}
              <strong>Page {data.page} of {totalPages}</strong>
            </span>
            <form action={path} className="super-admin-page-size" method="get">
              {query && <input name="q" type="hidden" value={query} />}
              {category && (
                <input name="category" type="hidden" value={category} />
              )}
              <label>
                Rows per page
                <select
                  aria-label="Rows per page"
                  defaultValue={String(data.pageSize)}
                  name="pageSize"
                >
                  {SUPER_ADMIN_RECORD_PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit">Apply</button>
            </form>
            {data.total > data.pageSize && (
              <div>
                {data.page > 1 ? (
                  <Link className="super-admin-back-action" href={pageHref(data.page - 1)}>
                    <ArrowLeft size={15} /> Previous
                  </Link>
                ) : (
                  <span className="super-admin-page-disabled">Previous</span>
                )}
                {data.page < totalPages ? (
                  <Link className="super-admin-primary-action" href={pageHref(data.page + 1)}>
                    Next <ArrowRight size={15} />
                  </Link>
                ) : (
                  <span className="super-admin-page-disabled">Next</span>
                )}
              </div>
            )}
          </nav>
        )}
      </section>
    </div>
  );
}
