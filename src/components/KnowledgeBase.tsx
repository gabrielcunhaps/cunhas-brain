'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Note {
  id: number;
  title: string;
  summary: string | null;
  content?: string;
  wikilinks: string[] | null;
  tags: string[] | null;
  ai_metadata?: Record<string, unknown> | null;
  connectedNotes?: { id: number; title: string; keyword: string }[];
  created_at: string;
}

interface GraphData {
  nodes: { id: number; title: string; wikilinks: string[] }[];
  edges: { source: number; target: number; keyword: string }[];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

type Tab = 'notes' | 'graph' | 'chat';

// ─── Main Component ──────────────────────────────────────────────────────────

export default function KnowledgeBase() {
  const [tab, setTab] = useState<Tab>('notes');
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [search, setSearch] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchNotes();
  }, []);

  async function fetchNotes() {
    try {
      const res = await fetch('/api/notes');
      const data = await res.json();
      if (Array.isArray(data)) setNotes(data);
    } catch (err) {
      console.error('Failed to fetch notes:', err);
    }
  }

  async function selectNote(id: number) {
    try {
      const res = await fetch(`/api/notes/${id}`);
      const data = await res.json();
      setSelectedNote(data);
    } catch (err) {
      console.error('Failed to load note:', err);
    }
  }

  async function deleteNote(id: number) {
    if (!confirm('Delete this note?')) return;
    try {
      await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      setSelectedNote(null);
      fetchNotes();
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  }

  function handleGraphNodeClick(nodeId: number) {
    setTab('notes');
    selectNote(nodeId);
  }

  function handleWikilinkClick(keyword: string) {
    const match = notes.find(
      (n) => n.wikilinks?.some((w) => w.toLowerCase() === keyword.toLowerCase())
    );
    if (match) selectNote(match.id);
  }

  const filtered = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.summary?.toLowerCase().includes(search.toLowerCase()) ||
      n.tags?.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface-1)' }}>
        {(['notes', 'graph', 'chat'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '6px 16px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
              background: tab === t ? 'var(--surface-3)' : 'transparent',
              color: tab === t ? 'var(--accent)' : 'var(--text-secondary)',
            }}
          >
            {t === 'notes' ? 'Notes List' : t === 'graph' ? 'Knowledge Graph' : 'Chat'}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ color: 'var(--text-muted)', fontSize: 13, alignSelf: 'center' }}>
          {notes.length} note{notes.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {tab === 'notes' && (
          <NotesTab
            notes={filtered}
            allNotes={notes}
            selectedNote={selectedNote}
            search={search}
            onSearchChange={setSearch}
            onSelectNote={selectNote}
            onDeselectNote={() => setSelectedNote(null)}
            onDeleteNote={deleteNote}
            onUploadClick={() => setShowUpload(true)}
            onWikilinkClick={handleWikilinkClick}
          />
        )}
        {tab === 'graph' && <GraphTab onNodeClick={handleGraphNodeClick} />}
        {tab === 'chat' && <ChatTab />}
      </div>

      {/* Upload modal */}
      {showUpload && (
        <UploadModal
          loading={loading}
          existingTitles={notes.map((n) => n.title)}
          onClose={() => setShowUpload(false)}
          onUpload={async (title, content, tags) => {
            setLoading(true);
            try {
              const res = await fetch('/api/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content, tags }),
              });
              if (res.ok) {
                setShowUpload(false);
                fetchNotes();
              }
            } catch (err) {
              console.error('Upload failed:', err);
            } finally {
              setLoading(false);
            }
          }}
          onBulkUpload={async (items) => {
            setLoading(true);
            try {
              for (const item of items) {
                await fetch('/api/notes', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ title: item.title, content: item.content, tags: item.tags }),
                });
              }
              setShowUpload(false);
              fetchNotes();
            } catch (err) {
              console.error('Bulk upload failed:', err);
            } finally {
              setLoading(false);
            }
          }}
        />
      )}
    </div>
  );
}

// ─── Notes Tab (Gallery + Detail) ───────────────────────────────────────────

