import { Link } from "../types/ogc.js";

const selfLink: Link = {
  href: "/collections",
  rel: "self",
  type: "application/json",
  title: "this document",
};

const collectionLinks = [selfLink];

export default collectionLinks;
