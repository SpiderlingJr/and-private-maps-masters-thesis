type Conformance = {
  conformsTo: string[];
};

const conformanceLinks = [
  "todo",
  "compare to https://app.swaggerhub.com/apis/OGC/ogcapi-features-1-example-1/1.0.1#/Capabilities/getConformanceDeclaration",
];

const conformance: Conformance = { conformsTo: conformanceLinks };

export default conformance;
