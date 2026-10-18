import type { LocationKind } from '@thedex/db';
import type { IconName } from '../../shared/ui/Icon';

/** Icon of each Location Dex group (RF06.1). */
export const LOCATION_KIND_ICONS: Readonly<Record<LocationKind, IconName>> = {
  city: 'home-city',
  route: 'road-variant',
  cave: 'image-filter-hdr',
  water: 'waves',
  building: 'office-building',
  area: 'pine-tree',
};
