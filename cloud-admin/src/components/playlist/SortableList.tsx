'use client';

import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { PlaylistItem } from '@non-turn/shared';
import { PlaylistItemCard } from './PlaylistItem';

interface SortableItemProps {
  item: PlaylistItem;
  onDelete: (id: string) => void;
}

function SortableItem({ item, onDelete }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <PlaylistItemCard
        item={item}
        onDelete={onDelete}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={false}
      />
    </div>
  );
}

interface SortableListProps {
  items: PlaylistItem[];
  onReorder: (items: PlaylistItem[]) => void;
  onDelete: (id: string) => void;
}

export function SortableList({ items, onReorder, onDelete }: SortableListProps) {
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      const reordered = arrayMove(items, oldIndex, newIndex).map((item, index) => ({
        ...item,
        position: index + 1,
      }));

      onReorder(reordered);
    }
  };

  const activeItem = activeId ? items.find((item) => item.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {items.map((item) => (
            <SortableItem key={item.id} item={item} onDelete={onDelete} />
          ))}
        </div>
      </SortableContext>

      {/* Drag overlay shows a "ghost" of the dragged item */}
      <DragOverlay>
        {activeItem ? (
          <PlaylistItemCard
            item={activeItem}
            onDelete={() => {}}
            isDragging={true}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
