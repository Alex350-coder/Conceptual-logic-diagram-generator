import { DATA_TYPES, UNDEFINED_TYPE } from '@erd-studio/shared'
import type { ColumnId, ColumnType, LogicalModel, TableId } from '@erd-studio/shared'

export const TYPE_OPTIONS: readonly ColumnType[] = [...DATA_TYPES, UNDEFINED_TYPE]

export function typeLabel(type: ColumnType): string {
  return type === UNDEFINED_TYPE ? 'No definido' : type
}

function TypeSelector({
  value,
  onChange,
}: {
  value: ColumnType
  onChange: (type: ColumnType) => void
}) {
  return (
    <select
      className="logical-type-select"
      value={value}
      aria-label="Tipo de columna"
      onChange={(event) => onChange(event.target.value as ColumnType)}
    >
      {TYPE_OPTIONS.map((type) => (
        <option key={type} value={type}>
          {typeLabel(type)}
        </option>
      ))}
    </select>
  )
}

const EMPTY_HINT = 'Aún no hay tablas. Transforma el modelo conceptual para generar el esquema lógico.'
const SELECT_HINT = 'Selecciona una tabla en el lienzo para ver y editar sus columnas'

/**
 * Panel lateral del modo Lógico (P10): muestra las columnas de la tabla
 * seleccionada y permite completar tipos. La region ARIA "Modelo lógico" vive en
 * el contenedor `.logical-layout` (EditorPage), no aqui.
 */
export function LogicalPanel({
  logical,
  selectedTable,
  onSelectTable,
  onSetType,
}: {
  logical: LogicalModel
  selectedTable: TableId | null
  onSelectTable: (tableId: TableId) => void
  onSetType: (payload: { tableId: TableId; columnId: ColumnId; dataType: ColumnType }) => void
}) {
  const selected =
    selectedTable === null ? undefined : logical.tables.find((t) => t.id === selectedTable)

  return (
    <aside className="logical-panel">
      <p className="logical-panel-version">Versión lógica v{logical.logicalVersion}</p>
      {logical.tables.length === 0 ? (
        <p className="logical-empty" role="status">
          {EMPTY_HINT}
        </p>
      ) : (
        <>
          <ul className="logical-table-tabs" aria-label="Tablas lógicas">
            {logical.tables.map((table) => (
              <li key={table.id}>
                <button
                  type="button"
                  className="logical-table-tab"
                  data-testid={`logical-table-tab-${table.name}`}
                  aria-pressed={table.id === selected?.id}
                  onClick={() => onSelectTable(table.id)}
                >
                  {table.name}
                </button>
              </li>
            ))}
          </ul>
          {selected === undefined ? (
            <p className="logical-panel-hint" role="status">
              {SELECT_HINT}
            </p>
          ) : (
            <section
              className="logical-table-card"
              data-testid={`logical-table-${selected.name}`}
            >
              <header className="logical-table-header">
                <span className="logical-table-name">{selected.name}</span>
                <span className="logical-table-source" title={`Regla ${selected.source.rule}`}>
                  {selected.source.rule}
                </span>
              </header>
              <ul className="logical-column-list">
                {selected.columns.map((column) => {
                  const isPrimaryKey = selected.primaryKey.includes(column.id)
                  return (
                    <li
                      key={column.id}
                      className={`logical-column-row${isPrimaryKey ? ' is-pk' : ''}`}
                      data-testid={`logical-column-${column.name}`}
                    >
                      <span className="logical-column-name" title={column.derivedFrom}>
                        {column.name}
                      </span>
                      {isPrimaryKey ? (
                        <span className="logical-column-pk" aria-label="Clave primaria">
                          PK
                        </span>
                      ) : null}
                      <TypeSelector
                        value={column.dataType}
                        onChange={(dataType) =>
                          onSetType({ tableId: selected.id, columnId: column.id, dataType })
                        }
                      />
                      <span className="logical-column-trace" title={column.derivedFrom}>
                        {column.derivedFrom}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </aside>
  )
}