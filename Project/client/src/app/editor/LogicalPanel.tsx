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

export function LogicalPanel({
  logical,
  onSetType,
}: {
  logical: LogicalModel
  onSetType: (payload: { tableId: TableId; columnId: ColumnId; dataType: ColumnType }) => void
}) {
  return (
    <div
      className={logical.tables.length === 0 ? 'logical-panel' : 'logical-panel has-tables'}
      role="region"
      aria-label="Modelo lógico"
    >
      <p className="logical-panel-version">Versión lógica v{logical.logicalVersion}</p>
      {logical.tables.length === 0 ? (
        <p className="logical-empty" role="status">
          Aún no hay tablas. Transforma el modelo conceptual para generar el esquema lógico.
        </p>
      ) : (
        <div className="logical-table-list">
        {logical.tables.map((table) => (
          <section
            key={table.id}
            className="logical-table-card"
            data-testid={`logical-table-${table.name}`}
          >
            <header className="logical-table-header">
              <span className="logical-table-name">{table.name}</span>
              <span className="logical-table-source" title={`Regla ${table.source.rule}`}>
                {table.source.rule}
              </span>
            </header>
            <ul className="logical-column-list">
              {table.columns.map((column) => {
                const isPrimaryKey = table.primaryKey.includes(column.id)
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
                        onSetType({ tableId: table.id, columnId: column.id, dataType })
                      }
                    />
                    <span className="logical-column-trace" title={column.derivedFrom}>{column.derivedFrom}</span>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
        </div>
      )}
    </div>
  )
}