'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface AiExplanation {
  whatItIs: string;
  keyInsights: string[];
  relatedConcepts: string[];
  technologiesUsed: string[];
}

interface ArtifactListItem {
  id: number;
  title: string;
  description: string | null;
  file_type: string;
  tags: string[] | null;
  created_at: string;
  has_explanation: boolean;
}

interface ArtifactFull {
  id: number;
  title: string;
  description: string | null;
  file_content: string;
  file_type: string;
  ai_explanation: AiExplanation | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

function wrapReactContent(code: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    ${code}
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(typeof App !== 'undefined' ? App : () => React.createElement('div', null, 'No App component found')));
  </script>
</body>
</html>`;
}

function getPreviewContent(artifact: ArtifactFull): string {
  if (artifact.file_type === 'html' || artifact.file_type === 'htm') {
    return artifact.file_content;
  }
  return wrapReactContent(artifact.file_content);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ArtifactsView() {
  const [artifacts, setArtifacts] = useState<ArtifactListItem[]>([]);
  const [selected, setSelected] = useState<ArtifactFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [search, setSearch] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // Upload form state
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCode, setUploadCode] = useState('');
  const [uploadTags, setUploadTags] = useState('');
  const [uploadMode, setUploadMode] = useState<'paste' | 'file'>('paste');
  const [uploadTab, setUploadTab] = useState<'paste' | 'bulk'>('paste');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bulk upload state
  const [bulkFiles, setBulkFiles] = useState<{ name: string; title: string; content: string; checked: boolean; isDuplicate: boolean }[]>([]);
  const [bulkTags, setBulkTags] = useState('');
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const bulkFilesInputRef = useRef<HTMLInputElement>(null);
  const bulkFolderInputRef = useRef<HTMLInputElement>(null);

  const fetchArtifacts = useCallback(async () => {
    try {
      const res = await fetch('/api/artifacts');
      const data = await res.json();
      setArtifacts(Array.isArray(data) ? data : []);
    } catch {
      console.error('Failed to fetch artifacts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArtifacts();
  }, [fetchArtifacts]);

  const selectArtifact = async (id: number) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/artifacts/${id}`);
      const data = await res.json();
      setSelected(data);
    } catch {
      console.error('Failed to fetch artifact detail');
    } finally {
      setLoadingDetail(false);
    }
  };

  const deleteArtifact = async (id: number) => {
    if (!confirm('Delete this artifact?')) return;
    try {
      await fetch(`/api/artifacts/${id}`, { method: 'DELETE' });
      if (selected?.id === id) setSelected(null);
      fetchArtifacts();
    } catch {
      console.error('Failed to delete artifact');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setUploadCode(reader.result as string);
      if (!uploadTitle) {
        setUploadTitle(file.name.replace(/\.[^.]+$/, ''));
      }
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!uploadTitle.trim() || !uploadCode.trim()) return;
    setUploading(true);

    const fileType = uploadCode.trim().startsWith('<!') || uploadCode.trim().startsWith('<html')
      ? 'html'
      : uploadCode.includes('import React') || uploadCode.includes('export default') || uploadCode.includes('function App')
        ? 'jsx'
        : 'html';

    try {
      const res = await fetch('/api/artifacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: uploadTitle.trim(),
          fileContent: uploadCode,
          fileType,
          tags: uploadTags.split(',').map((t) => t.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();

      // Reset form
      setUploadTitle('');
      setUploadCode('');
      setUploadTags('');
      setShowUpload(false);

      await fetchArtifacts();
      setSelected(data);
    } catch {
      console.error('Failed to upload artifact');
    } finally {
      setUploading(false);
    }
  };

  const handleBulkFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const validFiles = Array.from(files).filter((f) =>
      /\.(html?|jsx|tsx)$/i.test(f.name)
    );

    const existingLower = artifacts.map((a) => a.title.toLowerCase());
    const readPromises = validFiles.map(
      (file) =>
        new Promise<{ name: string; title: string; content: string; checked: boolean; isDuplicate: boolean }>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const text = reader.result as string;
            const fileTitle = file.name.replace(/\.[^.]+$/, '');
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

    e.target.value = '';
  };

  const toggleBulkFile = (index: number) => {
    setBulkFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, checked: !f.checked } : f))
    );
  };

  const handleBulkUpload = async () => {
    const toUpload = bulkFiles.filter((f) => f.checked && !f.isDuplicate);
    if (toUpload.length === 0) return;

    const tags = bulkTags.split(',').map((t) => t.trim()).filter(Boolean);
    const errors: string[] = [];
    setUploading(true);
    setBulkProgress({ current: 0, total: toUpload.length });

    for (let i = 0; i < toUpload.length; i++) {
      setBulkProgress({ current: i + 1, total: toUpload.length });
      const code = toUpload[i].content;
      const fileType = code.trim().startsWith('<!') || code.trim().startsWith('<html')
        ? 'html'
        : code.includes('import React') || code.includes('export default') || code.includes('function App')
          ? 'jsx'
          : 'html';
      try {
        const res = await fetch('/api/artifacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: toUpload[i].title,
            fileContent: code,
            fileType,
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
    setBulkProgress(null);
    setUploading(false);

    if (errors.length === 0) {
      setBulkFiles([]);
      setBulkTags('');
      setShowUpload(false);
      await fetchArtifacts();
    }
  };

  const bulkNewCount = bulkFiles.filter((f) => f.checked && !f.isDuplicate).length;
  const bulkDupeCount = bulkFiles.filter((f) => f.isDuplicate).length;

  // Collect all unique tags
  const allTags = Array.from(new Set(artifacts.flatMap((a) => a.tags || [])));

  const filtered = artifacts.filter((a) => {
    const matchesSearch = a.title.toLowerCase().includes(search.toLowerCase());
    const matchesTag = !activeTag || a.tags?.includes(activeTag);
    return matchesSearch && matchesTag;
  });

  // ─── Gallery View (no artifact selected) ──────────────────────────────────
  if (!selected) {
    return (
      <div style={{ height: '100%', background: 'var(--bg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>Artifacts</h1>
            <button
              onClick={() => setShowUpload(true)}
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
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--accent)')}
            >
              + New Artifact
            </button>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search artifacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: 60 }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: 60, fontSize: 14 }}>
              {search || activeTag ? 'No matching artifacts' : 'No artifacts yet. Upload one to get started.'}
            </div>
          ) : (
            <div className="artifacts-card-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 20,
            }}>
              {filtered.map((artifact) => (
                <ArtifactCard
                  key={artifact.id}
                  artifact={artifact}
                  onClick={() => selectArtifact(artifact.id)}
                  onDelete={() => deleteArtifact(artifact.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Upload Modal */}
        {showUpload && renderUploadModal()}

        <style>{`
          .artifacts-card-grid {
            grid-template-columns: repeat(3, 1fr) !important;
          }
          @media (max-width: 1024px) {
            .artifacts-card-grid {
              grid-template-columns: repeat(2, 1fr) !important;
            }
          }
          @media (max-width: 640px) {
            .artifacts-card-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>
    );
  }

  // ─── Detail View (artifact selected) ──────────────────────────────────────
  return (
    <div style={{ height: '100%', background: 'var(--bg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Back button bar */}
      <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={() => setSelected(null)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent)',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 500,
            padding: '4px 0',
          }}
        >
          &larr; Back to gallery
        </button>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setFullscreen(true)}
            style={{
              padding: '6px 14px',
              fontSize: 13,
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Full Screen
          </button>
          <button
            onClick={() => deleteArtifact(selected.id)}
            style={{
              padding: '6px 14px',
              fontSize: 13,
              background: 'transparent',
              border: '1px solid var(--danger, #ef4444)',
              borderRadius: 6,
              color: 'var(--danger, #ef4444)',
              cursor: 'pointer',
            }}
          >
            Delete
          </button>
        </div>
      </div>

      {loadingDetail ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          Loading artifact...
        </div>
      ) : (
        <div className="artifact-detail-layout" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left: Interactive content (60%) */}
          <div style={{ flex: '0 0 60%', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface-1)' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                {selected.title}
              </span>
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 11, padding: '2px 6px', background: 'var(--surface-3)', borderRadius: 4, color: 'var(--accent)', fontWeight: 500 }}>
                  {selected.file_type.toUpperCase()}
                </span>
                {selected.tags?.map((tag) => (
                  <span key={tag} style={{ fontSize: 11, padding: '2px 6px', background: 'var(--surface-2)', borderRadius: 4, color: 'var(--text-secondary)' }}>
                    {tag}
                  </span>
                ))}
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  {formatDate(selected.created_at)}
                </span>
              </div>
            </div>
            <iframe
              srcDoc={getPreviewContent(selected)}
              sandbox="allow-scripts allow-same-origin"
              style={{ flex: 1, width: '100%', border: 'none', background: '#fff', minHeight: '70vh' }}
              title="Artifact Preview"
            />
          </div>

          {/* Right: AI analysis (40%) */}
          <div style={{ flex: '0 0 40%', overflowY: 'auto', padding: 20 }}>
            {selected.ai_explanation ? (
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, marginTop: 0 }}>
                  What It Is
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 16px' }}>
                  {selected.ai_explanation.whatItIs}
                </p>

                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, marginTop: 0 }}>
                  Key Insights
                </h3>
                <ul style={{ margin: '0 0 16px', paddingLeft: 20 }}>
                  {selected.ai_explanation.keyInsights?.map((insight, i) => (
                    <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 4 }}>
                      {insight}
                    </li>
                  ))}
                </ul>

                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, marginTop: 0 }}>
                  Related Concepts
                </h3>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                  {selected.ai_explanation.relatedConcepts?.map((concept) => (
                    <span key={concept} style={{ fontSize: 12, padding: '4px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-secondary)' }}>
                      {concept}
                    </span>
                  ))}
                </div>

                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, marginTop: 0 }}>
                  Technologies Used
                </h3>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {selected.ai_explanation.technologiesUsed?.map((tech) => (
                    <span key={tech} style={{ fontSize: 12, padding: '4px 10px', background: 'var(--surface-3)', borderRadius: 12, color: 'var(--accent)', fontWeight: 500 }}>
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} style={{ marginBottom: 16 }}>
                    <div style={{ width: 120, height: 16, background: 'var(--surface-2)', borderRadius: 4, marginBottom: 8 }} />
                    <div style={{ width: '100%', height: 12, background: 'var(--surface-2)', borderRadius: 4, marginBottom: 4 }} />
                    <div style={{ width: '80%', height: 12, background: 'var(--surface-2)', borderRadius: 4 }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && renderUploadModal()}

      {/* Fullscreen Preview Modal */}
      {fullscreen && selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 200, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', background: 'var(--surface-1)' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{selected.title}</span>
            <button
              onClick={() => setFullscreen(false)}
              style={{ padding: '4px 12px', fontSize: 13, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
          <iframe
            srcDoc={getPreviewContent(selected)}
            sandbox="allow-scripts allow-same-origin"
            style={{ flex: 1, width: '100%', border: 'none', background: '#fff' }}
            title="Artifact Fullscreen Preview"
          />
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .artifact-detail-layout {
            flex-direction: column !important;
          }
          .artifact-detail-layout > div:first-child {
            flex: none !important;
            height: 50vh;
            border-right: none !important;
            border-bottom: 1px solid var(--border);
          }
          .artifact-detail-layout > div:last-child {
            flex: 1 !important;
          }
        }
      `}</style>
    </div>
  );

  // ─── Upload Modal (shared between both views) ─────────────────────────────
  function renderUploadModal() {
    return (
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
        onClick={() => !uploading && setShowUpload(false)}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, width: 560, maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto' }}
        >
          <h2 style={{ margin: '0 0 16px', fontSize: 18, color: 'var(--text-primary)' }}>Upload Artifact</h2>

          {/* Top-level tab: Paste vs Upload Files */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button
              onClick={() => setUploadTab('paste')}
              style={{ padding: '6px 14px', fontSize: 13, background: uploadTab === 'paste' ? 'var(--accent)' : 'var(--surface-2)', color: uploadTab === 'paste' ? '#fff' : 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}
            >
              Paste
            </button>
            <button
              onClick={() => setUploadTab('bulk')}
              style={{ padding: '6px 14px', fontSize: 13, background: uploadTab === 'bulk' ? 'var(--accent)' : 'var(--surface-2)', color: uploadTab === 'bulk' ? '#fff' : 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}
            >
              Upload Files
            </button>
          </div>

          {uploadTab === 'paste' ? (
            <>
              <label style={{ display: 'block', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Title *</span>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="My Cool Component"
                  style={{ width: '100%', padding: '8px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                />
              </label>

              {/* Paste/File sub-mode */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button
                  onClick={() => setUploadMode('paste')}
                  style={{ padding: '6px 14px', fontSize: 13, background: uploadMode === 'paste' ? 'var(--accent)' : 'var(--surface-2)', color: uploadMode === 'paste' ? '#fff' : 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}
                >
                  Paste Code
                </button>
                <button
                  onClick={() => setUploadMode('file')}
                  style={{ padding: '6px 14px', fontSize: 13, background: uploadMode === 'file' ? 'var(--accent)' : 'var(--surface-2)', color: uploadMode === 'file' ? '#fff' : 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}
                >
                  Upload File
                </button>
              </div>

              {uploadMode === 'paste' ? (
                <label style={{ display: 'block', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Code *</span>
                  <textarea
                    value={uploadCode}
                    onChange={(e) => setUploadCode(e.target.value)}
                    placeholder="Paste your HTML or React code here..."
                    rows={12}
                    style={{ width: '100%', padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 13, fontFamily: 'monospace', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                  />
                </label>
              ) : (
                <div style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>File *</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".html,.htm,.jsx,.tsx"
                    onChange={handleFileUpload}
                    style={{ width: '100%', padding: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }}
                  />
                  {uploadCode && (
                    <div style={{ fontSize: 12, color: 'var(--success)', marginTop: 4 }}>
                      File loaded ({uploadCode.length} characters)
                    </div>
                  )}
                </div>
              )}

              <label style={{ display: 'block', marginBottom: 20 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Tags (comma-separated)</span>
                <input
                  type="text"
                  value={uploadTags}
                  onChange={(e) => setUploadTags(e.target.value)}
                  placeholder="react, animation, dashboard"
                  style={{ width: '100%', padding: '8px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                />
              </label>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowUpload(false)}
                  disabled={uploading}
                  style={{ padding: '8px 16px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14 }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading || !uploadTitle.trim() || !uploadCode.trim()}
                  style={{ padding: '8px 16px', background: uploading || !uploadTitle.trim() || !uploadCode.trim() ? 'var(--surface-3)' : 'var(--accent)', border: 'none', borderRadius: 6, color: '#fff', cursor: uploading ? 'wait' : 'pointer', fontWeight: 600, fontSize: 14 }}
                >
                  {uploading ? 'Uploading & Analyzing...' : 'Upload & Analyze'}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Bulk file upload controls */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input ref={bulkFilesInputRef} type="file" accept=".html,.htm,.jsx,.tsx" multiple onChange={handleBulkFileSelect} style={{ display: 'none' }} />
                {/* @ts-expect-error webkitdirectory is a non-standard attribute */}
                <input ref={bulkFolderInputRef} type="file" accept=".html,.htm,.jsx,.tsx" webkitdirectory="" onChange={handleBulkFileSelect} style={{ display: 'none' }} />
                <button onClick={() => bulkFilesInputRef.current?.click()} style={{ padding: '6px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>
                  Select Files
                </button>
                <button onClick={() => bulkFolderInputRef.current?.click()} style={{ padding: '6px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>
                  Select Folder
                </button>
              </div>

              {bulkFiles.length > 0 && (
                <>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                    {bulkFiles.length} file{bulkFiles.length !== 1 ? 's' : ''} selected
                    {bulkDupeCount > 0 && (
                      <span style={{ color: 'var(--warning, #f59e0b)', marginLeft: 8 }}>
                        ({bulkNewCount} new, {bulkDupeCount} duplicate{bulkDupeCount !== 1 ? 's' : ''} skipped)
                      </span>
                    )}
                  </div>

                  <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 12 }}>
                    {bulkFiles.map((file, i) => (
                      <div
                        key={i}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: i < bulkFiles.length - 1 ? '1px solid var(--border)' : 'none', background: file.isDuplicate ? 'var(--surface-2)' : 'transparent', opacity: file.isDuplicate ? 0.6 : 1 }}
                      >
                        <input type="checkbox" checked={file.checked} disabled={file.isDuplicate} onChange={() => toggleBulkFile(i)} style={{ cursor: file.isDuplicate ? 'not-allowed' : 'pointer' }} />
                        <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.title}</span>
                        {file.isDuplicate && (
                          <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'var(--warning, #f59e0b)', color: '#000', fontWeight: 600, whiteSpace: 'nowrap' }}>Duplicate</span>
                        )}
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{(file.content.length / 1024).toFixed(1)}KB</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <label style={{ display: 'block', marginBottom: 20 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Tags for all files (comma-separated)</span>
                <input
                  type="text"
                  value={bulkTags}
                  onChange={(e) => setBulkTags(e.target.value)}
                  placeholder="react, animation, dashboard"
                  style={{ width: '100%', padding: '8px 12px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                />
              </label>

              {bulkProgress && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, color: 'var(--accent)', marginBottom: 4 }}>Uploading {bulkProgress.current}/{bulkProgress.total}...</div>
                  <div style={{ height: 4, background: 'var(--surface-3)', borderRadius: 2 }}>
                    <div style={{ height: '100%', background: 'var(--accent)', borderRadius: 2, width: `${(bulkProgress.current / bulkProgress.total) * 100}%`, transition: 'width 0.3s' }} />
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
                <button
                  onClick={() => setShowUpload(false)}
                  disabled={uploading || !!bulkProgress}
                  style={{ padding: '8px 16px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14 }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkUpload}
                  disabled={bulkNewCount === 0 || uploading || !!bulkProgress}
                  style={{ padding: '8px 16px', background: bulkNewCount === 0 || uploading ? 'var(--surface-3)' : 'var(--accent)', border: 'none', borderRadius: 6, color: '#fff', cursor: uploading ? 'wait' : 'pointer', fontWeight: 600, fontSize: 14 }}
                >
                  {bulkProgress ? `Uploading ${bulkProgress.current}/${bulkProgress.total}...` : `Upload & Analyze All (${bulkNewCount})`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }
}

// ─── Artifact Card Component ──────────────────────────────────────────────────

function ArtifactCard({ artifact, onClick, onDelete }: { artifact: ArtifactListItem; onClick: () => void; onDelete: () => void }) {
  const [hovered, setHovered] = useState(false);

  // Build a minimal HTML preview for the iframe srcdoc
  const previewHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;font-family:sans-serif;overflow:hidden}</style></head><body><div style="padding:8px;font-size:11px;color:#888">Preview not available for list items</div></body></html>`;

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
      {/* Preview thumbnail */}
      <div style={{
        height: 180,
        overflow: 'hidden',
        position: 'relative',
        background: '#1a1a1f',
        pointerEvents: 'none',
      }}>
        {/* We use a placeholder since we only have list items without file_content */}
        <div style={{
          width: '200%',
          height: '200%',
          transform: 'scale(0.5)',
          transformOrigin: 'top left',
        }}>
          <iframe
            srcDoc={previewHtml}
            sandbox=""
            style={{ width: '100%', height: '100%', border: 'none', pointerEvents: 'none' }}
            title={`Preview ${artifact.title}`}
            tabIndex={-1}
          />
        </div>
        {/* Gradient fade */}
        <div style={{
          content: '',
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {artifact.title}
            </div>
            {artifact.description && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                {artifact.description}
              </div>
            )}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px 6px', fontSize: 16, lineHeight: 1, borderRadius: 4, flexShrink: 0 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            title="Delete"
          >
            x
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, padding: '2px 6px', background: 'var(--surface-3)', borderRadius: 4, color: 'var(--accent)', fontWeight: 500 }}>
            {artifact.file_type.toUpperCase()}
          </span>
          {artifact.tags?.slice(0, 3).map((tag) => (
            <span key={tag} style={{ fontSize: 11, padding: '2px 6px', background: 'var(--surface-2)', borderRadius: 4, color: 'var(--text-secondary)' }}>
              {tag}
            </span>
          ))}
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
            {formatDate(artifact.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
}
