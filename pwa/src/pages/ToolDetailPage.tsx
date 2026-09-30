import { Hammer, SquarePen } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { TOOL_TYPE_LABELS } from '../../shared/model';
import { InfoRow, Linkified, Section } from '../components/Fields';
import { PageHeader } from '../components/PageHeader';
import { PhotoGrid, PhotoViewer } from '../components/Photos';
import { EmptyState, ErrorState, PageSpinner } from '../components/States';
import { photoUrl } from '../lib/api';
import { lastTab } from '../lib/navigation';
import { useToolList } from '../lib/queries';

export function ToolDetailPage() {
  const { id } = useParams();
  const list = useToolList();
  const [viewer, setViewer] = useState<number | null>(null);
  const tool = list.data?.find((t) => t.id === id);
  const back = lastTab();

  if (!tool) {
    return (
      <>
        <PageHeader title="Strumento" back={back} />
        <div className="page-content">
          {list.isPending ? (
            <PageSpinner />
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => void list.refetch()} />
          ) : (
            <EmptyState icon={Hammer} title="Strumento non trovato" text="Potrebbe essere stato eliminato.">
              <Link to={back} className="btn btn-secondary">
                Torna all’elenco
              </Link>
            </EmptyState>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={tool.name}
        back={back}
        right={
          <Link to={`/strumenti/${tool.id}/modifica`} className="icon-button" aria-label="Modifica strumento">
            <SquarePen size={22} aria-hidden="true" />
          </Link>
        }
      />
      <div className="page-content">
        {tool.photos[0] && (
          <button type="button" className="cover" onClick={() => setViewer(0)} aria-label="Apri le foto">
            <img src={photoUrl(tool.photos[0].id)} alt={tool.name} />
          </button>
        )}
        <div className="detail-heading">
          <h2>{tool.name}</h2>
          <span className="chip">{TOOL_TYPE_LABELS[tool.type]}</span>
        </div>

        <Section title="Descrizione">
          <InfoRow label="Tipologia" value={TOOL_TYPE_LABELS[tool.type]} />
          <InfoRow label="Genere" value={tool.genre} />
          <InfoRow label="Venditore" value={tool.seller} />
          <InfoRow label="Prezzo" value={tool.price} />
        </Section>

        <Section title="Link">
          {tool.links ? <div className="card-text"><Linkified text={tool.links} /></div> : <p className="card-text muted">Nessun link.</p>}
        </Section>

        <Section title="Dettagli">
          {tool.details ? <p className="card-text prewrap">{tool.details}</p> : <p className="card-text muted">Nessun dettaglio.</p>}
        </Section>

        <Section title="Foto">
          {tool.photos.length ? (
            <PhotoGrid photos={tool.photos} onOpen={setViewer} />
          ) : (
            <p className="card-text muted">
              Nessuna foto. <Link to={`/strumenti/${tool.id}/modifica`}>Aggiungine una</Link>.
            </p>
          )}
        </Section>
      </div>
      {viewer !== null && <PhotoViewer photos={tool.photos} index={viewer} onClose={() => setViewer(null)} />}
    </>
  );
}
