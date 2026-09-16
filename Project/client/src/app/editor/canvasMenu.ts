import type { ConceptualModel, NodeId } from '@erd-studio/shared'

export type AlignEdge = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom'
export type DistributeAxis = 'horizontal' | 'vertical'

export type ContextMenuAction = {
  id: string
  label: string
  disabled?: boolean
  separatorBefore?: boolean
  onSelect: () => void
}

export type CanvasMenuHandlers = {
  onCreateEntity: () => void
  onCreateRelation: () => void
  onSelectAll: () => void
  onRename: () => void
  onDuplicate: () => void
  onCopy: () => void
  onCut: () => void
  onPaste: () => void
  onAlign: (edge: AlignEdge) => void
  onDistribute: (axis: DistributeAxis) => void
  onDelete: () => void
}

export type CanvasMenuOptions = {
  model: ConceptualModel
  selection: ReadonlySet<NodeId>
  canPaste: boolean
  handlers: CanvasMenuHandlers
}

const ALIGN_ITEMS: { id: string; label: string; edge: AlignEdge }[] = [
  { id: 'align-left', label: 'Alinear izquierda', edge: 'left' },
  { id: 'align-center', label: 'Alinear centro', edge: 'hcenter' },
  { id: 'align-right', label: 'Alinear derecha', edge: 'right' },
]

const DISTRIBUTE_ITEMS: { id: string; label: string; axis: DistributeAxis }[] = [
  { id: 'distribute-vertical', label: 'Distribuir vertical', axis: 'vertical' },
  { id: 'distribute-horizontal', label: 'Distribuir horizontal', axis: 'horizontal' },
]

/**
 * Construye los items del menú contextual del canvas según la selección.
 * Puro y determinista: la UI solo ejecuta los handlers.
 */
export function buildCanvasMenu(options: CanvasMenuOptions): ContextMenuAction[] {
  const { model, selection, canPaste, handlers } = options
  const count = selection.size

  const singleId = count === 1 ? [...selection][0] : undefined
  const singleEntity = singleId !== undefined ? model.entities.find((e) => e.id === singleId) : undefined
  const singleAttribute = singleId !== undefined ? model.attributes.find((a) => a.id === singleId) : undefined
  const singleRelationship = singleId !== undefined
    ? model.relationships.find((r) => r.id === singleId)
    : undefined

  const actions: ContextMenuAction[] = []

  const pasteItem = (): ContextMenuAction => ({
    id: 'paste',
    label: 'Pegar',
    disabled: !canPaste,
    separatorBefore: true,
    onSelect: handlers.onPaste,
  })

  if (count === 0) {
    actions.push(
      { id: 'create-entity', label: 'Nueva entidad', onSelect: handlers.onCreateEntity },
      { id: 'create-relation', label: 'Nueva relación', disabled: true, onSelect: handlers.onCreateRelation },
      { id: 'select-all', label: 'Seleccionar todo', separatorBefore: true, onSelect: handlers.onSelectAll },
    )
    actions.push(pasteItem())
    return actions
  }

  if (count === 1) {
    const renameable = singleEntity !== undefined || singleAttribute !== undefined || singleRelationship !== undefined
    actions.push(
      { id: 'rename', label: 'Renombrar', disabled: !renameable, onSelect: handlers.onRename },
      { id: 'duplicate', label: 'Duplicar', disabled: singleEntity === undefined, onSelect: handlers.onDuplicate },
      { id: 'copy', label: 'Copiar', separatorBefore: true, onSelect: handlers.onCopy },
      { id: 'cut', label: 'Cortar', onSelect: handlers.onCut },
    )
    for (const item of ALIGN_ITEMS) {
      actions.push({ id: item.id, label: item.label, disabled: true, onSelect: () => handlers.onAlign(item.edge) })
    }
    actions.push(
      { id: 'delete', label: 'Eliminar', separatorBefore: true, onSelect: handlers.onDelete },
    )
    actions.push(pasteItem())
    return actions
  }

  actions.push({ id: 'copy', label: 'Copiar', separatorBefore: true, onSelect: handlers.onCopy })
  actions.push({ id: 'cut', label: 'Cortar', onSelect: handlers.onCut })
  for (const item of ALIGN_ITEMS) {
    actions.push({
      id: item.id,
      label: item.label,
      separatorBefore: true,
      onSelect: () => handlers.onAlign(item.edge),
    })
  }
  for (const item of DISTRIBUTE_ITEMS) {
    actions.push({ id: item.id, label: item.label, onSelect: () => handlers.onDistribute(item.axis) })
  }
  actions.push({ id: 'delete', label: 'Eliminar', separatorBefore: true, onSelect: handlers.onDelete })
  actions.push(pasteItem())
  return actions
}