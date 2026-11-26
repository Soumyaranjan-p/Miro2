import { formatBytes } from "../../app/format";
import { useModel } from "../../app/model";
import { FileIcon, FolderIcon } from "../../ui/icons";
import { EmptyState } from "./EmptyState";

export function ShelfPage() {
  const { snapshot } = useModel();
  const items = snapshot.shelf.slice(0, 3);

  if (items.length === 0) {
    return (
      <EmptyState
        title="Shelf is empty"
        hint="Drag files onto the notch to keep them close."
      />
    );
  }

  return (
    <div className="page shelf-page">
      <ul className="shelf-list">
        {items.map((item) => (
          <li key={item.id} className="shelf-row" title={item.path}>
            <span className="shelf-icon" aria-hidden="true">
              {item.isDir ? <FolderIcon /> : <FileIcon />}
            </span>
            <span className="shelf-name t-body">{item.name}</span>
            <span className="shelf-meta t-meta tnum">
              {formatBytes(item.sizeBytes)}
            </span>
          </li>
        ))}
      </ul>

      {snapshot.shelf.length > items.length ? (
        <p className="t-meta shelf-more">
          +{snapshot.shelf.length - items.length} more
        </p>
      ) : null}
    </div>
  );
}
