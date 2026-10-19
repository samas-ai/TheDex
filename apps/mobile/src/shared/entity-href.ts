import type { Href } from 'expo-router';
import type { SearchEntityType } from '@thedex/db';

/** Where an entity opens: a search hit, a favorite. */
export function entityHref(entityType: SearchEntityType, entityId: number): Href {
  switch (entityType) {
    case 'pokemon':
      return `/pokemon/${entityId}`;
    case 'move':
      return `/move/${entityId}`;
    case 'ability':
      return `/ability/${entityId}`;
    case 'item':
      return `/item/${entityId}`;
    case 'location':
      return `/location/${entityId}`;
    case 'type':
      return `/types?type=${entityId}`;
    case 'nature':
      return '/natures';
  }
}
