type Link = {
  href: string;
  rel: string;
  type?: string;
  title?: string;
};

type SpatialExtent = {
  description?: string;
  bbox: number[];
  crs: string;
};

type TemporalExtent = {
  description?: string;
  interval: string[];
  trs: string;
};

type Extent = {
  description?: string;
  spatial?: SpatialExtent;
  temporal?: TemporalExtent;
};

type Collection = {
  id: string;
  title?: string;
  description?: string;
  links: Link;
  extent?: Extent;
  itemType?: string;
  crs?: string[];
};

type Collections = {
  links: Link[];
  collections: Collection[];
};

export { Link, Collection, Collections };