function NotesTab({
  notes, allNotes, selectedNote, search, onSearchChange, onSelectNote, onDeselectNote, onDeleteNote, onUploadClick, onWikilinkClick,
}: {
  notes: Note[];
  allNotes: Note[];
  selectedNote: Note | null;
  search: string;
  onSearchChange: (v: string) => void;
  onSelectNote: (id: number) => void;
  onDeselectNote: () => void;
  onDeleteNote: (id: number) => void;
  onUploadClick: () => void;
  onWikilinkClick: (keyword: string) => void;
}) {
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // Collect all unique tags
  const allTags = Array.from(new Set(allNotes.flatMap((n) => n.tags || [])));

  const tagFiltered = activeTag
    ? notes.filter((n) => n.tags?.includes(activeTag))
    : notes;

  // ─── Gallery View (no note selected) ────────────────────────────────────
  if (!selectedNote) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>Knowledge Base</h1>
            <button
              onClick={onUploadClick}
              style={{
                padding: '8px 18px',
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 14,
                transition: 'background 0.2s',
              }}
            >
              + Upload Note
            </button>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search notes..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              color: 'var(--text-primary)',
              fontSize: 14,
              outline: 'none',
              boxSizing: 'border-box',
              marginBottom: allTags.length > 0 ? 12 : 0,
            }}
          />

          {/* Tag filter row */}
          {allTags.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingBottom: 4 }}>
              <button
                onClick={() => setActiveTag(null)}
                style={{
                  padding: '4px 12px',
                  fontSize: 12,
                  fontWeight: 500,
                  borderRadius: 20,
                  border: '1px solid var(--border)',
                  background: !activeTag ? 'var(--accent)' : 'var(--surface-1)',
                  color: !activeTag ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                All
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                  style={{
                    padding: '4px 12px',
                    fontSize: 12,
                    fontWeight: 500,
                    borderRadius: 20,
                    border: '1px solid var(--border)',
                    background: activeTag === tag ? 'var(--accent)' : 'var(--surface-1)',
                    color: activeTag === tag ? '#fff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Card grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 24px' }}>
          {tagFiltered.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: 60, fontSize: 14 }}>
              {search || activeTag ? 'No matching notes' : 'No notes yet. Upload one to get started.'}
            </div>
          ) : (
            <div className="notes-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
              {tagFiltered.map((note) => (
                <NoteCard key={note.id} note={note} onClick={() => onSelectNote(note.id)} />
              ))}
            </div>
          )}
        </div>

        <style>{`
          .notes-card-grid {
            grid-template-columns: repeat(3, 1fr) !important;
          }
          @media (max-width: 1024px) {
            .notes-card-grid {
              grid-template-columns: repeat(2, 1fr) !important;
            }
          }
          @media (max-width: 640px) {
            .notes-card-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>
    );
  }

  // ─── Detail View (note selected) ────────────────────────────────────────
  // Process content: convert [[wikilinks]] to styled HTML links
  function processContent(content: string): { markdown: string; wikilinks: string[] } {
    const wikilinks: string[] = [];
    const markdown = content.replace(/\[\[([^\]]+)\]\]/g, (_match, keyword) => {
      if (!wikilinks.includes(keyword)) wikilinks.push(keyword);
      return `<a class="wikilink" data-keyword="${keyword}">${keyword}</a>`;
    });
    return { markdown, wikilinks };
  }

  const processed = selectedNote.content ? processContent(selectedNote.content) : null;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Back button bar */}
      <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={onDeselectNote}
          style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 14, fontWeight: 500, padding: '4px 0' }}
        >
          &larr; Back to gallery
        </button>
        <button
          onClick={() => onDeleteNote(selectedNote.id)}
          style={{ ...btnDangerStyle, fontSize: 12, padding: '4px 12px' }}
        >
          Delete
        </button>
      </div>

      {/* Two-panel layout */}
      <div className="note-detail-layout" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: Rendered markdown (60%) */}
        <div style={{ flex: '0 0 60%', overflowY: 'auto', padding: 24, borderRight: '1px solid var(--border)' }}>
          <h2 style={{ margin: '0 0 12px', color: 'var(--text-primary)', fontSize: 22 }}>{selectedNote.title}</h2>

          {/* Tags */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            {selectedNote.tags?.map((t) => (
              <span key={t} style={tagStyle}>{t}</span>
            ))}
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Created {new Date(selectedNote.created_at).toLocaleDateString()}
            </span>
          </div>

          {/* Content */}
          <div style={{
            background: '#1a1a1f',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            padding: 32,
            maxWidth: 720,
          }}>
            <style>{`
              .kb-prose h1 { font-size: 1.5em; font-weight: 700; margin: 0 0 0.5em; color: #e4e4e7; }
              .kb-prose h2 { font-size: 1.25em; font-weight: 700; margin: 1.2em 0 0.5em; color: #e4e4e7; }
              .kb-prose h3 { font-size: 1.1em; font-weight: 600; margin: 1em 0 0.4em; color: #e4e4e7; }
              .kb-prose p { margin: 0 0 1em; line-height: 1.7; color: #d1d1d6; }
              .kb-prose ul, .kb-prose ol { margin: 0 0 1em; padding-left: 1.5em; color: #d1d1d6; }
              .kb-prose li { margin-bottom: 0.25em; line-height: 1.6; }
              .kb-prose blockquote { border-left: 3px solid #6366f1; padding-left: 1em; margin: 0 0 1em; color: #a1a1aa; }
              .kb-prose code { background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; font-size: 0.9em; color: #c4b5fd; }
              .kb-prose pre { background: rgba(255,255,255,0.06); padding: 16px; border-radius: 8px; overflow-x: auto; margin: 0 0 1em; }
              .kb-prose pre code { background: none; padding: 0; font-size: 0.85em; color: #d1d1d6; }
              .kb-prose hr { border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 1.5em 0; }
              .kb-prose strong { color: #e4e4e7; font-weight: 600; }
              .kb-prose a { color: #6366f1; text-decoration: underline; }
              .kb-prose a.wikilink { color: #818cf8; text-decoration: none; background: rgba(99,102,241,0.15); padding: 1px 6px; border-radius: 4px; cursor: pointer; border-bottom: 1px dashed rgba(99,102,241,0.4); font-weight: 500; }
              .kb-prose a.wikilink:hover { background: rgba(99,102,241,0.3); }
              .kb-prose img { max-width: 100%; border-radius: 8px; }
            `}</style>
            <div className="kb-prose" style={{ color: '#e4e4e7', lineHeight: 1.7, fontSize: 15 }}>
              {processed ? (
                <div onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.classList.contains('wikilink')) {
                    onWikilinkClick(target.getAttribute('data-keyword') || '');
                  }
                }}>
                  <ReactMarkdown rehypePlugins={[rehypeRaw]}>{processed.markdown}</ReactMarkdown>
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)' }}>No content</p>
              )}
            </div>

            {/* Wikilinks as badges below content */}
            {processed && processed.wikilinks.length > 0 && (
              <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#a1a1aa', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Linked Topics
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {processed.wikilinks.map((kw) => (
                    <span
                      key={kw}
                      onClick={() => onWikilinkClick(kw)}
                      style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        borderRadius: 6,
                        background: 'rgba(99,102,241,0.15)',
                        color: '#818cf8',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 500,
                        border: '1px solid rgba(99,102,241,0.25)',
                        transition: 'background 0.15s',
                      }}
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: AI analysis panel (40%) */}
        <div style={{ flex: '0 0 40%', overflowY: 'auto', padding: 20 }}>
          {/* Summary */}
          {selectedNote.summary && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, marginTop: 0 }}>Summary</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                {selectedNote.summary}
              </p>
            </div>
          )}

          {/* Connected notes */}
          {selectedNote.connectedNotes && selectedNote.connectedNotes.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, marginTop: 0 }}>Connected Notes</h3>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {selectedNote.connectedNotes.map((cn) => (
                  <span
                    key={`${cn.id}-${cn.keyword}`}
                    onClick={() => onWikilinkClick(cn.keyword)}
                    style={{
                      fontSize: 12,
                      padding: '4px 10px',
                      borderRadius: 6,
                      background: 'var(--surface-3)',
                      color: 'var(--accent)',
                      cursor: 'pointer',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {cn.title} ({cn.keyword})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Wikilinks / Linked topics */}
          {selectedNote.wikilinks && selectedNote.wikilinks.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, marginTop: 0 }}>Linked Topics</h3>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {selectedNote.wikilinks.map((kw) => (
                  <span
                    key={kw}
                    onClick={() => onWikilinkClick(kw)}
                    style={{
                      fontSize: 12,
                      padding: '4px 10px',
                      borderRadius: 12,
                      background: 'rgba(99,102,241,0.15)',
                      color: '#818cf8',
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {selectedNote.tags && selectedNote.tags.length > 0 && (
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, marginTop: 0 }}>Tags</h3>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {selectedNote.tags.map((t) => (
                  <span key={t} style={{ fontSize: 12, padding: '4px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-secondary)' }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* If nothing to show */}
          {!selectedNote.summary && (!selectedNote.connectedNotes || selectedNote.connectedNotes.length === 0) && (!selectedNote.wikilinks || selectedNote.wikilinks.length === 0) && (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, paddingTop: 20 }}>
              No AI analysis available for this note yet.
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .note-detail-layout {
            flex-direction: column !important;
          }
          .note-detail-layout > div:first-child {
            flex: none !important;
            border-right: none !important;
            border-bottom: 1px solid var(--border);
          }
          .note-detail-layout > div:last-child {
            flex: 1 !important;
          }
        }
      `}</style>
    </div>
  );
}

// ─── Note Card Component ────────────────────────────────────────────────────

function NoteCard({ note, onClick }: { note: Note; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  // Truncate content for preview
  const previewText = note.summary || '';

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--surface-1)',
        border: `1px solid ${hovered ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 16,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.3)' : 'none',
      }}
    >
      {/* Preview area - rendered markdown snippet */}
      <div style={{
        height: 180,
        overflow: 'hidden',
        position: 'relative',
        background: '#1a1a1f',
        padding: '14px 16px',
        fontSize: 12,
        lineHeight: 1.6,
        color: '#d1d1d6',
      }}>
        <div className="kb-prose" style={{ pointerEvents: 'none' }}>
          <ReactMarkdown>{previewText.slice(0, 200)}</ReactMarkdown>
        </div>
        {/* Gradient fade */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 40,
          background: 'linear-gradient(transparent, var(--surface-1))',
          pointerEvents: 'none',
        }} />
      </div>

      {/* Card info */}
      <div style={{ padding: '12px 16px' }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4 }}>
          {note.title}
        </div>
        {note.summary && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, marginBottom: 8 }}>
            {note.summary}
          </div>
        )}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          {note.tags?.slice(0, 3).map((t) => (
            <span key={t} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--surface-3)', color: 'var(--text-secondary)' }}>
              {t}
            </span>
          ))}
          {(note.wikilinks?.length ?? 0) > 0 && (
            <span style={{ fontSize: 10, color: 'var(--accent)', marginLeft: 'auto' }}>
              {note.wikilinks!.length} links
            </span>
          )}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
          {new Date(note.created_at).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}

// ─── Upload Modal ────────────────────────────────────────────────────────────

interface BulkFileEntry {
  name: string;
  title: string;
  content: string;
  checked: boolean;
  isDuplicate: boolean;
}

function UploadModal({ loading, existingTitles, onClose, onUpload, onBulkUpload }: {
  loading: boolean;
  existingTitles: string[];
  onClose: () => void;
  onUpload: (title: string, content: string, tags: string[]) => void;
  onBulkUpload: (items: { title: string; content: string; tags: string[] }[]) => void;
}) {
  const [mode, setMode] = useState<'paste' | 'upload'>('paste');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tagsStr, setTagsStr] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bulk upload state
  const [bulkFiles, setBulkFiles] = useState<BulkFileEntry[]>([]);
  const [bulkTags, setBulkTags] = useState('');
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const bulkFilesInputRef = useRef<HTMLInputElement>(null);
  const bulkFolderInputRef = useRef<HTMLInputElement>(null);

  function handleSingleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setContent(text);
      if (!title) setTitle(file.name.replace(/\.(md|txt|markdown)$/, ''));
    };
    reader.readAsText(file);
  }

  function handleBulkFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const validFiles = Array.from(files).filter((f) =>
      /\.(md|txt|markdown)$/i.test(f.name)
    );

    const existingLower = existingTitles.map((t) => t.toLowerCase());
    const readPromises = validFiles.map(
      (file) =>
        new Promise<BulkFileEntry>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const text = ev.target?.result as string;
            const fileTitle = file.name.replace(/\.(md|txt|markdown)$/i, '');
            const isDuplicate = existingLower.includes(fileTitle.toLowerCase());
            resolve({
              name: file.name,
              title: fileTitle,
              content: text,
              checked: !isDuplicate,
              isDuplicate,
            });
          };
          reader.readAsText(file);
        })
    );

    Promise.all(readPromises).then((entries) => {
      setBulkFiles(entries);
    });

    // Reset the input so the same files can be re-selected
    e.target.value = '';
  }

  function toggleBulkFile(index: number) {
    setBulkFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, checked: !f.checked } : f))
    );
  }

  async function handleBulkUpload() {
    const toUpload = bulkFiles.filter((f) => f.checked && !f.isDuplicate);
    if (toUpload.length === 0) return;

    const tags = bulkTags.split(',').map((t) => t.trim()).filter(Boolean);
    const errors: string[] = [];

    setBulkProgress({ current: 0, total: toUpload.length });

    for (let i = 0; i < toUpload.length; i++) {
      setBulkProgress({ current: i + 1, total: toUpload.length });
      try {
        const res = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: toUpload[i].title,
            content: toUpload[i].content,
            tags,
          }),
        });
        if (!res.ok) {
          errors.push(`Failed: ${toUpload[i].title}`);
        }
      } catch {
        errors.push(`Error: ${toUpload[i].title}`);
      }
    }

    setBulkErrors(errors);
    if (errors.length === 0) {
      onBulkUpload([]); // Signal completion (uploads already done)
    } else {
      setBulkProgress(null);
    }
  }

  const newCount = bulkFiles.filter((f) => f.checked && !f.isDuplicate).length;
  const dupeCount = bulkFiles.filter((f) => f.isDuplicate).length;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: 'var(--surface-1)', borderRadius: 12, padding: 24, width: 600, maxHeight: '85vh', overflow: 'auto', border: '1px solid var(--border)' }}>
        <h3 style={{ margin: '0 0 16px', color: 'var(--text-primary)' }}>Upload Notes</h3>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            onClick={() => setMode('paste')}
            style={{
              padding: '6px 14px',
              fontSize: 13,
              background: mode === 'paste' ? 'var(--accent)' : 'var(--surface-2)',
              color: mode === 'paste' ? '#fff' : 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Paste
          </button>
          <button
            onClick={() => setMode('upload')}
            style={{
              padding: '6px 14px',
              fontSize: 13,
              background: mode === 'upload' ? 'var(--accent)' : 'var(--surface-2)',
              color: mode === 'upload' ? '#fff' : 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Upload Files
          </button>
        </div>

        {mode === 'paste' ? (
          <>
            <label style={labelStyle}>Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title"
              style={{ ...inputStyle, marginBottom: 12 }}
            />

            <label style={labelStyle}>Content (Markdown)</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste markdown content here..."
              rows={12}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', marginBottom: 8 }}
            />
            <div style={{ marginBottom: 12 }}>
              <input ref={fileInputRef} type="file" accept=".md,.txt,.markdown" onChange={handleSingleFileUpload} style={{ display: 'none' }} />
              <button onClick={() => fileInputRef.current?.click()} style={{ ...btnSmallStyle, fontSize: 12 }}>
                Or upload .md file
              </button>
            </div>

            <label style={labelStyle}>Tags (comma-separated)</label>
            <input
              type="text"
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              placeholder="e.g. AI, productivity, notes"
              style={{ ...inputStyle, marginBottom: 16 }}
            />

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={btnSmallStyle} disabled={loading}>Cancel</button>
              <button
                onClick={() => {
                  const tags = tagsStr.split(',').map((t) => t.trim()).filter(Boolean);
                  onUpload(title, content, tags);
                }}
                disabled={!title || !content || loading}
                style={btnStyle}
              >
                {loading ? 'Analyzing and building connections...' : 'Upload & Process'}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Bulk file upload controls */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                ref={bulkFilesInputRef}
                type="file"
                accept=".md,.txt,.markdown"
                multiple
                onChange={handleBulkFileSelect}
                style={{ display: 'none' }}
              />
              <input
                ref={bulkFolderInputRef}
                type="file"
                accept=".md,.txt,.markdown"
                /* @ts-expect-error webkitdirectory is a non-standard attribute */
                webkitdirectory=""
                onChange={handleBulkFileSelect}
                style={{ display: 'none' }}
              />
              <button onClick={() => bulkFilesInputRef.current?.click()} style={btnSmallStyle}>
                Select Files
              </button>
              <button onClick={() => bulkFolderInputRef.current?.click()} style={btnSmallStyle}>
                Select Folder
              </button>
            </div>

            {bulkFiles.length > 0 && (
              <>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  {bulkFiles.length} file{bulkFiles.length !== 1 ? 's' : ''} selected
                  {dupeCount > 0 && (
                    <span style={{ color: 'var(--warning, #f59e0b)', marginLeft: 8 }}>
                      ({newCount} new, {dupeCount} duplicate{dupeCount !== 1 ? 's' : ''} skipped)
                    </span>
                  )}
                </div>

                <div style={{
                  maxHeight: 240,
                  overflowY: 'auto',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  marginBottom: 12,
                }}>
                  {bulkFiles.map((file, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 12px',
                        borderBottom: i < bulkFiles.length - 1 ? '1px solid var(--border)' : 'none',
                        background: file.isDuplicate ? 'var(--surface-2)' : 'transparent',
                        opacity: file.isDuplicate ? 0.6 : 1,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={file.checked}
                        disabled={file.isDuplicate}
                        onChange={() => toggleBulkFile(i)}
                        style={{ cursor: file.isDuplicate ? 'not-allowed' : 'pointer' }}
                      />
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {file.title}
                      </span>
                      {file.isDuplicate && (
                        <span style={{
                          fontSize: 11,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: 'var(--warning, #f59e0b)',
                          color: '#000',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}>
                          Duplicate
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {(file.content.length / 1024).toFixed(1)}KB
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <label style={labelStyle}>Tags for all files (comma-separated)</label>
            <input
              type="text"
              value={bulkTags}
              onChange={(e) => setBulkTags(e.target.value)}
              placeholder="e.g. AI, productivity, notes"
              style={{ ...inputStyle, marginBottom: 16 }}
            />

            {bulkProgress && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, color: 'var(--accent)', marginBottom: 4 }}>
                  Uploading {bulkProgress.current}/{bulkProgress.total}...
                </div>
                <div style={{ height: 4, background: 'var(--surface-3)', borderRadius: 2 }}>
                  <div style={{
                    height: '100%',
                    background: 'var(--accent)',
                    borderRadius: 2,
                    width: `${(bulkProgress.current / bulkProgress.total) * 100}%`,
                    transition: 'width 0.3s',
                  }} />
                </div>
              </div>
            )}

            {bulkErrors.length > 0 && (
              <div style={{ marginBottom: 12, padding: 8, background: 'var(--surface-2)', borderRadius: 6, border: '1px solid var(--danger)' }}>
                {bulkErrors.map((err, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 2 }}>{err}</div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={btnSmallStyle} disabled={loading || !!bulkProgress}>Cancel</button>
              <button
                onClick={handleBulkUpload}
                disabled={newCount === 0 || loading || !!bulkProgress}
                style={btnStyle}
              >
                {bulkProgress
                  ? `Uploading ${bulkProgress.current}/${bulkProgress.total}...`
                  : `Upload & Process All (${newCount})`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Graph Tab ───────────────────────────────────────────────────────────────

interface GraphNode {
  id: number;
  title: string;
  wikilinks: string[];
  x: number;
  y: number;
  vx: number;
  vy: number;
  connections: number;
}

type GraphView = 'files' | 'words';

function GraphTab({ onNodeClick }: { onNodeClick: (id: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<{ source: number; target: number; keyword: string }[]>([]);
  const [hovered, setHovered] = useState<GraphNode | null>(null);
  const [graphLoaded, setGraphLoaded] = useState(false);
  const [nodeCount, setNodeCount] = useState(0);
  const [popup, setPopup] = useState<{ node: GraphNode; x: number; y: number; connections: number; keywords: string[] } | null>(null);
  const [viewMode, setViewMode] = useState<GraphView>('files');
  const rawGraphRef = useRef<GraphData | null>(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const dragRef = useRef<{ dragging: boolean; lastX: number; lastY: number }>({ dragging: false, lastX: 0, lastY: 0 });
  const animRef = useRef<number>(0);

  const getNodeAt = useCallback((mx: number, my: number): GraphNode | null => {
    const off = offsetRef.current;
    const z = zoomRef.current;
    for (const node of nodesRef.current) {
      const sx = node.x * z + off.x;
      const sy = node.y * z + off.y;
      const r = Math.max(8, 4 + node.connections * 3) * z;
      if (Math.hypot(mx - sx, my - sy) < r) return node;
    }
    return null;
  }, []);

  function buildGraph(data: GraphData, mode: GraphView) {
    const canvas = canvasRef.current;
    const w = canvas?.parentElement?.clientWidth || 800;
    const h = canvas?.parentElement?.clientHeight || 600;

    if (mode === 'files') {
      const connCount: Record<number, number> = {};
      for (const e of data.edges) {
        connCount[e.source] = (connCount[e.source] || 0) + 1;
        connCount[e.target] = (connCount[e.target] || 0) + 1;
      }
      nodesRef.current = data.nodes.map((n) => ({
        ...n,
        x: w / 2 + (Math.random() - 0.5) * 400,
        y: h / 2 + (Math.random() - 0.5) * 300,
        vx: 0, vy: 0,
        connections: connCount[n.id] || 0,
      }));
      edgesRef.current = data.edges;
    } else {
      const keywordSet = new Map<string, { id: number; noteIds: number[] }>();
      let nextId = -1;

      for (const node of data.nodes) {
        for (const wl of (node.wikilinks || [])) {
          const key = wl.toLowerCase();
          if (!keywordSet.has(key)) {
            keywordSet.set(key, { id: nextId--, noteIds: [] });
          }
          keywordSet.get(key)!.noteIds.push(node.id);
        }
      }

      const kwNodes: GraphNode[] = [];
      keywordSet.forEach((val, key) => {
        kwNodes.push({
          id: val.id,
          title: key,
          wikilinks: [],
          x: w / 2 + (Math.random() - 0.5) * 400,
          y: h / 2 + (Math.random() - 0.5) * 300,
          vx: 0, vy: 0,
          connections: val.noteIds.length,
        });
      });

      const kwEdges: { source: number; target: number; keyword: string }[] = [];
      const kwArr = Array.from(keywordSet.entries());
      for (let i = 0; i < kwArr.length; i++) {
        for (let j = i + 1; j < kwArr.length; j++) {
          const shared = kwArr[i][1].noteIds.filter((id) => kwArr[j][1].noteIds.includes(id));
          if (shared.length > 0) {
            kwEdges.push({ source: kwArr[i][1].id, target: kwArr[j][1].id, keyword: `${shared.length} shared` });
          }
        }
      }

      nodesRef.current = kwNodes;
      edgesRef.current = kwEdges;
    }

    setNodeCount(nodesRef.current.length);
    offsetRef.current = { x: 0, y: 0 };
    zoomRef.current = 1;
    setPopup(null);
  }

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/notes/graph');
        const data: GraphData = await res.json();
        if (!data.nodes) return;
        rawGraphRef.current = data;
        buildGraph(data, viewMode);
        setGraphLoaded(true);
      } catch (err) {
        console.error('Failed to load graph:', err);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (rawGraphRef.current) {
      buildGraph(rawGraphRef.current, viewMode);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function resize() {
      if (!canvas) return;
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function simulate() {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const nodeMap: Record<number, GraphNode> = {};
      for (const n of nodes) nodeMap[n.id] = n;

      // Repulsion
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.max(1, Math.hypot(dx, dy));
          const force = 800 / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          nodes[i].vx -= fx;
          nodes[i].vy -= fy;
          nodes[j].vx += fx;
          nodes[j].vy += fy;
        }
      }

      // Attraction along edges
      for (const e of edges) {
        const s = nodeMap[e.source];
        const t = nodeMap[e.target];
        if (!s || !t) continue;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const force = (dist - 120) * 0.01;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        s.vx += fx;
        s.vy += fy;
        t.vx -= fx;
        t.vy -= fy;
      }

      // Center gravity
      if (!canvas) return;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      for (const n of nodes) {
        n.vx += (cx - n.x) * 0.001;
        n.vy += (cy - n.y) * 0.001;
        n.vx *= 0.9;
        n.vy *= 0.9;
        n.x += n.vx;
        n.y += n.vy;
      }

      // Draw
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw subtle dot grid background
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      const gridSize = 30;
      for (let gx = 0; gx < canvas.width; gx += gridSize) {
        for (let gy = 0; gy < canvas.height; gy += gridSize) {
          ctx.beginPath();
          ctx.arc(gx, gy, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const off = offsetRef.current;
      const z = zoomRef.current;

      ctx.save();
      ctx.translate(off.x, off.y);
      ctx.scale(z, z);

      function getNodeColor(connections: number): string {
        if (connections >= 5) return '#6366f1';
        if (connections >= 3) return '#8b5cf6';
        if (connections >= 1) return '#06b6d4';
        return '#64748b';
      }

      // Edges
      for (const e of edges) {
        const s = nodeMap[e.source];
        const t = nodeMap[e.target];
        if (!s || !t) continue;
        const isHL = hovered && (hovered.id === s.id || hovered.id === t.id);
        ctx.strokeStyle = isHL ? '#818cf8' : 'rgba(255,255,255,0.2)';
        ctx.lineWidth = isHL ? 2.5 : 1;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
        ctx.stroke();
      }

      // Nodes
      for (const n of nodes) {
        const r = Math.max(8, 4 + n.connections * 3);
        const isHL = hovered?.id === n.id;
        const color = getNodeColor(n.connections);

        if (isHL) {
          ctx.save();
          ctx.shadowColor = color;
          ctx.shadowBlur = 20;
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 2, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.restore();
        }

        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isHL ? '#a5b4fc' : color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = isHL ? 2 : 1;
        ctx.stroke();

        const label = n.title.length > 20 ? n.title.slice(0, 18) + '...' : n.title;
        const fontSize = isHL ? 13 : 11;
        ctx.font = `${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        const textWidth = ctx.measureText(label).width;
        const labelY = n.y - r - 8;

        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        const padX = 4, padY = 2;
        ctx.beginPath();
        ctx.roundRect(
          n.x - textWidth / 2 - padX,
          labelY - fontSize / 2 - padY - 1,
          textWidth + padX * 2,
          fontSize + padY * 2,
          3
        );
        ctx.fill();

        ctx.fillStyle = isHL ? '#ffffff' : '#e4e4e7';
        ctx.fillText(label, n.x, labelY + fontSize / 2 - 2);
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(simulate);
    }

    animRef.current = requestAnimationFrame(simulate);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animRef.current);
    };
  }, [hovered]);

  function handleMouseMove(e: React.MouseEvent) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (dragRef.current.dragging) {
      offsetRef.current.x += mx - dragRef.current.lastX;
      offsetRef.current.y += my - dragRef.current.lastY;
      dragRef.current.lastX = mx;
      dragRef.current.lastY = my;
      return;
    }

    const node = getNodeAt(mx, my);
    setHovered(node);
    if (canvasRef.current) canvasRef.current.style.cursor = node ? 'pointer' : 'grab';
  }

  function handleMouseDown(e: React.MouseEvent) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    dragRef.current = { dragging: true, lastX: mx, lastY: my };
  }

  function handleMouseUp(e: React.MouseEvent) {
    if (!dragRef.current.dragging) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const moved = Math.hypot(mx - dragRef.current.lastX, my - dragRef.current.lastY);
    dragRef.current.dragging = false;
    if (moved < 5) {
      const node = getNodeAt(mx, my);
      if (node) {
        const connections = edgesRef.current.filter(
          (edge) => edge.source === node.id || edge.target === node.id
        );
        const keywords = Array.from(new Set(connections.map((c) => c.keyword))).slice(0, 5);
        setPopup({ node, x: e.clientX, y: e.clientY, connections: connections.length, keywords });
      } else {
        setPopup(null);
      }
    }
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    zoomRef.current = Math.max(0.2, Math.min(3, zoomRef.current * delta));
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* View toggle */}
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, display: 'flex', gap: 4, background: 'var(--surface-1)', borderRadius: 8, padding: 4, border: '1px solid var(--border)' }}>
        <button
          onClick={() => setViewMode('files')}
          style={{
            padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            background: viewMode === 'files' ? 'var(--accent)' : 'transparent',
            color: viewMode === 'files' ? 'white' : 'var(--text-secondary)',
          }}
        >
          Files
        </button>
        <button
          onClick={() => setViewMode('words')}
          style={{
            padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            background: viewMode === 'words' ? 'var(--accent)' : 'transparent',
            color: viewMode === 'words' ? 'white' : 'var(--text-secondary)',
          }}
        >
          Words
        </button>
      </div>
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { dragRef.current.dragging = false; setHovered(null); }}
        onWheel={handleWheel}
        style={{ width: '100%', height: '100%', cursor: 'grab' }}
      />
      {hovered && (
        <div style={{
          position: 'absolute', top: 12, left: 12, background: 'var(--surface-2)', padding: '8px 14px',
          borderRadius: 8, border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13,
        }}>
          <strong>{hovered.title}</strong>
          <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{hovered.connections} connections</span>
        </div>
      )}
      {graphLoaded && nodeCount === 0 && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          No notes yet. Upload notes to see the knowledge graph.
        </div>
      )}
      {/* Node popup card */}
      {popup && (
        <div
          style={{
            position: 'fixed',
            left: Math.min(popup.x + 10, window.innerWidth - 300),
            top: Math.min(popup.y - 10, window.innerHeight - 200),
            width: 280,
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 16,
            zIndex: 100,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          <h3 style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--text-primary)' }}>{popup.node.title}</h3>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
            {popup.connections} connection{popup.connections !== 1 ? 's' : ''}
          </div>
          {popup.keywords.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
              {popup.keywords.map((kw) => (
                <span key={kw} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                  {kw}
                </span>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            {popup.node.id > 0 && (
              <button
                onClick={() => { onNodeClick(popup.node.id); setPopup(null); }}
                style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                Open Note
              </button>
            )}
            {popup.node.id < 0 && (
              <div style={{ flex: 1, fontSize: 11, color: 'var(--text-muted)', padding: '6px 0' }}>
                Keyword — appears in {popup.connections} note{popup.connections !== 1 ? 's' : ''}
              </div>
            )}
            <button
              onClick={() => setPopup(null)}
              style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Chat Tab ────────────────────────────────────────────────────────────────

function ChatTab() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const sessionRef = useRef(`kb-${Date.now()}`);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || streaming) return;
    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setStreaming(true);

    try {
      const res = await fetch('/api/notes/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, sessionId: sessionRef.current }),
      });

      if (!res.ok || !res.body) {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'Error: Failed to get response.' }]);
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantContent += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: 'assistant', content: assistantContent };
          return copy;
        });
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Error: Failed to send message.' }]);
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: 60, fontSize: 14 }}>
            Ask anything about your knowledge base. Your notes are loaded as context.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
            <div style={{
              maxWidth: '70%',
              padding: '10px 14px',
              borderRadius: 12,
              background: m.role === 'user' ? 'var(--accent)' : 'var(--surface-2)',
              color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
              fontSize: 14,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
            }}>
              {m.role === 'assistant' ? <ReactMarkdown>{m.content}</ReactMarkdown> : m.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: 16, borderTop: '1px solid var(--border)', background: 'var(--surface-1)', display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="Ask about your notes..."
          style={{ ...inputStyle, flex: 1 }}
          disabled={streaming}
        />
        <button onClick={sendMessage} disabled={streaming || !input.trim()} style={btnStyle}>
          {streaming ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}

// ─── Shared Styles ───────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--surface-2)',
  color: 'var(--text-primary)',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};

const btnStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 6,
  border: 'none',
  background: 'var(--accent)',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 500,
  whiteSpace: 'nowrap',
};

const btnSmallStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--surface-2)',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  fontSize: 13,
};

const btnDangerStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 6,
  border: '1px solid var(--danger)',
  background: 'transparent',
  color: 'var(--danger)',
  cursor: 'pointer',
  fontSize: 13,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginBottom: 4,
};

const tagStyle: React.CSSProperties = {
  fontSize: 11,
  padding: '2px 8px',
  borderRadius: 4,
  background: 'var(--surface-3)',
  color: 'var(--text-secondary)',
};
