import type { CourseRow } from "@/lib/pptx";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Manifest identifiers must not start with a digit per the SCORM 1.2 spec. */
function safeIdentifier(courseId: string): string {
  return `HAZWOPER_${courseId.replace(/-/g, "_")}`;
}

export function renderManifest(course: CourseRow, imageFileNames: string[]): string {
  const orgId = safeIdentifier(course.id);
  const title = escapeXml(course.name);

  const imageFiles = imageFileNames
    .map((name) => `      <file href="images/${escapeXml(name)}"/>`)
    .join("\n");

  return `<?xml version="1.0" standalone="no" ?>
<manifest identifier="${orgId}" version="1.2"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="${orgId}_ORG">
    <organization identifier="${orgId}_ORG">
      <title>${title}</title>
      <item identifier="${orgId}_ITEM" identifierref="${orgId}_RES" isvisible="true">
        <title>${title}</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="${orgId}_RES" type="webcontent" adlcp:scormtype="sco" href="viewer.html">
      <file href="viewer.html"/>
      <file href="viewer.js"/>
      <file href="viewer.css"/>
      <file href="scorm-api.js"/>
      <file href="slides.json"/>
      <file href="brand-logo.png"/>
${imageFiles}
    </resource>
  </resources>
</manifest>
`;
}
