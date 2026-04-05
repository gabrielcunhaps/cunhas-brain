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

  // Upload form state
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCode, setUploadCode] = useState('');
  const [uploadTags, setUploadTags] = useState('');
  const [uploadMode, setUploadMode] = useState<'paste' | 'file'>('paste');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const filtered = artifacts.filter((a) =>
    a.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="artifacts-layout" style={{ display: 'flex', height: '100%', background: 'var(--bg)' }}>
      {/* Left Panel */}
      <div
        style={{
          width: '350px',
          minWidth: '350px',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
          <button
            onClick={() => setShowUpload(true)}
            style={{
              width: '100%',
              padding: '10px',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              marginBottom: '12px',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--accent)')}
          >
            + Upload Artifact
          </button>
          <input
            type="text"
            placeholder="Search artifacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Artifacts List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
              {search ? 'No matching artifacts' : 'No artifacts yet'}
            </div>
          ) : (
            filtered.map((artifact) => (
              <div
                key={artifact.id}
                onClick={() => selectArtifact(artifact.id)}
                style={{
                  padding: '12px',
                  marginBottom: '6px',
                  background: selected?.id === artifact.id ? 'var(--surface-2)' : 'var(--surface-1)',
                  border: `1px solid ${selected?.id === artifact.id ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: '14px',
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {artifact.title}
                    </div>
                    {artifact.description && (
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--text-muted)',
                          marginTop: '4px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {artifact.description}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteArtifact(artifact.id);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '2px 6px',
                      fontSize: '16px',
                      lineHeight: 1,
                      borderRadius: '4px',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                    title="Delete"
                  >
                    x
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '2px 6px',
                      background: 'var(--surface-3)',
                      borderRadius: '4px',
                      color: 'var(--accent)',
                      fontWeight: 500,
                    }}
                  >
                    {artifact.file_type.toUpperCase()}
                  </span>
                  {artifact.tags?.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: '11px',
                        padding: '2px 6px',
                        background: 'var(--surface-2)',
                        borderRadius: '4px',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    {formatDate(artifact.created_at)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {loadingDetail ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
            }}
          >
            Loading artifact...
          </div>
        ) : !selected ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: '15px',
            }}
          >
            Select an artifact to preview
          </div>
        ) : (
          <>
            {/* Live Preview */}
            <div
              style={{
                flex: '0 0 60%',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
              }}
            >
              <div
                style={{
                  padding: '8px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px solid var(--border)',
                  background: 'var(--surface-1)',
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Live Preview — {selected.title}
                </span>
                <button
                  onClick={() => setFullscreen(true)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  Open Full Screen
                </button>
              </div>
              <iframe
                srcDoc={getPreviewContent(selected)}
                sandbox="allow-scripts allow-same-origin"
                style={{
                  flex: 1,
                  width: '100%',
                  border: 'none',
                  background: '#fff',
                }}
                title="Artifact Preview"
              />
            </div>

            {/* AI Explanation */}
            <div style={{ flex: '0 0 40%', overflowY: 'auto', padding: '16px' }}>
              {selected.ai_explanation ? (
                <div>
                  <h3
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginBottom: '8px',
                      marginTop: 0,
                    }}
                  >
                    What It Is
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 16px' }}>
                    {selected.ai_explanation.whatItIs}
                  </p>

                  <h3
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginBottom: '8px',
                      marginTop: 0,
                    }}
                  >
                    Key Insights
                  </h3>
                  <ul style={{ margin: '0 0 16px', paddingLeft: '20px' }}>
                    {selected.ai_explanation.keyInsights?.map((insight, i) => (
                      <li
                        key={i}
                        style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '4px' }}
                      >
                        {insight}
                      </li>
                    ))}
                  </ul>

                  <h3
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginBottom: '8px',
                      marginTop: 0,
                    }}
                  >
                    Related Concepts
                  </h3>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
                    {selected.ai_explanation.relatedConcepts?.map((concept) => (
                      <span
                        key={concept}
                        style={{
                          fontSize: '12px',
                          padding: '4px 10px',
                          background: 'var(--surface-2)',
                          border: '1px solid var(--border)',
                          borderRadius: '12px',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {concept}
                      </span>
                    ))}
                  </div>

                  <h3
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginBottom: '8px',
                      marginTop: 0,
                    }}
                  >
                    Technologies Used
                  </h3>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {selected.ai_explanation.technologiesUsed?.map((tech) => (
                      <span
                        key={tech}
                        style={{
                          fontSize: '12px',
                          padding: '4px 10px',
                          background: 'var(--surface-3)',
                          borderRadius: '12px',
                          color: 'var(--accent)',
                          fontWeight: 500,
                        }}
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  {/* Loading skeleton */}
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} style={{ marginBottom: '16px' }}>
                      <div
                        style={{
                          width: '120px',
                          height: '16px',
                          background: 'var(--surface-2)',
                          borderRadius: '4px',
                          marginBottom: '8px',
                        }}
                      />
                      <div
                        style={{
                          width: '100%',
                          height: '12px',
                          background: 'var(--surface-2)',
                          borderRadius: '4px',
                          marginBottom: '4px',
                        }}
                      />
                      <div
                        style={{
                          width: '80%',
                          height: '12px',
                          background: 'var(--surface-2)',
                          borderRadius: '4px',
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
          onClick={() => !uploading && setShowUpload(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '24px',
              width: '560px',
              maxWidth: '90vw',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
          >
            <h2 style={{ margin: '0 0 20px', fontSize: '18px', color: 'var(--text-primary)' }}>
              Upload Artifact
            </h2>

            <label style={{ display: 'block', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Title *
              </span>
              <input
                type="text"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="My Cool Component"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </label>

            {/* Mode Toggle */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <button
                onClick={() => setUploadMode('paste')}
                style={{
                  padding: '6px 14px',
                  fontSize: '13px',
                  background: uploadMode === 'paste' ? 'var(--accent)' : 'var(--surface-2)',
                  color: uploadMode === 'paste' ? '#fff' : 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Paste Code
              </button>
              <button
                onClick={() => setUploadMode('file')}
                style={{
                  padding: '6px 14px',
                  fontSize: '13px',
                  background: uploadMode === 'file' ? 'var(--accent)' : 'var(--surface-2)',
                  color: uploadMode === 'file' ? '#fff' : 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Upload File
              </button>
            </div>

            {uploadMode === 'paste' ? (
              <label style={{ display: 'block', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Code *
                </span>
                <textarea
                  value={uploadCode}
                  onChange={(e) => setUploadCode(e.target.value)}
                  placeholder="Paste your HTML or React code here..."
                  rows={12}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </label>
            ) : (
              <div style={{ marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  File *
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".html,.htm,.jsx,.tsx"
                  onChange={handleFileUpload}
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
                {uploadCode && (
                  <div style={{ fontSize: '12px', color: 'var(--success)', marginTop: '4px' }}>
                    File loaded ({uploadCode.length} characters)
                  </div>
                )}
              </div>
            )}

            <label style={{ display: 'block', marginBottom: '20px' }}>
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Tags (comma-separated)
              </span>
              <input
                type="text"
                value={uploadTags}
                onChange={(e) => setUploadTags(e.target.value)}
                placeholder="react, animation, dashboard"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </label>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowUpload(false)}
                disabled={uploading}
                style={{
                  padding: '8px 16px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !uploadTitle.trim() || !uploadCode.trim()}
                style={{
                  padding: '8px 16px',
                  background: uploading || !uploadTitle.trim() || !uploadCode.trim() ? 'var(--surface-3)' : 'var(--accent)',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#fff',
                  cursor: uploading ? 'wait' : 'pointer',
                  fontWeight: 600,
                  fontSize: '14px',
                }}
              >
                {uploading ? 'Uploading & Analyzing...' : 'Upload & Analyze'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Preview Modal */}
      {fullscreen && selected && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--bg)',
            zIndex: 200,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '8px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface-1)',
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {selected.title}
            </span>
            <button
              onClick={() => setFullscreen(false)}
              style={{
                padding: '4px 12px',
                fontSize: '13px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
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

      {/* Responsive: mobile stacking via media query in a style tag */}
      <style>{`
        @media (max-width: 768px) {
          .artifacts-layout {
            flex-direction: column !important;
          }
          .artifacts-layout > div:first-child {
            width: 100% !important;
            min-width: 100% !important;
            max-height: 40vh;
            border-right: none !important;
            border-bottom: 1px solid var(--border);
          }
        }
      `}</style>
    </div>
  );
}
