import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { useApiData } from '../lib/useApiData';
import { DataTable } from '../components/ui/DataTable';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import type { ChapterMember, OrgChapter, OrgDistrict, OrgState } from '../lib/types';

type Level = 'states' | 'districts' | 'chapters';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm';

export default function OrganizationPage() {
  // The three levels drill down: picking a state filters districts, picking a
  // district filters chapters.
  const [level, setLevel] = useState<Level>('states');
  const [selectedState, setSelectedState] = useState<OrgState | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<OrgDistrict | null>(null);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold tracking-tight text-ink">Organisation</h1>

      <nav className="flex flex-wrap items-center gap-1 text-sm text-slate-600">
        <button
          onClick={() => {
            setLevel('states');
            setSelectedState(null);
            setSelectedDistrict(null);
          }}
          className={level === 'states' ? 'font-semibold text-brand-navy' : 'hover:underline'}
        >
          States
        </button>
        {selectedState && (
          <>
            <span className="text-slate-400">/</span>
            <button
              onClick={() => {
                setLevel('districts');
                setSelectedDistrict(null);
              }}
              className={level === 'districts' ? 'font-semibold text-brand-navy' : 'hover:underline'}
            >
              {selectedState.name}
            </button>
          </>
        )}
        {selectedDistrict && (
          <>
            <span className="text-slate-400">/</span>
            <span className="font-semibold text-brand-navy">{selectedDistrict.name}</span>
          </>
        )}
      </nav>

      {level === 'states' && (
        <StatesPanel
          onDrillDown={(state) => {
            setSelectedState(state);
            setLevel('districts');
          }}
        />
      )}
      {level === 'districts' && selectedState && (
        <DistrictsPanel
          state={selectedState}
          onDrillDown={(district) => {
            setSelectedDistrict(district);
            setLevel('chapters');
          }}
        />
      )}
      {level === 'chapters' && selectedDistrict && <ChaptersPanel district={selectedDistrict} />}
    </div>
  );
}

// ── States ──

