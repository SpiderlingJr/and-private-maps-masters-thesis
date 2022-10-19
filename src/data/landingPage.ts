import { Link } from "../types/ogc.js";

const mimeTypes = {
  json: "application/json",
  htmlText: "html/text",
};

export const linkRoot: Link = {
  href: "/",
  rel: "self",
  type: mimeTypes.json,
  title: "this document",
};
export const linkConformance: Link = {
  href: "/conformance",
  rel: "conformance",
  type: mimeTypes.json,
  title: "OGC API conformance classes implemented by this server",
};

export const linkCollections: Link = {
  href: "/collections",
  rel: "data",
  type: mimeTypes.json,
  title: "Information about feature collections",
};

export const linkCollectionsByCollectionId: Link = {
  href: "/collections/<collection_id>",
  rel: "data",
  type: mimeTypes.json,
  title: "Features in requested Collection",
};
export const linkFeatureByCollectionAndFeatureId: Link = {
  href: "/collections/<collection_id>/items/<feature_id>",
  rel: "data",
  type: mimeTypes.json,
  title: "Feature in requested Collection with requested Feature Id.",
};

const links = [
  linkRoot,
  linkConformance,
  linkCollections,
  linkCollectionsByCollectionId,
  linkFeatureByCollectionAndFeatureId,
];

export default links;
