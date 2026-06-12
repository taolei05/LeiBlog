export function moveOrderedItem(ids: string[], id: string, delta: -1 | 1) {
  const index = ids.indexOf(id);
  const nextIndex = index + delta;
  if (index < 0 || nextIndex < 0 || nextIndex >= ids.length) return [...ids];

  const nextIds = [...ids];
  const [item] = nextIds.splice(index, 1);
  nextIds.splice(nextIndex, 0, item);
  return nextIds;
}

export function reorderByDrop(ids: string[], draggedId: string, targetId: string) {
  if (draggedId === targetId || !ids.includes(draggedId) || !ids.includes(targetId)) {
    return [...ids];
  }

  const nextIds = ids.filter((id) => id !== draggedId);
  const targetIndex = nextIds.indexOf(targetId);
  nextIds.splice(targetIndex + 1, 0, draggedId);
  return nextIds;
}

export async function persistOptimisticOrder(
  previousIds: string[],
  nextIds: string[],
  apply: (ids: string[]) => void,
  persist: (ids: string[]) => Promise<unknown>,
) {
  apply(nextIds);

  try {
    await persist(nextIds);
  } catch (error) {
    apply(previousIds);
    throw error;
  }
}