function StatesPanel({ onDrillDown }: { onDrillDown: (state: OrgState) => void }) {
  const { data: states, loading, error, reload } = useApiData<OrgState[]>('/api/admin/org/states');
  const [editing, setEditing] = useState<OrgState | null | 'new'>(null);
  const [deleting, setDeleting] = useState<OrgState | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    if (!deleting) return;
    setActionError(null);
    setBusy(true);
    try {
      await api.delete(`/api/admin/org/states/${deleting.id}`);
      setDeleting(null);
      reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Failed to delete state.');
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => setEditing('new')}
          className="btn-primary px-4 py-2 text-sm"
        >
          + New State
        </button>
      </div>
      {actionError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{actionError}</div>}
      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{error}</div>}
      {!loading && !error && states && (
        <div className="overflow-hidden card">
          <DataTable
            columns={[
              {
                header: 'State',
                render: (s) => (
                  <button onClick={() => onDrillDown(s)} className="font-medium text-brand-navy hover:underline">
                    {s.name}
                  </button>
                ),
              },
              { header: 'Districts', render: (s) => s.district_count },
              {
                header: 'Actions',
                render: (s) => (
                  <div className="flex gap-2">
                    <button
                      onClick={() => onDrillDown(s)}
                      className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                    >
                      Open
                    </button>
                    <button
                      onClick={() => setEditing(s)}
                      className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => setDeleting(s)}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100 hover:text-rose-700"
                    >
                      Delete
                    </button>
                  </div>
                ),
              },
            ]}
            rows={states}
            keyFor={(s) => s.id}
            emptyMessage="No states yet."
          />
        </div>
      )}

      {editing && (
        <NameFormModal
          title={editing === 'new' ? 'New State' : 'Rename State'}
          initialName={editing === 'new' ? '' : editing.name}
          onClose={() => setEditing(null)}
          onSubmit={async (name) => {
            if (editing === 'new') await api.post('/api/admin/org/states', { name });
            else await api.patch(`/api/admin/org/states/${editing.id}`, { name });
            setEditing(null);
            reload();
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete state"
          message={`Delete "${deleting.name}"? This is blocked while it still has districts.`}
          busy={busy}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

// ── Districts ──

function DistrictsPanel({ state, onDrillDown }: { state: OrgState; onDrillDown: (district: OrgDistrict) => void }) {
  const { data: districts, loading, error, reload } = useApiData<OrgDistrict[]>(
    `/api/admin/org/districts?stateId=${state.id}`,
    [state.id]
  );
  const [editing, setEditing] = useState<OrgDistrict | null | 'new'>(null);
  const [deleting, setDeleting] = useState<OrgDistrict | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    if (!deleting) return;
    setActionError(null);
    setBusy(true);
    try {
      await api.delete(`/api/admin/org/districts/${deleting.id}`);
      setDeleting(null);
      reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Failed to delete district.');
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => setEditing('new')}
          className="btn-primary px-4 py-2 text-sm"
        >
          + New District
        </button>
      </div>
      {actionError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{actionError}</div>}
      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{error}</div>}
      {!loading && !error && districts && (
        <div className="overflow-hidden card">
          <DataTable
            columns={[
              {
                header: 'District',
                render: (d) => (
                  <button onClick={() => onDrillDown(d)} className="font-medium text-brand-navy hover:underline">
                    {d.name}
                  </button>
                ),
              },
              { header: 'Chapters', render: (d) => d.chapter_count },
              {
                header: 'Actions',
                render: (d) => (
                  <div className="flex gap-2">
                    <button
                      onClick={() => onDrillDown(d)}
                      className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                    >
                      Open
                    </button>
                    <button
                      onClick={() => setEditing(d)}
                      className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => setDeleting(d)}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100 hover:text-rose-700"
                    >
                      Delete
                    </button>
                  </div>
                ),
              },
            ]}
            rows={districts}
            keyFor={(d) => d.id}
            emptyMessage="No districts in this state yet."
          />
        </div>
      )}

      {editing && (
        <NameFormModal
          title={editing === 'new' ? `New District in ${state.name}` : 'Rename District'}
          initialName={editing === 'new' ? '' : editing.name}
          onClose={() => setEditing(null)}
          onSubmit={async (name) => {
            if (editing === 'new') await api.post('/api/admin/org/districts', { stateId: state.id, name });
            else await api.patch(`/api/admin/org/districts/${editing.id}`, { name });
            setEditing(null);
            reload();
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete district"
          message={`Delete "${deleting.name}"? This is blocked while it still has chapters.`}
          busy={busy}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

// ── Chapters ──

function ChaptersPanel({ district }: { district: OrgDistrict }) {
  const { data: chapters, loading, error, reload } = useApiData<OrgChapter[]>(
    `/api/admin/org/chapters?districtId=${district.id}`,
    [district.id]
  );
  const [editing, setEditing] = useState<OrgChapter | null | 'new'>(null);
  const [deleting, setDeleting] = useState<OrgChapter | null>(null);
  const [viewingMembers, setViewingMembers] = useState<OrgChapter | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    if (!deleting) return;
    setActionError(null);
    setBusy(true);
    try {
      await api.delete(`/api/admin/org/chapters/${deleting.id}`);
      setDeleting(null);
      reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Failed to delete chapter.');
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => setEditing('new')}
          className="btn-primary px-4 py-2 text-sm"
        >
          + New Chapter
        </button>
      </div>
      {actionError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{actionError}</div>}
      {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{error}</div>}
      {!loading && !error && chapters && (
        <div className="overflow-hidden card">
          <DataTable
            columns={[
              { header: 'Chapter', render: (c) => <span className="font-medium">{c.name}</span> },
              { header: 'Members', render: (c) => c.member_count },
              { header: 'Referrals', render: (c) => c.referral_count },
              {
                header: 'Actions',
                render: (c) => (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setViewingMembers(c)}
                      className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                    >
                      Members
                    </button>
                    <button
                      onClick={() => setEditing(c)}
                      className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => setDeleting(c)}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100 hover:text-rose-700"
                    >
                      Delete
                    </button>
                  </div>
                ),
              },
            ]}
            rows={chapters}
            keyFor={(c) => c.id}
            emptyMessage="No chapters in this district yet."
          />
        </div>
      )}

      {editing && (
        <NameFormModal
          title={editing === 'new' ? `New Chapter in ${district.name}` : 'Rename Chapter'}
          initialName={editing === 'new' ? '' : editing.name}
          onClose={() => setEditing(null)}
          onSubmit={async (name) => {
            if (editing === 'new') await api.post('/api/admin/org/chapters', { districtId: district.id, name });
            else await api.patch(`/api/admin/org/chapters/${editing.id}`, { name });
            setEditing(null);
            reload();
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete chapter"
          message={`Delete "${deleting.name}"? This is blocked while it still has members.`}
          busy={busy}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}

      {viewingMembers && (
        <ChapterMembersModal
          chapter={viewingMembers}
          onClose={() => setViewingMembers(null)}
          onChanged={reload}
        />
      )}
    </div>
  );
}

function ChapterMembersModal({
  chapter,
  onClose,
  onChanged,
}: {
  chapter: OrgChapter;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { data: members, loading, error, reload } = useApiData<ChapterMember[]>(
    `/api/admin/org/chapters/${chapter.id}/members`,
    [chapter.id]
  );
  const [removing, setRemoving] = useState<ChapterMember | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmRemove() {
    if (!removing) return;
    setActionError(null);
    setBusy(true);
    try {
      await api.delete(`/api/admin/org/chapters/${chapter.id}/members/${removing.user_id}`);
      setRemoving(null);
      reload();
      onChanged();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Failed to remove member.');
      setRemoving(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Modal title={`${chapter.name} — Members`} onClose={onClose} wide>
        {actionError && <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{actionError}</div>}
        {loading && <div className="p-8 text-center text-sm font-medium text-slate-400">Loading…</div>}
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">{error}</div>}
        {!loading && !error && members && (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <DataTable
              columns={[
                {
                  header: 'Member',
                  render: (m) => (
                    <div>
                      <div className="font-medium">{m.full_name || '—'}</div>
                      <div className="text-xs text-slate-500">{m.email}</div>
                    </div>
                  ),
                },
                { header: 'Business', render: (m) => m.business_name ?? '—' },
                { header: 'City', render: (m) => m.city ?? '—' },
                { header: 'Joined', render: (m) => new Date(m.joined_at).toLocaleDateString() },
                {
                  header: '',
                  render: (m) => (
                    <button
                      onClick={() => setRemoving(m)}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100 hover:text-rose-700"
                    >
                      Remove
                    </button>
                  ),
                },
              ]}
              rows={members}
              keyFor={(m) => m.user_id}
              emptyMessage="No members in this chapter yet."
            />
          </div>
        )}
      </Modal>

      {removing && (
        <ConfirmDialog
          title="Remove member"
          message={`Remove ${removing.full_name || removing.email} from ${chapter.name}? Their referral history stays intact.`}
          confirmLabel="Remove"
          busy={busy}
          onConfirm={confirmRemove}
          onCancel={() => setRemoving(null)}
        />
      )}
    </>
  );
}

/** Shared single-field create/rename form used at all three levels. */
function NameFormModal({
  title,
  initialName,
  onClose,
  onSubmit,
}: {
  title: string;
  initialName: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Enter a name.');
    setSubmitting(true);
    try {
      await onSubmit(name.trim());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary px-4 py-2 text-sm"
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
