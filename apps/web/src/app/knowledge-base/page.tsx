export default function KnowledgeBasePage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-text-primary mb-2">Knowledge Base</h1>
      <p className="text-sm text-text-muted mb-8">Upload documents and manage your knowledge base</p>
      <div className="p-12 rounded-xl bg-bg-secondary border border-border text-center">
        <p className="text-text-muted">No documents yet</p>
        <p className="text-sm text-text-muted mt-1">Upload PDFs, DOCX, or add notes to build your knowledge base</p>
      </div>
    </div>
  );
}
