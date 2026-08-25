export default function AdminLoading() {
  return (
    <div className="prumo-page" aria-busy="true" aria-label="Carregando conteúdo">
      <div className="prumo-page-inner space-y-5">
        <div className="h-8 w-56 animate-pulse rounded bg-bg-2" />
        <div className="prumo-panel overflow-hidden">
          <div className="h-11 animate-pulse border-b border-brd-0 bg-bg-2" />
          {[1, 2, 3, 4, 5].map(row => <div key={row} className="h-16 animate-pulse border-b border-brd-0 bg-bg-1 last:border-0" />)}
        </div>
      </div>
    </div>
  );
}
